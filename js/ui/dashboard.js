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
import { tileLayout, tileRows } from '../core/tiles.js';
import { MEALS } from '../core/entry.js';
import { icon } from './icons.js';
import { dayLabel } from './daynav.js';
import { setSelectedDate } from './state.js';
import { addDays, parseISODate } from '../core/dates.js';
import { fmtDate } from '../i18n/i18n.js';

const grams = (n) => fmtNumber(Math.abs(n), Math.abs(n) < 10 && !Number.isInteger(n) ? 1 : 0);
// Bar labels: what you've eaten of the target, e.g. "110 / 121 g"
const amountText = (s) => t('dash.gOf', { eaten: fmtNumber(s.eaten), target: fmtNumber(s.target) });

/** A progress ring of `size` px with a `stroke`-wide line. */
function ringSvg(ratio, label, size = 88, stroke = 7) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const c = size / 2;
  return svg(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': label, class: 'progress-ring' },
    svg('g', { transform: `rotate(-90 ${c} ${c})`, fill: 'none' },
      svg('circle', { class: 'ring-track', cx: c, cy: c, r, 'stroke-width': stroke }),
      svg('circle', { class: 'ring-fill', cx: c, cy: c, r, 'stroke-width': stroke, 'stroke-linecap': ratio > 0.005 ? 'round' : 'butt', 'stroke-dasharray': `${(Math.max(0, Math.min(1, ratio)) * C).toFixed(1)} ${C.toFixed(1)}` })),
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
  return h(
    'section',
    { class: `card glass calorie-card${over ? ' over' : ''}` },
    h(
      'div',
      { class: 'calorie-main' },
      h(
        'div',
        { class: 'calorie-ring' },
        ringSvg(ratio, t('dash.calRing', { eaten: fmtKcal(eaten.kcal), target: fmtKcal(goal.kcal) }), 220, 17),
        h('div', { class: 'calorie-center' },
          icon('flame', 'cal-flame'),
          h('strong', { class: 'num' }, fmtKcal(Math.abs(rem.kcal))),
          h('span', {}, t(over ? 'dash.kcalOver' : 'dash.kcalLeft'))),
      ),
      h(
        'div',
        { class: 'calorie-stats' },
        h('div', {}, h('strong', { class: 'num' }, fmtKcal(eaten.kcal)), h('span', {}, t('dash.eatenWord'))),
        h('div', {}, h('strong', { class: 'num' }, fmtKcal(goal.kcal)), h('span', {}, t('dash.targetWord'))),
        h('div', {}, h('strong', { class: 'num' }, `${Math.round(ratio * 100)}%`), h('span', {}, t('dash.usedWord'))),
      ),
    ),
    h('div', { class: 'macro-grid' }, cols),
  );
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
    h('small', { class: 'num' }, sub),
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
    h('div', { class: 'recipe-label' }, icon('chart', 'ic-sm'), t('ideas.dashTitle', { meal: t(`meal.${s.meal}`) })),
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
    h('span', { class: 'qa-title' }, title),
    h('small', {}, sub || '\u00a0'),
    icon('chevronRight', 'action-arrow'),
  );
}

/** Date, title and the round + button with its menu. */
function header(date, rerender) {
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
  addBtn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    addBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  const isToday = date === today();
  return h(
    'header',
    { class: 'dash-header' },
    h(
      'div',
      { class: 'dash-title' },
      h('p', { class: 'date-label' }, fmtDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long' })),
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
  const [targets, profile, stored, settings] = await Promise.all([store.getTargets(), store.getProfile(), store.getEntriesForDate(date), store.getSettings()]);
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
    likes: () => shortcut('#/tastes', 'likes', t('tastes.title'), null),
  };

  const rows = [];
  for (const row of tileRows(tileLayout(settings.dashTiles))) {
    const els = (await Promise.all(row.map((tile) => build[tile.id]()))).filter(Boolean);
    if (!els.length) continue;
    rows.push(row[0].size === 'small' ? h('div', { class: 'quick-actions' }, els) : els[0]);
  }

  const edit = h('a', { class: 'link-btn edit-tiles', href: '#/tiles' }, icon('grid', 'shortcut-icon'), t('tiles.edit'));
  root.replaceChildren(...[header(date, rerender), notice, ...rows, edit].filter(Boolean));
}
