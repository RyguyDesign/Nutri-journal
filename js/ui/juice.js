// Juice mixer: pick any fruits and vegetables with their amounts (or start
// from a popular mix), see the totals, and hand the result to the entry form
// as one drink. Numbers come from js/foods/juices.js.
import { h } from './dom.js';
import { t } from '../i18n/i18n.js';
import { icon } from './icons.js';
import { setPendingFood, goBack } from './state.js';
import { JUICE_BASES, JUICE_BY_KEY, JUICE_MIXES, mixJuice, mixItems } from '../foods/juices.js';

export const live = false;

const short = (b) => b.name.replace(/ juice.*$| water.*$/i, '').replace(/, fresh.*$/i, '');
const BASE_OPTIONS = [...JUICE_BASES].sort((a, b) => short(a).localeCompare(short(b)));
const parseMl = (s) => {
  const v = Number(String(s ?? '').trim().replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
};
const r0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;

export async function render(root, _rerender, params = {}) {
  const q = params.query || {};
  let rows = [{ key: 'orange', ml: 250 }];
  let preset = null; // the mix the rows came from, while unchanged

  const list = h('div', { class: 'juice-rows' });
  const totals = h('div', { class: 'juice-totals', 'aria-live': 'polite' });
  const note = h('p', { class: 'muted small juice-note' });
  const addBtn = h('button', { type: 'button', class: 'btn primary wide', id: 'juice-log' }, t('juice.log'));

  const presetChips = h('div', { class: 'chips juice-presets', role: 'group', 'aria-label': t('juice.presets') },
    JUICE_MIXES.map((x) => h('button', {
      type: 'button', class: 'chip', 'data-mix': x.key, 'aria-pressed': 'false',
      onclick: () => {
        const total = currentMl() || 250;
        rows = mixItems(x, x.g && !currentMl() ? x.g : total);
        preset = x;
        draw();
        list.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    }, x.name.replace(/ juice/i, '').replace(/ \(.*\)/, '').replace(/, fresh$/, ''))));

  const currentMl = () => rows.reduce((n, r) => n + (r.ml > 0 ? r.ml : 0), 0);
  const changed = () => { preset = null; };

  function row(r, i) {
    const sel = h('select', { 'aria-label': t('juice.fruit', { n: i + 1 }), onchange: (e) => { r.key = e.target.value; changed(); refresh(); } },
      BASE_OPTIONS.map((b) => h('option', { value: b.key, selected: b.key === r.key }, short(b) + (b.est ? ' *' : ''))));
    const ml = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: String(r.ml), 'aria-label': t('juice.amount', { n: i + 1 }),
      oninput: (e) => { r.ml = parseMl(e.target.value); changed(); refresh(); } });
    const remove = h('button', { type: 'button', class: 'icon-btn juice-remove', 'aria-label': t('juice.remove', { name: short(JUICE_BY_KEY[r.key]) }),
      disabled: rows.length < 2, onclick: () => { rows.splice(i, 1); changed(); draw(); } }, icon('x', 'ic-xs'));
    return h('div', { class: 'juice-row' }, sel, h('div', { class: 'with-unit juice-ml' }, ml, h('span', { class: 'unit' }, t('unit.ml'))), remove);
  }

  function refresh() {
    for (const c of presetChips.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(preset?.key === c.dataset.mix));
    const bad = rows.some((r) => !(r.ml > 0) || r.ml > 3000);
    const m = mixJuice(rows);
    const g = (v) => (v === null ? '–' : `${r1(v)} ${t('common.g')}`);
    totals.replaceChildren(
      h('p', { class: 'juice-big num' }, h('strong', {}, String(r0(m.kcal))), ` ${t('common.kcal')}`, h('span', { class: 'muted' }, ` · ${r0(m.ml)} ${t('unit.ml')}`)),
      h('dl', { class: 'juice-macros' },
        h('div', {}, h('dt', {}, t('nutrient.short.carbs')), h('dd', { class: 'num' }, g(m.carbs))),
        h('div', {}, h('dt', {}, t('juice.sugar')), h('dd', { class: 'num' }, g(m.sugar))),
        h('div', {}, h('dt', {}, t('nutrient.short.protein')), h('dd', { class: 'num' }, g(m.protein))),
        h('div', {}, h('dt', {}, t('nutrient.short.fat')), h('dd', { class: 'num' }, g(m.fat)))),
    );
    note.textContent = bad ? t('juice.badAmount') : `${m.est ? t('juice.estimated') : t('juice.measured')}${m.sugar === null ? ` ${t('juice.noSugar')}` : ''}`;
    note.classList.toggle('warn', bad);
    addBtn.disabled = bad || !m.ml;
  }

  function draw() {
    list.replaceChildren(...rows.map(row));
    refresh();
  }

  addBtn.addEventListener('click', () => {
    const m = mixJuice(rows);
    if (!m.ml) return;
    const used = rows.filter((r) => r.ml > 0);
    const name = preset ? preset.name
      : used.length === 1 ? JUICE_BY_KEY[used[0].key].name
        : t('juice.mixName', { list: used.map((r) => short(JUICE_BY_KEY[r.key]).toLowerCase()).join(', ') });
    const per = { amount: r0(m.ml), unit: 'ml', kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, salt: 0 };
    if (m.sugar !== null) per.sugar = m.sugar;
    if (m.fibre !== null && used.every((r) => JUICE_BY_KEY[r.key].v.fibre !== null)) per.fibre = m.fibre;
    setPendingFood({
      name, per, source: 'typical', meal: 'drinks',
      notes: used.length > 1 ? used.map((r) => `${short(JUICE_BY_KEY[r.key])} ${r0(r.ml)} ml`).join(', ') : '',
    });
    location.hash = `#/add/detail${/^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? `?date=${q.date}` : ''}`;
  });

  root.replaceChildren(
    h('div', { class: 'page-head' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('add.back'), onclick: () => goBack('#/add') }, '‹'),
      h('div', {}, h('h1', { class: 'page-title' }, t('juice.title')), h('p', { class: 'muted small' }, t('juice.sub')))),
    h('section', { class: 'card juice-card' },
      h('h2', {}, t('juice.yours')),
      list,
      h('button', { type: 'button', class: 'btn wide juice-add', onclick: () => { rows.push({ key: 'apple', ml: 100 }); changed(); draw(); } }, icon('plus', 'ic-xs'), t('juice.addFruit')),
      totals,
      note,
      addBtn),
    h('section', { class: 'card juice-card' }, h('h2', {}, t('juice.presets')), presetChips),
  );
  draw();
}
