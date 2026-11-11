// "Add food": log one or several foods for a meal on one screen.
// Six big action tiles (scan, label photo, search, recent, my meals,
// calories only) feed "On your plate"; tap a plate row to adjust its amount.
// One big button saves everything. Combinations can be saved as a meal.
import { h, svg, toast } from './dom.js';
import { t, fmtKcal, fmtNumber, fmtDate } from '../i18n/i18n.js';
import { MEALS, MASS_UNITS, defaultMeal, nowTime, parseNumber } from '../core/entry.js';
import { scaleNutrients, sumNutrients } from '../core/calc.js';
import { today } from '../core/dates.js';
import * as store from '../data/store.js';
import { searchEveryday } from '../foods/everyday.js';
import { lookupBarcode, searchProducts } from '../foods/off.js';
import { scanBarcode } from './scanner.js';
import { amountSlider } from './slider.js';
import { getSelectedDate, goBack } from './state.js';
import {
  unitChoices, setUnit, itemTotals, mealTotals,
  itemFromFood, itemFromEveryday, itemFromProduct, itemCaloriesOnly,
  itemForSaving, itemsFromSavedMeal, entryFromItem,
} from '../core/meal.js';

export const live = false; // keeps the list while foods are added

const unitName = (u, q = 1) => (MASS_UNITS.includes(u) || q === 1 ? t(`unit.${u}`) : t(`unit.${u}.n`));

