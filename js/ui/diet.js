// Diet & fasting: how you eat. Diet style, fasting plan, daily targets,
// food preferences and diet history. Body details live on Me (#/profile).
import { h, toast } from './dom.js';
import { t } from '../i18n/i18n.js';
import { DIET_STYLES } from '../core/calc.js';
import { FASTING_IDS, eatingWindow } from '../core/diet.js';
import * as store from '../data/store.js';
import { recommendationFor } from './targets-compare.js';
import { field, splitList, targetsCard } from './profile.js';
import { dayLabel } from './daynav.js';

/** A row of single-choice chips backed by radio semantics. */
function choiceChips(name, ids, labelOf, value, onPick) {
  let current = value;
  const group = h('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': `${name}-label` });
  const draw = () =>
    group.replaceChildren(
      ...ids.map((id) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip',
            role: 'radio',
            'aria-checked': String(id === current),
            'aria-pressed': String(id === current),
            onclick: () => {
              current = id;
              draw();
              group.querySelector('[aria-checked="true"]')?.focus();
              onPick(id);
            },
          },
          labelOf(id),
        ),
      ),
    );
  draw();
  return { el: group, get value() { return current; } };
}

function dietForm(profile) {
  const p = profile || {};
  const note = h('p', { class: 'muted small', id: 'diet-note' });
  const diet = choiceChips('dietStyle', DIET_STYLES, (d) => t(`diet.short.${d}`), DIET_STYLES.includes(p.dietStyle) ? p.dietStyle : 'balanced', () => refresh());

  const start = h('input', { id: 'eatingStart', type: 'time', value: p.eatingStart || '12:00' });
  const windowText = h('p', { class: 'small', id: 'eating-window', 'aria-live': 'polite' });
  const bar = h('div', { class: 'window-bar', 'aria-hidden': 'true' }, h('div', { class: 'window-fill' }), h('div', { class: 'window-fill wrap' }));
  const startField = h('div', { class: 'field', id: 'f-eatingStart' }, h('label', { for: 'eatingStart' }, t('profile.eatingStart')), start, windowText, bar, h('div', { class: 'window-scale muted small', 'aria-hidden': 'true' }, h('span', {}, '00:00'), h('span', {}, '12:00'), h('span', {}, '24:00')));
  const fasting = choiceChips('fasting', FASTING_IDS, (f) => t(`profile.fasting.${f}`), FASTING_IDS.includes(p.fasting) ? p.fasting : 'none', () => refresh());

  function refresh() {
    note.textContent = t(`profile.dietStyle.${diet.value}`);
    startField.hidden = fasting.value === 'none';
    const win = eatingWindow({ fasting: fasting.value, eatingStart: start.value });
    windowText.textContent = win ? t('profile.eatingWindow', { start: win.start, end: win.end, hours: win.hours }) : '';
    if (win) {
      const [hh, mm] = start.value.split(':').map(Number);
      const from = ((hh || 0) * 60 + (mm || 0)) / 1440;
      const len = win.hours / 24;
      // A window past midnight continues at the start of the bar
      const [first, wrap] = bar.querySelectorAll('.window-fill');
      first.style.left = `${from * 100}%`;
      first.style.width = `${Math.min(len, 1 - from) * 100}%`;
      wrap.style.left = '0';
      wrap.style.width = `${Math.max(0, from + len - 1) * 100}%`;
    }
  }
  start.addEventListener('input', refresh);

  const list = (id, label, ph) => field(id, label, h('input', { id, type: 'text', value: (p[id] || []).join(', '), placeholder: ph }));

  const form = h(
    'form',
    { class: 'card', novalidate: true },
    h('h2', { id: 'dietStyle-label' }, t('profile.dietStyle')),
    diet.el,
    note,
    h('h2', { id: 'fasting-label' }, t('profile.fasting')),
    h('p', { class: 'muted small' }, t('profile.fasting.hint')),
    fasting.el,
    startField,
    h('h2', {}, t('profile.foodSection')),
    h('p', { class: 'muted small' }, t('profile.foodHint')),
    list('diet', t('profile.diet'), t('profile.diet.ph')),
    list('allergies', t('profile.allergies'), t('profile.allergies.ph')),
    list('dislikes', t('profile.dislikes'), t('profile.dislikes.ph')),
    h('button', { class: 'btn primary', type: 'submit' }, t('dietPage.save')),
  );
  refresh();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => form.querySelector(`#${id}`).value;
    const saved = (await store.getProfile()) || {};
    const next = {
      ...saved,
      dietStyle: diet.value,
      fasting: fasting.value,
      eatingStart: start.value || '12:00',
      diet: splitList(v('diet')),
      allergies: splitList(v('allergies')),
      dislikes: splitList(v('dislikes')),
    };
    delete next.updatedAt;
    try {
      await store.saveProfile(next);
      // Targets that came from a recommendation follow the new diet straight
      // away; targets the person typed in themselves are left alone.
      const rec = recommendationFor(next);
      const targets = await store.getTargets();
      let updated = false;
      let kept = false;
      if (rec) {
        const out = {};
        for (const k of store.TARGET_KEYS) {
          const cur = targets?.[k];
          if (cur?.source === 'manual') {
            out[k] = cur;
            kept = true;
          } else {
            out[k] = { value: rec[k], source: 'estimated' };
            if (cur?.value !== rec[k]) updated = true;
          }
        }
        if (updated) await store.saveTargets(out);
      }
      const diet = t(`diet.short.${next.dietStyle}`);
      toast(updated ? t(kept ? 'dietPage.savedTargetsKept' : 'dietPage.savedTargets', { diet }) : t('dietPage.saved'));
    } catch (err) {
      toast(t('err.generic', { msg: err.message }), 'error');
    }
  });
  return form;
}

