import { h, svg } from './dom.js';
import { t, fmtKcal, fmtNumber } from '../i18n/i18n.js';
import { sumNutrients, sumExtras, remainingNutrients, EXTRAS } from '../core/calc.js';
import * as store from '../data/store.js';
import { recommendationFor, estimatedTargetsOutdated } from './targets-compare.js';
import { getSelectedDate } from './state.js';
import { todaysSuggestions, addToJournal } from './ideas.js';
import { today } from '../core/dates.js';
import { dashboardStatus } from './diet-status.js';
import { DIETS, FASTING, nutrientGoals, activeFast } from '../core/diet.js';
import { macroBar, nutrientRings } from '../core/dash.js';
import { withTypicalExtras } from '../foods/everyday.js';
import { tileLayout, tileRows, saveShape, placeTile, showTile, hideTile } from '../core/tiles.js';
import { dragSort, keyMove } from './drag-sort.js';
import { waterOn, fmtWater, workoutsOn, WATER_GOAL_ML, WATER_STEP_ML } from '../core/activity.js';
import { MEALS } from '../core/entry.js';
import { icon } from './icons.js';
import { withLights } from './lights.js';
import { dayLabel } from './daynav.js';
import { setSelectedDate } from './state.js';
import { addDays, parseISODate } from '../core/dates.js';
import { fmtDate } from '../i18n/i18n.js';

const grams = (n) => fmtNumber(Math.abs(n), Math.abs(n) < 10 && !Number.isInteger(n) ? 1 : 0);
// Bar labels: what you've eaten of the target, e.g. "110 / 121 g"
const amountText = (s) => t('dash.gOf', { eaten: fmtNumber(s.eaten), target: fmtNumber(s.target) });

/** A progress ring of `size` px with a `stroke`-wide line. */
function ringSvg(ratio, label, size = 88, stroke = 7, gradId = null) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const c = size / 2;
  return svg(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': label, class: 'progress-ring' },
    gradId ? svg('defs', {}, svg('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '1', y2: '1' },
      svg('stop', { offset: '0', 'stop-color': '#9be3ff' }), svg('stop', { offset: '0.55', 'stop-color': '#3aa8ff' }), svg('stop', { offset: '1', 'stop-color': '#1d5fff' }))) : null,
    svg('g', { transform: `rotate(-90 ${c} ${c})`, fill: 'none' },
      svg('circle', { class: 'ring-track', cx: c, cy: c, r, 'stroke-width': stroke }),
      svg('circle', { class: 'ring-fill', cx: c, cy: c, r, 'stroke-width': stroke, stroke: gradId ? `url(#${gradId})` : null, 'stroke-linecap': ratio > 0.005 ? 'round' : 'butt', 'stroke-dasharray': `${(Math.max(0, Math.min(1, ratio)) * C).toFixed(1)} ${C.toFixed(1)}`, style: `--circ:${C.toFixed(1)}` })),
  );
}

const MACRO_ICON = { protein: 'beef', carbs: 'wheat', fat: 'droplet' };

