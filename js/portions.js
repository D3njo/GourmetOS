/**
 * Portion scaler: targetQty = baseQty × (targetPortions / basePortions)
 * Includes floating-point cleanup per product spec.
 */

import { formatAmountWithSystem } from './units.js';
import { getUnitSystem } from './storage.js';
import { cleanFloat } from './math.js';

export function scaleAmount(amount, basePortions, targetPortions) {
  if (!basePortions || basePortions <= 0) return amount;
  const scaled = amount * (targetPortions / basePortions);
  return cleanFloat(scaled);
}

export { cleanFloat } from './math.js';

export function formatAmount(amount, unit) {
  return formatAmountWithSystem(amount, unit, 'en', getUnitSystem());
}

export function scaleIngredients(ingredients, basePortions, targetPortions) {
  return ingredients.map((ing) => ({
    ...ing,
    amount: scaleAmount(ing.amount, basePortions, targetPortions)
  }));
}

export function scaleStepText(text, basePortions, targetPortions, step) {
  let result = text;
  const factor = targetPortions / basePortions;
  const unitSystem = getUnitSystem();

  if (step?.time_minutes) {
    const scaledTime = scaleTime(step.time_minutes, factor);
    result = result.replace(/\{\{time\}\}/g, scaledTime);
  }

  const tempC = step?.temp_celsius ?? 63;
  const tempDisplay =
    unitSystem === 'imperial' ? Math.round((tempC * 9) / 5 + 32) : tempC;
  result = result.replace(/\{\{temp\}\}/g, String(tempDisplay));

  if (unitSystem === 'imperial') {
    result = result.replace(/°C/g, '°F');
  }

  result = result.replace(/\{\{portion\}\}/g, String(Math.max(1, Math.round(3 * factor))));

  return result;
}

function scaleTime(minutes, factor) {
  if (minutes >= 120) {
    const hours = cleanFloat((minutes / 60) * Math.cbrt(factor));
    return hours >= 2 ? `${Math.round(hours)}` : `${cleanFloat(hours)}`;
  }
  if (minutes >= 10) {
    return String(Math.round(minutes * Math.cbrt(factor)));
  }
  return String(Math.max(1, Math.round(minutes)));
}

export function scaleSteps(steps, basePortions, targetPortions) {
  return steps.map((step) => ({
    ...step,
    displayText: scaleStepText(step.text, basePortions, targetPortions, step)
  }));
}
