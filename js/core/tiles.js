// Dashboard tiles: which ones show and in what order.
// Saved in settings as dashTiles: { order: [ids], off: [ids] }.
// Pure functions, covered by tests/tiles.test.js.

/** size 'wide' fills a row; 'small' tiles sit three to a row. */
export const TILES = [
  { id: 'calories', group: 'glance', size: 'wide', on: true },
  { id: 'nutrients', group: 'glance', size: 'wide', on: true },
  { id: 'table', group: 'detail', size: 'wide', on: false },
  { id: 'meals', group: 'detail', size: 'wide', on: false },
  { id: 'fasting', group: 'diet', size: 'wide', on: true },
  { id: 'idea', group: 'diet', size: 'wide', on: false },
  { id: 'water', group: 'body', size: 'wide', on: true },
  { id: 'workout', group: 'body', size: 'wide', on: true },
  { id: 'journal', group: 'shortcuts', size: 'small', on: true },
  { id: 'recipes', group: 'shortcuts', size: 'small', on: true },
  { id: 'diet', group: 'shortcuts', size: 'small', on: true },
  { id: 'scan', group: 'shortcuts', size: 'small', on: false },
  { id: 'likes', group: 'shortcuts', size: 'small', on: false },
];

export const TILE_GROUPS = ['glance', 'detail', 'diet', 'body', 'shortcuts'];

const BY_ID = new Map(TILES.map((t) => [t.id, t]));

/**
 * The saved layout made complete and safe: every known tile once, in the
 * saved order; tiles added in later versions go at the end with their
 * default on/off; unknown ids are dropped.
 *   [{ id, group, size, on }]
 */
export function tileLayout(saved) {
  const order = Array.isArray(saved?.order) ? saved.order.filter((id, i, a) => BY_ID.has(id) && a.indexOf(id) === i) : [];
  for (const t of TILES) if (!order.includes(t.id)) order.push(t.id);
  const off = Array.isArray(saved?.off) ? new Set(saved.off) : null;
  const known = new Set(Array.isArray(saved?.order) ? saved.order : []);
  return order.map((id) => {
    const t = BY_ID.get(id);
    // A tile the person hasn't seen yet keeps its default
    const on = off && known.has(id) ? !off.has(id) : t.on;
    return { ...t, on };
  });
}

/** Back to the saved shape. */
export function saveShape(layout) {
  return { order: layout.map((t) => t.id), off: layout.filter((t) => !t.on).map((t) => t.id) };
}

export function toggleTile(layout, id) {
  return layout.map((t) => (t.id === id ? { ...t, on: !t.on } : t));
}

/** Move a tile one place up (-1) or down (+1); unchanged at the ends. */
export function moveTile(layout, id, dir) {
  const i = layout.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layout.length) return layout;
  const next = layout.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * The tiles to show, grouped into rows: a wide tile is its own row;
 * neighbouring small tiles share a row (up to three).
 *   [[tile], [small, small, small], ...]
 */
export function tileRows(layout) {
  const rows = [];
  for (const t of layout.filter((x) => x.on)) {
    const last = rows[rows.length - 1];
    if (t.size === 'small' && last && last[0].size === 'small' && last.length < 3) last.push(t);
    else rows.push([t]);
  }
  return rows;
}

export const DEFAULT_LAYOUT = tileLayout(null);

/**
 * Move a tile so it sits just before `beforeId`. With no `beforeId` it goes
 * after the last shown tile (or, with toEnd, to the very end of the list).
 * Unchanged if either id is unknown.
 */
export function placeTile(layout, id, beforeId, { toEnd = false } = {}) {
  const moving = layout.find((t) => t.id === id);
  if (!moving || id === beforeId) return layout;
  const rest = layout.filter((t) => t.id !== id);
  let i;
  if (beforeId) {
    i = rest.findIndex((t) => t.id === beforeId);
    if (i < 0) return layout;
  } else {
    i = toEnd ? rest.length : rest.map((t) => t.on).lastIndexOf(true) + 1;
  }
  rest.splice(i, 0, moving);
  return rest;
}

/** Turn a tile on and put it after the last shown tile. */
export function showTile(layout, id) {
  return placeTile(layout.map((t) => (t.id === id ? { ...t, on: true } : t)), id, null);
}

/** Turn a tile off; it keeps its place in the list. */
export function hideTile(layout, id) {
  return layout.map((t) => (t.id === id ? { ...t, on: false } : t));
}
