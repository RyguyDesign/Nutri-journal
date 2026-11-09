// On-device text recognition for label photos, using Tesseract.js.
// Free and private: the photo never leaves the phone. The recogniser
// (~15 MB for German + English) is downloaded on first use and cached by
// the browser, after which it works offline.

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
  const [T, canvas] = await Promise.all([loadTesseract(), preprocess(file)]);
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
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    worker.terminate();
  }
}
