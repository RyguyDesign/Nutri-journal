import { watchForUpdates } from './update.js';
import { h, toast } from './ui/dom.js';
import { today } from './core/dates.js';
import { t, setLocale } from './i18n/i18n.js';
import * as store from './data/store.js';
import * as dashboard from './ui/dashboard.js';
import * as journal from './ui/journal.js';
import * as profile from './ui/profile.js';
import * as entryForm from './ui/entry-form.js';
import * as ideas from './ui/ideas.js';
import * as tastes from './ui/tastes.js';
import { getSelectedDate, setSelectedDate, noteNavigation } from './ui/state.js';

// 24×24 stroke icons
const ICONS = {
  dashboard: 'M12 3a9 9 0 1 0 9 9M12 3v9h9M12 3a9 9 0 0 1 9 9',
  journal: 'M6 3h11a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1zM5 17a2 2 0 0 1 2-2h12M9 7h6M9 11h6',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  ideas: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
};

// Only screens that work are listed. Later stages add Foods, Meal builder,
// Suggestions and Progress.
const ROUTES = [
  { pattern: /^\/$/, view: dashboard, tab: '/', label: 'nav.dashboard', icon: ICONS.dashboard },
  { pattern: /^\/journal$/, view: journal, tab: '/journal', label: 'nav.journal', icon: ICONS.journal },
  { pattern: /^\/ideas$/, view: ideas, tab: '/ideas', label: 'nav.ideas', icon: ICONS.ideas },
  { pattern: /^\/profile$/, view: profile, tab: '/profile', label: 'nav.profile', icon: ICONS.profile },
  { pattern: /^\/tastes$/, view: tastes },
  { pattern: /^\/add$/, view: entryForm },
  { pattern: /^\/edit\/([\w-]+)$/, view: entryForm, params: (m) => ({ id: m[1] }) },
];

function svgIcon(d) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'tab-icon');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

const main = document.getElementById('main');
let renderToken = 0;

function resolve() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  for (const r of ROUTES) {
    const m = r.pattern.exec(path);
    if (m) return { route: r, params: { ...(r.params ? r.params(m) : {}), query: Object.fromEntries(new URLSearchParams(qs)) }, path };
  }
  return { route: ROUTES[0], params: { query: {} }, path: '/' };
}

async function render() {
  const token = ++renderToken;
  const { route, params } = resolve();
  const container = h('div', { class: 'view' });
  try {
    await route.view.render(container, render, params);
  } catch (err) {
    console.error(err);
    container.replaceChildren(h('div', { class: 'card error' }, t('err.generic', { msg: err.message })));
  }
  if (token !== renderToken) return; // a newer render started meanwhile
  main.replaceChildren(container);
  document.querySelectorAll('.tabbar a').forEach((a) => a.setAttribute('aria-current', a.dataset.path === route.tab ? 'page' : 'false'));
}

function buildTabbar() {
  const nav = document.getElementById('tabbar');
  nav.replaceChildren(
    ...ROUTES.filter((r) => r.tab).map((r) => h('a', { href: `#${r.tab}`, dataset: { path: r.tab } }, svgIcon(r.icon), h('span', {}, t(r.label)))),
  );
}

async function start() {
  const settings = await store.getSettings();
  setLocale(settings.locale);
  document.title = t('app.name');
  buildTabbar();
  window.addEventListener('hashchange', () => {
    noteNavigation();
    render();
    window.scrollTo(0, 0);
  });
  // Live screens re-render on any data change; forms opt out (live = false)
  // so typing is never lost.
  store.onChange(() => {
    if (resolve().route.view.live !== false) render();
  });
  // Back in the foreground on a new day: move "today" along on the overview screens.
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || today() === lastDay) return;
    if (getSelectedDate() === lastDay) setSelectedDate(today());
    lastDay = today();
    if (resolve().route.view.live !== false) render();
  });
  await render();
  window.__appStarted = true;
  watchForUpdates({
    isBusy: () => resolve().route.view.live === false,
    onAvailable: () => toast(t('app.updateReady'), 'info', { label: t('app.updateReload'), fn: () => location.reload() }),
  });
  store.requestPersistence();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker not registered', e));
  }
}

start().catch((err) => {
  console.error(err);
  window.__appStarted = true; // the error below replaces the loading safety net
  main.replaceChildren(h('div', { class: 'card error' }, t('app.loadError', { msg: err.message })));
});
