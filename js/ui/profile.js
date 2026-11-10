import { h, toast } from './dom.js';
import { t, fmtKcal, fmtNumber } from '../i18n/i18n.js';
import { ACTIVITY_LEVELS, GOALS, RATES, validateProfile } from '../core/calc.js';
import * as store from '../data/store.js';
import { FASTING_IDS, eatingWindow } from '../core/diet.js';

const RANGES = { age: [18, 100], heightCm: [120, 230], weightKg: [35, 300], targetWeightKg: [35, 300] };
const TARGET_RANGES = { kcal: [1000, 6000], protein: [0, 400], carbs: [0, 1000], fat: [0, 400] };
const UNIT = { kcal: 'common.kcal', protein: 'common.g', carbs: 'common.g', fat: 'common.g' };

// Accept "72,5" as well as "72.5" (German keyboards).
const parseNum = (s) => {
  const v = String(s ?? '').trim().replace(',', '.');
  return v === '' ? NaN : Number(v);
};
export const splitList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export function field(id, label, input, hint) {
  return h('div', { class: 'field', id: `f-${id}` }, h('label', { for: id }, label), input, hint ? h('small', { class: 'muted' }, hint) : null, h('small', { class: 'err', id: `e-${id}` }));
}

function numInput(id, value, unit, step = 'any') {
  return h(
    'div',
    { class: 'with-unit' },
    h('input', { id, name: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value ?? '', 'data-step': step }),
    h('span', { class: 'unit' }, unit),
  );
}

export function select(id, options, value) {
  return h('select', { id, name: id }, options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
}

function rateOptions(goal) {
  if (goal === 'maintain' || !RATES[goal]) return [['0', t('profile.rate.none')]];
  return RATES[goal].map((r) => [String(r), t('profile.rate.option', { n: fmtNumber(r, 2) })]);
}

// ---------------------------------------------------------------------------

/** Fasting plan and when the eating window opens. */
export function fastingFields(p) {
  const plan = select('fasting', FASTING_IDS.map((f) => [f, t(`profile.fasting.${f}`)]), p.fasting || 'none');
  const start = h('input', { id: 'eatingStart', name: 'eatingStart', type: 'time', value: p.eatingStart || '12:00' });
  const startField = h('div', { class: 'field', id: 'f-eatingStart' }, h('label', { for: 'eatingStart' }, t('profile.eatingStart')), start, h('small', { class: 'muted', id: 'eating-window' }));
  const refresh = () => {
    startField.hidden = plan.value === 'none';
    const win = eatingWindow({ fasting: plan.value, eatingStart: start.value });
    startField.querySelector('#eating-window').textContent = win ? t('profile.eatingWindow', { start: win.start, end: win.end, hours: win.hours }) : '';
  };
  plan.addEventListener('change', refresh);
  start.addEventListener('input', refresh);
  refresh();
  return h('div', {}, field('fasting', t('profile.fasting'), plan, t('profile.fasting.hint')), startField);
}

function profileForm(profile) {
  const p = profile || { sex: 'male', activity: 'moderate', goal: 'maintain', rateKgPerWeek: 0 };
  const rateSel = select('rateKgPerWeek', rateOptions(p.goal), p.rateKgPerWeek);
  const goalSel = select('goal', GOALS.map((g) => [g, t(`profile.goal.${g}`)]), p.goal);
  goalSel.addEventListener('change', () => {
    const opts = rateOptions(goalSel.value);
    rateSel.replaceChildren(...opts.map(([v, l]) => h('option', { value: v }, l)));
    if (goalSel.value !== 'maintain') rateSel.value = String(RATES[goalSel.value][1] ?? RATES[goalSel.value][0]);
  });

  const form = h(
    'form',
    { class: 'card', novalidate: true },
    h('h2', {}, t('profile.body')),
    h(
      'div',
      { class: 'grid2' },
      field('age', t('profile.age'), numInput('age', p.age, '')),
      field('sex', t('profile.sex'), select('sex', [['male', t('profile.sex.male')], ['female', t('profile.sex.female')]], p.sex), t('profile.sexHint')),
      field('heightCm', t('profile.height'), numInput('heightCm', p.heightCm, t('common.cm'))),
      field('weightKg', t('profile.weight'), numInput('weightKg', p.weightKg, t('common.kg'))),
    ),
    field('activity', t('profile.activity'), select('activity', Object.keys(ACTIVITY_LEVELS).map((a) => [a, t(`profile.activity.${a}`)]), p.activity)),
    h('h2', {}, t('profile.goalSection')),
    h(
      'div',
      { class: 'grid2' },
      field('goal', t('profile.goal'), goalSel),
      field('rateKgPerWeek', t('profile.rate'), rateSel),
    ),
    field('targetWeightKg', t('profile.targetWeight'), numInput('targetWeightKg', p.targetWeightKg, t('common.kg'))),
    h('div', { class: 'warn', id: 'profile-warnings' }),
    h('button', { class: 'btn primary', type: 'submit' }, t('profile.save')),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => form.querySelector(`#${id}`).value;
    // Diet, fasting and food preferences live on the Diet & fasting screen:
    // keep whatever is saved there.
    const saved = (await store.getProfile()) || {};
    const next = {
      ...saved,
      age: parseNum(v('age')),
      sex: v('sex'),
      heightCm: parseNum(v('heightCm')),
      weightKg: parseNum(v('weightKg')),
      targetWeightKg: parseNum(v('targetWeightKg')),
      activity: v('activity'),
      goal: v('goal'),
      rateKgPerWeek: Number(v('rateKgPerWeek')),
    };
    delete next.updatedAt;
    const { errors, warnings, valid } = validateProfile(next);
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
    form.querySelectorAll('.err').forEach((el) => (el.textContent = ''));
    for (const [k, code] of Object.entries(errors)) {
      const [min, max] = RANGES[k] || [];
      form.querySelector(`#f-${k}`)?.classList.add('invalid');
      const el = form.querySelector(`#e-${k}`);
      if (el) el.textContent = t(`profile.err.${code}`, { min, max });
    }
    form.querySelector('#profile-warnings').replaceChildren(...warnings.map((w) => h('p', {}, t(`profile.warn.${w}`))));
    if (!valid) {
      toast(t('profile.invalid'), 'error');
      form.querySelector('.invalid input, .invalid select')?.focus();
      return;
    }
    try {
      await store.saveProfile(next);
      toast(t('profile.saved'));
    } catch (err) {
      toast(t('err.generic', { msg: err.message }), 'error');
    }
  });
  return form;
}

