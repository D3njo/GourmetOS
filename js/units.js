/** Metric ↔ imperial conversion for ingredient display */

import { cleanFloat } from './math.js';
import { isNumericAmount } from './measure-parse.js';

const COUNT_UNITS = new Set(['stk', 'pcs', 'pc', 'piece', 'pieces', 'clove', 'cloves']);

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

const QUALITATIVE_LABELS = {
  pinch: 'pinch',
  dash: 'dash',
  bunch: 'bunch',
  handful: 'handful',
  'to taste': 'to taste',
  'for frying': 'for frying',
  'for greasing': 'for greasing',
  'as needed': 'as needed',
  optional: 'optional'
};

const UNIT_LABELS = {
  metric: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'l',
    stk: 'pcs',
    clove: 'clove'
  },
  imperial: {
    oz: 'oz',
    lb: 'lb',
    floz: 'fl oz',
    cup: 'cup',
    stk: 'pcs',
    clove: 'clove'
  }
};

let unitSystem = 'metric';

export function getUnitSystem() {
  return unitSystem;
}

export function setUnitSystem(system) {
  unitSystem = system === 'imperial' ? 'imperial' : 'metric';
}

export function formatTemperature(celsius, system = unitSystem) {
  if (celsius == null) return '—';
  if (system === 'imperial') {
    return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(celsius)}°C`;
}

function labelForUnit(code) {
  const bucket = UNIT_LABELS[unitSystem]?.[code];
  return typeof bucket === 'string' ? bucket : code;
}

function qualitativeLabel(unit) {
  const key = (unit || '').toLowerCase().trim();
  return QUALITATIVE_LABELS[key] || unit;
}

/** Convert stored metric amount + unit into display amount + unit */
export function convertAmount(amount, unit, system = unitSystem) {
  const normalized = (unit || '').toLowerCase().trim();

  if (!isNumericAmount(amount)) {
    return { amount, unit: qualitativeLabel(normalized) || normalized };
  }

  if (QUALITATIVE_LABELS[normalized] || DESCRIPTOR_UNITS.has(normalized)) {
    const label = qualitativeLabel(normalized);
    return { amount: cleanFloat(amount), unit: label || normalized };
  }

  if (COUNT_UNITS.has(normalized) || normalized === 'stk' || normalized === 'zehe' || normalized === 'clove') {
    const code = normalized === 'zehe' || normalized === 'clove' ? 'clove' : 'stk';
    return {
      amount: cleanFloat(amount),
      unit: labelForUnit(code)
    };
  }

  if (system === 'metric') {
    if (normalized === 'kg') {
      return amount >= 1
        ? { amount: cleanFloat(amount), unit: 'kg' }
        : { amount: cleanFloat(amount * 1000), unit: 'g' };
    }
    if (normalized === 'l') {
      return amount >= 1
        ? { amount: cleanFloat(amount), unit: 'l' }
        : { amount: cleanFloat(amount * 1000), unit: 'ml' };
    }
    return { amount: cleanFloat(amount), unit: normalized || 'g' };
  }

  // Imperial conversions (recipes store metric base units)
  if (normalized === 'g') {
    if (amount >= 454) {
      return { amount: cleanFloat(amount / 453.592), unit: 'lb' };
    }
    return { amount: cleanFloat(amount / 28.3495), unit: 'oz' };
  }

  if (normalized === 'kg') {
    return { amount: cleanFloat(amount * 2.20462), unit: 'lb' };
  }

  if (normalized === 'ml') {
    if (amount >= 240) {
      return { amount: cleanFloat(amount / 236.588), unit: 'cup' };
    }
    return { amount: cleanFloat(amount / 29.5735), unit: 'fl oz' };
  }

  if (normalized === 'l') {
    return { amount: cleanFloat(amount * 4.22675), unit: 'cup' };
  }

  return { amount: cleanFloat(amount), unit: normalized };
}

export function formatAmountWithSystem(amount, unit, _locale = 'en', system = unitSystem) {
  const normalized = (unit || '').toLowerCase().trim();

  if (!isNumericAmount(amount)) {
    const label = qualitativeLabel(normalized) || normalized;
    return label ? String(label) : '—';
  }

  if (QUALITATIVE_LABELS[normalized] || DESCRIPTOR_UNITS.has(normalized)) {
    const label = qualitativeLabel(normalized);
    const n = cleanFloat(amount);
    if (n === 1) return label;
    return `${n} ${label}`;
  }

  const { amount: converted, unit: displayUnit } = convertAmount(amount, unit, system);
  const cleaned = cleanFloat(converted);
  if (!Number.isFinite(cleaned)) {
    return qualitativeLabel(normalized) || '—';
  }
  const formatted = Number.isInteger(cleaned)
    ? String(cleaned)
    : String(cleaned).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m));

  return `${formatted} ${displayUnit}`.trim();
}
