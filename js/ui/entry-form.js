// Add / edit a journal entry.
import { h, toast } from './dom.js';
import { t, fmtKcal, fmtNumber } from '../i18n/i18n.js';
import { MEALS, UNITS, MASS_UNITS, PREPARATIONS, computeEntry, defaultMeal, nowTime, parseNumber, validateEntry } from '../core/entry.js';
import { NUTRIENTS, scaleNutrients } from '../core/calc.js';
import * as store from '../data/store.js';
import { lookupBarcode } from '../foods/off.js';
import { parseLabelText } from '../foods/label-parse.js';
import { recognizeLabel } from '../foods/ocr.js';
import { scanBarcode } from './scanner.js';
import { getSelectedDate, goBack } from './state.js';

// The form keeps its own state; it must not be re-rendered by store changes.
export const live = false;

const r1 = (v) => Math.round(v * 10) / 10;
const fmtInput = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(r1(v)) : '');
const unitLabel = (u, qty = 1) => (MASS_UNITS.includes(u) || qty === 1 ? t(`unit.${u}`) : t(`unit.${u}.n`));

function field(id, label, control, extra = {}) {
  return h(
    'div',
    { class: `field ${extra.class || ''}`, id: `f-${id}`, hidden: extra.hidden },
    h('label', { for: id, id: `l-${id}` }, label),
    control,
    extra.hint ? h('small', { class: 'muted', id: `h-${id}` }, extra.hint) : null,
    h('small', { class: 'err', id: `e-${id}` }),
  );
}

const numInput = (id, attrs = {}) => h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', ...attrs });

