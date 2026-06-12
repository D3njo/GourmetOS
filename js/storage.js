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
  homeInventory: 'gourmetos_home_inventory',
  recentRecipes: 'gourmetos_recent_recipes',
  foodLog: 'gourmetos_food_log'
};

const RECENT_RECIPE_MAX_ENTRIES = 30;
const RECENT_RECIPE_MAX_AGE_DAYS = 21;

function recentDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysSinceDateKey(dateKey, ref = new Date()) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.floor((start - then) / 86400000);
}

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

/** Ring buffer of { date, ids[] } for cross-week variety scoring. */
export function getRecentRecipeEntries() {
  const raw = getItem(STORAGE_KEYS.recentRecipes, []);
  return Array.isArray(raw) ? raw : [];
}

function pruneRecentRecipeEntries(entries, ref = new Date()) {
  return entries
    .filter((e) => e?.date && Array.isArray(e.ids) && e.ids.length)
    .filter((e) => daysSinceDateKey(e.date, ref) <= RECENT_RECIPE_MAX_AGE_DAYS)
    .slice(-RECENT_RECIPE_MAX_ENTRIES);
}

/** Record recipe IDs served on a calendar day (merged into one entry per day). */
export function recordPlanRecipeIds(recipeIds, dateStr = recentDateKey()) {
  const ids = [...new Set((recipeIds || []).filter(Boolean))];
  if (!ids.length) return;

  const all = getRecentRecipeEntries();
  const existing = all.find((e) => e.date === dateStr);
  const mergedIds = existing ? [...new Set([...(existing.ids || []), ...ids])] : ids;
  const entries = [...all.filter((e) => e.date !== dateStr), { date: dateStr, ids: mergedIds }];
  setItem(STORAGE_KEYS.recentRecipes, pruneRecentRecipeEntries(entries));
}

/** Score penalty for recipes served recently (cross-week fatigue). */
export function getRecentRecipeScorePenalty(recipeId, ref = new Date()) {
  if (!recipeId) return 0;

  let minDays = Infinity;
  for (const entry of getRecentRecipeEntries()) {
    if (!entry.ids?.includes(recipeId)) continue;
    minDays = Math.min(minDays, daysSinceDateKey(entry.date, ref));
  }

  if (!Number.isFinite(minDays)) return 0;
  if (minDays <= 7) return -15;
  if (minDays <= 14) return -8;
  if (minDays <= 21) return -4;
  return 0;
}

/** Recipe IDs served within the last N calendar days (for hard exclusion when picking). */
export function getRecentlyServedRecipeIds(withinDays = 7, ref = new Date()) {
  const ids = new Set();
  for (const entry of getRecentRecipeEntries()) {
    if (daysSinceDateKey(entry.date, ref) <= withinDays) {
      for (const id of entry.ids || []) ids.add(id);
    }
  }
  return ids;
}

function foodLogDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getFoodLogStore() {
  const raw = getItem(STORAGE_KEYS.foodLog, {});
  return raw && typeof raw === 'object' ? raw : {};
}

function saveFoodLogStore(store) {
  setItem(STORAGE_KEYS.foodLog, store);
}

export function getFoodLogForDate(dateStr = foodLogDateKey()) {
  const store = getFoodLogStore();
  return Array.isArray(store[dateStr]) ? store[dateStr] : [];
}

export function addFoodLogEntry(entry, dateStr = foodLogDateKey()) {
  const store = getFoodLogStore();
  const list = [...(store[dateStr] || [])];
  list.push(entry);
  store[dateStr] = list;
  saveFoodLogStore(store);
  return entry;
}

export function removeFoodLogEntry(entryId, dateStr = foodLogDateKey()) {
  const store = getFoodLogStore();
  store[dateStr] = (store[dateStr] || []).filter((e) => e.id !== entryId);
  saveFoodLogStore(store);
}

export function getFoodLogDailyTotals(dateStr = foodLogDateKey()) {
  const entries = getFoodLogForDate(dateStr);
  return entries.reduce(
    (acc, e) => ({
      proteinG: acc.proteinG + (Number(e.proteinG) || 0),
      caloriesKcal: acc.caloriesKcal + (Number(e.caloriesKcal) || 0)
    }),
    { proteinG: 0, caloriesKcal: 0 }
  );
}

export { foodLogDateKey };

export { STORAGE_KEYS, DEFAULT_MEAL_PLAN, DEFAULT_EFFORT_PLAN };
