/** Exclusive weather bucket assignment and plan mode keys */

export const PLAN_MODE_KEYS = ['auto', 'hot', 'cold', 'mild'];
export const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

/** Assign each recipe to exactly one primary weather bucket */
export function inferWeatherPrimary(recipeOrTags) {
  const tags = Array.isArray(recipeOrTags)
    ? recipeOrTags
    : recipeOrTags?.weather_tags || [];
  if (tags.some((t) => ['hot', 'sunny'].includes(t))) return 'hot';
  if (tags.some((t) => ['rain', 'cold'].includes(t))) return 'cold';
  return 'mild';
}

export function getRecipeWeatherPrimary(recipe) {
  if (recipe?.weather_primary) return recipe.weather_primary;
  return inferWeatherPrimary(recipe);
}

export function normalizePlanModeKey(mode) {
  if (mode === 'auto') return 'auto';
  if (PLAN_MODE_KEYS.includes(mode)) return mode;
  return 'auto';
}

export function isLegacyPlanSelections(data) {
  if (!data || typeof data !== 'object') return false;
  const keys = Object.keys(data);
  if (!keys.length) return false;
  return !keys.some((k) => PLAN_MODE_KEYS.includes(k));
}

export function emptyPlanSelectionStore() {
  return { auto: {}, hot: {}, cold: {}, mild: {} };
}

export function normalizePlanSelectionStore(data) {
  const base = emptyPlanSelectionStore();
  if (!data || typeof data !== 'object') return base;
  for (const mode of PLAN_MODE_KEYS) {
    if (data[mode] && typeof data[mode] === 'object') {
      base[mode] = { ...data[mode] };
    }
  }
  return base;
}
