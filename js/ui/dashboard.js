import { h, bar } from './dom.js';
import { t, fmtKcal, fmtGrams, fmtDate } from '../i18n/i18n.js';
import { sumNutrients, remainingNutrients, progress } from '../core/calc.js';
import { addDays, parseISODate, today } from '../core/dates.js';
import * as store from '../data/store.js';
import { recommendationFor, estimatedTargetsOutdated } from './targets-compare.js';

// Selected day survives switching tabs within a session.
let selectedDate = today();

function dayLabel(iso) {
  const now = today();
  if (iso === now) return t('dash.today');
  if (iso === addDays(now, -1)) return t('dash.yesterday');
  if (iso === addDays(now, 1)) return t('dash.tomorrow');
  return fmtDate(parseISODate(iso));
}

export async function render(root, rerender) {
  const [targets, profile, entries] = await Promise.all([
    store.getTargets(),
    store.getProfile(),
    store.getEntriesForDate(selectedDate),
  ]);
  const goal = store.targetValues(targets);
  const eaten = sumNutrients(entries);

  const go = (n) => {
    selectedDate = n === 0 ? today() : addDays(selectedDate, n);
    rerender();
  };

  const isToday = selectedDate === today();
  const nav = h(
    'div',
    { class: 'daynav' },
    h('button', { class: 'icon-btn', 'aria-label': t('dash.prevDay'), onclick: () => go(-1) }, '‹'),
    h(
      'div',
      { class: 'daynav-label' },
      h('strong', {}, dayLabel(selectedDate)),
      isToday ? null : h('button', { class: 'link-btn', onclick: () => go(0) }, t('dash.goToToday')),
    ),
    h('button', { class: 'icon-btn', 'aria-label': t('dash.nextDay'), onclick: () => go(1) }, '›'),
  );

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
          h(
            'div',
            { class: 'macro-head' },
            h('span', {}, t(`nutrient.${k}`)),
            h('span', { class: 'num' }, `${fmtGrams(eaten[k])} / ${fmtGrams(goal[k])} ${t('common.g')}`),
          ),
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

  const notice = estimatedTargetsOutdated(targets, recommendationFor(profile))
    ? h('section', { class: 'notice' }, h('p', {}, t('dash.recChanged')), h('a', { class: 'link-btn', href: '#/profile' }, t('dash.recChangedAction')))
    : null;

  const log = h(
    'section',
    { class: 'card' },
    h('h2', {}, t('dash.log')),
    entries.length
      ? h(
          'ul',
          { class: 'log' },
          entries.map((e) =>
            h(
              'li',
              {},
              h('span', { class: 'log-time num' }, e.time || ''),
              h('span', { class: 'log-name' }, e.name, h('small', { class: 'muted' }, ` ${e.quantity ?? ''} ${e.unit ?? ''}`)),
              h('span', { class: 'log-kcal num' }, `${fmtKcal(e.kcal)} ${t('common.kcal')}`),
            ),
          ),
        )
      : h('p', { class: 'muted' }, t('dash.logEmpty')),
  );

  root.replaceChildren(...[nav, notice, hero, macros, log].filter(Boolean));
}