// ---------------------------------------------------------------------------

export function targetsCard(targets, rec) {
  const card = h('section', { class: 'card', id: 'targets' }, h('h2', {}, t('targets.title')));
  if (!rec && !targets) {
    card.append(h('p', { class: 'muted' }, t('targets.needProfile')));
    return card;
  }

  const useValues = async (keys) => {
    const next = { ...(targets || {}) };
    for (const k of keys) next[k] = { value: rec[k], source: 'estimated' };
    for (const k of store.TARGET_KEYS) if (!next[k]) next[k] = { value: rec[k], source: 'estimated' };
    await store.saveTargets(next);
    toast(t('targets.saved'));
  };

  const rows = store.TARGET_KEYS.map((k) => {
    const cur = targets?.[k];
    const differs = rec && (!cur || cur.value !== rec[k]);
    const source = cur ? cur.source : 'none';
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, t(`nutrient.${k}`), h('span', { class: `badge ${source}` }, t(`targets.source.${source}`))),
      h('td', {}, h('div', { class: 'with-unit' }, h('input', { type: 'text', inputmode: 'numeric', id: `t-${k}`, value: cur?.value ?? '', 'aria-label': t(`nutrient.${k}`) }), h('span', { class: 'unit' }, t(UNIT[k])))),
      h(
        'td',
        { class: 'rec' },
        rec ? h('span', { class: 'num' }, fmtKcal(rec[k])) : '–',
        differs ? h('button', { type: 'button', class: 'link-btn', onclick: () => useValues([k]) }, t('targets.use')) : null,
      ),
    );
  });

  const anyDiffers = rec && store.TARGET_KEYS.some((k) => targets?.[k]?.value !== rec[k]);

  const saveManual = async () => {
    const next = { ...(targets || {}) };
    let changed = false;
    for (const k of store.TARGET_KEYS) {
      const raw = parseNum(card.querySelector(`#t-${k}`).value);
      const [min, max] = TARGET_RANGES[k];
      if (!Number.isInteger(raw) || raw < min || raw > max) {
        toast(t('targets.invalidValue', { min, max, name: t(`nutrient.${k}`) }), 'error');
        card.querySelector(`#t-${k}`).focus();
        return;
      }
      if (targets?.[k]?.value !== raw) {
        next[k] = { value: raw, source: 'manual' };
        changed = true;
      }
    }
    if (!changed) return toast(t('targets.noChanges'));
    await store.saveTargets(next);
    toast(t('targets.saved'));
  };

  card.append(
    h(
      'table',
      { class: 'targets' },
      h('thead', {}, h('tr', {}, h('th', {}), h('th', {}, t('targets.colTarget')), h('th', {}, t('targets.colRecommended')))),
      h('tbody', {}, rows),
    ),
    h(
      'div',
      { class: 'actions' },
      anyDiffers
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn primary',
              onclick: () => {
                const list = store.TARGET_KEYS.map((k) => `${t(`nutrient.${k}`)}: ${targets?.[k]?.value ?? '–'} → ${rec[k]}`).join('\n');
                if (!targets || confirm(t('targets.useAllConfirm', { list }))) useValues(store.TARGET_KEYS);
              },
            },
            t('targets.useAll'),
          )
        : null,
      h('button', { type: 'button', class: 'btn', onclick: saveManual }, t('targets.saveManual')),
    ),
  );

  if (rec) {
    const d = rec.detail;
    const adjKey = d.adjustment < 0 ? 'lose' : d.adjustment > 0 ? 'gain' : 'maintain';
    card.append(
      h(
        'details',
        { class: 'how' },
        h('summary', {}, t('targets.howTitle')),
        h(
          'ul',
          {},
          h('li', {}, t('targets.how.bmr', { n: fmtKcal(d.bmr) })),
          h('li', {}, t('targets.how.tdee', { n: fmtKcal(d.tdee) })),
          h('li', {}, t(`targets.how.adj.${adjKey}`, { n: fmtKcal(Math.abs(d.adjustment)), rate: fmtNumber(Math.abs(d.adjustment) * 7 / 7700, 2) })),
          d.flags.clampedToBmr ? h('li', { class: 'warn' }, t('targets.how.clamped')) : null,
          h('li', {}, t(adjKey === 'lose' ? 'targets.how.protein.lose' : 'targets.how.protein.other', { perKg: fmtNumber(d.basis.proteinPerKg, 1), kg: fmtNumber(d.basis.proteinRefWeight, 1) })),
          ...(d.basis.fixedCarbs != null
            ? [h('li', {}, t('targets.how.lowcarb.carbs', { n: d.basis.fixedCarbs })), h('li', {}, t('targets.how.lowcarb.fat'))]
            : [h('li', {}, t('targets.how.fat', { pct: Math.round(d.basis.fatShare * 100), min: fmtNumber(d.basis.fatMinPerKg, 1) })), h('li', {}, t('targets.how.carbs'))]),
        ),
      ),
    );
  }
  card.append(h('p', { class: 'muted small' }, t('targets.disclaimer')));
  return card;
}