function likesCard(tastes) {
  const n = tastes?.likes?.length || 0;
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('tastes.title')),
    h('p', { class: 'muted small' }, n ? t('dietPage.likesCount', { n }) : t('dietPage.likesNone')),
    h('a', { class: 'link-btn', href: '#/tastes' }, `${t('dietPage.likesLink')} →`),
  );
}

function historyCard(history) {
  if (!history.length) return null;
  const rows = history.slice().reverse().slice(0, 12).map((x, i, arr) => {
    const plan = [t(`diet.short.${x.diet}`), x.fasting && x.fasting !== 'none' ? t(`profile.fasting.${x.fasting}`) : null].filter(Boolean).join(' · ');
    const until = i === 0 ? t('dietPage.since', { date: dayLabel(x.from) }) : t('dietPage.range', { from: dayLabel(x.from), to: dayLabel(arr[i - 1].from) });
    return h('li', { class: i === 0 ? '' : 'muted' }, h('span', {}, plan), h('span', { class: 'small' }, until));
  });
  return h('section', { class: 'card' }, h('h2', {}, t('dietPage.history')), h('ul', { class: 'history-list' }, rows));
}

// The form keeps what you type; don't redraw it on every data change.
export const live = false;

export async function render(root) {
  const [profile, targets, tastes, history] = await Promise.all([store.getProfile(), store.getTargets(), store.getTastes(), store.getDietHistory()]);
  const rec = recommendationFor(profile);
  const targetsHolder = h('div', {}, targetsCard(targets, rec));
  // Targets change when a diet style is saved or a target is used/typed:
  // refresh just that card so the form keeps its state.
  const off = store.onChange(async () => {
    if (!root.isConnected) return off?.();
    const [p, tg] = await Promise.all([store.getProfile(), store.getTargets()]);
    targetsHolder.replaceChildren(targetsCard(tg, recommendationFor(p)));
  });
  root.replaceChildren(
    h('h1', { class: 'page-title' }, t('dietPage.title')),
    h('p', { class: 'muted small' }, t('dietPage.intro')),
    dietForm(profile),
    targetsHolder,
    likesCard(tastes),
    ...[historyCard(history)].filter(Boolean),
  );
}
