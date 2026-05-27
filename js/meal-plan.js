import { getMealPlan, saveMealPlan } from './storage.js';

export function getMealCount(dayKey) {
  const plan = getMealPlan();
  return plan[dayKey] ?? 2;
}

export function setMealCount(dayKey, count) {
  const plan = getMealPlan();
  plan[dayKey] = Math.min(5, Math.max(1, count));
  saveMealPlan(plan);
  return plan[dayKey];
}

export { buildWeeklyPlan, DAY_KEYS } from './plan-engine.js';
