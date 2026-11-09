// Calendar-date helpers. Journal days are local calendar dates stored as
// "YYYY-MM-DD" strings, never derived from UTC (toISOString would shift
// late-evening entries to the wrong day).

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) throw new Error(`Invalid date: ${iso}`);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (toISODate(d) !== iso) throw new Error(`Invalid date: ${iso}`);
  return d;
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function today() {
  return toISODate(new Date());
}
