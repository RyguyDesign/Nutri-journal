// "Add food": log one or several foods for a meal on one screen.
// Search -> tap -> it joins the list with a typical amount; adjust with the
// amount, unit, or ½ ¼ ×2; one Save for everything. Combinations can be
// saved as a meal and logged again with one tap.
import { h, toast } from './dom.js';
import { t, fmtKcal, fmtGrams, fmtNumber } from '../i18n/i18n.js';
import { MEALS, MASS_UNITS, defaultMeal, nowTime, parseNumber } from '../core/entry.js';
import { scaleNutrients } from '../core/calc.js';
import * as store from '../data/store.js';
import { searchEveryday } from '../foods/everyday.js';
import { lookupBarcode, searchProducts } from '../foods/off.js';
import { scanBarcode } from './scanner.js';
import { getSelectedDate, goBack } from './state.js';
import {
  unitChoices, setUnit, itemTotals, mealTotals, scaleItem,
  itemFromFood, itemFromEveryday, itemFromProduct, itemCaloriesOnly,
  itemForSaving, itemsFromSavedMeal, entryFromItem,
} from '../core/meal.js';

export const live = false; // keeps the list while foods are added

const unitName = (u, q = 1) => (MASS_UNITS.includes(u) || q === 1 ? t(`unit.${u}`) : t(`unit.${u}.n`));

