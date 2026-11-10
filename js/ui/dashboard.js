import { h, svg } from './dom.js';
import { t, fmtKcal, fmtNumber } from '../i18n/i18n.js';
import { sumNutrients, sumExtras, remainingNutrients } from '../core/calc.js';
import * as store from '../data/store.js';
import { recommendationFor, estimatedTargetsOutdated } from './targets-compare.js';
import { dayNav } from './daynav.js';
import { getSelectedDate } from './state.js';
import { todaysSuggestions } from './ideas.js';
import { today } from '../core/dates.js';
import { dashboardStatus } from './diet-status.js';
import { DIETS, FASTING, nutrientGoals } from '../core/diet.js';
import { macroBar, nutrientRings } from '../core/dash.js';
import { withTypicalExtras } from '../foods/everyday.js';

const grams = (n) => fmtNumber(Math.abs(n), Math.abs(n) < 10 && !Number.isInteger(n) ? 1 : 0);
const leftText = (s) => t(s.over ? 'dash.gOver' : 'dash.gLeft', { n: Math.abs(s.left) });

/** One section of the calorie bar. The label is drawn twice so it stays readable across the fill edge. */
function section(s) {
  const label = (cls) => h('span', { class: `mz-label ${cls}` }, h('span', { class: 'mz-name' }, t(`nutrient.short.${s.key}`)), h('span', { class: 'mz-left num' }, leftText(s)));
  return h(
    'div',
    { class: `mz mz-${s.key}${s.over ? ' over' : ''}`, style: { flex: `${Math.max(s.share, 0.03)} 1 0` } },
    s.inside ? label('') : null,
    h('div', { class: 'mz-fill', style: { width: `${s.ratio * 100}%` } }, s.inside ? label('on') : null),
  );
}

function macroCard(goal, eaten) {
  const rem = remainingNutrients(goal, { ...eaten, kcal: Math.round(eaten.kcal) });
  const over = rem.kcal < 0;
  const { sections, layout } = macroBar(goal, eaten);
  const summary = sections.map((s) => `${t(`nutrient.short.${s.key}`)} ${leftText(s)}, ${s.pct}%`).join('; ');

  let under;
  if (layout === 'legend') {
    under = h('div', { class: 'mz-legend' }, sections.map((s) => h(
      'div',
      { class: `ml ml-${s.key}` },
      h('span', { class: 'ml-name' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), t(`nutrient.short.${s.key}`)),
      h('span', { class: 'num strong' }, leftText(s)),
      h('span', { class: 'num muted' }, `${s.pct}%`),
    )));
  } else {
    // Percentages under their sections; a section too narrow for its
    // label gets it on a second line, pointing up at the section.
    const pcts = h('div', { class: 'mz-under' }, sections.map((s) => h(
      'div',
      { class: 'mu', style: { flex: `${Math.max(s.share, 0.03)} 1 0` } },
      h('span', { class: 'num' }, `${s.pct}%`),
    )));
    let start = 0;
    const notes = [];
    for (const s of sections) {
      if (!s.inside) {
        const mid = start + s.share / 2;
        notes.push(h(
          'span',
          { class: 'mz-note num', style: mid < 0.5 ? { left: `${start * 100}%` } : { right: `${(1 - start - s.share) * 100}%` } },
          h('span', { 'aria-hidden': 'true' }, '↑ '),
          `${t(`nutrient.short.${s.key}`)} ${leftText(s)}`,
        ));
      }
      start += s.share;
    }
    under = [pcts, notes.length ? h('div', { class: 'mz-notes' }, notes) : null];
  }

  return h(
    'section',
    { class: 'card dash-cal' },
    h(
      'div',
      { class: 'dash-cal-head' },
      h('div', {}, h('span', { class: 'dash-cal-num num' }, fmtKcal(Math.abs(rem.kcal))), ' ', h('span', { class: 'muted' }, t(over ? 'dash.kcalOver' : 'dash.kcalLeft'))),
      h('div', { class: 'muted small num' }, t('dash.of', { target: fmtKcal(goal.kcal) })),
    ),
    h('div', { class: 'mz-bar', role: 'img', 'aria-label': summary }, sections.map(section)),
    under,
  );
}

