import { h } from './ui/dom.js';
import { today } from './core/dates.js';
import { t, setLocale } from './i18n/i18n.js';
import * as store from './data/store.js';
import * as dashboard from './ui/dashboard.js';
import * as profile from './ui/profile.js';

// Only screens that work are listed. Later stages add Journal, Foods,
// Meal builder, Suggestions and Progress here.
const ICONS = {
  // 24×24 stroke icons
  dashboard: 'M12 3a9 9 0 1 0 9 9M12 3v9h9M12 3a9 9 0 0 1 9 9',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};

const ROUTES = {
  '/': { view: dashboard, label: 'nav.dashboard', icon: ICONS.dashboard },
  '/profile': { view: profile, label: 'nav.profile', icon: ICONS.profile },
};

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

function currentPath() {
  const p = location.hash.replace(/^#/, '') || '/';
  return ROUTES[p] ? p : '/';
}

async function render() {
  const token = ++renderToken;
  const path = currentPath();
  const route = ROUTES[path];
  const container = h('div', { class: 'view' });
  try {
    await route.view.render(container, render);
  } catch (err) {
    console.error(err);
    container.replaceChildren(h('div', { class: 'card error' }, t('err.generic', { msg: err.message })));
  }
  if (token !== renderToken) return; // a newer render started meanwhile
  main.replaceChildren(container);
  document.querySelectorAll('.tabbar a').forEach((a) => a.setAttribute('aria-current', a.dataset.path === path ? 'page' : 'false'));
}

function buildTabbar() {
  const nav = document.getElementById('tabbar');
  nav.replaceChildren(
    ...Object.entries(ROUTES).map(([path, r]) =>
      h('a', { href: `#${path}`, dataset: { path } }, svgIcon(r.icon), h('span', {}, t(r.label))),
    ),
  );
}

async function start() {
  const settings = await store.getSettings();
  setLocale(settings.locale);
  document.title = t('app.name');
  buildTabbar();
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });
  store.onChange(() => render());
  // If the app comes back to the foreground on a new day, refresh the
  // dashboard so "today" is correct. Other screens are left alone so
  // unsaved form input is never lost.
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || today() === lastDay) return;
    lastDay = today();
    if (currentPath() === '/') render();
  });
  await render();
  store.requestPersistence();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker not registered', e));
  }
}

start().catch((err) => {
  console.error(err);
  main.replaceChildren(h('div', { class: 'card error' }, t('app.loadError', { msg: err.message })));
});
