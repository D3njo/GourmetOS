/**
 * Diet-style preferences (vegetarian, vegan, low carb, …).
 * Applied together with allergen exclusions via isRecipeAllowed().
 * Fish/meat/dairy detection uses inferRecipeExcludeTags() (same as allergen presets).
 */

import { getPreferences } from './storage.js';
import { inferRecipeExcludeTags, recipeTextBlob } from './exclusions.js';
import { inferProtein } from './recipe-meta.js';

const LAND_MEAT_TAGS = ['beef', 'pork', 'duck'];
const FISH_SHELL_TAGS = ['fish', 'shellfish'];
const DAIRY_EGG_TAGS = ['dairy', 'eggs'];

/** Poultry & land animals not covered by preset tags alone. */
const LAND_MEAT_EXTRA =
  /\b(chicken|hähnchen|huhn|turkey|pute|lamb|lamm|venison|wild|goose|gans|rabbit|kaninchen|mince|burger)\b/i;

const HIGH_CARB =
  /\b(pasta|noodle|nudeln|spaghetti|penne|rice|reis|bread|brot|flour|mehl|potato|kartoffel|sugar|zucker|couscous|bulgur|quinoa|corn|mais|tortilla|wrap|pizza|dough|teig|bagel|croissant|porridge|haferflocken|oats|cereal)\b/i;

const HONEY_GELATIN = /\b(honey|honig|gelatin|gelatine)\b/i;

export const DIET_PREFERENCE_IDS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'low_carb',
  'gluten_free',
  'dairy_free'
];

export function getActiveDietPreferences() {
  return getPreferences().dietPreferences || [];
}

function recipeHaystack(recipe) {
  const tags = inferRecipeExcludeTags(recipe).join(' ');
  return `${recipeTextBlob(recipe)} ${tags} ${(recipe.meal_type || []).join(' ')} ${recipe.technique || ''} ${recipe.cuisine || ''}`;
}

function hasInferredTags(recipe, tagIds) {
  const tags = inferRecipeExcludeTags(recipe);
  return tagIds.some((t) => tags.includes(t));
}

function hasLandMeat(recipe) {
  if (hasInferredTags(recipe, LAND_MEAT_TAGS)) return true;
  if (LAND_MEAT_EXTRA.test(recipeHaystack(recipe))) return true;
  const protein = inferProtein(recipe);
  return ['beef', 'pork', 'poultry', 'lamb', 'chicken'].includes(protein);
}

function hasFishShell(recipe) {
  if (hasInferredTags(recipe, FISH_SHELL_TAGS)) return true;
  const protein = inferProtein(recipe);
  return protein === 'fish' || protein === 'seafood';
}

function hasDairyEggsHoney(recipe) {
  if (hasInferredTags(recipe, DAIRY_EGG_TAGS)) return true;
  if (HONEY_GELATIN.test(recipeHaystack(recipe))) return true;
  return inferProtein(recipe) === 'egg';
}

function hasHighCarb(recipe) {
  return HIGH_CARB.test(recipeHaystack(recipe));
}

function hasGlutenSignal(recipe) {
  return hasInferredTags(recipe, ['gluten']);
}

function matchesVegetarian(recipe) {
  if (hasLandMeat(recipe) || hasFishShell(recipe)) return false;
  return true;
}

function matchesVegan(recipe) {
  if (hasLandMeat(recipe) || hasFishShell(recipe) || hasDairyEggsHoney(recipe)) return false;
  return true;
}

function matchesPescatarian(recipe) {
  if (hasLandMeat(recipe)) return false;
  return true;
}

function matchesLowCarb(recipe) {
  if (hasHighCarb(recipe)) return false;
  return true;
}

function matchesGlutenFree(recipe) {
  return !hasGlutenSignal(recipe);
}

function matchesDairyFree(recipe) {
  return !hasInferredTags(recipe, ['dairy']);
}

const DIET_MATCHERS = {
  vegetarian: matchesVegetarian,
  vegan: matchesVegan,
  pescatarian: matchesPescatarian,
  low_carb: matchesLowCarb,
  gluten_free: matchesGlutenFree,
  dairy_free: matchesDairyFree
};

/** True when recipe satisfies all active diet preferences. */
export function recipeMatchesDietPreferences(recipe, diets = null) {
  const active = diets ?? getActiveDietPreferences();
  if (!active.length || !recipe) return true;

  for (const id of active) {
    const matcher = DIET_MATCHERS[id];
    if (matcher && !matcher(recipe)) return false;
  }
  return true;
}

export function filterByDietPreferences(recipes, diets = null) {
  return recipes.filter((r) => recipeMatchesDietPreferences(r, diets));
}
