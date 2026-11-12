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
import * as mealView from './ui/meal.js';
import * as dietView from './ui/diet.js';
import * as tilesView from './ui/tiles.js';
import * as workoutView from './ui/workout.js';
import { getSelectedDate, setSelectedDate, noteNavigation } from './ui/state.js';
import { icon } from './ui/icons.js';

// Tab icons (js/ui/icons.js)
const ICONS = { dashboard: 'compass', journal: 'book', ideas: 'soup', diet: 'sliders', profile: 'user' };

// Only screens that work are listed. Later stages add Foods, Meal builder,
// Suggestions and Progress.
const ROUTES = [
  { pattern: /^\/$/, view: dashboard, tab: '/', label: 'nav.dashboard', icon: ICONS.dashboard },
  { pattern: /^\/journal$/, view: journal, tab: '/journal', label: 'nav.journal', icon: ICONS.journal },
  { pattern: /^\/ideas$/, view: ideas, tab: '/ideas', label: 'nav.ideas', icon: ICONS.ideas },
  { pattern: /^\/diet$/, view: dietView, tab: '/diet', label: 'nav.diet', icon: ICONS.diet },
  { pattern: /^\/profile$/, view: profile, tab: '/profile', label: 'nav.profile', icon: ICONS.profile },
  { pattern: /^\/tiles$/, view: tilesView },
  { pattern: /^\/tastes$/, view: tastes },
  { pattern: /^\/workout$/, view: workoutView },
  { pattern: /^\/add$/, view: mealView },
  { pattern: /^\/add\/detail$/, view: entryForm },
  { pattern: /^\/edit\/([\w-]+)$/, view: entryForm, params: (m) => ({ id: m[1] }) },
];

function svgIcon(name) {
  return icon(name, 'tab-icon');
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
