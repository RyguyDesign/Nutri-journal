import { h, toast } from './dom.js';
import { t, fmtKcal, fmtGrams, fmtNumber } from '../i18n/i18n.js';
import { MEALS, MASS_UNITS } from '../core/entry.js';
import { sumNutrients } from '../core/calc.js';
import { addDays } from '../core/dates.js';
import * as store from '../data/store.js';
import { dayNav, dayLabel } from './daynav.js';
import { getSelectedDate } from './state.js';
import { journalStatus } from './diet-status.js';

export function amountText(e) {
  const q = fmtNumber(e.quantity, 1);
  if (MASS_UNITS.includes(e.unit)) return `${q} ${t(`unit.${e.unit}`)}`;
  return `${q} ${e.quantity === 1 ? t(`unit.${e.unit}`) : t(`unit.${e.unit}.n`)}`;
}

/** One tappable entry row, used on the journal and the dashboard. */
export function entryRow(e, { showMacros = true } = {}) {
  return h(
    'li',
    {},
    h(
      'a',
      { class: 'entry-row', href: `#/edit/${e.id}` },
      h('span', { class: 'log-time num' }, e.time),
      h(
        'span',
        { class: 'log-name' },
        h('span', {}, e.name, e.prep ? h('span', { class: 'tag' }, t(`prep.${e.prep}`)) : null),
        h(
          'small',
          { class: 'muted' },
          amountText(e),
          showMacros ? ` · ${t('journal.macros', { p: fmtGrams(e.protein), c: fmtGrams(e.carbs), f: fmtGrams(e.fat) })}` : '',
        ),
      ),
      h('span', { class: 'log-kcal num' }, `${fmtKcal(e.kcal)}`),
    ),
  );
}

// "Yesterday" reads as "yesterday" mid-sentence; dates stay as they are.
const relativeLower = (label) => ([t('dash.yesterday'), t('dash.today'), t('dash.tomorrow')].includes(label) ? label.toLowerCase() : label);

export async function render(root, rerender) {
  const date = getSelectedDate();
  const prev = addDays(date, -1);
  const [entries, prevEntries] = await Promise.all([store.getEntriesForDate(date), store.getEntriesForDate(prev)]);
  const total = sumNutrients(entries);

  const sections = MEALS.map((meal) => {
    const list = entries.filter((e) => e.meal === meal);
    const sub = sumNutrients(list);
    return h(
      'section',
      { class: `card meal${list.length ? '' : ' empty'}` },
      h(
        'div',
        { class: 'meal-head' },
        h('h2', {}, t(`meal.${meal}`)),
        list.length ? h('span', { class: 'muted num' }, `${fmtKcal(sub.kcal)} kcal`) : null,
        h('a', { class: 'link-btn', href: `#/add?meal=${meal}&date=${date}`, 'aria-label': t('journal.addTo', { meal: t(`meal.${meal}`) }) }, `+ ${t('journal.add')}`),
      ),
      list.length ? h('ul', { class: 'log' }, list.map((e) => entryRow(e))) : null,
    );
  });

  const copy = prevEntries.length
    ? h(
        'button',
        {
          class: 'btn wide',
          onclick: async () => {
            if (!confirm(t('journal.copyConfirm', { n: prevEntries.length, from: dayLabel(prev), to: dayLabel(date) }))) return;
            const n = await store.copyDay(prev, date);
            toast(t('journal.copied', { n }));
          },
        },
        t('journal.copyDay', { day: relativeLower(dayLabel(prev)) }),
      )
    : null;

  const status = await journalStatus(date);
  root.replaceChildren(
    ...[
      dayNav(rerender),
      h(
        'p',
        { class: 'day-total muted num' },
        t('journal.dayTotal', { kcal: fmtKcal(total.kcal), p: fmtGrams(total.protein), c: fmtGrams(total.carbs), f: fmtGrams(total.fat) }),
      ),
      status,
      ...sections,
      copy,
    ].filter(Boolean),
  );
}