function macroCard(goal, eaten) {
  const rem = remainingNutrients(goal, { ...eaten, kcal: Math.round(eaten.kcal) });
  const over = rem.kcal < 0;
  const ratio = goal.kcal > 0 ? eaten.kcal / goal.kcal : 0;
  const { sections } = macroBar(goal, eaten);
  const cols = sections.map((s) => h(
    'div',
    { class: `macro-item mc-${s.key}${s.over ? ' over' : ''}` },
    h('div', { class: 'macro-heading' }, icon(MACRO_ICON[s.key], 'macro-icon'), h('span', {}, t(`nutrient.short.${s.key}`))),
    h('div', { class: 'macro-value num' }, fmtNumber(s.eaten), ' ', h('small', {}, `/ ${fmtNumber(s.target)}g`)),
    h('div', { class: 'progress-track', 'aria-hidden': 'true' }, h('div', { class: 'progress-fill', style: { width: `${Math.min(1, s.ratio) * 100}%` } })),
    h('div', { class: 'macro-caption num' }, s.over
      ? t('dash.macroOver', { pct: s.pct, n: fmtNumber(s.eaten - s.target) })
      : t('dash.macroLeft', { pct: s.pct, n: fmtNumber(Math.max(0, s.target - s.eaten)) })),
  ));
  return [h(
    'section',
    { class: `card glass calorie-card${over ? ' over' : ''}` },
    h(
      'div',
      { class: 'calorie-main' },
      h(
        'div',
        { class: 'calorie-ring' },
        ringSvg(ratio, t('dash.calRing', { eaten: fmtKcal(eaten.kcal), target: fmtKcal(goal.kcal) }), 220, 17, 'calGrad'),
        h('div', { class: 'calorie-center' },
          icon('flame', 'cal-flame'),
          h('strong', { class: 'num' }, fmtKcal(Math.abs(rem.kcal))),
          h('span', {}, t(over ? 'dash.kcalOver' : 'dash.kcalLeft'))),
      ),
      h(
        'div',
        { class: 'calorie-stats' },
        statRow('utensils', fmtKcal(eaten.kcal), t('dash.eatenWord')),
        statRow('target', fmtKcal(goal.kcal), t('dash.targetWord')),
        statRow('clock', `${Math.round(ratio * 100)}%`, t('dash.usedWord')),
      ),
    ),
  ), h('section', { class: 'card glass macro-card', 'aria-label': t('dash.macrosLabel') }, h('div', { class: 'macro-grid' }, cols))];
}

function statRow(name, value, label) {
  return h('div', { class: 'stat-row' }, icon(name, 'stat-icon'), h('div', {}, h('strong', { class: 'num' }, value), h('span', {}, label)));
}

const NUT_ICON = { fibre: 'leaf', sugar: 'candy', satFat: 'droplet', salt: 'salt' };

