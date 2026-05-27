/** Favorites, user-generated recipes, and per-recipe customization overrides */

import { getItem, setItem, STORAGE_KEYS } from './storage.js';

const KEYS = {
  favorites: 'gourmetos_favorites',
  overrides: 'gourmetos_recipe_overrides',
  generated: 'gourmetos_generated_recipes'
};

export function getFavorites() {
  return getItem(KEYS.favorites, []);
}

export function isFavorite(recipeId) {
  return getFavorites().includes(recipeId);
}

export function toggleFavorite(recipeId) {
  const list = getFavorites();
  const idx = list.indexOf(recipeId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(recipeId);
  setItem(KEYS.favorites, list);
  return list.includes(recipeId);
}

export function getRecipeOverrides() {
  return getItem(KEYS.overrides, {});
}

export function getRecipeOverride(recipeId) {
  return getRecipeOverrides()[recipeId] ?? null;
}

export function saveRecipeOverride(recipeId, override) {
  const all = getRecipeOverrides();
  all[recipeId] = { ...override, updatedAt: new Date().toISOString() };
  setItem(KEYS.overrides, all);
}

export function clearRecipeOverride(recipeId) {
  const all = getRecipeOverrides();
  delete all[recipeId];
  setItem(KEYS.overrides, all);
}

export function hasRecipeOverride(recipeId) {
  return !!getRecipeOverride(recipeId);
}

/** Apply stored override on top of base recipe (deep merge for editable fields) */
export function applyRecipeOverride(recipe) {
  if (!recipe?.id) return recipe;
  const override = getRecipeOverride(recipe.id);
  if (!override) return { ...recipe, isCustomized: false };

  return {
    ...recipe,
    name: override.name ?? recipe.name,
    description: override.description ?? recipe.description,
    technique: override.technique ?? recipe.technique,
    flavor_profile: override.flavor_profile ?? recipe.flavor_profile,
    ingredients: override.ingredients ?? recipe.ingredients,
    steps: override.steps ?? recipe.steps,
    base_portions: override.base_portions ?? recipe.base_portions,
    isCustomized: true
  };
}

export function getGeneratedRecipes() {
  return getItem(KEYS.generated, []);
}

export function saveGeneratedRecipes(recipes) {
  setItem(KEYS.generated, recipes);
}

export function addGeneratedRecipe(recipe) {
  const list = getGeneratedRecipes();
  if (list.some((r) => r.id === recipe.id)) return list;
  list.push(recipe);
  saveGeneratedRecipes(list);
  return list;
}

/** Clone recipe fields safe for editing */
export function cloneRecipeForEdit(recipe) {
  return {
    name: recipe.name,
    description: recipe.description,
    technique: recipe.technique,
    flavor_profile: recipe.flavor_profile,
    base_portions: recipe.base_portions,
    ingredients: recipe.ingredients.map((i) => ({ ...i })),
    steps: recipe.steps.map((s) => ({ ...s, text: s.text }))
  };
}

export { KEYS as RECIPE_STORE_KEYS };
