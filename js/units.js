/** Metric ↔ imperial conversion for ingredient display */

import { cleanFloat } from './math.js';

const COUNT_UNITS = new Set(['stk', 'stück', 'pcs', 'pc', 'piece', 'pieces', 'zehe', 'clove', 'cloves']);

const UNIT_LABELS = {
  metric: {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'l',
    stk: { de: 'Stk', en: 'pcs' },
    zehe: { de: 'Zehe', en: 'clove' }
  },
  imperial: {
    oz: 'oz',
    lb: 'lb',
    floz: 'fl oz',
    cup: 'cup',
    stk: { de: 'Stk', en: 'pcs' },
    zehe: { de: 'Zehe', en: 'clove' }
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

function labelForUnit(code, locale) {
  const bucket = UNIT_LABELS[unitSystem]?.[code];
  if (!bucket) return code;
  if (typeof bucket === 'string') return bucket;
  return bucket[locale] || bucket.de || code;
}

/** Convert stored metric amount + unit into display amount + unit */
export function convertAmount(amount, unit, system = unitSystem, locale = 'de') {
  const normalized = (unit || '').toLowerCase().trim();

  if (COUNT_UNITS.has(normalized) || normalized === 'stk' || normalized === 'zehe') {
    const code = normalized === 'zehe' ? 'zehe' : 'stk';
    return {
      amount: cleanFloat(amount),
      unit: labelForUnit(code, locale)
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

export function formatAmountWithSystem(amount, unit, locale = 'de', system = unitSystem) {
  const { amount: converted, unit: displayUnit } = convertAmount(amount, unit, system, locale);
  const cleaned = cleanFloat(converted);
  const formatted = Number.isInteger(cleaned)
    ? String(cleaned)
    : String(cleaned).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m));

  return `${formatted} ${displayUnit}`;
}
