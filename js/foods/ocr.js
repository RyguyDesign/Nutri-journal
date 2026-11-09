// On-device text recognition for label photos, using Tesseract.js.
// Free and private: the photo never leaves the phone. The recogniser
// (~15 MB for German + English) is downloaded on first use and cached by
// the browser, after which it works offline.

import { parseLabelText } from './label-parse.js';

// Lines that hold a nutrient value (German and English labels)
const NUTRIENT_LINE = /energ|brennwert|kcal|kj|fett|fat|kohlen|carbo|eiwei|protein|zucker|sugar|salz|salt|ballast|fib/i;

const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let loader;

function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_SRC;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => (globalThis.Tesseract ? resolve(globalThis.Tesseract) : reject(new Error('download')));
    s.onerror = () => {
      loader = null;
      s.remove();
      reject(new Error('download'));
    };
    document.head.append(s);
  });
  return loader;
}

/**
 * Prepare a photo for recognition: respect EXIF rotation, scale to a
 * workable size, convert to greyscale and stretch contrast.
 */
async function preprocess(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const longest = Math.max(bmp.width, bmp.height);
  const scale = Math.min(1, 2200 / longest) * (longest < 1000 ? 2 : 1);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) * 255) / range;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Recognise text in a label photo.
 * onProgress({ stage: 'loading' | 'reading', progress: 0..1 })
 * Throws Error('download') if the recogniser can't be fetched.
 */
export async function recognizeLabel(file, onProgress = () => {}) {
  onProgress({ stage: 'loading', progress: 0 });
  const [T, prepared] = await Promise.all([loadTesseract(), preprocess(file)]);
  let canvas = prepared;
  let worker;
  try {
    worker = await T.createWorker(['deu', 'eng'], 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress({ stage: 'reading', progress: m.progress || 0 });
        else onProgress({ stage: 'loading', progress: m.progress || 0 });
      },
    });
  } catch (err) {
    throw new Error('download', { cause: err });
  }
  try {
    // 0. Straighten a tilted photo: Tesseract measures the skew, and the
    //    rest is read from a straightened copy so value boxes line up.
    await worker.setParameters({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' });
    const probe = await worker.recognize(canvas, { rotateAuto: true });
    const angle = probe.data.rotateRadians || 0;
    if (Math.abs(angle) > 0.005) canvas = rotateCanvas(canvas, angle);
    // 1. Read the table as one block (page mode 6), which keeps each
    //    nutrient's name and value on one line.
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', tessedit_char_whitelist: '' });
    const { data } = await worker.recognize(canvas);
    const first = data.text || '';
    // 2. Re-read just the value part of each nutrient line, limited to
    //    digits and units: far fewer misread numbers ("7,5 g" was "79509").
    const lines = (data.lines || []).filter((ln) => NUTRIENT_LINE.test(ln.text) && (ln.words || []).length >= 2);
    let refined = '';
    if (lines.length) {
      onProgress({ stage: 'checking', progress: 0 });
      await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789,.<gmkJcal/ ' });
      const out = [];
      for (const [i, ln] of lines.entries()) {
        const words = ln.words;
        let k = words.findIndex((w, j) => j > 0 && /\d/.test(w.text));
        if (k < 0) k = words.length - 1;
        const x0 = Math.max(0, words[k].bbox.x0 - 10);
        const rectangle = {
          left: x0,
          top: Math.max(0, ln.bbox.y0 - 6),
          width: Math.min(canvas.width - x0, ln.bbox.x1 - x0 + 16),
          height: Math.min(canvas.height, ln.bbox.y1 - ln.bbox.y0 + 12),
        };
        const name = words.slice(0, k).map((w) => w.text).join(' ');
        const value = ((await worker.recognize(canvas, { rectangle })).data.text || '').trim();
        // Only keep values that look like an amount; otherwise the plain
        // reading below is used for this nutrient
        if (/^<?\s*\d{1,4}([.,]\d{1,3})?\s*(g|mg|9|kj|kcal)?(\s*\/\s*\d{1,4}\s*(kcal)?)?\s*\S{0,2}$/i.test(value) || /kj|kcal/i.test(value)) out.push(`${name} ${value}`);
        onProgress({ stage: 'checking', progress: (i + 1) / lines.length });
      }
      // keep the heading lines ("pro 100 g") from the first reading
      refined = `${first.split('\n').filter((l) => !NUTRIENT_LINE.test(l)).join('\n')}\n${out.join('\n')}`;
    }
    // The parser takes the first match for each nutrient: refined values
    // first, then the plain reading for anything the refinement missed.
    const combined = refined ? `${refined}\n${first}` : first;
    if (!parseLabelText(combined).missing.length) return combined;
    // 3. Still missing something: read once more with automatic layout.
    await worker.setParameters({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' });
    const second = (await worker.recognize(canvas)).data.text || '';
    return `${combined}\n${second}`;
  } finally {
    worker.terminate();
  }
}

/** A copy of the canvas rotated by `angle` (radians; Tesseract's correction), on white. */
function rotateCanvas(src, angle) {
  const c = document.createElement('canvas');
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  c.width = Math.round(src.width * cos + src.height * sin);
  c.height = Math.round(src.width * sin + src.height * cos);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}
