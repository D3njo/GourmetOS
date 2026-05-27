/**
 * Parse TheMealDB / free-text measures into numeric amounts + units.
 */

const QUALITATIVE_UNITS = new Map([
  ['pinch', 'pinch'],
  ['prise', 'pinch'],
  ['brise', 'pinch'],
  ['dash', 'dash'],
  ['splash', 'splash'],
  ['bunch', 'bunch'],
  ['handful', 'handful'],
  ['handfuls', 'handful'],
  ['to taste', 'to taste'],
  ['nach geschmack', 'to taste'],
  ['for frying', 'for frying'],
  ['for greasing', 'for greasing'],
  ['as needed', 'as needed'],
  ['optional', 'optional']
]);

const DESCRIPTOR_UNITS = new Set([
  'finely chopped',
  'roughly chopped',
  'chopped',
  'sliced',
  'diced',
  'minced',
  'grated',
  'shavings',
  'crushed',
  'whole',
  'large',
  'small',
  'medium'
]);

function parseFractionToken(token) {
  const t = token.trim();
  if (!t) return null;
  if (t.includes('/')) {
    const [num, den] = t.split('/').map((s) => parseFloat(s.trim()));
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return num / den;
    }
    return null;
  }
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Parse "1", "1/2", "1 1/2", "2.5" */
export function parseNumericAmount(amountPart) {
  const raw = (amountPart || '').trim();
  if (!raw) return null;

  const mixed = raw.match(/^(\d+)\s+(\d+\/\d+|\d+\.\d+|\d+)$/);
  if (mixed) {
    const whole = parseFloat(mixed[1]);
    const frac = parseFractionToken(mixed[2]);
    if (Number.isFinite(whole) && frac != null) return whole + frac;
  }

  if (raw.includes('/')) {
    return parseFractionToken(raw);
  }

  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeQualitative(text) {
  const lower = text.toLowerCase().trim();
  if (QUALITATIVE_UNITS.has(lower)) {
    return { amount: 1, unit: QUALITATIVE_UNITS.get(lower), scaleable: false };
  }
  for (const [key, unit] of QUALITATIVE_UNITS) {
    if (lower === key || lower.startsWith(`${key} `)) {
      return { amount: 1, unit, scaleable: false };
    }
  }
  for (const desc of DESCRIPTOR_UNITS) {
    if (lower === desc || lower.endsWith(` ${desc}`)) {
      return { amount: 1, unit: desc, scaleable: false };
    }
  }
  return null;
}

/**
 * @returns {{ amount: number, unit: string, scaleable: boolean, rawMeasure?: string }}
 */
export function parseMeasure(raw) {
  const text = (raw || '').trim();
  if (!text) {
    return { amount: 1, unit: 'pcs', scaleable: true };
  }

  const qualitative = normalizeQualitative(text);
  if (qualitative) return qualitative;

  const match = text.match(/^([\d./\s,]+)\s*(.*)$/);
  if (match) {
    const amountPart = match[1].trim();
    const rest = match[2].trim();
    const numeric = parseNumericAmount(amountPart);

    if (numeric != null) {
      if (!rest) {
        return { amount: numeric, unit: 'pcs', scaleable: true };
      }
      const restQual = normalizeQualitative(rest);
      if (restQual) {
        return { amount: numeric, unit: restQual.unit, scaleable: false, rawMeasure: text };
      }
      return { amount: numeric, unit: rest.toLowerCase(), scaleable: true, rawMeasure: text };
    }

    if (rest) {
      const combined = normalizeQualitative(`${amountPart} ${rest}`.trim()) || normalizeQualitative(rest);
      if (combined) return combined;
    }
  }

  const bareQual = normalizeQualitative(text);
  if (bareQual) return bareQual;

  return { amount: 1, unit: text.toLowerCase(), scaleable: false, rawMeasure: text };
}

export function isNumericAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount);
}
