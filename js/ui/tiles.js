// Choose dashboard tiles: tick to show, drag the handle (or long-press a row)
// to change the order; arrow keys on the handle move a tile one place.
// Changes are saved straight away.
import { h } from './dom.js';
import { t } from '../i18n/i18n.js';
import * as store from '../data/store.js';
import { tileLayout, saveShape, toggleTile, moveTile, placeTile } from '../core/tiles.js';
import { icon } from './icons.js';
import { dragSort, keyMove } from './drag-sort.js';

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
      { class: `tile-row${tile.on ? '' : ' off'}`, 'data-id': tile.id },
      h(
        'label',
        { class: 'check-row tile-check', for: id },
        h('input', { type: 'checkbox', id, checked: tile.on, onchange: () => save(toggleTile(layout, tile.id), id) }),
        h('span', { class: 'tile-text' }, h('span', { class: 'tile-name' }, t(`tile.${tile.id}`)), h('small', { class: 'muted' }, t(`tile.${tile.id}.desc`))),
      ),
      (() => {
        const grip = h('button', { type: 'button', class: 'tile-grip', id: `${id}-grip`, 'aria-label': t('tiles.drag', { name: t(`tile.${tile.id}`) }) }, icon('grip', 'ic'));
        keyMove(grip, (dir) => save(moveTile(layout, tile.id, dir), `${id}-grip`));
        return grip;
      })(),
    );
  };

  function draw() {
    const list = h('ol', { class: 'tile-list' }, layout.map(row));
    dragSort(list, { slotSelector: '.tile-row', handleSelector: '.tile-grip', onDrop: (id, before) => save(placeTile(layout, id, before, { toEnd: true }), `tile-${id}-grip`) });
    root.replaceChildren(
      h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': t('tiles.back') }, '‹'), h('h1', { class: 'page-title' }, t('tiles.title'))),
      h('p', { class: 'muted small' }, t('tiles.hint')),
      h(
        'section',
        { class: 'card' },
        h('h2', {}, t('tiles.order')),
        list,
      ),
      h('a', { class: 'btn primary wide', href: '#/' }, t('tiles.done')),
    );
  }
  draw();
}
