// Dashboard lighting: a blue light source behind a card, and neon SVG lines that
// wrap around the outside of its rounded corners. Drawn at the card's real size,
// so the curves follow the corner radius exactly.
import { h, svg } from './dom.js';

const PAD = 16; // room outside the card for the lines and their glow

// Each line: which corner to wrap, how far outside the edge, and how far it runs
// along each side (as a share of that side).
const LINES = {
  calorie: [
    { corner: 'br', off: 6, a: 0.55, b: 0.6, w: 1.6 },
    { corner: 'br', off: 12, a: 0.3, b: 0.35, w: 1, faint: true },
    { corner: 'tl', off: 6, a: 0.25, b: 0.3, w: 1.2 },
  ],
  fasting: [
    { corner: 'tr', off: 6, a: 0.45, b: 0.5, w: 1.4 },
    { corner: 'tr', off: 12, a: 0.22, b: 0.25, w: 1, faint: true },
  ],
  recipe: [
    { corner: 'bl', off: 6, a: 0.5, b: 0.55, w: 1.4 },
    { corner: 'tr', off: 6, a: 0.25, b: 0.3, w: 1.1, faint: true },
  ],
};

// Path that starts partway along one side, rounds the corner `off` px outside
// the card and runs partway along the next side.
function cornerPath(W, H, R, { corner, off, a, b }) {
  const x0 = PAD - off, y0 = PAD - off, x1 = PAD + W + off, y1 = PAD + H + off, r = R + off;
  switch (corner) {
    case 'br': return `M${x1} ${y1 - r - (H - 2 * R) * a} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x1 - r - (W - 2 * R) * b}`;
    case 'tr': return `M${x1 - r - (W - 2 * R) * a} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y0 + r + (H - 2 * R) * b}`;
    case 'bl': return `M${x0 + r + (W - 2 * R) * a} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y1 - r - (H - 2 * R) * b}`;
    default: return `M${x0} ${y0 + r + (H - 2 * R) * a} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} H${x0 + r + (W - 2 * R) * b}`;
  }
}

let uid = 0;

function draw(wrap, card, kind) {
  const W = card.offsetWidth, H = card.offsetHeight;
  if (!W || !H) return;
  const R = Math.min(parseFloat(getComputedStyle(card).borderTopLeftRadius) || 24, W / 2, H / 2);
  const old = wrap.querySelector(':scope > .neon-lines');
  const id = `nl${++uid}`;
  const lines = LINES[kind].map((l, i) => {
    const g = `${id}-${i}`;
    return [
      svg('linearGradient', { id: g, gradientUnits: 'userSpaceOnUse', ...ends(W, H, R, l) },
        svg('stop', { offset: '0', 'stop-color': '#48baff', 'stop-opacity': '0' }),
        svg('stop', { offset: '0.5', 'stop-color': '#8fdcff', 'stop-opacity': l.faint ? '0.55' : '1' }),
        svg('stop', { offset: '1', 'stop-color': '#2f8cff', 'stop-opacity': '0' })),
      svg('path', { d: cornerPath(W, H, R, l), fill: 'none', stroke: `url(#${g})`, 'stroke-width': l.w, 'stroke-linecap': 'round' }),
    ];
  });
  // Owner's CSS: a 230px glowing ring sitting in the calorie card's bottom-right corner
  // (right -150px, bottom -170px), clipped to the card.
  const ring = kind === 'calorie' ? [
    svg('clipPath', { id: `${id}-clip` }, svg('rect', { x: PAD, y: PAD, width: W, height: H, rx: R })),
    svg('circle', { class: 'corner-ring', cx: PAD + W + 35, cy: PAD + H + 55, r: 115, fill: 'none', stroke: 'rgba(65,185,255,0.8)', 'stroke-width': 2, 'clip-path': `url(#${id}-clip)` }),
  ] : [];
  const el = svg('svg', { class: 'neon-lines', width: W + PAD * 2, height: H + PAD * 2, viewBox: `0 0 ${W + PAD * 2} ${H + PAD * 2}`, 'aria-hidden': 'true' },
    svg('defs', {}, lines.map((x) => x[0]), ring[0] || null), ring[1] || null, lines.map((x) => x[1]));
  if (old) old.replaceWith(el); else wrap.append(el);
}

// Gradient runs from the path's start to its end so both ends fade out.
function ends(W, H, R, { corner, off, a, b }) {
  const p = cornerPath(W, H, R, { corner, off, a, b }).match(/-?[\d.]+/g).map(Number);
  const [x1, y1] = p;
  const last = cornerPath(W, H, R, { corner, off, a, b }).trim().split(/(?=[HV])/).pop();
  const v = Number(last.slice(1));
  const end = last[0] === 'H' ? { x2: v, y2: corner[0] === 'b' ? PAD + H + off : PAD - off } : { x2: corner[1] === 'r' ? PAD + W + off : PAD - off, y2: v };
  return { x1, y1, ...end };
}

export function withLights(card, kind) {
  if (!LINES[kind]) return card;
  const wrap = h('div', { class: `lit lit-${kind}` }, h('div', { class: 'ambient', 'aria-hidden': 'true' }), card);
  const redraw = () => draw(wrap, card, kind);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(redraw).observe(card);
  requestAnimationFrame(redraw);
  return wrap;
}
