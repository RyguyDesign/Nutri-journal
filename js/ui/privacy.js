// Privacy notice (GDPR: say plainly what is stored and what leaves the phone).
// Keep it in step with the actual network calls: js/foods/off.js,
// js/foods/ocr.js, js/update.js, and the Content-Security-Policy in index.html.
import { h } from './dom.js';
import { t } from '../i18n/i18n.js';
import { goBack } from './state.js';

export const live = false;

const section = (head, ...paras) => h('section', { class: 'card privacy-card' }, h('h2', {}, t(head)), ...paras.map((k) => h('p', {}, t(k))));

export async function render(root) {
  root.replaceChildren(
    h('div', { class: 'page-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('add.back'), onclick: () => goBack('#/profile') }, '‹'),
      h('div', {}, h('h1', { class: 'page-title' }, t('privacy.title')), h('p', { class: 'muted small' }, t('privacy.sub')))),
    section('privacy.storedH', 'privacy.stored'),
    section('privacy.leavesH', 'privacy.off', 'privacy.ocr', 'privacy.host', 'privacy.backup'),
    section('privacy.notH', 'privacy.not'),
    section('privacy.controlH', 'privacy.control'),
    section('privacy.contactH', 'privacy.contact'),
  );
}
