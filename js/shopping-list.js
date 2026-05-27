import { scaleIngredients, formatAmount } from './portions.js';
import { getShoppingListState, saveShoppingListState, getPreferences } from './storage.js';
import { enrichShoppingGroups, normalizeIngredientName } from './ingredient-normalize.js';
import { isIngredientAtHome } from './home-inventory.js';
import { getHomeInventory } from './storage.js';
import { getLocale } from './i18n.js';
import { isNumericAmount } from './measure-parse.js';
import { isRecipeAllowed, filterAllowedIngredients } from './exclusions.js';

const CATEGORY_ORDER = ['produce', 'butchery', 'dry_goods', 'spices'];

export function aggregateIngredients(recipeEntries) {
  const merged = new Map();
  let hiddenCount = 0;
  const inventory = getHomeInventory();

  for (const entry of recipeEntries) {
    const { recipe, portions = recipe.base_portions } = entry;
    if (!recipe || !isRecipeAllowed(recipe)) continue;

    const allowed = filterAllowedIngredients(recipe.ingredients || []);
    hiddenCount += (recipe.ingredients?.length || 0) - allowed.length;
    const scaled = scaleIngredients(allowed, recipe.base_portions, portions);

    for (const ing of scaled) {
      const normalizedName = normalizeIngredientName(ing.name);
      const key = `${normalizedName}|${ing.unit}|${ing.category}`;
      if (merged.has(key)) {
        const existing = merged.get(key);
        if (isNumericAmount(existing.amount) && isNumericAmount(ing.amount)) {
          existing.amount += ing.amount;
        }
        existing.atHome = existing.atHome || isIngredientAtHome(ing.name, inventory);
      } else {
        merged.set(key, {
          ...ing,
          name: ing.name,
          normalizedName,
          atHome: isIngredientAtHome(ing.name, inventory)
        });
      }
    }
  }

  const ingredients = Array.from(merged.values()).map((ing) => ({
    ...ing,
    atHome: ing.atHome ?? isIngredientAtHome(ing.name, inventory)
  }));

  return { ingredients, hiddenCount };
}

export function groupByCategory(ingredients, categoryMeta = {}) {
  const groups = {};
  const locale = getLocale();

  for (const cat of CATEGORY_ORDER) {
    groups[cat] = [];
  }

  for (const ing of ingredients) {
    const cat = ing.category || 'dry_goods';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(ing);
  }

  return CATEGORY_ORDER.filter((c) => groups[c]?.length).map((cat) => ({
    id: cat,
    label: categoryMeta[cat]?.label || cat,
    emoji: categoryMeta[cat]?.emoji || '📦',
    items: groups[cat].sort((a, b) => a.name.localeCompare(b.name, locale))
  }));
}

/**
 * Build shopping list from weekly plan.
 * @param {object} options - { scope: 'day'|'week', dateStr: ISO date for day scope }
 */
export function buildShoppingListFromPlan(weeklyPlan, portions, categoryMeta, options = {}) {
  const { scope = 'week', dateStr } = options;
  const entries = [];

  const days =
    scope === 'day'
      ? weeklyPlan.filter((d) => d.dateStr === (dateStr || new Date().toISOString().slice(0, 10)))
      : weeklyPlan;

  for (const day of days) {
    for (const recipe of day.recipes) {
      if (recipe && isRecipeAllowed(recipe)) entries.push({ recipe, portions });
    }
  }

  const { ingredients, hiddenCount } = aggregateIngredients(entries);
  const hidePantry = options.hidePantry ?? !!getPreferences().hidePantryBasics;
  const groups = enrichShoppingGroups(groupByCategory(ingredients, categoryMeta), { hidePantry });
  return { groups, hiddenCount };
}

export function getItemKey(groupId, name, unit) {
  return `${groupId}::${name}::${unit}`;
}

export function toggleItemChecked(key) {
  const state = getShoppingListState();
  state[key] = !state[key];
  saveShoppingListState(state);
  return state[key];
}

export function isItemChecked(key) {
  return !!getShoppingListState()[key];
}

export { CATEGORY_ORDER };