export async function render(root, rerender, params = {}) {
  const q = params.query || {};
  let items = [];
  let usedMealId = null;
  let openKey = null; // plate row whose amount editor is open
  let panel = null; // open tile: search | recent | meals | kcal
  const time = nowTime();

  // ---- When: meal, time, date (folded into the subtitle) -------------------
  const mealSel = h('select', { id: 'meal' }, MEALS.map((m) => h('option', { value: m }, t(`meal.${m}`))));
  mealSel.value = MEALS.includes(q.meal) ? q.meal : defaultMeal(time);
  const timeIn = h('input', { id: 'time', type: 'time', value: time });
  const dateIn = h('input', { id: 'date', type: 'date', value: q.date || getSelectedDate() });
  const whenBtn = h('button', { type: 'button', class: 'add-when', 'aria-expanded': 'false', 'aria-controls': 'add-when-fields' });
  const whenFields = h(
    'section',
    { class: 'card add-when-fields', id: 'add-when-fields', hidden: true },
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', { for: 'meal' }, t('entry.meal')), mealSel),
      h('div', { class: 'field' }, h('label', { for: 'time' }, t('entry.time')), timeIn)),
    h('div', { class: 'field narrow' }, h('label', { for: 'date' }, t('entry.date')), dateIn),
  );
  whenBtn.addEventListener('click', () => {
    whenFields.hidden = !whenFields.hidden;
    whenBtn.setAttribute('aria-expanded', String(!whenFields.hidden));
  });

  let left = null; // kcal left for the chosen day, before this meal
  async function loadLeft() {
    const [targets, entries] = await Promise.all([store.getTargets(), store.getEntriesForDate(dateIn.value)]);
    const goal = store.targetValues(targets);
    left = goal?.kcal > 0 ? goal.kcal - sumNutrients(entries).kcal : null;
    drawWhen();
  }
  function drawWhen() {
    const day = dateIn.value === today() ? t('dash.today') : fmtDate(new Date(`${dateIn.value}T12:00`), { weekday: 'short', day: 'numeric', month: 'short' });
    const parts = [t(`meal.${mealSel.value}`), `${day} ${timeIn.value}`];
    if (left !== null) {
      const after = left - mealTotals(items).kcal;
      parts.push(after >= 0 ? t('add.left', { kcal: fmtKcal(after) }) : t('add.over', { kcal: fmtKcal(-after) }));
    }
    whenBtn.replaceChildren(h('span', {}, parts.join(' · ')), glyphChevron());
    whenBtn.classList.toggle('over', left !== null && left - mealTotals(items).kcal < 0);
  }
  timeIn.addEventListener('change', () => {
    if (!q.meal) mealSel.value = defaultMeal(timeIn.value);
    drawWhen();
  });
  mealSel.addEventListener('change', drawWhen);
  dateIn.addEventListener('change', loadLeft);

  // ---- Shared bits ----------------------------------------------------------
  const search = h('input', { id: 'food-search', type: 'search', autocomplete: 'off', placeholder: t('meal.searchPh'), 'aria-label': t('meal.search') });
  const results = h('div', { class: 'suggest meal-results', id: 'meal-results' });
  const panelEl = h('section', { class: 'card add-panel', id: 'add-panel', hidden: true });
  const status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const list = h('div', { class: 'meal-items', id: 'meal-items' });
  const totalsEl = h('div', { class: 'plate-kcal num', id: 'meal-total', 'aria-label': t('add.total') });
  const saveBtn = h('button', { type: 'button', class: 'btn primary grow add-save', id: 'save-all' });
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
    openKey = newItems.length === 1 ? newItems[0].key : null;
    search.value = '';
    if (panel === 'search') showResults();
    drawItems();
    setStatus(null);
    const row = list.querySelector(`[data-key="${openKey}"]`);
    row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    if (newItems.length === 1 && newItems[0].caloriesOnly && !Number.isFinite(newItems[0].per.kcal)) row?.querySelector('.kcal-only input')?.focus();
  }

  // ---- Action tiles ---------------------------------------------------------
  const TILE_DEFS = [
    ['scan', 'scan', () => onScan()],
    ['photo', 'photo', () => { location.hash = `#/add/detail?meal=${mealSel.value}&date=${dateIn.value}&photo=1`; }],
    ['search', 'search', () => openPanel('search')],
    ['recent', 'recent', () => openPanel('recent')],
    ['meals', 'meals', () => openPanel('meals')],
    ['kcal', 'kcal', () => openPanel('kcal')],
  ];
  const tileBtns = {};
  const tiles = h('div', { class: 'add-tiles' }, TILE_DEFS.map(([id, ic, fn]) => {
    const b = h(
      'button',
      { type: 'button', class: `card add-tile tile-${id}`, id: `add-tile-${id}`, onclick: fn },
      icon(ic, 'add-tile-icon'),
      h('span', { class: 'add-tile-title' }, t(`add.tile.${id}`)),
    );
    if (['search', 'recent', 'meals', 'kcal'].includes(id)) b.setAttribute('aria-pressed', 'false');
    tileBtns[id] = b;
    return b;
  }));

  function openPanel(name) {
    panel = !name || (panel === name && name !== 'search') ? null : name;
    for (const [id, b] of Object.entries(tileBtns)) if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(id === panel));
    panelEl.hidden = !panel;
    if (!panel) return panelEl.replaceChildren();
    if (panel === 'search') {
      panelEl.replaceChildren(panelHead(t('add.tile.search')), search, results);
      showResults();
      search.focus();
    } else if (panel === 'recent') {
      panelEl.replaceChildren(panelHead(t('add.tile.recent')));
      drawRecent();
    } else if (panel === 'meals') {
      panelEl.replaceChildren(panelHead(t('add.tile.meals')));
      drawMeals();
    } else {
      drawKcalForm();
    }
    panelEl.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  function panelHead(title) {
    return h('div', { class: 'add-panel-head' }, h('h2', {}, title), h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('add.close'), onclick: () => openPanel(null) }, '×'));
  }

  async function drawRecent() {
    const foods = await store.recentFoods(10);
    if (panel !== 'recent') return;
    panelEl.replaceChildren(
      panelHead(t('add.tile.recent')),
      foods.length
        ? h('ul', { class: 'pick-list' }, foods.map((f) => h('li', {}, pick(f.name, foodInfo(f), () => add([itemFromFood(f)])))))
        : h('p', { class: 'muted small' }, t('add.noRecent')),
    );
  }

  async function drawMeals() {
    const meals = await store.getSavedMeals();
    if (panel !== 'meals') return;
    panelEl.replaceChildren(
      panelHead(t('add.tile.meals')),
      meals.length
        ? h('ul', { class: 'pick-list' }, meals.map((m) => h('li', {}, pick(m.name, t('meal.savedInfo', { n: m.items.length, kcal: fmtKcal(mealTotals(m.items).kcal) }), () => {
          usedMealId = m.id;
          add(itemsFromSavedMeal(m));
        }))))
        : h('p', { class: 'muted small' }, t('add.noMeals')),
    );
  }

  function drawKcalForm() {
    const nameIn = h('input', { id: 'kcal-name', type: 'text', maxlength: 80, autocomplete: 'off', placeholder: t('add.kcalNamePh') });
    const kcalIn = h('input', { id: 'kcal-value', type: 'text', inputmode: 'decimal', placeholder: '0' });
    const err = h('p', { class: 'err', id: 'kcal-error', role: 'alert' });
    const submit = (e) => {
      e.preventDefault();
      const name = nameIn.value.trim();
      const kcal = parseNumber(kcalIn.value);
      if (!name) { err.textContent = t('add.kcalNeedName'); nameIn.focus(); return; }
      if (!(kcal >= 0)) { err.textContent = t('add.kcalNeedValue'); kcalIn.focus(); return; }
      err.textContent = '';
      add([itemCaloriesOnly(name, kcal)]);
      nameIn.value = '';
      kcalIn.value = '';
    };
    panelEl.replaceChildren(
      panelHead(t('add.tile.kcal')),
      h('form', { class: 'add-kcal', onsubmit: submit, novalidate: true },
        h('div', { class: 'field' }, h('label', { for: 'kcal-name' }, t('add.kcalName')), nameIn),
        h('div', { class: 'field' }, h('label', { for: 'kcal-value' }, t('nutrient.kcal')), h('div', { class: 'with-unit' }, kcalIn, h('span', { class: 'unit' }, 'kcal'))),
        err,
        h('button', { type: 'submit', class: 'btn' }, t('add.kcalAdd'))),
    );
    nameIn.focus();
  }

  // ---- Search ---------------------------------------------------------------
  let token = 0;
  async function showResults() {
    const my = ++token;
    const text = search.value.trim();
    const lower = text.toLowerCase();
    const [meals, foods] = await Promise.all([store.getSavedMeals(), store.searchFoods(text, 5)]);
    if (my !== token) return;
    const sections = [];
    const mealsShown = text ? meals.filter((m) => m.name.toLowerCase().includes(lower)).slice(0, 3) : [];
    if (mealsShown.length) {
      sections.push(section(t('meal.savedHead'), mealsShown.map((m) => pick(m.name, t('meal.savedInfo', { n: m.items.length, kcal: fmtKcal(mealTotals(m.items).kcal) }), () => {
        usedMealId = m.id;
        add(itemsFromSavedMeal(m));
      }))));
    }
    if (foods.length && text) {
      sections.push(section(t('entry.matches'), foods.map((f) => pick(f.name, foodInfo(f), () => add([itemFromFood(f)])))));
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

  // ---- The plate --------------------------------------------------------------
  function update(keyId, fn) {
    items = items.map((it) => (it.key === keyId ? fn(it) : it));
    drawItems(keyId);
  }

  function amountText(it, quantity = it.quantity) {
    if (it.caloriesOnly) return t('add.kcalOnlyTag');
    return `${fmtInputNum(quantity)} ${optionLabel(it, it.unit, quantity)}`;
  }

  function itemRow(it) {
    const open = it.key === openKey;
    const n = itemTotals(it);
    const kcalNum = h('span', {}, n ? fmtKcal(n.kcal) : '–');
    const kcalEl = h('span', { class: 'num kcal' }, kcalNum, h('span', { class: 'kcal-unit' }, ' kcal'));
    const amountEl = h('span', { class: 'muted small num plate-amount' }, amountText(it));
    const toggle = h(
      'button',
      { type: 'button', class: 'plate-toggle', 'aria-expanded': String(open), 'aria-label': t('add.editAmount', { name: it.name }), onclick: () => { openKey = open ? null : it.key; drawItems(); } },
      h('span', { class: 'meal-item-name' }, h('strong', {}, it.name), it.brand ? h('span', { class: 'muted small' }, ` ${it.brand}`) : null, amountEl),
      kcalEl,
    );
    const top = h(
      'div',
      { class: 'meal-item-top' },
      toggle,
      h('button', { type: 'button', class: 'plate-remove', 'aria-label': t('meal.remove', { name: it.name }), onclick: () => { items = items.filter((x) => x.key !== it.key); if (openKey === it.key) openKey = null; drawItems(); } }, icon('close', 'plate-remove-icon')),
    );
    const li = h('li', { class: `meal-item${open ? ' open' : ''}${n ? '' : ' incomplete'}`, dataset: { key: it.key } }, top);
    if (!open) return li;

    const qty = h('input', { type: 'text', inputmode: 'decimal', class: 'qty', value: fmtInputNum(it.quantity), 'aria-label': t('entry.amount') });
    qty.addEventListener('change', () => {
      const v = parseNumber(qty.value);
      if (v > 0) update(it.key, (x) => ({ ...x, quantity: v }));
      else qty.value = fmtInputNum(it.quantity);
    });
    const choices = unitChoices(it);
    const unit = h('select', { class: 'unit', 'aria-label': t('entry.unit') }, choices.map((c) => h('option', { value: c.unit, selected: c.unit === it.unit }, optionLabel(it, c.unit, it.quantity))));
    unit.addEventListener('change', () => update(it.key, (x) => setUnit(x, unit.value)));

    if (it.caloriesOnly) {
      const kcalIn = h('div', { class: 'with-unit kcal-only' }, h('input', { type: 'text', inputmode: 'decimal', value: Number.isFinite(it.per.kcal) ? String(it.per.kcal) : '', placeholder: t('meal.kcalPh'), 'aria-label': t('nutrient.kcal') }), h('span', { class: 'unit' }, 'kcal'));
      kcalIn.querySelector('input').addEventListener('change', (e) => {
        const v = parseNumber(e.target.value);
        update(it.key, (x) => ({ ...x, per: { ...x.per, kcal: v >= 0 ? v : NaN } }));
      });
      li.append(kcalIn);
      return li;
    }
    // Slider: live updates of this row and the total while dragging,
    // without redrawing the list (that would interrupt the drag)
    const sizeEl = h('span', { class: 'muted small' });
    const live = (quantity) => {
      items = items.map((x) => (x.key === it.key ? { ...x, quantity } : x));
      const cur = items.find((x) => x.key === it.key);
      qty.value = fmtInputNum(quantity);
      const nn = itemTotals(cur);
      kcalNum.textContent = nn ? fmtKcal(nn.kcal) : '–';
      amountEl.textContent = amountText(cur, quantity);
      sizeEl.textContent = !MASS_UNITS.includes(cur.unit) && cur.unitSize > 0 ? `≈ ${fmtNumber(cur.unitSize * quantity, 0)} ${cur.per.unit}` : '';
      if (unit.tagName === 'SELECT') for (const o of unit.options) o.textContent = optionLabel(cur, o.value, quantity);
      drawTotals();
    };
    const slider = amountSlider({
      quantity: it.quantity,
      counted: !MASS_UNITS.includes(it.unit),
      base: it.baseGrams > 0 ? it.baseGrams : 100,
      label: t('meal.amountOf', { name: it.name }),
      onInput: live,
    });
    qty.addEventListener('input', () => {
      const v = parseNumber(qty.value);
      if (v > 0) slider?.setQuantity(v);
    });
    li.append(
      h('div', { class: 'meal-item-amount' }, qty, choices.length > 1 ? unit : h('span', { class: 'unit-fixed' }, unitName(it.unit, it.quantity)), sizeEl),
      slider,
    );
    live(it.quantity);
    return li;
  }

  function drawItems(focusKey) {
    if (!items.length) {
      list.replaceChildren(h('p', { class: 'muted small empty' }, t('add.empty')));
    } else {
      list.replaceChildren(h('ul', {}, items.map(itemRow)));
    }
    drawTotals();
    saveRow.hidden = items.length < 2 && !usedMealId;
    if (focusKey) list.querySelector(`[data-key="${focusKey}"] .qty`)?.blur();
  }

  function drawTotals() {
    const tt = mealTotals(items);
    totalsEl.textContent = items.length ? `${fmtKcal(tt.kcal)} kcal` : '';
    saveBtn.textContent = items.length
      ? t(items.length === 1 ? 'add.save1' : 'add.saveN', { n: items.length, kcal: fmtKcal(tt.kcal) })
      : t('add.saveNone');
    saveBtn.disabled = !items.length;
    drawWhen();
  }

  // ---- Save -----------------------------------------------------------------
  async function saveAll() {
    if (!items.length) return;
    const bad = items.find((it) => !itemTotals(it));
    if (bad) {
      toast(bad.caloriesOnly ? t('meal.needKcal', { name: bad.name }) : t('meal.needAmount', { name: bad.name }), 'error');
      openKey = bad.key;
      drawItems();
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
    h(
      'header',
      { class: 'add-head' },
      h('button', { type: 'button', class: 'icon-btn add-back', 'aria-label': t('add.back'), onclick: () => goBack('#/journal') }, icon('back', 'add-back-icon')),
      h('div', { class: 'add-head-text' }, h('h1', { class: 'page-title' }, t('entry.addTitle')), whenBtn),
    ),
    whenFields,
    tiles,
    panelEl,
    status,
    h(
      'section',
      { class: 'card plate' },
      h('div', { class: 'plate-head' }, h('h2', {}, t('add.plate')), totalsEl),
      list,
      saveRow,
    ),
    h('p', { class: 'add-detail' }, h('a', { class: 'link-btn', href: `#/add/detail?meal=${mealSel.value}&date=${dateIn.value}`, onclick: (e) => { e.currentTarget.href = `#/add/detail?meal=${mealSel.value}&date=${dateIn.value}`; } }, t('add.detailed'))),
    h('div', { class: 'actions sticky add-actions' }, saveBtn),
  );

  // Opened from the dashboard's Scan barcode tile: go straight to the camera.
  // The flag is removed so going back here doesn't open it again.
  if (q.scan === '1') {
    history.replaceState(null, '', location.href.replace(/[?&]scan=1/, (m) => (m[0] === '?' ? '?' : '')).replace('?&', '?').replace(/\?$/, ''));
    onScan();
  }
  drawItems();
  loadLeft();
}

const TILE_ICON = {
  scan: ['M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2', 'M8 8v8M11 8v8M14 8v8M17 8v8'],
  photo: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  recent: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  meals: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  kcal: ['M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 12 15.5 4 4 0 0 1 8 11.5c0-1.6.8-2.6 1.6-3.4.2 1.4 1 2.2 1.9 2.4C11 8 11 5.5 12 3z'],
  back: ['M15 6l-6 6 6 6'],
  close: ['M6 6l12 12M18 6L6 18'],
};

function icon(name, cls) {
  return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: cls }, TILE_ICON[name].map((d) => svg('path', { d })));
}

function glyphChevron() {
  return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'add-when-chev' }, svg('path', { d: 'M8 10l4 4 4-4' }));
}

function foodInfo(f) {
  return [f.brand, `${fmtKcal(f.per.kcal)} kcal / ${fmtNumber(f.per.amount, 1)} ${unitName(f.per.unit, f.per.amount)}`].filter(Boolean).join(' · ');
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

function fracLabel(v) {
  return { 0.25: '¼', 0.5: '½', 1: '1', 1.5: '1½', 2: '2' }[v] || String(v);
}

function optionLabel(it, unit, q) {
  if (unit === 'portion' && it.portionLabel) return plural(it.portionLabel, q);
  return MASS_UNITS.includes(unit) || q === 1 ? t(`unit.${unit}`) : t(`unit.${unit}.n`);
}
