import { h } from './dom.js';
import { t, fmtDate } from '../i18n/i18n.js';
import { addDays, parseISODate, today } from '../core/dates.js';
import { getSelectedDate, setSelectedDate } from './state.js';

export function dayLabel(iso) {
  const now = today();
  if (iso === now) return t('dash.today');
  if (iso === addDays(now, -1)) return t('dash.yesterday');
  if (iso === addDays(now, 1)) return t('dash.tomorrow');
  return fmtDate(parseISODate(iso));
}

/** Previous / next day bar. Calls rerender after changing the shared date. */
export function dayNav(rerender) {
  const d = getSelectedDate();
  const go = (n) => {
    setSelectedDate(n === 0 ? today() : addDays(getSelectedDate(), n));
    rerender();
  };
  return h(
    'div',
    { class: 'daynav' },
    h('button', { class: 'icon-btn', 'aria-label': t('dash.prevDay'), onclick: () => go(-1) }, '‹'),
    h(
      'div',
      { class: 'daynav-label' },
      h('strong', {}, dayLabel(d)),
      d === today() ? null : h('button', { class: 'link-btn', onclick: () => go(0) }, t('dash.goToToday')),
    ),
    h('button', { class: 'icon-btn', 'aria-label': t('dash.nextDay'), onclick: () => go(1) }, '›'),
  );
}