function ring(r, count) {
  const value = r.key === 'salt' ? fmtNumber(r.value, 1) : fmtNumber(Math.round(r.value));
  const diff = r.key === 'salt' ? fmtNumber(r.diff, 1) : grams(Math.round(r.diff));
  const sub = r.state === 'reached' ? t('dash.reached') : t(r.kind === 'max' ? `dash.${r.state}Max` : 'dash.toGo', { n: diff });
  const name = t(`nutrient.short.${r.key}`);
  const unknown = count - r.known;
  return h(
    'div',
    { class: `nutrient-card nring-${r.key}${r.state === 'over' ? ' over-limit' : ''}` },
    h('div', { class: 'nutrient-ring' },
      ringSvg(r.ratio, `${name}: ${value} / ${r.target} g, ${sub}`, 88, 7),
      h('strong', { class: 'num', 'aria-hidden': 'true' }, `${r.pct}%`)),
    icon(NUT_ICON[r.key], 'nutrient-icon'),
    h('h3', {}, t(`dash.nutName.${r.key}`)),
    h('p', { class: 'num' }, t('dash.gOf', { eaten: value, target: fmtNumber(r.target) })),
    h('span', { class: 'mini-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.min(1, r.ratio) * 100}%` } })),
    r.state === 'over' ? h('small', { class: 'num' }, sub) : null,
    unknown > 0 ? h('small', { class: 'nring-unknown' }, t(unknown === 1 ? 'dash.unknown1' : 'dash.unknown', { n: unknown })) : null,
  );
}

function ringsCard(entries, goal, dietStyle) {
  const extras = sumExtras(entries);
  const rings = nutrientRings(extras, nutrientGoals(goal, dietStyle));
  const anyUnknown = rings.some((r) => r.known < extras.count);
  return h(
    'section',
    { class: 'dash-rings', 'aria-label': t('tile.nutrients') },
    h('div', { class: 'nutrient-grid' }, rings.map((r) => ring(r, extras.count))),
    anyUnknown ? h('p', { class: 'muted small dash-partial' }, t('dash.unknownHint')) : null,
  );
}

/** Eaten, target and left for every tracked nutrient. */
function tableCard(entries, eaten, goal, dietStyle) {
  const extras = sumExtras(entries);
  const goals = nutrientGoals(goal, dietStyle);
  const fmt = (k, v) => (v == null ? '–' : k === 'kcal' ? fmtKcal(v) : fmtNumber(v, k === 'salt' ? 1 : 0));
  const rows = [
    ...['kcal', 'protein', 'carbs', 'fat'].map((k) => ({ k, eaten: eaten[k], target: goal?.[k], kind: 'target' })),
    ...EXTRAS.map((k) => ({ k, eaten: extras[k].value, target: goals[k].target, kind: goals[k].kind })),
  ];
  return h(
    'section',
    { class: 'card dash-table' },
    h('h2', {}, t('tile.table')),
    h(
      'table',
      { class: 'nutrient-table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, t('tile.table.nutrient'))), h('th', { scope: 'col' }, t('tile.table.eaten')), h('th', { scope: 'col' }, t('tile.table.target')), h('th', { scope: 'col' }, t('tile.table.left')))),
      h('tbody', {}, rows.map((r) => {
        const left = r.target == null ? null : r.target - r.eaten;
        const over = left != null && left < 0 && r.kind !== 'min';
        const unit = r.k === 'kcal' ? '' : ' g';
        return h(
          'tr',
          { class: over ? 'over' : '' },
          h('th', { scope: 'row' }, t(`nutrient.short.${r.k === 'kcal' ? 'kcal' : r.k}`), r.kind === 'max' ? h('span', { class: 'muted small' }, ` ${t('tile.table.max')}`) : r.kind === 'min' ? h('span', { class: 'muted small' }, ` ${t('tile.table.min')}`) : null),
          h('td', { class: 'num' }, fmt(r.k, r.eaten) + unit),
          h('td', { class: 'num' }, r.target == null ? '–' : fmt(r.k, r.target) + unit),
          h('td', { class: 'num' }, left == null ? '–' : over ? t('tile.table.overBy', { n: fmt(r.k, -left) + unit }) : left <= 0 ? t('dash.reached') : fmt(r.k, left) + unit),
        );
      })),
    ),
  );
}

/** Today's meals with their calories. */
function mealsCard(entries) {
  const byMeal = MEALS.map((m) => ({ m, list: entries.filter((e) => e.meal === m) })).filter((x) => x.list.length);
  return h(
    'section',
    { class: 'card dash-meals' },
    h('h2', {}, t('tile.meals')),
    byMeal.length
      ? h('ul', { class: 'meal-sum' }, byMeal.map(({ m, list }) => {
          const kcal = list.reduce((a, e) => a + (e.kcal || 0), 0);
          const time = list.map((e) => e.time).filter(Boolean).sort()[0];
          return h(
            'li',
            {},
            h('div', { class: 'meal-sum-head' }, h('strong', {}, t(`meal.${m}`)), time ? h('span', { class: 'muted small num' }, time) : null, h('span', { class: 'num meal-sum-kcal' }, `${fmtKcal(kcal)} ${t('common.kcal')}`)),
            h('div', { class: 'muted small' }, list.map((e) => e.name).join(', ')),
          );
        }))
      : h('p', { class: 'muted' }, t('dash.logEmpty')),
    h('a', { class: 'link-btn', href: '#/journal' }, `${t('tile.meals.open')} →`),
  );
}

/** One recipe idea for the next meal. */
async function ideaCard() {
  if (activeFast(await store.getFasts())) return null;
  const { result } = await todaysSuggestions(1);
  const s = result?.mode === 'normal' ? result.groups.quick[0] || result.groups.regular[0] : result?.groups?.light?.[0];
  if (!s) return null;
  return h(
    'section',
    { class: 'card glass recipe-card' },
    h('div', { class: 'recipe-label' }, icon('trend', 'ic-sm'), h('span', {}, t('ideas.dashTitle', { meal: t(`meal.${s.meal}`) })), h('a', { class: 'recipe-more', href: '#/ideas', 'aria-label': t('ideas.dashMore') }, icon('chevronRight', 'ic-sm'))),
    h(
      'div',
      { class: 'recipe-content' },
      h('div', { class: 'recipe-image', 'aria-hidden': 'true' }, icon('utensils', 'ic-recipe')),
      h(
        'div',
        { class: 'recipe-info' },
        h('h2', {}, s.title),
        h('p', { class: 'num' }, icon('clock', 'ic-xs'), t('ideas.meta', { min: s.minutes, kcal: fmtKcal(s.totals.kcal) })),
        h('div', { class: 'recipe-buttons' },
          h('button', { type: 'button', class: 'add-journal', onclick: () => addToJournal(s) }, t('ideas.add')),
          h('a', { class: 'text-button', href: '#/ideas' }, t('ideas.dashMore'))),
      ),
    ),
  );
}

const SHORT_ICON = { journal: 'book', recipes: 'soup', diet: 'sliders', scan: 'scan', likes: 'heart' };

function shortcut(href, name, title, sub) {
  return h(
    'a',
    { class: 'quick-action', href },
    icon(SHORT_ICON[name], 'qa-icon'),
    h('span', { class: 'qa-title' }, title, icon('chevronRight', 'action-arrow')),
    sub ? h('small', {}, sub) : null,
  );
}

/** Date, title and the round + button with its menu. */
function header(date, rerender) {
  const isToday = date === today();
  const go = (n) => {
    setSelectedDate(n === 0 ? today() : addDays(getSelectedDate(), n));
    rerender();
  };
  const menu = h(
    'div',
    { class: 'add-menu card glass', id: 'add-menu', hidden: true },
    h('a', { href: `#/add?date=${date}` }, icon('utensils', 'ic-sm'), t('dash.add')),
    h('a', { href: `#/add?date=${date}&scan=1` }, icon('scan', 'ic-sm'), t('tile.scan')),
  );
  const addBtn = h('button', { type: 'button', class: 'add-button', 'aria-label': t('dash.add'), 'aria-expanded': 'false', 'aria-controls': 'add-menu' }, icon('plus', 'ic-add'));
  const setOpen = (open, { focus = false } = {}) => {
    menu.hidden = !open;
    addBtn.classList.toggle('open', open);
    addBtn.setAttribute('aria-expanded', String(open));
    addBtn.setAttribute('aria-label', open ? t('dash.addClose') : t('dash.add'));
    if (open) {
      if (focus) menu.querySelector('a')?.focus();
      // Close on a tap anywhere else, or on Escape.
      setTimeout(() => document.addEventListener('pointerdown', onOutside, true));
      document.addEventListener('keydown', onKey);
    } else {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey);
    }
  };
  const onOutside = (e) => { if (!menu.contains(e.target) && !addBtn.contains(e.target)) setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); addBtn.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...menu.querySelectorAll('a')];
    const i = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };
  // detail === 0 means keyboard activation: move focus into the menu.
  addBtn.addEventListener('click', (e) => setOpen(menu.hidden, { focus: e.detail === 0 }));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  return h(
    'header',
    { class: 'dash-header' },
    h(
      'div',
      { class: 'dash-title' },
      h('p', { class: 'date-label' }, fmtDate(parseISODate(date), { weekday: 'short', day: 'numeric', month: 'short' }), isToday ? h('span', { class: 'date-today' }, ` • ${t('dash.today')}`) : null),
      h('div', { class: 'dash-day' },
        h('button', { type: 'button', class: 'day-step', 'aria-label': t('dash.prevDay'), onclick: () => go(-1) }, icon('chevronLeft', 'ic-sm')),
        h('h1', {}, dayLabel(date)),
        h('button', { type: 'button', class: 'day-step', 'aria-label': t('dash.nextDay'), onclick: () => go(1) }, icon('chevronRight', 'ic-sm'))),
      isToday ? null : h('button', { type: 'button', class: 'link-btn', onclick: () => go(0) }, t('dash.goToToday')),
    ),
    addBtn,
    menu,
  );
}

