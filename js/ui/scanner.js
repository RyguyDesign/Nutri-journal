// Full-screen barcode scanner. Uses the browser's built-in BarcodeDetector
// (Chrome on Android); elsewhere only manual entry is offered.
import { h } from './dom.js';
import { t } from '../i18n/i18n.js';
import { isValidBarcode } from '../foods/off.js';

const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Opens the scanner. Resolves to a barcode string, or null if closed. */
export function scanBarcode() {
  return new Promise((resolve) => {
    let stream;
    let stopped = false;
    let timer;

    const msg = h('p', { class: 'scan-msg' }, t('scan.hint'));
    const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
    const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': t('scan.manual'), placeholder: '4008400401621' });
    const form = h(
      'form',
      { class: 'scan-manual' },
      h('label', {}, t('scan.manual')),
      h('div', { class: 'row' }, input, h('button', { class: 'btn primary', type: 'submit' }, t('scan.lookup'))),
    );
    const overlay = h(
      'div',
      { class: 'scan-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('scan.title') },
      h('div', { class: 'scan-top' }, h('strong', {}, t('scan.title')), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onclick: () => finish(null) }, '×')),
      h('div', { class: 'scan-view' }, video, h('div', { class: 'scan-frame', 'aria-hidden': 'true' })),
      msg,
      form,
    );

    function finish(code) {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(code);
    }
    const onKey = (e) => e.key === 'Escape' && finish(null);
    document.addEventListener('keydown', onKey);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = input.value.replace(/\D/g, '');
      if (!isValidBarcode(code)) {
        msg.textContent = t('scan.invalid');
        msg.classList.add('err');
        return;
      }
      finish(code);
    });

    document.body.append(overlay);

    const live = async () => {
      if (!('BarcodeDetector' in globalThis) || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const supported = await globalThis.BarcodeDetector.getSupportedFormats();
      const formats = WANTED.filter((f) => supported.includes(f));
      if (!formats.length) throw new Error('unsupported');
      const detector = new globalThis.BarcodeDetector({ formats });
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch (err) {
        throw new Error(err.name === 'NotAllowedError' ? 'denied' : 'camera');
      }
      if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
      video.srcObject = stream;
      await video.play().catch(() => {});
      const tick = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const found = await detector.detect(video);
            const code = found.map((b) => b.rawValue).find((v) => isValidBarcode(v));
            if (code) {
              navigator.vibrate?.(60);
              return finish(code);
            }
          }
        } catch {
          /* frame not ready; try again */
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    };

    live().catch((err) => {
      overlay.classList.add('no-camera');
      msg.textContent = t({ unsupported: 'scan.unsupported', denied: 'scan.cameraDenied' }[err.message] || 'scan.cameraError');
      input.focus();
    });
  });
}
