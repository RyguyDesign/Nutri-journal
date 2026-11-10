import { h, svg } from './dom.js';
import { t, fmtKcal, fmtNumber } from '../i18n/i18n.js';
import { sumNutrients, sumExtras, remainingNutrients, EXTRAS } from '../core/calc.js';
import * as store from '../data/store.js';
import { recommendationFor, estimatedTargetsOutdated } from './targets-compare.js';
import { dayNav } from './daynav.js';
import { getSelectedDate } from './state.js';
import { todaysSuggestions, addToJournal } from './ideas.js';
import { today } from '../core/dates.js';
import { dashboardStatus } from './diet-status.js';
import { DIETS, FASTING, nutrientGoals, activeFast } from '../core/diet.js';
import { macroBar, nutrientRings } from '../core/dash.js';
import { withTypicalExtras } from '../foods/everyday.js';
import { tileLayout, tileRows } from '../core/tiles.js';
import { MEALS } from '../core/entry.js';

const grams = (n) => fmtNumber(Math.abs(n), Math.abs(n) < 10 && !Number.isInteger(n) ? 1 : 0);
// Bar labels: what you've eaten of the target, e.g. "110 / 121 g"
const amountText = (s) => t('dash.gOf', { eaten: fmtNumber(s.eaten), target: fmtNumber(s.target) });

/** A progress ring; `big` is the calorie ring. */
function ringSvg(ratio, label, big = false) {
  const r = big ? 46 : 24;
  const C = 2 * Math.PI * r;
  const size = big ? 104 : 60;
  const c = size / 2;
  return svg(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': label },
    svg('g', { transform: `rotate(-90 ${c} ${c})`, fill: 'none' },
      svg('circle', { class: 'ring-track', cx: c, cy: c, r, 'stroke-width': big ? 9 : 7 }),
      svg('circle', { class: 'ring-fill', cx: c, cy: c, r, 'stroke-width': big ? 9 : 7, 'stroke-linecap': ratio > 0.005 ? 'round' : 'butt', 'stroke-dasharray': `${(Math.max(0, Math.min(1, ratio)) * C).toFixed(1)} ${C.toFixed(1)}` })),
  );
}

const GLYPH = {
  flame: ['M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 12 15.5 4 4 0 0 1 8 11.5c0-1.6.8-2.6 1.6-3.4.2 1.4 1 2.2 1.9 2.4C11 8 11 5.5 12 3z', 'M12 21a5 5 0 0 1-5-5c0-1 .3-1.8.7-2.5'],
  fibre: ['M5 19c4-4 8-6 14-14', 'M9 15c-2-1-3-3-2.5-5.5C9 10 10 12 9 15zM13 11c-2-1-3-3-2.5-5.5C13 6 14 8 13 11zM12 16c1 2 3 3 5.5 2.5C17 16 15 15 12 16zM16 12c1 2 3 3 5.5 2.5C21 12 19 11 16 12z'],
  sugar: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5M12 12v9'],
  satFat: ['M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z'],
  salt: ['M8 9h8l1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z', 'M9 9V6a3 3 0 0 1 6 0v3', 'M11 5h.01M13 5h.01M12 3.6h.01'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  chevron: ['M9 6l6 6-6 6'],
};
const glyph = (name, cls) => svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: cls }, GLYPH[name].map((d) => svg('path', { d })));

