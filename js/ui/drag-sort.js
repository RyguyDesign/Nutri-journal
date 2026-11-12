// Drag to reorder, for touch, mouse and pen.
//
// Slots are elements with data-id. A slot starts dragging straight away from
// its handle, or after a long press anywhere on it (so normal scrolling still
// works). While dragging, the slot follows the finger, a glowing bar shows
// where it will land, and the page scrolls near the top and bottom edges.
// Slots marked data-inline sit side by side (small tiles), so for them the
// drop side is decided left/right instead of above/below.
//
// onDrop(id, beforeId) is called once, on release: beforeId is the slot it
// now sits in front of, or null for "after the last slot".

const LONG_PRESS_MS = 350;
const MOVE_CANCEL_PX = 8;
const EDGE_PX = 90;

// Swallows the click that follows a drag release.
function swallow(e) { e.stopPropagation(); e.preventDefault(); window.removeEventListener('click', swallow, true); }

export function dragSort(container, { slotSelector = '[data-id]', handleSelector = null, longPress = true, onDrop }) {
  let press = null; // waiting for a long press
  let drag = null; // active drag

  const slots = () => [...container.querySelectorAll(slotSelector)];

  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag || press) return;
    const slot = e.target.closest(slotSelector);
    if (!slot || !container.contains(slot) || e.target.closest('[data-no-drag]')) return;
    if (handleSelector && e.target.closest(handleSelector)) {
      e.preventDefault();
      listen(true);
      start(slot, e);
      return;
    }
    if (!longPress) return;
    listen(true);
    press = { slot, x: e.clientX, y: e.clientY, timer: setTimeout(() => { const p = press; press = null; if (p) start(p.slot, { clientX: p.x, clientY: p.y }); }, LONG_PRESS_MS) };
  });

  const cancelPress = () => { if (press) { clearTimeout(press.timer); press = null; } };

  // Window listeners exist only while a press or drag is in progress
  const onMove = (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_CANCEL_PX) { cancelPress(); listen(false); }
    if (drag) { e.preventDefault(); drag.x = e.clientX; drag.y = e.clientY; update(); }
  };
  const onUp = () => { cancelPress(); if (drag) finish(true); listen(false); };
  const onCancel = () => { cancelPress(); if (drag) finish(false); listen(false); };
  const onKey = (e) => { if (drag && e.key === 'Escape') { finish(false); listen(false); } };
  function listen(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('pointermove', onMove, { passive: false });
    window[f]('pointerup', onUp);
    window[f]('pointercancel', onCancel);
    window[f]('keydown', onKey);
  }
  // Stop the page from scrolling under the finger while dragging
  container.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
  container.addEventListener('contextmenu', (e) => { if (press || drag) e.preventDefault(); });

  function start(slot, e) {
    const r = slot.getBoundingClientRect();
    drag = { slot, id: slot.dataset.id, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, scroll0: window.scrollY, target: null, raf: 0, w: r.width };
    slot.classList.add('dragging');
    container.classList.add('is-dragging');
    drag.bar = document.createElement('div');
    drag.bar.className = 'drop-bar';
    document.body.append(drag.bar);
    navigator.vibrate?.(12);
    update();
    autoScroll();
  }

  function update() {
    const { slot } = drag;
    slot.style.transform = `translate(${drag.x - drag.x0}px, ${drag.y - drag.y0 + window.scrollY - drag.scroll0}px) scale(1.03)`;
    const others = slots().filter((s) => s !== slot);
    if (!others.length) return;
    // The slot under the finger, else the nearest one vertically
    let best = null;
    let bestD = Infinity;
    for (const el of others) {
      const r = el.getBoundingClientRect();
      const dy = drag.y < r.top ? r.top - drag.y : drag.y > r.bottom ? drag.y - r.bottom : 0;
      const dx = drag.x < r.left ? r.left - drag.x : drag.x > r.right ? drag.x - r.right : 0;
      const d = dy * 1000 + dx; // rows first, then columns
      if (d < bestD) { bestD = d; best = { el, r }; }
    }
    const { el, r } = best;
    const inline = el.dataset.inline !== undefined;
    const before = inline ? drag.x < r.left + r.width / 2 : drag.y < r.top + r.height / 2;
    const order = others.map((s) => s.dataset.id);
    const i = order.indexOf(el.dataset.id);
    drag.target = before ? el.dataset.id : order[i + 1] ?? null;
    const bar = drag.bar.style;
    if (inline) Object.assign(bar, { left: `${(before ? r.left : r.right) - 2}px`, top: `${r.top}px`, width: '4px', height: `${r.height}px` });
    else Object.assign(bar, { left: `${r.left}px`, top: `${(before ? r.top : r.bottom) - 2}px`, width: `${r.width}px`, height: '4px' });
  }

  function autoScroll() {
    if (!drag) return;
    const nav = document.querySelector('.tabbar')?.getBoundingClientRect().top ?? window.innerHeight;
    const bottom = Math.min(window.innerHeight, nav);
    let v = 0;
    if (drag.y < EDGE_PX) v = -Math.ceil((EDGE_PX - drag.y) / 6);
    else if (drag.y > bottom - EDGE_PX) v = Math.ceil((drag.y - (bottom - EDGE_PX)) / 6);
    if (v) { window.scrollBy(0, v); update(); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function finish(commit) {
    const d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    d.bar.remove();
    d.slot.classList.remove('dragging');
    d.slot.style.transform = '';
    container.classList.remove('is-dragging');
    // A drag must not also count as a tap on whatever is underneath
    window.addEventListener('click', swallow, true);
    setTimeout(() => window.removeEventListener('click', swallow, true), 350);
    if (!commit) return;
    const all = slots().map((s) => s.dataset.id);
    const was = all[all.indexOf(d.id) + 1] ?? null;
    if (d.target === was) return; // dropped where it started
    onDrop(d.id, d.target);
  }
}

/** Keyboard reordering for a handle button: arrow keys move by one place. */
export function keyMove(handle, onStep) {
  handle.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    onStep(e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1);
  });
}
