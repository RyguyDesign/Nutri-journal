import { h, bar } from './dom.js';
import { t, fmtKcal, fmtGrams } from '../i18n/i18n.js';
import { sumNutrients, remainingNutrients, progress } from '../core/calc.js';
import * as store from '../data/store.js';
import { recommendationFor, estimatedTargetsOutdated } from './targets-compare.js';
import { dayNav } from './daynav.js';
import { getSelectedDate } from './state.js';
import { entryRow } from './journal.js';
import { todaysSuggestions, addToJournal } from './ideas.js';
import { today } from '../core/dates.js';
import { dashboardStatus } from './diet-status.js';
import { activeFast } from '../core/diet.js';

export async function render(root, rerender) {
  const date = getSelectedDate();
  const [targets, profile, entries] = await Promise.all([store.getTargets(), store.getProfile(), store.getEntriesForDate(date)]);
  const goal = store.targetValues(targets);
  const eaten = sumNutrients(entries);

  let hero;
  let macros = null;
  if (goal) {
    // Round eaten calories once, so "eaten" and "remaining" always add up to the target.
    const rem = remainingNutrients(goal, { ...eaten, kcal: Math.round(eaten.kcal) });
    const over = rem.kcal < 0;
    const p = progress(eaten.kcal, goal.kcal);
    hero = h(
      'section',
      { class: 'card hero' },
      h('div', { class: 'hero-num' }, fmtKcal(Math.abs(rem.kcal))),
      h('div', { class: 'hero-label' }, over ? t('dash.over') : t('dash.remaining')),
      bar(p.ratio, p.over, t('nutrient.kcal')),
      h('div', { class: 'hero-sub' }, t('dash.ofTarget', { eaten: fmtKcal(eaten.kcal), target: fmtKcal(goal.kcal) })),
    );
    macros = h(
      'section',
      { class: 'card macros' },
      ['protein', 'carbs', 'fat'].map((k) => {
        const mp = progress(eaten[k], goal[k]);
        return h(
          'div',
          { class: 'macro' },
          h('div', { class: 'macro-head' }, h('span', {}, t(`nutrient.${k}`)), h('span', { class: 'num' }, `${fmtGrams(eaten[k])} / ${fmtGrams(goal[k])} ${t('common.g')}`)),
          bar(mp.ratio, mp.over, t(`nutrient.${k}`)),
        );
      }),
    );
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

  const add = h('a', { class: 'btn primary wide add-btn', href: `#/add?date=${date}` }, `+ ${t('dash.add')}`);

  const notice = estimatedTargetsOutdated(targets, recommendationFor(profile))
    ? h('section', { class: 'notice' }, h('p', {}, t('dash.recChanged')), h('a', { class: 'link-btn', href: '#/profile' }, t('dash.recChangedAction')))
    : null;

  const log = h(
    'section',
    { class: 'card' },
    h('h2', {}, t('dash.log')),
    entries.length ? h('ul', { class: 'log' }, entries.map((e) => entryRow(e, { showMacros: false }))) : h('p', { class: 'muted' }, t('dash.logEmpty')),
  );

  // One suggestion for the next meal, today only
  let idea = null;
  if (goal && date === today() && !activeFast(await store.getFasts())) {
    const { result } = await todaysSuggestions(1);
    const s = result?.mode === 'normal' ? result.groups.quick[0] || result.groups.regular[0] : result?.groups.light[0];
    if (s) {
      idea = h(
        'section',
        { class: 'card idea-teaser' },
        h('h2', {}, t('ideas.dashTitle', { meal: t(`meal.${s.meal}`) })),
        h('p', {}, h('strong', {}, s.title)),
        h('p', { class: 'muted small num' }, t('ideas.meta', { min: s.minutes, kcal: fmtKcal(s.totals.kcal) })),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => addToJournal(s) }, t('ideas.add')), h('a', { class: 'link-btn', href: '#/ideas' }, t('ideas.dashMore'))),
      );
    }
  }

  const status = date === today() ? await dashboardStatus(rerender) : null;
  root.replaceChildren(...[dayNav(rerender), notice, hero, add, status, macros, idea, log].filter(Boolean));
}
