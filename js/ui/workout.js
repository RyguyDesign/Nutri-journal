// Log or edit a workout: type, minutes, and burned kcal (estimated from body
// weight with MET values; the person can overwrite it). Burned kcal is shown
// on its own and is not added to the calorie budget.
import { h, toast } from './dom.js';
import { t, fmtDate } from '../i18n/i18n.js';
import * as store from '../data/store.js';
import { WORKOUTS, estimateKcal, validateWorkout } from '../core/activity.js';
import { today, parseISODate } from '../core/dates.js';
import { icon } from './icons.js';
import { field } from './profile.js';

export const live = false;

const parseNum = (s) => {
  const v = String(s ?? '').trim().replace(',', '.');
  return v === '' ? NaN : Number(v);
};
const nowTime = () => new Date().toTimeString().slice(0, 5);

export async function render(root, rerender, params = {}) {
  const q = params.query || {};
  const [profile, list] = await Promise.all([store.getProfile(), store.getWorkouts()]);
  const existing = q.id ? list.find((w) => w.id === q.id) : null;
  const weightKg = profile?.weightKg;
  const date = existing?.date || (/^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : today());

  let type = existing?.type || 'gym';
  // kcal follows the estimate until the person types their own number
  let kcalAuto = existing ? existing.kcalAuto !== false : true;

  const minutes = h('input', { id: 'w-minutes', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: existing?.minutes ?? '' });
  const kcal = h('input', { id: 'w-kcal', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: existing?.kcal ?? '' });
  const time = h('input', { id: 'w-time', type: 'time', value: existing?.time || nowTime() });
  const kcalHint = h('small', { class: 'muted', id: 'w-kcal-hint' });

  const refreshEstimate = () => {
    const est = estimateKcal(type, Math.round(parseNum(minutes.value)), weightKg);
    if (kcalAuto) kcal.value = est ?? '';
    if (type === 'other') kcalHint.textContent = t('workout.kcalOther');
    else if (!(weightKg > 0)) kcalHint.textContent = t('workout.kcalNoWeight');
    else if (kcalAuto) kcalHint.textContent = est === null ? t('workout.kcalEnterMinutes') : t('workout.kcalEstimated', { kg: weightKg });
    else kcalHint.textContent = est === null ? t('workout.kcalOwn') : t('workout.kcalOwnVs', { n: est });
  };
  minutes.addEventListener('input', refreshEstimate);
  kcal.addEventListener('input', () => { kcalAuto = kcal.value.trim() === ''; refreshEstimate(); });

  const typeChips = h('div', { class: 'chips', role: 'group', 'aria-labelledby': 'w-type-label' },
    WORKOUTS.map((w) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(w.id === type), 'data-type': w.id,
      onclick: (e) => {
        type = w.id;
        for (const c of typeChips.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c === e.currentTarget));
        refreshEstimate();
      },
    }, t(`workout.type.${w.id}`))));

  const showErrors = (errors) => {
    for (const [k, id] of [['minutes', 'w-minutes'], ['kcal', 'w-kcal'], ['type', 'w-type']]) {
      const f = root.querySelector(`#f-${id}`);
      const msg = errors[k] ? t(errors[k]) : '';
      f?.classList.toggle('invalid', Boolean(msg));
      const e = root.querySelector(`#e-${id}`);
      if (e) e.textContent = msg;
      root.querySelector(`#${id}`)?.setAttribute('aria-invalid', String(Boolean(msg)));
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const m = parseNum(minutes.value);
    const k = parseNum(kcal.value);
    const w = { type, minutes: Number.isFinite(m) ? m : NaN, kcal: Number.isFinite(k) ? Math.round(k) : null };
    const errors = validateWorkout(w);
    showErrors(errors);
    if (Object.keys(errors).length) { root.querySelector('.invalid input, .invalid button')?.focus(); return; }
    await store.saveWorkout({ id: existing?.id, date, time: time.value || nowTime(), type, minutes: w.minutes, kcal: w.kcal, kcalAuto });
    toast(t(existing ? 'workout.updated' : 'workout.saved'));
    location.hash = '#/';
  };

  const remove = existing
    ? h('button', { type: 'button', class: 'btn danger wide', onclick: async () => {
        const copy = existing;
        await store.deleteWorkout(copy.id);
        toast(t('workout.deleted'), 'info', { label: t('common.undo'), fn: () => store.saveWorkout(copy) });
        location.hash = '#/';
      } }, t('workout.delete'))
    : null;

  root.replaceChildren(
    h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': t('tiles.back') }, '‹'),
      h('div', {}, h('h1', { class: 'page-title' }, t(existing ? 'workout.editTitle' : 'workout.title')), h('p', { class: 'muted small' }, fmtDate(parseISODate(date), { weekday: 'long', day: 'numeric', month: 'long' })))),
    h('form', { class: 'card workout-form', novalidate: true, onsubmit: save },
      h('div', { class: 'field', id: 'f-w-type' }, h('p', { class: 'label', id: 'w-type-label' }, t('workout.typeLabel')), typeChips, h('small', { class: 'err', id: 'e-w-type' })),
      h('div', { class: 'field-row' },
        field('w-minutes', t('workout.minutes'), h('div', { class: 'with-unit' }, minutes, h('span', { class: 'unit' }, t('workout.min')))),
        field('w-time', t('workout.time'), time)),
      field('w-kcal', t('workout.kcal'), h('div', { class: 'with-unit' }, kcal, h('span', { class: 'unit' }, t('common.kcal')))),
      kcalHint,
      h('p', { class: 'muted small workout-note' }, icon('target', 'ic-xs'), t('workout.notBudget')),
      h('button', { type: 'submit', class: 'btn primary wide' }, t(existing ? 'workout.update' : 'workout.save')),
      remove),
  );
  refreshEstimate();
  if (!existing) minutes.focus();
}
