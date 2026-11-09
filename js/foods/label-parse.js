// Turn text recognised from a nutrition label photo into numbers.
// Handles German and English EU-style labels, e.g.
//   Nährwerte pro 100 g | Brennwert 1046 kJ / 250 kcal | Fett 9,8 g |
//   davon gesättigte Fettsäuren 3,1 g | Kohlenhydrate 30 g | ... | Eiweiß 8,5 g
// Values from the first column (per 100 g/ml) are used.
//
// Text recognition often reads the unit "g" as the digit "9" ("3,5 g" ->
// "3,59", "38 g" -> "389") and drops decimal commas. For each macro the
// parser therefore considers the likely readings and picks the combination
// that agrees best with the calories printed on the label. Values it had to
// reinterpret are reported in `uncertain` so the app can ask for a check.
// Pure function, covered by tests/label-parse.test.js.

const SUB_VALUE = /davon|of which|gesätt|gesatt|saturat|fettsäur|fettsaur|ungesätt|zucker|sugar|ballast|fibre|fiber|polyol|stärke|starch|salz|salt/;

const KEYS = {
  fat: /\b(fett|fat|lipides?)\b/,
  carbs: /kohlen\s*hydrat|kohlenhydr|carbo\s*hydrate|\bcarbs?\b|glucides/,
  protein: /eiwei|eiweib|eiweis|eiwelß|eiwelss|protein/,
};
const MACROS = Object.keys(KEYS);

/** Normalise OCR quirks while keeping line structure. */
export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[|¦]/g, ' ')
    .replace(/k[ce][ao][l1i]|kca[il1]|kcai/g, 'kcal')
    .replace(/k[ij1l|]\s*\/\s*kcal/g, 'kj/kcal')
    .replace(/(\d)\s*k\s*j\b/g, '$1kj')
    // letters misread inside numbers: "1O46", "2S0", "25o"
    .replace(/(\d)[os](?=\d)/g, (m, d) => d + (m[1] === 'o' ? '0' : '5'))
    .replace(/(\d)[os](?=\d)/g, (m, d) => d + (m[1] === 'o' ? '0' : '5'))
    .replace(/(\d)o(?=\s|k|g|$)/gm, (m, d) => `${d}0`)
    // a lone "O g"/"Og" is zero grams
    .replace(/(^|\s)o\s?g\b/gm, '$10g')
    .replace(/[ \t]+/g, ' ');
}

const toNum = (s) => Number(String(s).replace(',', '.'));

/** First number token after the keyword: { text, lessThan, unit }. */
function tokenAfter(line, keyRegex) {
  const m = keyRegex.exec(line);
  const rest = m ? line.slice(m.index + m[0].length) : line;
  const t = /(<\s*)?(\d{1,4}(?:[.,]\d{1,3})?)\s*(mg|g\b|g(?=\d|\s|$))?/.exec(rest);
  if (!t) return null;
  return { text: t[2], lessThan: !!t[1], unit: t[3] || '' };
}

/**
 * Plausible readings of a recognised macro token, each with a penalty
 * (higher = less likely). Values above 100 g are impossible per 100 g/ml.
 */
export function candidates(tok) {
  if (!tok) return [];
  if (tok.lessThan) return [{ v: 0, p: 0 }];
  const raw = toNum(tok.text);
  if (tok.unit === 'g') return raw <= 100 ? [{ v: raw, p: 0 }] : [];
  if (tok.unit === 'mg') return [{ v: raw / 1000, p: 0 }];

  const out = [];
  const add = (v, p) => {
    if (Number.isFinite(v) && v >= 0 && v <= 100 && !out.some((c) => Math.abs(c.v - v) < 1e-9)) out.push({ v, p });
  };
  const decimals = (tok.text.split(/[.,]/)[1] || '').length;
  const endsIn9 = tok.text.length > 1 && tok.text.endsWith('9');

  if (endsIn9) {
    // trailing 9 is probably the unit "g"
    const stripped = tok.text.slice(0, -1).replace(/[.,]$/, '');
    const s = toNum(stripped);
    const strongG = decimals >= 2 || raw > 100;
    add(raw, strongG ? 15 : 0);
    add(s, strongG ? 0 : 10);
    // decimal comma lost as well: "489" -> "48" -> 4.8
    if (/^\d{2,3}$/.test(stripped)) add(s / 10, 10);
  } else {
    add(raw, 0);
    // decimal comma lost: "48" -> 4.8
    if (/^\d{2,3}$/.test(tok.text)) add(raw / 10, 15);
  }
  return out;
}

function macroKcal(v) {
  return 4 * (v.protein ?? 0) + 4 * (v.carbs ?? 0) + 9 * (v.fat ?? 0);
}