export async function render(root, rerender) {
  const date = getSelectedDate();
  const isToday = date === today();
  const [targets, profile, stored, settings, water, workouts] = await Promise.all([store.getTargets(), store.getProfile(), store.getEntriesForDate(date), store.getSettings(), store.getWater(), store.getWorkouts()]);
  const entries = stored.map(withTypicalExtras);
  const goal = store.targetValues(targets);
  const eaten = sumNutrients(entries);

  const notice = estimatedTargetsOutdated(targets, recommendationFor(profile))
    ? h('section', { class: 'notice' }, h('p', {}, t('dash.recChanged')), h('a', { class: 'link-btn', href: '#/diet' }, t('dash.recChangedAction')))
    : null;

  const diet = DIETS[profile?.dietStyle] ? profile.dietStyle : 'balanced';
  const fasting = FASTING[profile?.fasting] ? t(`profile.fasting.${profile.fasting}`) : null;

  // Each tile builds only when it's switched on
  const build = {
    calories: () =>
      goal
        ? macroCard(goal, eaten)
        : h(
            'section',
            { class: 'card setup' },
            h('h2', {}, t('dash.noTargetsTitle')),
            h('p', {}, t('dash.noTargetsBody')),
            entries.length ? h('p', { class: 'muted' }, t('dash.eatenOnly', { eaten: fmtKcal(eaten.kcal) })) : null,
            h('a', { class: 'btn primary', href: '#/profile' }, t('dash.noTargetsAction')),
          ),
    nutrients: () => ringsCard(entries, goal, diet),
    table: () => tableCard(entries, eaten, goal, diet),
    meals: () => mealsCard(entries),
    fasting: () => (isToday ? dashboardStatus(rerender) : null),
    idea: () => (goal && isToday ? ideaCard() : null),
    journal: () => shortcut('#/journal', 'journal', t('nav.journal'), t(entries.length === 1 ? 'dash.entry' : 'dash.entries', { n: entries.length })),
    recipes: async () => {
      let sub = null;
      if (goal && isToday) {
        const { result } = await todaysSuggestions(1);
        if (result?.mode === 'normal' && result.meal) sub = t('dash.forMeal', { meal: t(`meal.${result.meal}`).toLowerCase() });
      }
      return shortcut('#/ideas', 'recipes', t('nav.ideas'), sub);
    },
    diet: () => shortcut('#/diet', 'diet', t('dash.dietFasting'), [t(`diet.short.${diet}`), fasting].filter(Boolean).join(' · ')),
    scan: () => shortcut(`#/add?date=${date}&scan=1`, 'scan', t('tile.scan'), null),
    water: () => waterCard(date, waterOn(water, date)),
    workout: () => workoutCard(date, workoutsOn(workouts, date)),
    likes: () => shortcut('#/tastes', 'likes', t('tastes.title'), null),
  };

  const layout = tileLayout(settings.dashTiles);
  const saveLayout = async (next) => store.saveSettings({ ...(await store.getSettings()), dashTiles: saveShape(next) });

  if (editing) {
    root.replaceChildren(...(await editView({ layout, build, saveLayout, rerender })));
    return;
  }

  const rows = [];
  for (const row of tileRows(layout)) {
    const els = (await Promise.all(row.map((tile) => build[tile.id]()))).flat().filter(Boolean);
    if (!els.length) continue;
    if (row[0].size === 'small') rows.push(h('div', { class: 'quick-actions' }, els));
    else rows.push(...els);
  }
  rows.forEach((el, i) => {
    const kind = el.classList?.contains('calorie-card') ? 'calorie' : el.classList?.contains('recipe-card') ? 'recipe' : el.classList?.contains('diet-status') ? 'fasting' : null;
    if (kind) rows[i] = withLights(el, kind);
  });

  const edit = h('button', { type: 'button', class: 'link-btn edit-tiles', onclick: () => enterEdit(rerender) }, icon('grid', 'shortcut-icon'), t('dash.edit.start'));
  const view = [header(date, rerender), notice, ...rows, edit].filter(Boolean);
  root.replaceChildren(...view);
  // Long-press any card to start rearranging
  longPressToEdit(root, rerender);
}

