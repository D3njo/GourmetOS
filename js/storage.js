import {
  emptyPlanSelectionStore,
  isLegacyPlanSelections,
  normalizePlanModeKey,
  normalizePlanSelectionStore
} from './weather-buckets.js';
import { normalizeIngredientName } from './ingredient-normalize.js';

const STORAGE_KEYS = {
  theme: 'gourmetos_theme',
  preferences: 'gourmetos_preferences',
  mealPlan: 'gourmetos_meal_plan',
  planSelections: 'gourmetos_plan_selections',
  effortPlan: 'gourmetos_effort_plan',
  shoppingList: 'gourmetos_shopping_list',
  portions: 'gourmetos_portions',
  weatherMode: 'gourmetos_weather_mode',
  weatherCache: 'gourmetos_weather_cache',
  forecastCache: 'gourmetos_forecast_cache',
  homeInventory: 'gourmetos_home_inventory'
};

const DEFAULT_PREFERENCES = {
  excludedTags: [],
  customExclusions: [],
  dietPreferences: [],
  darkMode: true,
  useGeolocation: true,
  locale: 'en',
  unitSystem: 'metric',
  shoppingScope: 'day',
  spoonacularApiKey: '',
  preferExoticIngredients: false,
  preferHighProtein: false,
  preferHomeIngredients: false
};

const DEFAULT_MEAL_PLAN = {
  monday: 1,
  tuesday: 2,
  wednesday: 2,
  thursday: 2,
  friday: 2,
  saturday: 3,
  sunday: 1
};

const DEFAULT_EFFORT_PLAN = {
  monday: 'quick',
  tuesday: 'quick',
  wednesday: 'medium',
  thursday: 'medium',
  friday: 'medium',
  saturday: 'elaborate',
  sunday: 'elaborate'
};

export function getItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getPreferences() {
  return { ...DEFAULT_PREFERENCES, ...getItem(STORAGE_KEYS.preferences, {}) };
}

export function savePreferences(prefs) {
  setItem(STORAGE_KEYS.preferences, { ...getPreferences(), ...prefs });
}

export function getLocale() {
  return 'en';
}

export function getUnitSystem() {
  return getPreferences().unitSystem || 'metric';
}

export function getMealPlan() {
  return { ...DEFAULT_MEAL_PLAN, ...getItem(STORAGE_KEYS.mealPlan, {}) };
}

export function saveMealPlan(plan) {
  setItem(STORAGE_KEYS.mealPlan, plan);
}

export function getPlanSelectionsStore() {
  const raw = getItem(STORAGE_KEYS.planSelections, emptyPlanSelectionStore());
  if (isLegacyPlanSelections(raw)) {
    const modeKey = normalizePlanModeKey(getWeatherMode());
    const migrated = emptyPlanSelectionStore();
    migrated[modeKey] = { ...raw };
    savePlanSelectionsStore(migrated);
    return migrated;
  }
  return normalizePlanSelectionStore(raw);
}

export function savePlanSelectionsStore(store) {
  setItem(STORAGE_KEYS.planSelections, normalizePlanSelectionStore(store));
}

export function getActivePlanModeKey() {
  return normalizePlanModeKey(getWeatherMode());
}

export function getPlanSelectionsForMode(mode) {
  const store = getPlanSelectionsStore();
  const modeKey = normalizePlanModeKey(mode);
  return store[modeKey] || {};
}

export function savePlanSelectionsForMode(mode, daySelections) {
  const store = getPlanSelectionsStore();
  store[normalizePlanModeKey(mode)] = daySelections;
  savePlanSelectionsStore(store);
}

/** @deprecated Use getPlanSelectionsForMode(getActivePlanModeKey()) */
export function getPlanSelections() {
  return getPlanSelectionsForMode(getActivePlanModeKey());
}

/** @deprecated Use savePlanSelectionsForMode */
export function savePlanSelections(selections) {
  savePlanSelectionsForMode(getActivePlanModeKey(), selections);
}

export function clearPlanSelections() {
  savePlanSelectionsStore(emptyPlanSelectionStore());
}

export function clearDayPlanSelection(dayKey, mode = null) {
  const modeKey = normalizePlanModeKey(mode ?? getWeatherMode());
  const store = getPlanSelectionsStore();
  delete store[modeKey][dayKey];
  savePlanSelectionsStore(store);
}

export function getEffortPlan() {
  return { ...DEFAULT_EFFORT_PLAN, ...getItem(STORAGE_KEYS.effortPlan, {}) };
}

export function saveEffortPlan(plan) {
  setItem(STORAGE_KEYS.effortPlan, plan);
}

export function setDayEffort(dayKey, effort) {
  const plan = getEffortPlan();
  plan[dayKey] = effort;
  saveEffortPlan(plan);
  return plan[dayKey];
}

export function getDayEffort(dayKey) {
  return getEffortPlan()[dayKey] ?? 'medium';
}

export function getSpoonacularApiKey() {
  return getPreferences().spoonacularApiKey || '';
}

export function saveSpoonacularApiKey(key) {
  savePreferences({ spoonacularApiKey: (key || '').trim() });
}

export function getShoppingScope() {
  return getPreferences().shoppingScope || 'day';
}

export function saveShoppingScope(scope) {
  savePreferences({ shoppingScope: scope === 'week' ? 'week' : 'day' });
}

export function getShoppingListState() {
  return getItem(STORAGE_KEYS.shoppingList, {});
}

export function saveShoppingListState(state) {
  setItem(STORAGE_KEYS.shoppingList, state);
}

export function getPortions() {
  return getItem(STORAGE_KEYS.portions, 2);
}

export function savePortions(n) {
  setItem(STORAGE_KEYS.portions, n);
}

/** 'auto' | 'mild' | 'hot' | 'cold' — auto uses forecast, others are manual overrides */
export function getWeatherMode() {
  return getItem(STORAGE_KEYS.weatherMode, 'auto');
}

export function saveWeatherMode(mode) {
  setItem(STORAGE_KEYS.weatherMode, mode);
}

export function getTheme() {
  return getItem(STORAGE_KEYS.theme, 'dark');
}

export function saveTheme(theme) {
  setItem(STORAGE_KEYS.theme, theme);
}

export function getForecastCache() {
  return getItem(STORAGE_KEYS.forecastCache, null);
}

export function saveForecastCache(data) {
  setItem(STORAGE_KEYS.forecastCache, data);
}

export function getHomeInventory() {
  const raw = getItem(STORAGE_KEYS.homeInventory, []);
  return Array.isArray(raw) ? raw : [];
}

export function saveHomeInventory(items) {
  setItem(STORAGE_KEYS.homeInventory, Array.isArray(items) ? items : []);
}

/**
 * @param {string[]} names - display names to add
 * @param {'manual'|'shopping'} [source]
 */
export function addHomeInventoryItems(names, source = 'manual') {
  const current = getHomeInventory();
  const seen = new Set(current.map((i) => i.normalizedName));
  const added = [];

  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name) continue;
    const normalizedName = normalizeIngredientName(name);
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    const item = {
      id: `${normalizedName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      normalizedName,
      source: source || 'manual',
      createdAt: Date.now()
    };
    current.push(item);
    added.push(item);
  }

  saveHomeInventory(current);
  return added;
}

export function removeHomeInventoryItem(id) {
  saveHomeInventory(getHomeInventory().filter((item) => item.id !== id));
}

export { STORAGE_KEYS, DEFAULT_MEAL_PLAN, DEFAULT_EFFORT_PLAN };