// ---------------------------------------------------------------------------

async function dataCard() {
  const status = await store.storageStatus();
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const obj = store.validateBackup(JSON.parse(await file.text()));
      const date = new Date(obj.exportedAt).toLocaleString();
      if (!confirm(t('data.importConfirm', { date }))) return;
      await store.restoreBackup(obj);
      toast(t('data.imported'));
    } catch (err) {
      toast(t('data.importFailed', { msg: err instanceof SyntaxError ? 'not a JSON file.' : err.message }), 'error');
    }
  });

  const exportBackup = async () => {
    try {
      const backup = await store.buildBackup();
      const name = `nutri-journal-backup-${backup.exportedAt.slice(0, 10)}.json`;
      const file = new File([JSON.stringify(backup, null, 2)], name, { type: 'application/json' });
      // On phones, the share sheet lets you save to Files, Drive or mail it.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
          toast(t('data.exported'));
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t('data.exported'));
    } catch (err) {
      toast(t('err.generic', { msg: err.message }), 'error');
    }
  };

  return h(
    'section',
    { class: 'card' },
    h('h2', {}, t('data.title')),
    h('p', { class: 'muted small' }, t('data.body')),
    h('p', { class: 'small' }, t(`data.storage.${status}`)),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', class: 'btn', onclick: exportBackup }, t('data.export')),
      h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, t('data.import')),
      fileInput,
    ),
  );
}

/** Me: only about you. Diet, fasting, targets and food preferences are on #/diet. */
export async function render(root) {
  const [profile, targets] = await Promise.all([store.getProfile(), store.getTargets()]);
  const pointer = h(
    'section',
    { class: 'card' },
    h('h2', {}, t('me.dietTitle')),
    h('p', { class: 'muted small' }, t(targets ? 'me.dietBody' : 'me.dietBodyNew')),
    h('a', { class: targets ? 'link-btn' : 'btn primary', href: '#/diet' }, `${t('me.dietLink')} →`),
  );
  root.replaceChildren(h('h1', { class: 'page-title' }, t('profile.title')), profileForm(profile), pointer, await dataCard());
}