// ---- Water and workouts ---------------------------------------------------

function waterCard(date, ml) {
  const goal = WATER_GOAL_ML;
  const pct = Math.round((ml / goal) * 100);
  const glasses = Math.round(ml / WATER_STEP_ML);
  return h(
    'section',
    { class: `card glass water-card${ml >= goal ? ' done' : ''}` },
    h('div', { class: 'act-head' },
      h('span', { class: 'act-icon' }, icon('glass', 'ic')),
      h('h2', {}, t('water.title')),
      h('p', { class: 'act-value' }, h('strong', {}, fmtWater(ml)), h('small', {}, ` / ${fmtWater(goal)}`))),
    h('div', { class: 'progress-track', role: 'progressbar', 'aria-label': t('water.title'), 'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(ml), 'aria-valuetext': `${fmtWater(ml)} / ${fmtWater(goal)}` },
      h('div', { class: 'progress-fill', style: { width: `${Math.min(100, pct)}%` } })),
    h('div', { class: 'act-foot' },
      h('p', { class: 'muted' }, ml >= goal ? t('water.reached', { n: glasses }) : t('water.progress', { pct, n: glasses, left: fmtWater(goal - ml) })),
      h('div', { class: 'act-buttons' },
        h('button', { type: 'button', class: 'act-minus', disabled: ml <= 0, 'aria-label': t('water.remove', { ml: WATER_STEP_ML }), onclick: () => store.addWaterMl(date, -WATER_STEP_ML) }, icon('minus', 'ic-sm')),
        h('button', { type: 'button', class: 'act-plus', onclick: () => { navigator.vibrate?.(8); store.addWaterMl(date, WATER_STEP_ML); } }, icon('plus', 'ic-sm'), `${WATER_STEP_ML} ml`))),
  );
}

function workoutCard(date, { items, minutes, kcal }) {
  return h(
    'section',
    { class: 'card glass workout-card' },
    h('div', { class: 'act-head' },
      h('span', { class: 'act-icon' }, icon('dumbbell', 'ic')),
      h('h2', {}, t('workout.cardTitle')),
      items.length ? h('p', { class: 'act-value' }, h('strong', {}, `${minutes}`), h('small', {}, ` ${t('workout.min')}`)) : null),
    items.length
      ? h('ul', { class: 'workout-list' }, items.map((w) => h('li', {},
          h('a', { href: `#/workout?id=${w.id}`, 'aria-label': t('workout.editOne', { name: t(`workout.type.${w.type}`) }) },
            h('span', { class: 'wl-name' }, t(`workout.type.${w.type}`)),
            h('span', { class: 'wl-meta' }, [`${w.minutes} ${t('workout.min')}`, Number.isFinite(w.kcal) ? `${w.kcalAuto === false ? '' : '~'}${w.kcal} ${t('common.kcal')}` : null].filter(Boolean).join(' · ')),
            icon('chevronRight', 'ic-sm')))))
      : h('p', { class: 'muted' }, t('workout.none')),
    items.length && kcal ? h('p', { class: 'muted small workout-burn' }, t('workout.burned', { n: kcal })) : null,
    h('a', { class: 'btn act-add', href: `#/workout?date=${date}` }, icon('plus', 'ic-sm'), t('workout.add')),
  );
}

// ---- Edit mode: rearrange the dashboard in place --------------------------

let editing = false;
window.addEventListener('hashchange', () => { editing = false; });

function enterEdit(rerender) {
  editing = true;
  navigator.vibrate?.(15);
  rerender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function longPressToEdit(root, rerender) {
  root.__editRerender = rerender;
  if (root.__longPress) return; // attach once; the view root lives across renders
  root.__longPress = true;
  let timer = 0;
  let start = null;
  const clear = () => { clearTimeout(timer); timer = 0; };
  root.addEventListener('pointerdown', (e) => {
    const onDashboard = ['', '#', '#/'].includes(location.hash);
    if (editing || !onDashboard) return;
    const card = e.target.closest('.card, .nutrient-card, .quick-action, .dash-rings');
    if (!card || e.target.closest('input, select, textarea, .add-menu')) return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = 0;
      // the long press must not also open whatever was under the finger
      const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, true), 400);
      enterEdit(root.__editRerender);
    }, 550);
  });
  root.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) clear(); });
  root.addEventListener('pointerup', clear);
  root.addEventListener('pointercancel', clear);
  root.addEventListener('contextmenu', (e) => { if (e.target.closest('.card, .quick-action, .nutrient-card')) e.preventDefault(); });
}

