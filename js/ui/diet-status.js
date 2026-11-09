// Diet and fasting status: the fasting card on the dashboard and the daily
// check line in the journal. Uses the diet history so past days are judged
// by the diet and fasting plan that applied then.
import { h, bar, toast } from './dom.js';
import { t, fmtGrams } from '../i18n/i18n.js';
import * as store from '../data/store.js';
import { addDays, today } from '../core/dates.js';
import {
  DIETS, FASTING, eatingWindow, inWindow, activeFast, fastHours, fastsEndingOn,
  dietOnDate, dayCheck, streak, localDate,
} from '../core/diet.js';

const hm = (hours) => {
  const totalMin = Math.max(0, Math.round(hours * 60));
  return t('fast.hm', { h: Math.floor(totalMin / 60), m: String(totalMin % 60).padStart(2, '0') });
};
const clock = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Check for one day with the diet and plan that applied then. */
export async function checkForDate(date, ctx) {
  const entries = await store.getEntriesForDate(date);
  const applied = dietOnDate(ctx.history, date);
  const fasting = applied.fasting;
  return {
    applied,
    ...dayCheck({
      entries,
      diet: applied.diet,
      fasting,
      profile: { ...ctx.profile, fasting },
      targets: ctx.goal,
      fastsEnded: fastsEndingOn(ctx.fasts, date),
    }),
  };
}

export async function loadContext() {
  const [profile, history, fasts, targets] = await Promise.all([store.getProfile(), store.getDietHistory(), store.getFasts(), store.getTargets()]);
  return { profile: profile || {}, history, fasts, goal: store.targetValues(targets) };
}

/** Days in a row the diet check passed (looks back up to 60 days). */
async function dietStreak(ctx, kind) {
  const byDate = {};
  const end = today();
  for (let i = 0; i < 60; i++) {
    const d = addDays(end, -i);
    const c = await checkForDate(d, ctx);
    const r = c[kind];
    if (!r) {
      if (i > 0) break;
      continue;
    }
    byDate[d] = r;
    if (!r.ok && i > 0) break;
  }
  return streak(byDate, end);
}

/** Text for a check result. */
export function checkText(kind, r, applied) {
  if (!r) return null;
  if (kind === 'diet') {
    const name = t(`diet.short.${applied.diet}`);
    if (r.kind === 'carbs') return t(r.ok ? 'check.carbsOk' : 'check.carbsOver', { diet: name, g: fmtGrams(r.value), limit: fmtGrams(r.limit) });
    if (r.kind === 'protein') return t(r.ok ? 'check.proteinOk' : 'check.proteinLow', { diet: name, g: fmtGrams(r.value), target: fmtGrams(r.limit) });
    if (r.kind === 'foods') return r.ok ? t('check.foodsOk', { diet: name }) : t('check.foodsOff', { diet: name, list: r.off.slice(0, 3).join(', ') });
  }
  const plan = t(`profile.fasting.${applied.fasting}`);
  if (r.kind === 'fast') return t(r.ok ? 'check.fastOk' : 'check.fastShort', { plan, time: hm(r.hours), goal: r.goal });
  if (r.kind === 'window') return r.ok ? t('check.windowOk', { plan, start: r.window.start, end: r.window.end }) : t('check.windowOut', { plan, n: r.outside, start: r.window.start, end: r.window.end });
  return null;
}

function checkLine(kind, r, applied) {
  const text = checkText(kind, r, applied);
  return text ? h('p', { class: `check ${r.ok ? 'ok' : 'off'}` }, h('span', { class: 'check-mark', 'aria-hidden': 'true' }, r.ok ? '✓' : '•'), text) : null;
}

/** Journal: the day's diet and fasting result, plus fasts that ended that day. */
export async function journalStatus(date) {
  const ctx = await loadContext();
  const c = await checkForDate(date, ctx);
  const ended = fastsEndingOn(ctx.fasts, date);
  const lines = [checkLine('diet', c.diet, c.applied), checkLine('fasting', c.fasting, c.applied)].filter(Boolean);
  const fastList = ended.length
    ? h('ul', { class: 'fast-list' }, ended.map((f) => h(
        'li',
        {},
        h('span', {}, t('fast.entry', { from: clock(new Date(f.start)), to: clock(new Date(f.end)), time: hm(fastHours(f)) })),
        h('button', {
          type: 'button',
          class: 'icon-btn',
          'aria-label': t('fast.delete'),
          onclick: async () => {
            if (confirm(t('fast.deleteConfirm'))) await store.deleteFast(f.id);
          },
        }, '×'),
      )))
    : null;
  const dietName = c.applied.diet !== 'balanced' || c.applied.fasting !== 'none'
    ? h('p', { class: 'muted small' }, t('check.plan', { diet: t(`diet.short.${c.applied.diet}`), plan: c.applied.fasting === 'none' ? t('profile.fasting.none') : t(`profile.fasting.${c.applied.fasting}`) }))
    : null;
  if (!lines.length && !fastList && !dietName) return null;
  return h('section', { class: 'card diet-status' }, dietName, ...lines, fastList);
}

