/**
 * Home pantry inventory — name-based matching for ranking and shopping hints.
 */

import { normalizeIngredientName, isPantryBasic, formatIngredientDisplayName } from './ingredient-normalize.js';
import {
  getHomeInventory,
  saveHomeInventory,
  addHomeInventoryItems,
  removeHomeInventoryItem
} from './storage.js';

export { getHomeInventory, saveHomeInventory, addHomeInventoryItems, removeHomeInventoryItem };

export const COMMON_HOME_INGREDIENTS = [
  'eggs',
  'milk',
  'rice',
  'pasta',
  'onions',
  'garlic',
  'tofu',
  'chicken',
  'yogurt',
  'beans'
];

export function normalizeHomeIngredientName(name) {
  return normalizeIngredientName(name);
}

function inventoryNameSet(inventory) {
  return new Set(
    (inventory || [])
      .map((item) => item.normalizedName || normalizeHomeIngredientName(item.name))
      .filter(Boolean)
  );
}

function matchesInventoryName(ingredientNorm, names) {
  for (const inv of names) {
    if (ingredientNorm === inv || ingredientNorm.includes(inv) || inv.includes(ingredientNorm)) {
      return true;
    }
  }
  return false;
}

export function isIngredientAtHome(ingredientName, inventory = null) {
  const norm = normalizeHomeIngredientName(ingredientName);
  if (!norm) return false;
  const names = inventoryNameSet(inventory ?? getHomeInventory());
  return matchesInventoryName(norm, names);
}

function countableIngredients(recipe) {
  return (recipe?.ingredients || []).filter((ing) => ing?.name && !isPantryBasic(ing.name));
}

/**
 * @returns {{ matched: number, total: number, missing: object[], coverage: number }}
 */
export function recipeInventoryCoverage(recipe, inventory = null) {
  const ingredients = countableIngredients(recipe);
  if (!ingredients.length) {
    return { matched: 0, total: 0, missing: [], coverage: 0 };
  }

  const names = inventoryNameSet(inventory ?? getHomeInventory());
  const missing = [];
  let matched = 0;

  for (const ing of ingredients) {
    const norm = normalizeHomeIngredientName(ing.name);
    if (matchesInventoryName(norm, names)) matched += 1;
    else missing.push(ing);
  }

  const total = ingredients.length;
  return {
    matched,
    total,
    missing,
    coverage: total ? matched / total : 0
  };
}

export function missingIngredientsForRecipe(recipe, inventory = null) {
  return recipeInventoryCoverage(recipe, inventory).missing;
}

/**
 * @returns {{ boost: number, coverage: number, matched: number, total: number, missing: object[] }}
 */
export function homeIngredientBoost(recipe, inventory = null) {
  const { matched, total, missing, coverage } = recipeInventoryCoverage(recipe, inventory);
  if (!total) return { boost: 0, coverage, matched, total, missing };

  let boost = 0;
  if (coverage >= 0.75) boost = 3;
  else if (coverage >= 0.5) boost = 2;
  else if (coverage >= 0.25) boost = 1;

  if (missing.length <= 2 && total >= 3) boost += 1;

  return { boost, coverage, matched, total, missing };
}

export function formatInventoryChipLabel(item) {
  return formatIngredientDisplayName(item.name || item.normalizedName);
}