async function editView({ layout, build, saveLayout }) {
  const name = (id) => t(`tile.${id}`);

  const slot = async (tile) => {
    let content = [await build[tile.id]()].flat().filter(Boolean);
    if (!content.length) {
      content = [h('div', { class: `card edit-empty${tile.size === 'small' ? ' small' : ''}` }, h('strong', {}, name(tile.id)), h('small', { class: 'muted' }, t('dash.edit.emptyNow')))];
    }
    const body = h('div', { class: 'edit-body' }, content);
    body.inert = true; // the card itself can't be used while rearranging
    const remove = h('button', { type: 'button', class: 'edit-remove', 'data-no-drag': '', 'aria-label': t('dash.edit.remove', { name: name(tile.id) }), onclick: () => saveLayout(hideTile(layout, tile.id)) }, icon('x', 'ic'));
    const grip = h('button', { type: 'button', class: 'edit-grip', 'aria-label': t('tiles.drag', { name: name(tile.id) }) }, icon('grip', 'ic'));
    keyMove(grip, (dir) => saveLayout(moveShown(layout, tile.id, dir)));
    return h('div', { class: `edit-slot ${tile.size}`, 'data-id': tile.id, 'data-inline': tile.size === 'small' ? '' : null }, body, remove, grip);
  };

  const parts = [];
  for (const row of tileRows(layout)) {
    const els = await Promise.all(row.map(slot));
    if (row[0].size === 'small') parts.push(h('div', { class: 'quick-actions edit-row' }, els));
    else parts.push(...els);
  }
  const board = h('div', { class: 'edit-board' }, parts);
  dragSort(board, { slotSelector: '.edit-slot', handleSelector: '.edit-grip', onDrop: (id, before) => saveLayout(placeTile(layout, id, before)) });

  // The + card: suggests the cards that aren't on the dashboard yet
  const hidden = layout.filter((tl) => !tl.on);
  const addCard = h(
    'section',
    { class: 'add-card' },
    h('div', { class: 'add-card-head' }, h('span', { class: 'add-card-plus' }, icon('plus', 'ic')), h('div', {}, h('h2', {}, t('dash.edit.addTitle')), h('p', { class: 'muted' }, hidden.length ? t('dash.edit.addHint') : t('dash.edit.allOn')))),
    hidden.length
      ? h('div', { class: 'add-card-list' }, hidden.map((tl) => h('button', { type: 'button', class: 'add-card-item', onclick: () => saveLayout(showTile(layout, tl.id)) },
          icon('plus', 'ic-sm'), h('span', {}, h('strong', {}, name(tl.id)), h('small', {}, t(`tile.${tl.id}.desc`))))))
      : null,
  );

  const bar = h('div', { class: 'edit-bar' },
    h('div', {}, h('h1', {}, t('dash.edit.title')), h('p', { class: 'muted' }, t('dash.edit.hint'))),
    h('button', { type: 'button', class: 'btn primary edit-done', onclick: () => { editing = false; saveLayout(layout); } }, icon('check', 'ic-sm'), t('tiles.done')));
  return [bar, board, addCard, h('a', { class: 'link-btn edit-tiles', href: '#/tiles' }, t('dash.edit.list'))];
}

/** Move a shown tile one place among the shown tiles (keyboard reordering). */
function moveShown(layout, id, dir) {
  const shown = layout.filter((tl) => tl.on).map((tl) => tl.id);
  const i = shown.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= shown.length) return layout;
  return placeTile(layout, id, dir < 0 ? shown[j] : shown[j + 1] ?? null);
}
