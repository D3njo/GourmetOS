import { getPreferences } from './storage.js';
import { resolveWeatherTagFromValues } from './weather.js';
import { filterByExclusions, getAllExcludedTerms } from './exclusions.js';
import { applyRecipeOverride, isFavorite } from './recipe-store.js';
import { getPlanningPool, resolveRecipesForSlots } from './recipe-loader.js';
import { syncRecipePool, getSyncStatus } from './pool-sync.js';
import { migrateFromLocalStorage } from './recipe-idb.js';
import { bootstrapFromBundledIfEmpty } from './recipe-bootstrap.js';
import {
  enrichRecipeComplexity,
  effortMatchesFilter,
  effortScoreBoost
} from './recipe-complexity.js';
import { toDateKey } from './menu-refresh.js';
import { getRecipeWeatherPrimary } from './weather-buckets.js';
import { enrichEditorial } from './editorial-recipe.js';
import { inferProtein } from './recipe-meta.js';
import { rankRecipes } from './recommendation-engine.js';

let recipeDatabase = null;

const CATEGORIES = {
  produce: { label: 'Produce & Harvest', emoji: '🥕' },
  butchery: { label: 'Meat & Fish', emoji: '🥩' },
  dry_goods: { label: 'Dry Goods & Oils', emoji: '🥫' },
  spices: { label: 'Spices & Herbs', emoji: '🥣' }
};

function localizeCategories() {
  return CATEGORIES;
}

function localizeRecipe(recipe) {
  if (!recipe._en) return recipe;
  const en = recipe._en;
  return {
    ...recipe,
    name: en.name ?? recipe.name,
    description: en.description ?? recipe.description,
    technique: en.technique ?? recipe.technique,
    source: recipe.source
      ? { ...recipe.source, name: en.source_name ?? recipe.source.name }
      : recipe.source
  };
}

function prepareRecipe(recipe, context = {}) {
  const base = enrichRecipeComplexity(applyRecipeOverride(localizeRecipe(recipe)));
  return enrichEditorial(base, context);
}

async function buildCatalog() {
  await migrateFromLocalStorage();
  await bootstrapFromBundledIfEmpty();
  const recipes = await getPlanningPool();
  return recipes.map((r) => prepareRecipe(r));
}

export async function loadRecipes() {
  if (recipeDatabase && recipeDatabase._locale === 'en') {
    return recipeDatabase;
  }

  const recipes = await buildCatalog();

  recipeDatabase = {
    version: '4.0',
    recipes,
    categories: localizeCategories(),
    _locale: 'en'
  };
  return recipeDatabase;
}

export async function refreshRecipeCatalog(onProgress) {
  await syncRecipePool({ force: true, onProgress });
  invalidateRecipeCache();
  return loadRecipes();
}

export async function clearRecipePool() {
  const { clearRecipes, setSyncMeta } = await import('./recipe-idb.js');
  await clearRecipes();
  await setSyncMeta('pool_sync', { tmdComplete: false, spoonOffset: 0, lastRun: null });
  invalidateRecipeCache();
}

export { syncRecipePool, getSyncStatus };

export function invalidateRecipeCache() {
  recipeDatabase = null;
}

export function getRecipeById(recipes, id) {
  const found = recipes.find((r) => r.id === id) ?? null;
  return found ? prepareRecipe(found) : null;
}

export function resolveWeatherTag(weatherData, manualMode) {
  if (manualMode === 'hot' || manualMode === 'cold' || manualMode === 'mild') return manualMode;
  if (!weatherData) return 'cold';

  const temp = weatherData.temperature ?? weatherData.tempMean;
  const code = weatherData.weathercode;
  return resolveWeatherTagFromValues(temp, code);
}

function filterByEffort(pool, effortLevel) {
  if (!effortLevel) return pool;

  const strict = pool.filter((r) => r.effort === effortLevel);
  if (strict.length >= 2) return strict;

  const relaxed = pool.filter((r) => effortMatchesFilter(r.effort, effortLevel));
  return relaxed.length ? relaxed : pool;
}

function matchesWeatherBucket(recipe, weatherTag) {
  return getRecipeWeatherPrimary(recipe) === weatherTag;
}

export function filterRecipes(
  recipes,
  { weatherTag, excludedTags = null, mealType = null, effortLevel = null }
) {
  const { presetTags, customTerms } = getAllExcludedTerms();
  const tags = excludedTags ?? presetTags;

  let pool = recipes.filter((recipe) => {
    const weatherMatch = matchesWeatherBucket(recipe, weatherTag);
    const mealMatch = !mealType || (recipe.meal_type || []).includes(mealType);
    return weatherMatch && mealMatch;
  });

  pool = filterByExclusions(pool, tags, customTerms);
  pool = filterByEffort(pool, effortLevel);
  return pool;
}

export { inferProtein } from './recipe-meta.js';

export function getRecipeOptions(
  recipes,
  {
    weatherTag,
    mealType = null,
    excludedTags = null,
    effortLevel = null,
    limit = 3,
    dayIndex = 0,
    usedIds = null,
    usedCuisines = null,
    usedProteins = null,
    usedTastes = null,
    usedTechniques = null
  }
) {
  const { presetTags, customTerms } = getAllExcludedTerms();
  const tags = excludedTags ?? presetTags;

  let pool = filterRecipes(recipes, { weatherTag, excludedTags: tags, mealType, effortLevel });

  if (!pool.length) {
    pool = filterRecipes(recipes, { weatherTag, excludedTags: tags, effortLevel: null, mealType });
  }
  if (!pool.length) {
    pool = filterRecipes(recipes, { weatherTag, excludedTags: tags });
  }
  if (!pool.length) {
    pool = filterByExclusions(recipes, tags, customTerms);
  }
  if (!pool.length) pool = recipes;

  const ranked = rankRecipes(pool, {
    weatherTag,
    mealType,
    effortLevel,
    dayIndex,
    usedIds,
    usedCuisines,
    usedProteins,
    usedTastes,
    usedTechniques
  });

  const seen = new Set();
  const result = [];
  for (const { recipe, reasons, score } of ranked) {
    if (seen.has(recipe.id)) continue;
    seen.add(recipe.id);
    result.push({ ...prepareRecipe(recipe), _recScore: score, _recReasons: reasons });
    if (result.length >= limit) break;
  }

  return result;
}

export function pickRecipeForDay(recipes, dayIndex, weatherTag, effortLevel = null) {
  const options = getRecipeOptions(recipes, { weatherTag, effortLevel, limit: 5, dayIndex });
  return options[dayIndex % options.length] ?? recipes[0];
}

export async function getActiveRecipeFromPlan(weeklyPlan) {
  const db = await loadRecipes();
  const todayStr = toDateKey();
  const todayDay = weeklyPlan?.find((d) => d.dateStr === todayStr);

  const slot = todayDay?.slots?.[0];
  const recipe = prepareRecipe(slot?.selected ?? todayDay?.recipes?.[0] ?? db.recipes[0]);
  const weatherTag = todayDay?.weatherTag ?? 'mild';

  return {
    recipe,
    weatherTag,
    categories: db.categories,
    todayDay,
    primarySlot: slot
  };
}

export { loadRecipes as getRecipeDatabase };
export { inferWeatherPrimary, getRecipeWeatherPrimary } from './weather-buckets.js';
