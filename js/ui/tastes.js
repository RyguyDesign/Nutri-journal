// "Foods I like" questionnaire.
import { h, toast } from './dom.js';
import { t } from '../i18n/i18n.js';
import * as store from '../data/store.js';
import { FOODS, CATEGORIES, CUISINES, STYLES } from '../suggest/catalog.js';
import { MEAL_PLANS, COOK_LIMITS, styleLevels } from '../suggest/engine.js';
import { goBack } from './state.js';

export const live = false; // keep ticks while editing

function chip(label, pressed, onToggle) {
  const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed) }, label);
  b.addEventListener('click', () => {
    const now = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(now));
    onToggle(now);
  });
  return b;
}

function chipGroup(ids, labelOf, selected) {
  return h('div', { class: 'chips' }, ids.map((id) => chip(labelOf(id), selected.has(id), (on) => (on ? selected.add(id) : selected.delete(id)))));
}

// Tap cycles: not ticked -> sometimes -> often -> not ticked
const NEXT_LEVEL = { undefined: 'sometimes', sometimes: 'often', often: undefined };
function levelChips(ids, labelOf, levels) {
  return h(
    'div',
    { class: 'chips' },
    ids.map((id) => {
      const b = h('button', { type: 'button', class: 'chip' });
      const paint = () => {
        const lv = levels.get(id);
        b.setAttribute('aria-pressed', String(!!lv));
        b.dataset.level = lv || '';
        b.replaceChildren(labelOf(id), lv ? h('span', { class: 'level' }, ` · ${t(`tastes.level.${lv}`)}`) : '');
      };
      b.addEventListener('click', () => {
        const next = NEXT_LEVEL[levels.get(id)];
        if (next) levels.set(id, next);
        else levels.delete(id);
        paint();
      });
      paint();
      return b;
    }),
  );
}

function radios(name, options, value, onChange) {
  return h(
    'div',
    { class: 'radios', role: 'radiogroup' },
    options.map(([v, label]) =>
      h('label', { class: 'radio' }, h('input', { type: 'radio', name, value: v, checked: v === value, onchange: () => onChange(v) }), h('span', {}, label)),
    ),
  );
}

export async function render(root) {
  const tastes = await store.getTastes();
  const likes = new Set(tastes.likes);
  const pantry = new Set(tastes.pantry);
  const cuisines = new Set(tastes.cuisines);
  const styles = styleLevels(tastes.styles);
  let cookTime = tastes.cookTime;
  let plan = tastes.plan;

  const foodName = (id) => FOODS.find((f) => f.id === id).name;
  const byCat = (cat) => FOODS.filter((f) => f.cat === cat).map((f) => f.id);

  const likeSections = CATEGORIES.map((cat) =>
    h('section', { class: 'card' }, h('h2', {}, t(`tastes.cat.${cat}`)), chipGroup(byCat(cat), foodName, likes)),
  );

  const pantrySection = h(
    'details',
    { class: 'card pantry', open: pantry.size > 0 },
    h('summary', {}, h('strong', {}, t('tastes.pantry')), h('span', { class: 'muted small' }, ` · ${t('tastes.pantryHint')}`)),
    ...CATEGORIES.map((cat) => h('div', { class: 'pantry-group' }, h('h3', {}, t(`tastes.cat.${cat}`)), chipGroup(byCat(cat), foodName, pantry))),
  );

  const save = async () => {
    try {
      await store.saveTastes({ likes: [...likes], pantry: [...pantry], cuisines: [...cuisines], styles: Object.fromEntries(styles), cookTime, plan });
      toast(t('tastes.saved'));
      goBack('#/ideas');
    } catch (err) {
      toast(t('err.generic', { msg: err.message }), 'error');
    }
  };

  root.replaceChildren(
    h('h1', { class: 'page-title' }, t('tastes.title')),
    h('p', { class: 'muted' }, t('tastes.intro')),
    ...likeSections,
    h('section', { class: 'card' }, h('h2', {}, t('tastes.styles')), h('p', { class: 'muted small' }, t('tastes.stylesHint')), levelChips(STYLES, (x) => t(`tastes.style.${x}`), styles)),
    h('section', { class: 'card' }, h('h2', {}, t('tastes.cuisines')), chipGroup(CUISINES, (c) => t(`tastes.cuisine.${c}`), cuisines)),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, t('tastes.cookTime')),
      radios('cookTime', Object.keys(COOK_LIMITS).map((k) => [k, t(`tastes.cookTime.${k}`)]), cookTime, (v) => (cookTime = v)),
      h('h2', { class: 'gap' }, t('tastes.plan')),
      radios('plan', Object.keys(MEAL_PLANS).map((k) => [k, t(`tastes.plan.${k}`)]), plan, (v) => (plan = v)),
    ),
    pantrySection,
    h('p', { class: 'muted small' }, t('tastes.restrictions')),
    h('div', { class: 'actions sticky' }, h('button', { type: 'button', class: 'btn primary grow', onclick: save }, t('tastes.save'))),
  );
}
