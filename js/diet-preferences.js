/**
 * Diet-style preferences (vegetarian, vegan, low carb, …).
 * Applied together with allergen exclusions via isRecipeAllowed().
 */

import { getPreferences } from './storage.js';
import { inferRecipeExcludeTags, recipeTextBlob } from './exclusions.js';

/** Land animal meat & poultry (not fish). */
const LAND_MEAT =
  /\b(beef|rind|steak|pork|schwein|bacon|ham|lamb|lamm|veal|kalb|chicken|hähnchen|huhn|turkey|pute|duck|ente|sausage|wurst|chorizo|mince|burger|venison|wild|goose|gans|rabbit|kaninchen)\b/i;

const FISH_SHELL =
  /\b(fish|fisch|salmon|lachs|tuna|thunfisch|cod|prawn|shrimp|crab|lobster|mussel|clam|squid|anchovy|sardine|trout|shellfish|garnelen)\b/i;

const DAIRY_EGGS_HONEY =
  /\b(milk|milch|cream|sahne|cheese|käse|kaese|butter|yogurt|joghurt|parmesan|mozzarella|egg|eggs|ei\b|eier|mayonnaise|mayo|honey|honig|gelatin|gelatine)\b/i;

const HIGH_CARB =
  /\b(pasta|noodle|nudeln|spaghetti|penne|rice|reis|bread|brot|flour|mehl|potato|kartoffel|sugar|zucker|couscous|bulgur|quinoa|corn|mais|tortilla|wrap|pizza|dough|teig|bagel|croissant|porridge|haferflocken|oats|cereal)\b/i;

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

function hasLandMeat(recipe) {
  const text = recipeHaystack(recipe);
  if (LAND_MEAT.test(text)) return true;
  const tags = inferRecipeExcludeTags(recipe);
  return tags.some((t) => ['beef', 'pork', 'duck'].includes(t));
}

function hasFishShell(recipe) {
  const text = recipeHaystack(recipe);
  if (FISH_SHELL.test(text)) return true;
  const tags = inferRecipeExcludeTags(recipe);
  return tags.some((t) => ['fish', 'shellfish'].includes(t));
}

function hasDairyEggsHoney(recipe) {
  const text = recipeHaystack(recipe);
  if (DAIRY_EGGS_HONEY.test(text)) return true;
  const tags = inferRecipeExcludeTags(recipe);
  return tags.some((t) => ['dairy', 'eggs'].includes(t));
}

function hasHighCarb(recipe) {
  return HIGH_CARB.test(recipeHaystack(recipe));
}

function hasGlutenSignal(recipe) {
  const tags = inferRecipeExcludeTags(recipe);
  return tags.includes('gluten') || /\b(gluten|wheat|weizen|pasta|bread|brot|flour|mehl)\b/i.test(recipeHaystack(recipe));
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

const DAIRY_ONLY =
  /\b(milk|milch|cream|sahne|cheese|käse|kaese|butter|yogurt|joghurt|parmesan|mozzarella|cheddar|feta|ricotta|mascarpone|ghee|buttermilk|sour\s*cream)\b/i;

function matchesDairyFree(recipe) {
  const tags = inferRecipeExcludeTags(recipe);
  if (tags.includes('dairy')) return false;
  return !DAIRY_ONLY.test(recipeHaystack(recipe));
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