/** Dashboard: fasting timer / eating window, today's check and the streak. */
export async function dashboardStatus(rerender) {
  const ctx = await loadContext();
  const plan = ctx.profile.fasting && FASTING[ctx.profile.fasting] ? ctx.profile.fasting : 'none';
  const diet = DIETS[ctx.profile.dietStyle] ? ctx.profile.dietStyle : 'balanced';
  const running = activeFast(ctx.fasts);
  if (plan === 'none' && !running && !DIETS[diet].check) return null;

  const parts = [];
  if (running || plan !== 'none') {
    const goal = running?.goalHours || FASTING[plan] || 16;
    if (running) {
      const timeEl = h('div', { class: 'fast-time num' });
      const barEl = h('div');
      const sub = h('p', { class: 'muted small' });
      const tick = () => {
        const hrs = fastHours(running);
        timeEl.textContent = hm(hrs);
        barEl.replaceChildren(bar(Math.min(1, hrs / goal), false, t('fast.title')));
        const endAt = new Date(new Date(running.start).getTime() + goal * 3600000);
        sub.textContent = hrs >= goal ? t('fast.reached', { goal }) : t('fast.until', { goal, time: clock(endAt) });
      };
      tick();
      const timer = setInterval(() => (timeEl.isConnected ? tick() : clearInterval(timer)), 30000);
      parts.push(
        h('h2', {}, t('fast.running')),
        timeEl,
        barEl,
        sub,
        h('p', { class: 'muted small' }, t('fast.autoEnd')),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: async () => { await store.endFast(); toast(t('fast.ended')); rerender(); } }, t('fast.end'))),
      );
    } else {
      const win = eatingWindow({ ...ctx.profile, fasting: plan });
      const now = new Date();
      const open = inWindow(clock(now), win);
      const startIn = h('input', { type: 'time', id: 'fast-start', value: clock(now), 'aria-label': t('fast.startedAt') });
      parts.push(
        h('h2', {}, t('fast.windowTitle', { plan: t(`profile.fasting.${plan}`) })),
        h('p', {}, t(open ? 'fast.windowOpen' : 'fast.windowClosed', { start: win.start, end: win.end })),
        h(
          'div',
          { class: 'fast-start-row' },
          h('label', { for: 'fast-start' }, t('fast.startedAt')),
          startIn,
          h('button', {
            type: 'button',
            class: 'btn primary',
            onclick: async () => {
              const [hh, mm] = startIn.value.split(':').map(Number);
              const start = new Date();
              start.setHours(hh, mm, 0, 0);
              if (start > new Date()) start.setDate(start.getDate() - 1); // "20:00" typed after midnight means yesterday
              await store.startFast(start, FASTING[plan]);
              toast(t('fast.started'));
              rerender();
            },
          }, t('fast.start')),
        ),
      );
    }
  }

  // Today's diet check and the streak
  const c = await checkForDate(today(), ctx);
  const dietLine = checkLine('diet', c.diet, c.applied);
  if (dietLine || DIETS[diet].check) {
    const n = await dietStreak(ctx, 'diet');
    if (dietLine) parts.push(dietLine);
    if (n > 0) parts.push(h('p', { class: 'muted small' }, t('check.streak', { n, diet: t(`diet.short.${diet}`) })));
  }
  if (plan !== 'none') {
    const fastStreak = await dietStreak(ctx, 'fasting');
    if (fastStreak > 1) parts.push(h('p', { class: 'muted small' }, t('check.fastStreak', { n: fastStreak, plan: t(`profile.fasting.${plan}`) })));
  }
  return parts.length ? h('section', { class: 'card diet-status' }, ...parts) : null;
}

export { localDate };
