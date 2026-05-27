/**
 * Lazy recipe resolution: IndexedDB → API fetch → index stub + external link
 */

import { getRecipe, putRecipes } from './recipe-idb.js';
import {
  fetchMealById,
  loadCatalog,
  mapMealToRecipe,
  buildMetaFromMeal
} from './recipe-api.js';
import { loadRecipeIndex } from './pool-sync.js';
import { enrichRecipeComplexity } from './recipe-complexity.js';
import { enrichEditorial } from './editorial-recipe.js';
import { mapSpoonacularRecipe } from './spoonacular-api.js';
import { getSpoonacularApiKey } from './storage.js';

let indexCache = null;
let indexById = null;

export async function ensureIndexLoaded() {
  if (indexCache) return indexCache;
  indexCache = await loadRecipeIndex();
  indexById = new Map(indexCache.entries.map((e) => [e.id, e]));
  return indexCache;
}

const EDITORIAL_INDEX_FIELDS = [
  'description',
  'technique',
  'weather_primary',
  'weather_tags',
  'meal_type',
  'exclude_tags',
  'effort',
  'totalMinutes',
  'ingredientCount',
  'rating',
  'tier',
  'qualityScore',
  'chef',
  'fineDiningMeta',
  'taste_profile',
  'why_this_works',
  'chef_move',
  'occasion',
  'skill_focus',
  'mise_en_place',
  'weather_mood'
];

function mergeIndexMeta(recipe, entry) {
  if (!recipe || !entry) return recipe;
  const merged = { ...recipe };
  for (const field of EDITORIAL_INDEX_FIELDS) {
    if (entry[field] != null && entry[field] !== '') {
      merged[field] = entry[field];
    }
  }
  const name = (merged.name || '').trim();
  if (!merged.description || merged.description.trim() === name) {
    merged.description = entry.description || merged.description;
  }
  return merged;
}

function finalizeRecipe(recipe, entry) {
  const merged = entry ? mergeIndexMeta(recipe, entry) : recipe;
  return enrichEditorial(merged, {
    weatherTag: merged.weather_primary,
    effortLevel: merged.effort
  });
}

export function stubFromIndexEntry(entry) {
  const stub = enrichRecipeComplexity({
    id: entry.id,
    idMeal: entry.idMeal,
    spoonacularId: entry.spoonacularId,
    name: entry.name,
    description: entry.description || entry.name,
    image: entry.image,
    technique: entry.technique,
    flavor_profile: entry.cuisine || '',
    weather_tags: entry.weather_tags || ['mild'],
    weather_primary: entry.weather_primary,
    exclude_tags: entry.exclude_tags || [],
    meal_type: entry.meal_type || ['dinner'],
    base_portions: 2,
    rating: entry.rating,
    tier: entry.tier,
    qualityScore: entry.qualityScore,
    chef: entry.chef,
    fineDiningMeta: entry.fineDiningMeta,
    effort: entry.effort,
    totalMinutes: entry.totalMinutes,
    ingredientCount: entry.ingredientCount,
    taste_profile: entry.taste_profile,
    why_this_works: entry.why_this_works,
    chef_move: entry.chef_move,
    occasion: entry.occasion,
    skill_focus: entry.skill_focus,
    mise_en_place: entry.mise_en_place,
    weather_mood: entry.weather_mood,
    source: entry.source,
    external: true,
    ingredients: [],
    steps: [],
    hasFullData: false,
    onlineOnly: true
  });
  return enrichEditorial(stub, { weatherTag: entry.weather_primary, effortLevel: entry.effort });
}

async function fetchSpoonacularById(id) {
  const numId = id.replace(/^spoon-/, '');
  const apiKey = getSpoonacularApiKey();
  if (!apiKey) return null;

  const url = `https://api.spoonacular.com/recipes/${numId}/information?apiKey=${apiKey}&language=en`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  const recipe = mapSpoonacularRecipe(data);
  return enrichRecipeComplexity({ ...recipe, hasFullData: true, onlineOnly: false });
}

/** Resolve full recipe by id */
export async function resolveRecipe(id) {
  await ensureIndexLoaded();

  let recipe = await getRecipe(id);
  const entry = indexById.get(id);

  if (recipe?.ingredients?.length) {
    return finalizeRecipe(enrichRecipeComplexity(recipe), entry);
  }

  if (!entry) return recipe ?? null;

  if (entry.idMeal) {
    try {
      const catalog = await loadCatalog();
      const override = (catalog.meals || []).find((m) => m.idMeal === entry.idMeal);
      const meal = await fetchMealById(entry.idMeal);
      const meta = override || buildMetaFromMeal(meal, catalog.discovery || {});
      recipe = mapMealToRecipe(meal, { ...meta, slug: entry.id });
      recipe = {
        ...recipe,
        tier: entry.tier,
        qualityScore: entry.qualityScore,
        hasFullData: true,
        onlineOnly: false
      };
      recipe = finalizeRecipe(enrichRecipeComplexity(recipe), entry);
      await putRecipes([recipe]);
      return recipe;
    } catch {
      /* fall through to stub */
    }
  }

  if (id.startsWith('spoon-')) {
    recipe = await fetchSpoonacularById(id);
    if (recipe) {
      recipe = finalizeRecipe(enrichRecipeComplexity(recipe), entry);
      await putRecipes([recipe]);
      return recipe;
    }
  }

  return stubFromIndexEntry(entry);
}

/** Build planning pool: merge index metadata with IDB full recipes */
export async function getPlanningPool() {
  await ensureIndexLoaded();

  const { getAllRecipes } = await import('./recipe-idb.js');
  const stored = await getAllRecipes();
  const storedById = new Map(stored.map((r) => [r.id, r]));

  const pool = indexCache.entries.map((entry) => {
    const full = storedById.get(entry.id);
    if (full?.ingredients?.length) {
      return finalizeRecipe(
        enrichRecipeComplexity({
          ...full,
          hasFullData: true,
          onlineOnly: false
        }),
        entry
      );
    }
    return stubFromIndexEntry(entry);
  });

  for (const r of stored) {
    if (!indexById.has(r.id)) {
      pool.push(enrichRecipeComplexity(r));
    }
  }

  return pool;
}

export async function resolveRecipesForSlots(recipeIds) {
  const unique = [...new Set(recipeIds.filter(Boolean))];
  const resolved = await Promise.all(unique.map((id) => resolveRecipe(id)));
  return new Map(unique.map((id, i) => [id, resolved[i]]));
}

export function isOnlineOnly(recipe) {
  return recipe?.onlineOnly === true || !recipe?.ingredients?.length;
}

export async function getIndexCount() {
  await ensureIndexLoaded();
  return indexCache?.count ?? indexCache?.entries?.length ?? 0;
}
