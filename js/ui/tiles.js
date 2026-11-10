// Choose dashboard tiles: tick to show, arrows to change the order.
// Changes are saved straight away.
import { h } from './dom.js';
import { t } from '../i18n/i18n.js';
import * as store from '../data/store.js';
import { tileLayout, saveShape, toggleTile, moveTile } from '../core/tiles.js';

// Saving re-renders live screens; this screen redraws itself instead so
// focus stays on the control that was used.
export const live = false;

export async function render(root) {
  const settings = await store.getSettings();
  let layout = tileLayout(settings.dashTiles);

  const save = async (next, focusId) => {
    layout = next;
    await store.saveSettings({ ...(await store.getSettings()), dashTiles: saveShape(layout) });
    draw();
    if (focusId) root.querySelector(`#${focusId}`)?.focus();
  };

  const row = (tile, i) => {
    const id = `tile-${tile.id}`;
    return h(
      'li',
      { class: `tile-row${tile.on ? '' : ' off'}` },
      h(
        'label',
        { class: 'check-row tile-check', for: id },
        h('input', { type: 'checkbox', id, checked: tile.on, onchange: () => save(toggleTile(layout, tile.id), id) }),
        h('span', { class: 'tile-text' }, h('span', { class: 'tile-name' }, t(`tile.${tile.id}`)), h('small', { class: 'muted' }, t(`tile.${tile.id}.desc`))),
      ),
      h(
        'div',
        { class: 'tile-move' },
        h('button', { type: 'button', class: 'icon-btn', id: `${id}-up`, 'aria-label': t('tiles.up', { name: t(`tile.${tile.id}`) }), disabled: i === 0, onclick: () => save(moveTile(layout, tile.id, -1), `${id}-up`) }, '↑'),
        h('button', { type: 'button', class: 'icon-btn', id: `${id}-down`, 'aria-label': t('tiles.down', { name: t(`tile.${tile.id}`) }), disabled: i === layout.length - 1, onclick: () => save(moveTile(layout, tile.id, 1), `${id}-down`) }, '↓'),
      ),
    );
  };

  function draw() {
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': t('tiles.back') }, '‹'), h('h1', { class: 'page-title' }, t('tiles.title'))),
      h('p', { class: 'muted small' }, t('tiles.hint')),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, t('tiles.order')),
        h('ol', { class: 'tile-list' }, layout.map(row)),
      ),
      h('a', { class: 'btn primary wide', href: '#/' }, t('tiles.done')),
    );
  }
  draw();
}