export async function render(root, rerender, params = {}) {
  const editing = params.id ? await store.getEntry(params.id) : null;
  if (params.id && !editing) {
    root.replaceChildren(h('section', { class: 'card' }, h('p', {}, t('entry.notFound')), h('a', { class: 'btn', href: '#/journal' }, t('nav.journal'))));
    return;
  }

  // Non-input state
  const s = {
    foodId: editing?.foodId,
    brand: editing?.brand || '',
    barcode: editing?.barcode || '',
    servingSize: undefined,
    source: editing?.source || 'manual',
    valuesEdited: false,
    mode: 'per100',
    base: 'g',
    scaleBase: null, // { qty, vals } for proportional scaling in "total" mode
  };

  // ---- Controls ------------------------------------------------------------
  const $ = {};
  $.name = h('input', { id: 'name', type: 'text', autocomplete: 'off', maxlength: 120, placeholder: t('entry.name.ph') });
  $.suggest = h('div', { class: 'suggest', id: 'suggest' });
  $.meal = h('select', { id: 'meal' }, MEALS.map((m) => h('option', { value: m }, t(`meal.${m}`))));
  $.time = h('input', { id: 'time', type: 'time', required: true });
  $.date = h('input', { id: 'date', type: 'date', required: true });
  $.modePer100 = h('input', { type: 'radio', name: 'mode', value: 'per100', id: 'mode-per100' });
  $.modeTotal = h('input', { type: 'radio', name: 'mode', value: 'total', id: 'mode-total' });
  $.base = h('select', { id: 'base' }, ['g', 'ml'].map((u) => h('option', { value: u }, t(`entry.base.${u}`))));
  $.qty = numInput('qty');
  $.unit = h('select', { id: 'unit', 'aria-label': t('entry.amount') });
  $.usize = numInput('usize');
  $.vals = Object.fromEntries(NUTRIENTS.map((k) => [k, numInput(`v-${k}`)]));
  $.prep = h('select', { id: 'prep' }, PREPARATIONS.map((p) => h('option', { value: p }, t(`prep.${p}`))));
  $.notes = h('textarea', { id: 'notes', rows: 2, maxlength: 500 });
  $.saveFood = h('input', { type: 'checkbox', id: 'savefood', checked: true });
  $.status = h('div', { class: 'status', id: 'status', role: 'status', 'aria-live': 'polite' });
  $.result = h('div', { class: 'result', id: 'result' });
  $.valuesHead = h('h3', { class: 'values-head' });
  $.sourceLine = h('p', { class: 'muted small', id: 'source-line' });
  $.file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });

  // ---- Helpers -------------------------------------------------------------
  const unitOptions = () => (s.mode === 'per100' ? [s.base, 'portion', 'piece'] : UNITS);

  function refreshUnits(want) {
    const cur = want ?? $.unit.value;
    const opts = unitOptions();
    $.unit.replaceChildren(...opts.map((u) => h('option', { value: u }, t(`unit.${u}`))));
    $.unit.value = opts.includes(cur) ? cur : opts[0];
    s.lastUnit = $.unit.value;
  }

  function readValues() {
    return Object.fromEntries(NUTRIENTS.map((k) => [k, parseNumber($.vals[k].value)]));
  }

  function setValues(v, { only } = {}) {
    for (const k of NUTRIENTS) {
      if (only && !only.includes(k)) continue;
      $.vals[k].value = fmtInput(v?.[k]);
      $.vals[k].classList.remove('check');
    }
  }

  function draft() {
    const qty = parseNumber($.qty.value);
    const unit = $.unit.value;
    const usize = parseNumber($.usize.value);
    const vals = readValues();
    const per = s.mode === 'per100' ? { amount: 100, unit: s.base, ...vals } : { amount: qty, unit, ...vals };
    return {
      name: $.name.value.trim(),
      meal: $.meal.value,
      time: $.time.value,
      date: $.date.value,
      quantity: qty,
      unit,
      unitSize: !MASS_UNITS.includes(unit) && MASS_UNITS.includes(per.unit) ? usize : undefined,
      per,
      prep: $.prep.value,
      notes: $.notes.value.trim(),
    };
  }

  function setMode(mode) {
    s.mode = mode;
    $.modePer100.checked = mode === 'per100';
    $.modeTotal.checked = mode === 'total';
    root.querySelector('#f-base').hidden = mode !== 'per100';
    refreshUnits();
  }

  function captureScaleBase() {
    const qty = parseNumber($.qty.value);
    s.scaleBase = s.mode === 'total' && qty > 0 ? { qty, vals: readValues() } : null;
  }

  /** Switch between per-100 and total, converting the numbers. */
  function switchMode(mode) {
    if (mode === s.mode) return;
    const d = draft();
    const haveVals = NUTRIENTS.some((k) => Number.isFinite(d.per[k]));
    if (mode === 'total') {
      let totals = null;
      try {
        if (haveVals && d.quantity > 0) totals = computeEntry(d);
      } catch {
        /* missing portion size: leave numbers */
      }
      setMode('total');
      if (totals) setValues(totals);
      captureScaleBase();
    } else {
      const qty = d.quantity;
      let grams = null;
      let base = s.base;
      if (MASS_UNITS.includes(d.unit)) {
        grams = qty;
        base = d.unit;
      } else if (d.unitSize > 0 || parseNumber($.usize.value) > 0) grams = qty * parseNumber($.usize.value);
      s.base = base;
      $.base.value = base;
      setMode('per100');
      if (haveVals && grams > 0) setValues(scaleNutrients(d.per, 100, grams));
      else if (haveVals) {
        setValues(null);
        toast(t('entry.convertNeedsSize', { unit: unitLabel(d.unit) }));
      }
      s.scaleBase = null;
    }
    update();
  }

  function setStatus(lines, kind = 'info') {
    const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    $.status.className = `status ${kind}`;
    $.status.replaceChildren(...list.map((l) => h('p', {}, l)));
  }

  function showErrors(errors) {
    root.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    root.querySelectorAll('.err').forEach((e) => (e.textContent = ''));
    const map = { quantity: 'qty', unitSize: 'usize', kcal: 'v-kcal', protein: 'v-protein', carbs: 'v-carbs', fat: 'v-fat' };
    for (const [k, code] of Object.entries(errors)) {
      const id = map[k] || k;
      root.querySelector(`#f-${id}`)?.classList.add('invalid');
      const el = root.querySelector(`#e-${id}`);
      if (el) el.textContent = code === 'required' && k === 'unitSize' ? t('entry.err.unitSize', { unit: unitLabel($.unit.value) }) : t(`entry.err.${code}`);
    }
  }

  // Live preview and labels
  function update() {
    const d = draft();
    const needsSize = d.unitSize !== undefined || (!MASS_UNITS.includes(d.unit) && MASS_UNITS.includes(d.per.unit));
    const sizeField = root.querySelector('#f-usize');
    sizeField.hidden = !needsSize;
    root.querySelector('#l-usize').textContent = t('entry.unitSize', { unit: unitLabel(d.unit) });
    root.querySelector('#h-usize').textContent = t('entry.unitSize.hint', { base: s.base });
    root.querySelector('#u-usize').textContent = s.base;
    const qtyTxt = Number.isFinite(d.quantity) ? fmtNumber(d.quantity, 2) : '…';
    $.valuesHead.textContent = s.mode === 'per100' ? t('entry.values.per100', { unit: s.base }) : t('entry.values.total', { qty: qtyTxt, unit: unitLabel(d.unit, d.quantity) });
    for (const k of NUTRIENTS) root.querySelector(`#u-${k}`).textContent = k === 'kcal' ? 'kcal' : 'g';

    const v = validateEntry({ ...d, name: d.name || 'x', meal: d.meal, date: d.date, time: d.time });
    let line = '–';
    if (v.valid) {
      const n = computeEntry(d);
      line = t('entry.resultLine', { kcal: fmtKcal(n.kcal), p: fmtNumber(n.protein, 1), c: fmtNumber(n.carbs, 1), f: fmtNumber(n.fat, 1) });
    }
    $.result.replaceChildren(
      h('strong', {}, t('entry.result')),
      h('div', { class: 'num' }, line),
      ...(v.valid ? v.warnings.map((w) => h('p', { class: 'warn small' }, t(`entry.warn.${w}`))) : []),
    );
    const src = s.source === 'database' && s.valuesEdited ? 'manual' : s.source;
    $.sourceLine.textContent = t('entry.sourceLine', { source: t(`source.${src}`) });
  }

  // ---- Fill from sources ---------------------------------------------------
  function applyFood(f, { source } = {}) {
    $.name.value = f.name;
    s.foodId = f.id;
    s.brand = f.brand || '';
    s.barcode = f.barcode || s.barcode;
    s.servingSize = f.servingSize;
    s.source = source || f.source || 'manual';
    s.valuesEdited = false;
    $.prep.value = f.prep || '';
    if (f.per.amount === 100 && MASS_UNITS.includes(f.per.unit)) {
      s.base = f.per.unit;
      $.base.value = s.base;
      setMode('per100');
      setValues(f.per);
      if (f.servingSize > 0) {
        refreshUnits('portion');
        $.qty.value = '1';
        $.usize.value = fmtInput(f.servingSize);
      } else {
        refreshUnits(s.base);
        $.qty.value = '100';
      }
    } else {
      setMode('total');
      refreshUnits(f.per.unit);
      $.qty.value = fmtInput(f.per.amount);
      setValues(f.per);
      captureScaleBase();
    }
    hideSuggestions();
    update();
  }

  /** Clear a previously loaded product (its data no longer matches the scan). */
  function clearLoadedFood() {
    if (!s.foodId && s.source !== 'database') return;
    $.name.value = '';
    setValues(null);
    s.foodId = undefined;
    s.brand = '';
    s.servingSize = undefined;
    s.source = 'manual';
    setMode('per100');
    refreshUnits(s.base);
    $.qty.value = '';
    $.usize.value = '';
    update();
  }

  async function onScan() {
    const code = await scanBarcode();
    if (!code) return;
    setStatus(t('scan.looking', { code }));
    const local = await store.findFoodByBarcode(code);
    if (local) {
      applyFood(local);
      setStatus(t('scan.foundLocal'), 'ok');
      return;
    }
    try {
      const f = await lookupBarcode(code);
      if (!f) {
        clearLoadedFood();
        s.barcode = code;
        setStatus(t('scan.notFound', { code }), 'warn');
        return;
      }
      s.barcode = code;
      const missing = NUTRIENTS.filter((k) => f.per[k] === undefined);
      applyFood({ ...f, id: undefined }, { source: 'database' });
      if (!f.name) $.name.value = '';
      setStatus(missing.length ? t('scan.incomplete', { list: missing.map((k) => t(`nutrient.${k}`)).join(', ') }) : t('scan.found'), missing.length ? 'warn' : 'ok');
      if (!f.name) $.name.focus();
    } catch (err) {
      clearLoadedFood();
      s.barcode = code;
      setStatus(t({ offline: 'scan.offline', timeout: 'scan.timeout' }[err.message] || 'scan.error'), 'error');
    }
  }

  $.file.addEventListener('change', async () => {
    const file = $.file.files?.[0];
    $.file.value = '';
    if (!file) return;
    setStatus(t('ocr.loading'));
    try {
      const text = await recognizeLabel(file, ({ stage, progress }) => {
        if (stage === 'reading') setStatus(t('ocr.reading', { pct: Math.round(progress * 100) }));
      });
      const r = parseLabelText(text);
      const found = NUTRIENTS.filter((k) => r.values[k] !== undefined);
      if (!found.length) {
        setStatus(t('ocr.nothing'), 'error');
        return;
      }
      // Keep a typed weight; otherwise start from 100 g/ml. Portions from a
      // previously loaded product never carry over.
      const keepQty = MASS_UNITS.includes($.unit.value) && parseNumber($.qty.value) > 0 && !s.servingSize;
      if (r.basis) s.base = r.basis;
      $.base.value = s.base;
      setMode('per100');
      refreshUnits(s.base);
      if (!keepQty) $.qty.value = '100';
      $.usize.value = '';
      s.servingSize = undefined;
      setValues(r.values);
      for (const k of r.uncertain) $.vals[k].classList.add('check');
      s.source = 'label';
      s.valuesEdited = false;
      setStatus(
        [
          t('ocr.done'),
          r.missing.length ? t('ocr.missing', { list: r.missing.map((k) => t(`nutrient.${k}`)).join(', ') }) : null,
          r.kcalFromKj ? t('ocr.kj') : null,
        ],
        r.missing.length || r.uncertain.length ? 'warn' : 'ok',
      );
      update();
    } catch (err) {
      if (err.message !== 'download') console.error(err);
      setStatus(err.message === 'download' ? t('ocr.downloadFailed') : t('ocr.failed', { msg: err.message }), 'error');
    }
  });

  // ---- Suggestions from the personal food library --------------------------
  let suggestToken = 0;
  async function showSuggestions() {
    const token = ++suggestToken;
    const q = $.name.value;
    const foods = await store.searchFoods(q, 6);
    if (token !== suggestToken) return;
    if (!foods.length) return hideSuggestions();
    $.suggest.replaceChildren(
      h('div', { class: 'suggest-head muted small' }, q.trim() ? t('entry.matches') : t('entry.recent')),
      h(
        'ul',
        {},
        foods.map((f) =>
          h(
            'li',
            {},
            h(
              'button',
              { type: 'button', class: 'suggest-pick', onclick: () => applyFood(f) },
              h('span', {}, f.name, f.prep ? h('span', { class: 'tag' }, t(`prep.${f.prep}`)) : null),
              h('small', { class: 'muted' }, [f.brand, `${fmtKcal(f.per.kcal)} kcal / ${fmtNumber(f.per.amount, 1)} ${unitLabel(f.per.unit, f.per.amount)}`].filter(Boolean).join(' · ')),
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'suggest-remove',
                'aria-label': t('entry.removeFood', { name: f.name }),
                onclick: async () => {
                  if (!confirm(t('entry.removeFoodConfirm', { name: f.name }))) return;
                  await store.deleteFood(f.id);
                  if (s.foodId === f.id) s.foodId = undefined;
                  showSuggestions();
                },
              },
              '×',
            ),
          ),
        ),
      ),
    );
    $.suggest.hidden = false;
  }
  function hideSuggestions() {
    suggestToken++;
    $.suggest.hidden = true;
    $.suggest.replaceChildren();
  }

  // ---- Events --------------------------------------------------------------
  $.name.addEventListener('input', () => {
    // A new name is a new food unless picked again; detach the previous
    // product so its barcode and portion size can't leak into this one.
    if (s.foodId || s.servingSize) {
      s.foodId = undefined;
      s.barcode = '';
      s.brand = '';
      s.servingSize = undefined;
    }
    showSuggestions();
  });
  $.modePer100.addEventListener('change', () => switchMode('per100'));
  $.modeTotal.addEventListener('change', () => switchMode('total'));
  $.base.addEventListener('change', () => {
    s.base = $.base.value;
    refreshUnits(MASS_UNITS.includes($.unit.value) ? s.base : $.unit.value);
    update();
  });
  $.unit.addEventListener('change', () => {
    const prevUnit = s.lastUnit;
    if (s.mode === 'total' && s.scaleBase) captureScaleBase();
    // Per-100 foods: "200 g" should become "1 portion", not "200 portions"
    if (s.mode === 'per100' && prevUnit) {
      const fromMass = MASS_UNITS.includes(prevUnit);
      const toMass = MASS_UNITS.includes($.unit.value);
      if (fromMass && !toMass) {
        $.qty.value = '1';
        if (!$.usize.value && s.servingSize) $.usize.value = fmtInput(s.servingSize);
      } else if (!fromMass && toMass) {
        const grams = parseNumber($.qty.value) * parseNumber($.usize.value);
        $.qty.value = grams > 0 ? fmtInput(grams) : '100';
      }
    }
    s.lastUnit = $.unit.value;
    update();
  });
  $.qty.addEventListener('input', () => {
    // Totals scale with the amount once they describe a known food or entry
    const q = parseNumber($.qty.value);
    if (s.mode === 'total' && s.scaleBase && q > 0) {
      setValues(Object.fromEntries(NUTRIENTS.map((k) => [k, (s.scaleBase.vals[k] * q) / s.scaleBase.qty])));
    }
    update();
  });
  for (const k of NUTRIENTS) {
    $.vals[k].addEventListener('input', () => {
      $.vals[k].classList.remove('check');
      s.valuesEdited = true;
      // Freshly typed totals don't scale (the amount may still be corrected);
      // totals of a known food or entry keep scaling from the edited values.
      if (s.mode === 'total' && s.scaleBase) captureScaleBase();
      update();
    });
  }
  for (const el of [$.usize, $.meal, $.time, $.date, $.prep]) el.addEventListener('input', update);
  $.time.addEventListener('change', () => {
    if (!editing && !params.query?.meal) $.meal.value = defaultMeal($.time.value);
  });

  async function save(e) {
    e.preventDefault();
    const d = draft();
    const { errors, valid } = validateEntry(d);
    showErrors(errors);
    if (!valid) {
      toast(t('entry.invalid'), 'error');
      root.querySelector('.field.invalid input, .field.invalid select')?.focus();
      return;
    }
    const source = s.source === 'database' && s.valuesEdited ? 'manual' : s.source;
    const totals = computeEntry(d);
    try {
      let foodId = s.foodId;
      if ($.saveFood.checked) {
        // Library foods are stored per 100 g/ml when the amount is a weight
        const per = MASS_UNITS.includes(d.per.unit) && d.per.amount !== 100 ? { amount: 100, unit: d.per.unit, ...scaleNutrients(d.per, 100, d.per.amount) } : d.per;
        foodId = await store.rememberFood({
          id: s.foodId,
          name: d.name,
          brand: s.brand,
          barcode: s.barcode,
          per,
          servingSize: d.unitSize || s.servingSize,
          prep: d.prep,
          source,
        }, { countUse: !editing });
      }
      await store.saveEntry({
        ...(editing || {}),
        date: d.date,
        time: d.time,
        meal: d.meal,
        name: d.name,
        brand: s.brand,
        barcode: s.barcode,
        foodId,
        quantity: d.quantity,
        unit: d.unit,
        unitSize: d.unitSize,
        per: d.per,
        prep: d.prep,
        notes: d.notes,
        source,
        ...totals,
      });
      toast(t('entry.saved'));
      goBack('#/journal');
    } catch (err) {
      toast(t('err.generic', { msg: err.message }), 'error');
    }
  }

  // ---- Layout --------------------------------------------------------------
  const valuesGrid = h(
    'div',
    { class: 'grid2' },
    NUTRIENTS.map((k) => field(`v-${k}`, t(`nutrient.${k}`), h('div', { class: 'with-unit' }, $.vals[k], h('span', { class: 'unit', id: `u-${k}` })))),
  );

  const form = h(
    'form',
    { class: 'entry-form', novalidate: true, onsubmit: save },
    h('h1', { class: 'page-title' }, editing ? t('entry.editTitle') : t('entry.addTitle')),
    h(
      'div',
      { class: 'capture' },
      h('button', { type: 'button', class: 'btn', onclick: onScan }, t('entry.scan')),
      h('button', { type: 'button', class: 'btn', onclick: () => $.file.click() }, t('entry.photo')),
      $.file,
    ),
    $.status,
    h(
      'section',
      { class: 'card' },
      field('name', t('entry.name'), $.name),
      $.suggest,
      h('div', { class: 'grid2' }, field('meal', t('entry.meal'), $.meal), field('time', t('entry.time'), $.time)),
      field('date', t('entry.date'), $.date, { class: 'narrow' }),
    ),
    h(
      'section',
      { class: 'card' },
      h(
        'fieldset',
        { class: 'segmented' },
        h('legend', {}, t('entry.mode')),
        h('label', {}, $.modePer100, h('span', {}, t('entry.mode.per100'))),
        h('label', {}, $.modeTotal, h('span', {}, t('entry.mode.total'))),
      ),
      field('base', t('entry.base'), $.base),
      h(
        'div',
        { class: 'grid2' },
        field('qty', t('entry.amount'), $.qty),
        field('unit', ' ', $.unit),
      ),
      field('usize', '', h('div', { class: 'with-unit' }, $.usize, h('span', { class: 'unit', id: 'u-usize' }, 'g')), { hint: ' ', hidden: true }),
      $.valuesHead,
      valuesGrid,
      $.result,
      $.sourceLine,
    ),
    h(
      'section',
      { class: 'card' },
      field('prep', t('entry.prep'), $.prep, { hint: t('entry.prep.hint') }),
      field('notes', t('entry.notes'), $.notes),
      h('label', { class: 'check-row' }, $.saveFood, h('span', {}, t('entry.saveFood'))),
    ),
    h(
      'div',
      { class: 'actions sticky' },
      h('button', { type: 'submit', class: 'btn primary grow' }, t('entry.save')),
      editing
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn',
              onclick: async () => {
                await store.duplicateEntry(editing.id);
                toast(t('entry.duplicated'));
                goBack('#/journal');
              },
            },
            t('entry.duplicate'),
          )
        : null,
      editing
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn danger',
              onclick: async () => {
                const old = await store.deleteEntry(editing.id);
                goBack('#/journal');
                toast(t('entry.deleted', { name: old.name }), 'info', { label: t('common.undo'), fn: () => store.restoreEntry(old) });
              },
            },
            t('entry.delete'),
          )
        : null,
    ),
  );

  root.replaceChildren(form);

  // ---- Initial values ------------------------------------------------------
  if (editing) {
    $.name.value = editing.name;
    $.meal.value = editing.meal;
    $.time.value = editing.time;
    $.date.value = editing.date;
    $.prep.value = editing.prep || '';
    $.notes.value = editing.notes || '';
    const p = editing.per;
    if (p.amount === 100 && MASS_UNITS.includes(p.unit)) {
      s.base = p.unit;
      $.base.value = s.base;
      setMode('per100');
      refreshUnits(editing.unit);
      setValues(p);
      if (editing.unitSize) $.usize.value = fmtInput(editing.unitSize);
    } else {
      setMode('total');
      refreshUnits(editing.unit);
      setValues(editing); // totals as eaten
    }
    $.qty.value = fmtInput(editing.quantity);
    if (s.mode === 'total') captureScaleBase();
    $.saveFood.checked = !!editing.foodId;
  } else {
    const time = nowTime();
    $.time.value = time;
    $.date.value = params.query?.date || getSelectedDate();
    $.meal.value = MEALS.includes(params.query?.meal) ? params.query.meal : defaultMeal(time);
    setMode('per100');
    refreshUnits('g');
    showSuggestions();
  }
  update();
}
