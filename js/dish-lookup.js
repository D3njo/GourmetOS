/**
 * Dish nutrition lookup — cache → bundled dishes → app recipes → Spoonacular.
 */

import { getItem, setItem, getSpoonacularApiKey } from './storage.js';
import { estimateProteinScore } from './protein-preferences.js';
import {
  extractNutrientsFromSpoonacular,
  searchDishByName,
  fetchRecipeNutrition,
  searchMenuItemByName,
  fetchMenuItemNutrition,
  hasSpoonacularQuotaRemaining,
  SpoonacularQuotaError
} from './spoonacular-api.js';

const CACHE_KEY = 'gourmetos_dish_nutrition_cache';
let commonDishesPromise = null;

export function normalizeDishQuery(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCache() {
  return getItem(CACHE_KEY, {});
}

function saveCache(cache) {
  setItem(CACHE_KEY, cache);
}

function cacheResult(query, result) {
  const key = normalizeDishQuery(query);
  if (!key || !result) return;
  const cache = getCache();
  cache[key] = { ...result, cachedAt: Date.now() };
  saveCache(cache);
}

function fromCache(query) {
  const key = normalizeDishQuery(query);
  if (!key) return null;
  return getCache()[key] || null;
}

async function loadCommonDishes() {
  if (!commonDishesPromise) {
    commonDishesPromise = fetch('./data/common-dishes.json')
      .then((r) => (r.ok ? r.json() : { dishes: [] }))
      .catch(() => ({ dishes: [] }));
  }
  return commonDishesPromise;
}

function matchesDishName(query, dish) {
  const q = normalizeDishQuery(query);
  if (!q) return false;
  const names = [dish.name, ...(dish.aliases || [])].map(normalizeDishQuery);
  return names.some((n) => n === q || q.includes(n) || n.includes(q));
}

export async function lookupBundledDish(query) {
  const data = await loadCommonDishes();
  const dish = (data.dishes || []).find((d) => matchesDishName(query, d));
  if (!dish) return null;
  return {
    label: dish.name,
    proteinG: dish.proteinG,
    caloriesKcal: dish.caloriesKcal,
    source: 'bundled',
    sourceId: dish.id,
    estimated: false
  };
}

export function estimateNutritionFromRecipe(recipe) {
  if (!recipe) return null;
  const proteinScore = estimateProteinScore(recipe);
  const ingredientCount = (recipe.ingredients || []).filter((i) => i?.name).length;
  const proteinG = Math.round(8 + proteinScore * 3.2);
  const caloriesKcal = Math.round(260 + proteinScore * 42 + ingredientCount * 10);
  return {
    label: recipe.name,
    proteinG,
    caloriesKcal,
    source: 'app-recipe',
    sourceId: recipe.id,
    estimated: true
  };
}

export async function lookupAppRecipeByName(query, recipes = []) {
  const q = normalizeDishQuery(query);
  if (!q || !recipes.length) return null;

  let best = null;
  let bestScore = 0;

  for (const recipe of recipes) {
    const name = normalizeDishQuery(recipe.name);
    if (!name) continue;
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q) || q.includes(name)) score = 70;
    else {
      const tokens = q.split(' ').filter((t) => t.length > 2);
      const matched = tokens.filter((t) => name.includes(t)).length;
      if (matched) score = 30 + matched * 15;
    }
    if (score > bestScore) {
      bestScore = score;
      best = recipe;
    }
  }

  if (!best || bestScore < 40) return null;
  return estimateNutritionFromRecipe(best);
}

async function lookupSpoonacularRecipe(query) {
  const results = await searchDishByName(query, 3);
  if (!results.length) return null;

  for (const hit of results) {
    const nutrition = await fetchRecipeNutrition(hit.id);
    const { proteinG, caloriesKcal } = extractNutrientsFromSpoonacular(nutrition);
    if (proteinG == null && caloriesKcal == null) continue;
    const servings = hit.servings || 1;
    return {
      label: hit.title,
      proteinG: proteinG != null ? Math.round(proteinG / servings) : null,
      caloriesKcal: caloriesKcal != null ? Math.round(caloriesKcal / servings) : null,
      source: 'spoonacular-recipe',
      sourceId: hit.id,
      estimated: false
    };
  }
  return null;
}

async function lookupSpoonacularMenuItem(query) {
  const items = await searchMenuItemByName(query, 3);
  if (!items.length) return null;

  for (const item of items) {
    const nutrition = await fetchMenuItemNutrition(item.id);
    const { proteinG, caloriesKcal } = extractNutrientsFromSpoonacular(nutrition);
    if (proteinG == null && caloriesKcal == null) continue;
    return {
      label: item.title,
      proteinG,
      caloriesKcal,
      source: 'spoonacular-menu',
      sourceId: item.id,
      estimated: false
    };
  }
  return null;
}

/**
 * @returns {Promise<{ label, proteinG, caloriesKcal, source, sourceId, estimated } | null>}
 * @throws {SpoonacularQuotaError}
 */
export async function lookupDishNutrition(query, { recipes = [] } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;

  const cached = fromCache(trimmed);
  if (cached) return cached;

  const bundled = await lookupBundledDish(trimmed);
  if (bundled?.proteinG != null && bundled?.caloriesKcal != null) {
    cacheResult(trimmed, bundled);
    return bundled;
  }

  const appMatch = await lookupAppRecipeByName(trimmed, recipes);
  if (appMatch?.proteinG != null && appMatch?.caloriesKcal != null) {
    cacheResult(trimmed, appMatch);
    return appMatch;
  }

  if (!getSpoonacularApiKey()) return null;
  if (!hasSpoonacularQuotaRemaining()) {
    throw new SpoonacularQuotaError();
  }

  let spoon = await lookupSpoonacularRecipe(trimmed);
  if (!spoon) {
    spoon = await lookupSpoonacularMenuItem(trimmed);
  }

  if (spoon?.proteinG != null || spoon?.caloriesKcal != null) {
    cacheResult(trimmed, spoon);
    return spoon;
  }

  return null;
}

export { SpoonacularQuotaError };