function macroCard(goal, eaten) {
  const rem = remainingNutrients(goal, { ...eaten, kcal: Math.round(eaten.kcal) });
  const over = rem.kcal < 0;
  const ratio = goal.kcal > 0 ? eaten.kcal / goal.kcal : 0;
  const { sections } = macroBar(goal, eaten);
  const cols = sections.map((s) => h(
    'div',
    { class: `mc mc-${s.key}${s.over ? ' over' : ''}` },
    h('span', { class: 'mc-pct num' }, `${s.pct}%`),
    h('span', { class: 'mc-name' }, t(`nutrient.short.${s.key}`)),
    h('span', { class: 'mc-line' },
      h('span', { class: 'mc-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${s.ratio * 100}%` } })),
      h('span', { class: 'mc-amount num' }, amountText(s))),
  ));
  return h(
    'section',
    { class: `card glass dash-cal${over ? ' over' : ''}` },
    h(
      'div',
      { class: 'cal-top' },
      h(
        'div',
        { class: 'cal-ring' },
        ringSvg(ratio, t('dash.calRing', { eaten: fmtKcal(eaten.kcal), target: fmtKcal(goal.kcal) }), true),
        h('div', { class: 'cal-ring-inner' },
          glyph('flame', 'cal-flame'),
          h('span', { class: 'cal-num num' }, fmtKcal(Math.abs(rem.kcal))),
          h('span', { class: 'cal-unit' }, t(over ? 'dash.kcalOver' : 'dash.kcalLeft'))),
      ),
      h(
        'div',
        { class: 'cal-target' },
        h('span', { class: 'cal-of' }, t('dash.ofWord')),
        h('span', { class: 'cal-target-num num' }, fmtKcal(goal.kcal)),
        h('span', { class: 'cal-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.min(1, ratio) * 100}%` } })),
        h('span', { class: 'cal-eaten num' }, t('dash.eatenKcal', { n: fmtKcal(eaten.kcal) })),
      ),
    ),
    h('div', { class: 'cal-macros' }, cols),
  );
}

function ring(r, count) {
  const value = r.key === 'salt' ? fmtNumber(r.value, 1) : fmtNumber(Math.round(r.value));
  const diff = r.key === 'salt' ? fmtNumber(r.diff, 1) : grams(Math.round(r.diff));
  const sub = r.state === 'reached' ? t('dash.reached') : t(r.kind === 'max' ? `dash.${r.state}Max` : 'dash.toGo', { n: diff });
  const name = t(`nutrient.short.${r.key}`);
  const unknown = count - r.known;
  return h(
    'div',
    { class: `card glass nring nring-${r.key}${r.state === 'over' ? ' over' : ''}` },
    h('div', { class: 'nring-art' },
      ringSvg(r.ratio, `${name}: ${value} / ${r.target} g, ${sub}`),
      h('span', { class: 'nring-pct num', 'aria-hidden': 'true' }, `${r.pct}%`)),
    glyph(r.key, 'nring-icon'),
    h('span', { class: 'nring-name' }, name),
    r.key === 'satFat' ? h('span', { class: 'nring-note' }, t('dash.partOfFat')) : null,
    h('span', { class: 'nring-val num' }, t('dash.gOf', { eaten: value, target: fmtNumber(r.target) })),
    r.state === 'over' || r.state === 'toGo' ? h('span', { class: 'nring-sub num' }, sub) : null,
    unknown > 0 ? h('span', { class: 'nring-unknown' }, t(unknown === 1 ? 'dash.unknown1' : 'dash.unknown', { n: unknown })) : null,
  );
}

function ringsCard(entries, goal) {
  const extras = sumExtras(entries);
  const rings = nutrientRings(extras, nutrientGoals(goal));
  const anyUnknown = rings.some((r) => r.known < extras.count);
  return h(
    'section',
    { class: 'dash-rings', 'aria-label': t('tile.nutrients') },
    h('div', { class: 'nrings' }, rings.map((r) => ring(r, extras.count))),
    anyUnknown ? h('p', { class: 'muted small dash-partial' }, t('dash.unknownHint')) : null,
  );
}

/** Eaten, target and left for every tracked nutrient. */
function tableCard(entries, eaten, goal) {
  const extras = sumExtras(entries);
  const goals = nutrientGoals(goal);
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
    { class: 'card idea-teaser' },
    h('h2', {}, t('ideas.dashTitle', { meal: t(`meal.${s.meal}`) })),
    h('p', {}, h('strong', {}, s.title)),
    h('p', { class: 'muted small num' }, t('ideas.meta', { min: s.minutes, kcal: fmtKcal(s.totals.kcal) })),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => addToJournal(s) }, t('ideas.add')), h('a', { class: 'link-btn', href: '#/ideas' }, t('ideas.dashMore'))),
  );
}

const ICON = {
  journal: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 8h6M9 12h6M9 16h4'],
  recipes: ['M3 11h18', 'M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6', 'M8 7c0-1.2 1-1.2 1-2.4M12 7c0-1.2 1-1.2 1-2.4M16 7c0-1.2 1-1.2 1-2.4'],
  diet: ['M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1', 'M15 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  scan: ['M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2', 'M8 8v8M11 8v8M14 8v8M17 8v8'],
  likes: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  edit: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z', 'M17 14v6M14 17h6'],
};

function shortcut(href, icon, title, sub) {
  return h(
    'a',
    { class: 'card glass shortcut', href },
    svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'shortcut-icon' }, ICON[icon].map((d) => svg('path', { d }))),
    h('span', { class: 'shortcut-title' }, title),
    sub ? h('span', { class: 'shortcut-sub' }, sub) : null,
    glyph('chevron', 'shortcut-chev'),
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
    nutrients: () => ringsCard(entries, goal),
    table: () => tableCard(entries, eaten, goal),
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
    rows.push(row[0].size === 'small' ? h('div', { class: 'shortcuts' }, els) : els[0]);
  }

  const edit = h('a', { class: 'link-btn edit-tiles', href: '#/tiles' }, svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'shortcut-icon' }, ICON.edit.map((d) => svg('path', { d }))), t('tiles.edit'));
  const add = h('a', { class: 'btn primary wide add-btn', href: `#/add?date=${date}` }, `+ ${t('dash.add')}`);

  root.replaceChildren(...[dayNav(rerender), notice, ...rows, add, edit].filter(Boolean));
}