export async function render(root, rerender, params = {}) {
  const q = params.query || {};
  let items = [];
  let usedMealId = null;
  const time = nowTime();

  // ---- Header: meal, time, date -------------------------------------------
  const mealSel = h('select', { id: 'meal' }, MEALS.map((m) => h('option', { value: m }, t(`meal.${m}`))));
  mealSel.value = MEALS.includes(q.meal) ? q.meal : defaultMeal(time);
  const timeIn = h('input', { id: 'time', type: 'time', value: time });
  const dateIn = h('input', { id: 'date', type: 'date', value: q.date || getSelectedDate() });
  timeIn.addEventListener('change', () => {
    if (!q.meal) mealSel.value = defaultMeal(timeIn.value);
  });

  // ---- Search ---------------------------------------------------------------
  const search = h('input', { id: 'food-search', type: 'search', autocomplete: 'off', placeholder: t('meal.searchPh'), 'aria-label': t('meal.search') });
  const results = h('div', { class: 'suggest meal-results', id: 'meal-results' });
  const status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const list = h('div', { class: 'meal-items', id: 'meal-items' });
  const totalsEl = h('div', { class: 'meal-total num', id: 'meal-total' });
  const saveBtn = h('button', { type: 'button', class: 'btn primary grow', id: 'save-all' });
  const saveMealCheck = h('input', { type: 'checkbox', id: 'save-meal' });
  const saveMealName = h('input', { type: 'text', id: 'save-meal-name', maxlength: 60, placeholder: t('meal.savePh'), hidden: true });
  saveMealCheck.addEventListener('change', () => {
    saveMealName.hidden = !saveMealCheck.checked;
    if (saveMealCheck.checked && !saveMealName.value) saveMealName.value = [...new Set(items.map((i) => shortName(i.name)))].join(' + ').slice(0, 60);
    if (saveMealCheck.checked) saveMealName.focus();
  });

  function setStatus(msg, kind = 'info') {
    status.className = `status ${kind}`;
    status.replaceChildren(...(msg ? [h('p', {}, msg)] : []));
  }

  function add(newItems) {
    items = [...items, ...newItems];
    search.value = '';
    showResults();
    drawItems();
    setStatus(null);
  }

  let token = 0;
  async function showResults() {
    const my = ++token;
    const text = search.value.trim();
    const lower = text.toLowerCase();
    const [meals, foods] = await Promise.all([store.getSavedMeals(), store.searchFoods(text, 5)]);
    if (my !== token) return;
    const sections = [];
    const mealsShown = text ? meals.filter((m) => m.name.toLowerCase().includes(lower)).slice(0, 3) : meals.slice(0, 4);
    if (mealsShown.length) {
      sections.push(section(t('meal.savedHead'), mealsShown.map((m) => pick(m.name, t('meal.savedInfo', { n: m.items.length, kcal: fmtKcal(mealTotals(m.items).kcal) }), () => {
        usedMealId = m.id;
        add(itemsFromSavedMeal(m));
      }))));
    }
    if (foods.length) {
      sections.push(section(text ? t('entry.matches') : t('entry.recent'), foods.map((f) => pick(f.name, [f.brand, `${fmtKcal(f.per.kcal)} kcal / ${fmtNumber(f.per.amount, 1)} ${unitName(f.per.unit, f.per.amount)}`].filter(Boolean).join(' · '), () => add([itemFromFood(f)])))));
    }
    if (text.length >= 2) {
      const saved = new Set(foods.map((f) => f.name.toLowerCase()));
      const typical = searchEveryday(text, 5).filter((c) => !saved.has(c.name.toLowerCase()));
      if (typical.length) {
        sections.push(section(typical[0].closest ? t('entry.typicalClosest') : t('entry.typicalHead'), typical.map((c) => pick(c.name, c.portion.unit !== 'g'
          ? t('entry.typicalPiece', { kcal: fmtKcal((c.per.kcal * c.portion.g) / 100), label: c.portion.label, g: c.portion.g, unit: c.per.unit })
          : `${fmtKcal(c.per.kcal)} kcal / 100 ${c.per.unit}`, () => add([itemFromEveryday(c)])))));
      }
      sections.push(h(
        'div',
        { class: 'online-row' },
        h('button', { type: 'button', class: 'btn small', onclick: () => searchOnline(text) }, t('entry.online.button', { q: text })),
        h('button', { type: 'button', class: 'btn small', onclick: () => add([itemCaloriesOnly(text)]) }, t('meal.caloriesOnly', { q: text })),
      ));
    }
    results.replaceChildren(...sections);
    results.hidden = !sections.length;
  }

  async function searchOnline(text) {
    const my = ++token;
    results.replaceChildren(h('p', { class: 'muted small' }, t('entry.online.searching', { q: text })));
    results.hidden = false;
    try {
      const found = await searchProducts(text);
      if (my !== token) return;
      results.replaceChildren(
        found.length
          ? section(t('entry.online.head'), found.map((f) => pick(f.name, [f.brand, `${fmtKcal(f.per.kcal)} kcal / 100 ${f.per.unit}`].filter(Boolean).join(' · '), () => add([itemFromProduct(f)]))))
          : h('p', { class: 'muted small' }, t('entry.online.none', { q: text })),
        h('div', { class: 'online-row' }, h('button', { type: 'button', class: 'btn small', onclick: () => add([itemCaloriesOnly(text)]) }, t('meal.caloriesOnly', { q: text }))),
      );
    } catch (err) {
      if (my !== token) return;
      results.replaceChildren(
        h('p', { class: 'warn small' }, t({ offline: 'scan.offline', timeout: 'scan.timeout', busy: 'entry.online.busy' }[err.message] || 'entry.online.error')),
        h('div', { class: 'online-row' }, h('button', { type: 'button', class: 'btn small', onclick: () => add([itemCaloriesOnly(text)]) }, t('meal.caloriesOnly', { q: text }))),
      );
    }
  }

  let debounce;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(showResults, 120);
  });

  async function onScan() {
    const code = await scanBarcode();
    if (!code) return;
    setStatus(t('scan.looking', { code }));
    const local = await store.findFoodByBarcode(code);
    if (local) return add([itemFromFood(local)]);
    try {
      const f = await lookupBarcode(code);
      if (!f || f.per.kcal === undefined) {
        setStatus(t('meal.scanUnknown', { code }), 'warn');
        return;
      }
      add([{ ...itemFromProduct(f), name: f.name || t('meal.scanned') }]);
    } catch (err) {
      setStatus(t({ offline: 'scan.offline', timeout: 'scan.timeout' }[err.message] || 'scan.error'), 'error');
    }
  }

  // ---- The list ---------------------------------------------------------------
  function update(keyId, fn) {
    items = items.map((it) => (it.key === keyId ? fn(it) : it));
    drawItems(keyId);
  }

  function itemRow(it) {
    const n = itemTotals(it);
    const qty = h('input', { type: 'text', inputmode: 'decimal', class: 'qty', value: fmtInputNum(it.quantity), 'aria-label': t('entry.amount') });
    qty.addEventListener('change', () => {
      const v = parseNumber(qty.value);
      if (v > 0) update(it.key, (x) => ({ ...x, quantity: v }));
      else qty.value = fmtInputNum(it.quantity);
    });
    const choices = unitChoices(it);
    const unit = h('select', { class: 'unit', 'aria-label': t('entry.unit') }, choices.map((c) => h('option', { value: c.unit, selected: c.unit === it.unit }, c.unit === 'portion' && it.portionLabel ? plural(it.portionLabel, it.quantity) : unitName(c.unit, it.quantity))));
    unit.addEventListener('change', () => update(it.key, (x) => setUnit(x, unit.value)));
    const sizeNote = !MASS_UNITS.includes(it.unit) && it.unitSize > 0 ? h('span', { class: 'muted small' }, `≈ ${fmtNumber(it.unitSize * it.quantity, 0)} ${it.per.unit}`) : null;

    const kcalIn = it.caloriesOnly
      ? h('div', { class: 'with-unit kcal-only' }, h('input', { type: 'text', inputmode: 'decimal', value: Number.isFinite(it.per.kcal) ? String(it.per.kcal) : '', placeholder: t('meal.kcalPh'), 'aria-label': t('nutrient.kcal') }), h('span', { class: 'unit' }, 'kcal'))
      : null;
    if (kcalIn) {
      kcalIn.querySelector('input').addEventListener('change', (e) => {
        const v = parseNumber(e.target.value);
        update(it.key, (x) => ({ ...x, per: { ...x.per, kcal: v >= 0 ? v : NaN } }));
      });
    }
    const chip = (label, f) => h('button', { type: 'button', class: 'chip mini', onclick: () => update(it.key, (x) => scaleItem(x, f)) }, label);
    return h(
      'li',
      { class: 'meal-item', dataset: { key: it.key } },
      h(
        'div',
        { class: 'meal-item-top' },
        h('div', { class: 'meal-item-name' }, h('strong', {}, it.name), it.brand ? h('span', { class: 'muted small' }, ` ${it.brand}`) : null),
        h('span', { class: 'num kcal' }, n ? `${fmtKcal(n.kcal)} kcal` : '–'),
        h('button', { type: 'button', class: 'icon-btn remove', 'aria-label': t('meal.remove', { name: it.name }), onclick: () => { items = items.filter((x) => x.key !== it.key); drawItems(); } }, '×'),
      ),
      kcalIn || h(
        'div',
        { class: 'meal-item-amount' },
        qty,
        choices.length > 1 ? unit : h('span', { class: 'unit-fixed' }, unitName(it.unit, it.quantity)),
        h('div', { class: 'chips' }, chip('½', 0.5), chip('¼', 0.25), chip('×2', 2)),
      ),
      sizeNote && !kcalIn ? h('div', { class: 'meal-item-size' }, sizeNote) : null,
    );
  }

  function drawItems(focusKey) {
    if (!items.length) {
      list.replaceChildren(h('p', { class: 'muted small empty' }, t('meal.empty')));
    } else {
      list.replaceChildren(h('ul', {}, items.map(itemRow)));
    }
    const tt = mealTotals(items);
    totalsEl.replaceChildren(
      items.length ? h('strong', {}, t('meal.total', { kcal: fmtKcal(tt.kcal) })) : null,
      items.length ? h('span', { class: 'muted small' }, ` · ${t('ideas.macros', { p: fmtGrams(tt.protein), c: fmtGrams(tt.carbs), f: fmtGrams(tt.fat) })}`) : null,
    );
    saveBtn.textContent = items.length > 1 ? t('meal.saveAll', { n: items.length }) : t('entry.save');
    saveBtn.disabled = !items.length;
    saveRow.hidden = items.length < 2 && !usedMealId;
    if (focusKey) list.querySelector(`[data-key="${focusKey}"] .qty`)?.blur();
  }

  // ---- Save -----------------------------------------------------------------
  async function saveAll() {
    if (!items.length) return;
    const bad = items.find((it) => !itemTotals(it));
    if (bad) {
      toast(bad.caloriesOnly ? t('meal.needKcal', { name: bad.name }) : t('meal.needAmount', { name: bad.name }), 'error');
      list.querySelector(`[data-key="${bad.key}"] input`)?.focus();
      return;
    }
    const when = { date: dateIn.value, time: timeIn.value || nowTime(), meal: mealSel.value };
    try {
      for (const it of items) {
        let foodId = it.foodId;
        if (!it.caloriesOnly) {
          const per = MASS_UNITS.includes(it.per.unit) && it.per.amount !== 100 ? { amount: 100, unit: it.per.unit, ...scaleNutrients(it.per, 100, it.per.amount) } : it.per;
          foodId = await store.rememberFood({
            id: it.foodId,
            name: it.name,
            brand: it.brand,
            barcode: it.barcode,
            per,
            servingSize: ['piece', 'portion'].includes(it.unit) && it.unitSize ? it.unitSize : it.servingSize,
            measures: it.measures,
            lastUnit: it.unit,
            prep: it.prep,
            source: it.source,
          });
        }
        await store.saveEntry({ ...entryFromItem({ ...it, foodId }, when), foodId });
      }
      if (saveMealCheck.checked && saveMealName.value.trim()) {
        await store.saveSavedMeal({ name: saveMealName.value, items: items.map(itemForSaving) });
      } else if (usedMealId) {
        await store.useSavedMeal(usedMealId);
      }
      toast(items.length > 1 ? t('meal.savedN', { n: items.length }) : t('entry.saved'));
      goBack('#/journal');
    } catch (err) {
      toast(t('err.generic', { msg: err.message }), 'error');
    }
  }
  saveBtn.addEventListener('click', saveAll);

  const saveRow = h(
    'div',
    { class: 'save-meal-row' },
    h('label', { class: 'check-row' }, saveMealCheck, h('span', {}, t('meal.saveAsMeal'))),
    saveMealName,
  );

  root.replaceChildren(
    h('h1', { class: 'page-title' }, t('entry.addTitle')),
    h(
      'section',
      { class: 'card when' },
      h('div', { class: 'grid2' },
        h('div', { class: 'field' }, h('label', { for: 'meal' }, t('entry.meal')), mealSel),
        h('div', { class: 'field' }, h('label', { for: 'time' }, t('entry.time')), timeIn)),
      h('div', { class: 'field narrow' }, h('label', { for: 'date' }, t('entry.date')), dateIn),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: 'food-search' }, t('meal.search')), search),
      results,
      h('div', { class: 'capture' },
        h('button', { type: 'button', class: 'btn', onclick: onScan }, t('entry.scan')),
        h('button', { type: 'button', class: 'btn', onclick: () => { location.hash = `#/add/detail?meal=${mealSel.value}&date=${dateIn.value}`; } }, t('meal.detailed'))),
      status,
    ),
    h('section', { class: 'card' }, list, totalsEl, saveRow),
    h('div', { class: 'actions sticky' }, saveBtn),
  );
  drawItems();
  showResults();
}

function shortName(name) {
  return name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

function fmtInputNum(v) {
  return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '';
}

function section(title, buttons) {
  return h('div', {}, h('div', { class: 'suggest-head muted small' }, title), h('ul', {}, buttons.map((b) => h('li', {}, b))));
}

function pick(name, info, onPick) {
  return h('button', { type: 'button', class: 'suggest-pick', onclick: onPick }, h('span', {}, name), h('small', { class: 'muted' }, info));
}

function plural(word, q) {
  if (q === 1 || /s$/.test(word)) return word;
  return /(ch|sh|x)$/.test(word) ? `${word}es` : `${word}s`;
}
