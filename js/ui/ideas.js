// Suggestions for the rest of today.
import { macroPills } from './macros.js';
import { h } from './dom.js';
import { t, fmtKcal, fmtGrams, fmtNumber } from '../i18n/i18n.js';
import { sumNutrients, remainingNutrients } from '../core/calc.js';
import { nowTime } from '../core/entry.js';
import { today } from '../core/dates.js';
import * as store from '../data/store.js';
import { suggest } from '../suggest/engine.js';
import { setPendingFood, getIdeasRound, nextIdeasRound } from './state.js';
import { extrasFor } from '../foods/extras.js';

const GROUPS = ['quick', 'regular', 'protein', 'light', 'pantry'];
let filter = 'all';

/** Everything the engine needs for today, or null when targets aren't set. */
export async function todaysSuggestions(limit = 3) {
  const date = today();
  const [targets, profile, tastes, entries] = await Promise.all([store.getTargets(), store.getProfile(), store.getTastes(), store.getEntriesForDate(date)]);
  const goal = store.targetValues(targets);
  if (!goal) return { goal: null, tastes };
  const eaten = sumNutrients(entries);
  const remaining = remainingNutrients(goal, { ...eaten, kcal: Math.round(eaten.kcal) });
  const loggedMeals = [...new Set(entries.map((e) => e.meal))];
  const result = suggest({ remaining, tastes, profile: profile || {}, now: nowTime(), loggedMeals, seed: `${date}:${getIdeasRound()}`, limit });
  return { goal, tastes, remaining, result };
}

export function itemLabel(it) {
  const amount = it.show ? it.show : it.pieces ? `${t('ideas.pieces', { n: it.pieces, unit: it.pieceUnit + (it.pieces > 1 ? 's' : '') })} (${it.grams} g)` : `${it.grams} g`;
  return `${it.name}${it.prep === 'cooked' ? ' (cooked weight)' : ''}: ${amount}`;
}

/** Fibre, sugar, saturated fat and salt of a recipe, from its main ingredients (seasoning isn't counted). */
function recipeExtras(s) {
  const out = { fibre: 0, sugar: 0, satFat: 0, salt: 0 };
  let known = 0;
  for (const it of s.items) {
    const x = extrasFor(it.id);
    if (!x || !(it.grams > 0)) continue;
    known += 1;
    for (const k of Object.keys(out)) out[k] += (x[k] * it.grams) / 100;
  }
  return known ? out : {};
}

/** Hand a suggestion to the entry form as one journal entry. */
export function addToJournal(s) {
  setPendingFood({
    name: s.title,
    per: { amount: 1, unit: 'portion', ...s.totals, ...recipeExtras(s) },
    source: 'typical',
    meal: s.meal,
    notes: t('ideas.ingredients', { list: s.items.map(itemLabel).join(', ') }),
  });
  location.hash = '#/add/detail';
}

export function card(s) {
  return h(
    'article',
    { class: 'card idea' },
    h('h3', {}, s.title),
    h('div', { class: 'idea-meta' }, h('span', { class: 'idea-kcal num' }, h('strong', {}, fmtKcal(s.totals.kcal)), ` ${t('common.kcal')}`), h('span', { class: 'idea-time num' }, t('ideas.minutes', { min: s.minutes })), macroPills(s.totals)),
    h('ul', { class: 'ingredients' }, s.items.map((it) => h('li', {}, itemLabel(it), it.isNew ? h('span', { class: 'tag new' }, t('ideas.new')) : null))),
    h('details', { class: 'how' }, h('summary', {}, t('ideas.steps')), h('ol', {}, s.steps.map((st) => h('li', {}, st)))),
    h('button', { type: 'button', class: 'btn primary', onclick: () => addToJournal(s) }, t('ideas.add')),
  );
}

export async function render(root, rerender) {
  const { goal, tastes, remaining, result } = await todaysSuggestions();
  const title = h('h1', { class: 'page-title' }, t('ideas.title'));

  if (!goal) {
    root.replaceChildren(title, h('section', { class: 'card setup' }, h('p', {}, t('ideas.noTargets')), h('a', { class: 'btn primary', href: '#/profile' }, t('dash.noTargetsAction'))));
    return;
  }

  const tastesPrompt = tastes.saved
    ? null
    : h('section', { class: 'notice' }, h('p', {}, t('ideas.noTastes')), h('a', { class: 'btn primary', href: '#/tastes' }, t('ideas.noTastesAction')));

  const { mode, meal, target, groups } = result;
  const summary = h(
    'section',
    { class: 'card summary' },
    h('div', { class: 'left-today' },
      h('span', { class: 'muted small' }, t('ideas.leftLabel')),
      h('span', { class: 'idea-kcal num' }, h('strong', {}, fmtKcal(Math.max(0, remaining.kcal))), ` ${t('common.kcal')}`),
      macroPills({ protein: Math.max(0, remaining.protein), carbs: Math.max(0, remaining.carbs), fat: Math.max(0, remaining.fat) })),
    mode === 'normal' ? h('p', { class: 'strong' }, t('ideas.next', { meal: t(`meal.${meal}`), kcal: fmtNumber(Math.round(target.kcal / 10) * 10) })) : null,
    mode === 'normal' && target.capped ? h('p', { class: 'muted small' }, t('ideas.capped', { kcal: fmtKcal(target.kcal) })) : null,
    mode === 'light' ? h('p', {}, t('ideas.light')) : null,
    mode === 'over' ? h('p', {}, t('ideas.over')) : null,
  );

  const available = GROUPS.filter((g) => groups[g].length || (g === 'pantry' && tastes.pantry.length && mode === 'normal'));
  if (filter !== 'all' && !available.includes(filter)) filter = 'all';
  const chips = mode === 'normal'
    ? h(
        'div',
        { class: 'chips filter', role: 'tablist' },
        ['all', ...available].map((g) =>
          h('button', { type: 'button', class: 'chip', role: 'tab', 'aria-selected': String(filter === g), 'aria-pressed': String(filter === g), onclick: () => { filter = g; rerender(); } }, g === 'all' ? t('ideas.filter.all') : t(`ideas.chip.${g}`)),
        ),
      )
    : null;

  const shown = filter === 'all' ? available : [filter];
  const sections = shown.map((g) =>
    h('section', { class: 'idea-group' }, h('h2', {}, t(`ideas.group.${g}`)), groups[g].length ? groups[g].map(card) : h('p', { class: 'muted' }, t('ideas.none'))),
  );

  root.replaceChildren(
    ...[
      title,
      tastesPrompt,
      summary,
      chips,
      ...sections,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => { nextIdeasRound(); rerender(); } }, t('ideas.shuffle')), h('a', { class: 'btn', href: '#/tastes' }, t('ideas.editTastes'))),
      h('p', { class: 'muted small' }, t('ideas.note')),
    ].filter(Boolean),
  );
}