function ring(r) {
  const C = 2 * Math.PI * 24;
  const value = r.key === 'salt' ? fmtNumber(r.value, 1) : fmtNumber(Math.round(r.value));
  const diff = r.key === 'salt' ? fmtNumber(r.diff, 1) : grams(Math.round(r.diff));
  const sub = r.state === 'reached' ? t('dash.reached') : t(r.kind === 'max' ? `dash.${r.state}Max` : 'dash.toGo', { n: diff });
  const name = t(`nutrient.short.${r.key}`);
  return h(
    'div',
    { class: `nring nring-${r.key}${r.state === 'over' ? ' over' : ''}` },
    h(
      'div',
      { class: 'nring-art' },
      svg(
        'svg',
        { viewBox: '0 0 60 60', role: 'img', 'aria-label': `${name}: ${value} / ${r.target} g, ${sub}` },
        svg('g', { transform: 'rotate(-90 30 30)', fill: 'none' },
          svg('circle', { class: 'nring-track', cx: 30, cy: 30, r: 24, 'stroke-width': 7 }),
          svg('circle', { class: 'nring-fill', cx: 30, cy: 30, r: 24, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': `${(r.ratio * C).toFixed(1)} ${C.toFixed(1)}` })),
      ),
      h('span', { class: 'nring-pct num', 'aria-hidden': 'true' }, `${r.pct}%`),
    ),
    h('span', { class: 'nring-name' }, name),
    h('span', { class: 'nring-val num' }, `${value} / ${r.target} g`),
    h('span', { class: 'nring-sub num' }, sub),
  );
}

function ringsCard(entries, goal) {
  const extras = sumExtras(entries);
  const rings = nutrientRings(extras, nutrientGoals(goal));
  const missing = extras.count - Math.min(...rings.map((r) => r.known));
  return h(
    'section',
    { class: 'card dash-rings' },
    h('div', { class: 'nrings' }, rings.map(ring)),
    missing > 0 ? h('p', { class: 'muted small dash-partial' }, t('dash.partial', { n: missing, total: extras.count })) : null,
  );
}

const ICON = {
  journal: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 8h6M9 12h6M9 16h4'],
  recipes: ['M3 11h18', 'M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6', 'M8 7c0-1.2 1-1.2 1-2.4M12 7c0-1.2 1-1.2 1-2.4M16 7c0-1.2 1-1.2 1-2.4'],
  diet: ['M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1', 'M15 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M9 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', 'M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
};

function shortcut(href, icon, title, sub) {
  return h(
    'a',
    { class: 'card shortcut', href },
    svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'shortcut-icon' }, ICON[icon].map((d) => svg('path', { d }))),
    h('span', { class: 'shortcut-title' }, title),
    sub ? h('span', { class: 'shortcut-sub' }, sub) : null,
  );
}

/**
 * Place each bar label where it reads best: inside the fill when it fits,
 * otherwise right-aligned on the empty part. Only when neither fits does it
 * stay split across the fill edge.
 */
function placeLabels(root) {
  for (const sec of root.querySelectorAll('.mz')) {
    const lab = sec.querySelector(':scope > .mz-label');
    const fill = sec.querySelector('.mz-fill');
    if (!lab || !fill) continue;
    sec.classList.remove('label-in', 'label-out');
    const need = lab.offsetWidth + 14;
    if (fill.offsetWidth >= need) sec.classList.add('label-in');
    else if (sec.clientWidth - fill.offsetWidth >= need) sec.classList.add('label-out');
  }
}

export async function render(root, rerender) {
  const date = getSelectedDate();
  const [targets, profile, stored] = await Promise.all([store.getTargets(), store.getProfile(), store.getEntriesForDate(date)]);
  const entries = stored.map(withTypicalExtras);
  const goal = store.targetValues(targets);
  const eaten = sumNutrients(entries);

  let hero;
  if (goal) {
    hero = macroCard(goal, eaten);
  } else {
    hero = h(
      'section',
      { class: 'card setup' },
      h('h2', {}, t('dash.noTargetsTitle')),
      h('p', {}, t('dash.noTargetsBody')),
      entries.length ? h('p', { class: 'muted' }, t('dash.eatenOnly', { eaten: fmtKcal(eaten.kcal) })) : null,
      h('a', { class: 'btn primary', href: '#/profile' }, t('dash.noTargetsAction')),
    );
  }

  const rings = ringsCard(entries, goal);

  const notice = estimatedTargetsOutdated(targets, recommendationFor(profile))
    ? h('section', { class: 'notice' }, h('p', {}, t('dash.recChanged')), h('a', { class: 'link-btn', href: '#/profile' }, t('dash.recChangedAction')))
    : null;

  const isToday = date === today();
  const status = isToday ? await dashboardStatus(rerender) : null;

  // Shortcuts
  let nextMeal = null;
  if (goal && isToday) {
    const { result } = await todaysSuggestions(1);
    if (result?.mode === 'normal' && result.meal) nextMeal = t('dash.forMeal', { meal: t(`meal.${result.meal}`).toLowerCase() });
  }
  const diet = DIETS[profile?.dietStyle] ? profile.dietStyle : 'balanced';
  const fasting = FASTING[profile?.fasting] ? t(`profile.fasting.${profile.fasting}`) : null;
  const shortcuts = h(
    'div',
    { class: 'shortcuts' },
    shortcut('#/journal', 'journal', t('nav.journal'), t(entries.length === 1 ? 'dash.entry' : 'dash.entries', { n: entries.length })),
    shortcut('#/ideas', 'recipes', t('nav.ideas'), nextMeal),
    shortcut('#/profile', 'diet', t('dash.dietFasting'), [t(`diet.short.${diet}`), fasting].filter(Boolean).join(' · ')),
  );

  const add = h('a', { class: 'btn primary wide add-btn', href: `#/add?date=${date}` }, `+ ${t('dash.add')}`);

  root.replaceChildren(...[dayNav(rerender), notice, hero, rings, status, shortcuts, add].filter(Boolean));
  const place = () => (root.isConnected ? placeLabels(root) : window.removeEventListener('resize', place));
  requestAnimationFrame(place);
  window.addEventListener('resize', place);
}