function splitKjKcal(digits) {
  // "272164" is "272/64" with the slash read as 1 (or 7, l, i)
  for (let i = 2; i < digits.length - 1; i++) {
    if (!'17li'.includes(digits[i])) continue;
    const kj = Number(digits.slice(0, i));
    const kcal = Number(digits.slice(i + 1));
    if (kcal > 0 && Math.abs(kj / 4.184 - kcal) <= Math.max(2, kcal * 0.06)) return kcal;
  }
  return null;
}

function findEnergy(text) {
  // "kj/kcal 1046/250" layout
  let m = /kj\s*\/\s*kcal[^\d\n]*?(\d{2,4})\s*\/\s*(\d{1,3})\b/.exec(text);
  if (m) return { kcal: Number(m[2]), via: 'kcal' };
  m = /kj\s*\/\s*kcal[^\d\n]*?(\d{4,8})\b/.exec(text);
  if (m) {
    const k = splitKjKcal(m[1]);
    if (k) return { kcal: k, via: 'kcal' };
  }
  m = /(\d{1,4}(?:[.,]\d{1,2})?)\s*kcal/.exec(text);
  if (m) return { kcal: toNum(m[1]), via: 'kcal' };
  m = /kcal\)?[:\s]*(\d{1,4}(?:[.,]\d{1,2})?)/.exec(text);
  if (m) return { kcal: toNum(m[1]), via: 'kcal' };
  m = /(\d{2,4}(?:[.,]\d{1,2})?)\s*kj/.exec(text);
  if (m) return { kcal: Math.round(toNum(m[1]) / 4.184), via: 'kj' };
  return null;
}

function findBasis(text) {
  const m =
    /(?:pro|je|per|für|for|in)\s*100\s*(g|ml|9)(?![\d,.])/.exec(text) ||
    /\b100\s*(g|ml)\b/.exec(text);
  if (!m) return null;
  return m[1] === 'ml' ? 'ml' : 'g';
}

/**
 * Parse recognised label text.
 * Returns {
 *   basis: 'g' | 'ml' | null,
 *   values: { kcal?, protein?, carbs?, fat? },  // per 100 g/ml
 *   missing: [...],      // not found, left empty rather than guessed
 *   uncertain: [...],    // found but reinterpreted; ask the user to check
 *   kcalFromKj: boolean  // calories converted from kJ
 * }
 */
export function parseLabelText(text) {
  const norm = normalise(text);
  const lines = norm.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const values = {};
  const uncertain = [];

  const energy = findEnergy(norm);
  if (energy && energy.kcal > 0 && energy.kcal <= 950) values.kcal = energy.kcal;

  const options = {};
  for (const key of MACROS) {
    const re = KEYS[key];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!re.test(line) || SUB_VALUE.test(line)) continue;
      let tok = tokenAfter(line, re);
      if (!tok && lines[i + 1] && !MACROS.some((k) => KEYS[k].test(lines[i + 1]))) tok = tokenAfter(lines[i + 1], /^/);
      const c = candidates(tok);
      if (c.length) {
        options[key] = c;
        break;
      }
    }
  }

  const found = MACROS.filter((k) => options[k]);
  // Choose the combination with the lowest penalty, judged against the
  // printed calories when all three macros and the calories are known.
  const useEnergy = values.kcal !== undefined && found.length === 3;
  let best = null;
  const walk = (i, pick, penalty) => {
    if (i === found.length) {
      const sum = found.reduce((s, k) => s + pick[k], 0);
      if (sum > 101) return;
      const score = penalty + (useEnergy ? Math.abs(macroKcal(pick) - values.kcal) : 0);
      if (!best || score < best.score) best = { score, pick: { ...pick } };
      return;
    }
    for (const c of options[found[i]]) walk(i + 1, { ...pick, [found[i]]: c.v }, penalty + c.p);
  };
  walk(0, {}, 0);

  if (best) {
    for (const k of found) {
      values[k] = Math.round(best.pick[k] * 10) / 10;
      const first = options[k][0];
      // Uncertain when the chosen value is not a clean reading, or when
      // several readings were possible and nothing could confirm the choice.
      const chosen = options[k].find((c) => Math.abs(c.v - best.pick[k]) < 1e-9);
      if (chosen.p > 0 || (options[k].length > 1 && !useEnergy) || first.v !== best.pick[k]) uncertain.push(k);
    }
  }

  // Calories that the macros can't explain were probably read from the wrong
  // column (e.g. per pack) or misread.
  if (useEnergy && Math.abs(macroKcal(values) - values.kcal) > Math.max(30, values.kcal * 0.3)) uncertain.unshift('kcal');

  const missing = ['kcal', ...MACROS].filter((k) => values[k] === undefined);
  return { basis: findBasis(norm), values, missing, uncertain, kcalFromKj: energy?.via === 'kj' };
}
