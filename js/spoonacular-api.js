/**
 * Optional Spoonacular API integration (user-provided API key).
 */

import { getSpoonacularApiKey, getItem, setItem } from './storage.js';

const API_BASE = 'https://api.spoonacular.com';
const QUOTA_KEY = 'gourmetos_spoonacular_quota';

const INGREDIENT_CATEGORIES = {
  butchery: ['beef', 'chicken', 'lamb', 'pork', 'duck', 'salmon', 'tuna', 'fish', 'prawn', 'shrimp', 'steak', 'fillet'],
  spices: ['salt', 'pepper', 'garlic', 'onion', 'ginger', 'chili', 'mustard', 'paprika', 'basil', 'thyme', 'cumin'],
  produce: ['tomato', 'mushroom', 'carrot', 'potato', 'lemon', 'lime', 'onion', 'pepper', 'spinach', 'broccoli']
};

function inferCategory(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'dry_goods';
}

function saveQuotaFromResponse(response) {
  const left = response.headers.get('X-Api-Quota-Left');
  const used = response.headers.get('X-Api-Quota-Used');
  if (left != null) {
    setItem(QUOTA_KEY, {
      left: Number(left),
      used: used != null ? Number(used) : null,
      updatedAt: new Date().toISOString()
    });
  }
}

export function getSpoonacularQuota() {
  return getItem(QUOTA_KEY, null);
}

export class SpoonacularQuotaError extends Error {
  constructor() {
    super('Spoonacular quota exceeded');
    this.name = 'SpoonacularQuotaError';
    this.quotaExceeded = true;
  }
}

async function spoonacularFetch(path, params = {}) {
  const apiKey = getSpoonacularApiKey();
  if (!apiKey) return null;

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('apiKey', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }

  const response = await fetch(url.toString(), { cache: 'no-store' });
  saveQuotaFromResponse(response);

  if (response.status === 402) {
    throw new SpoonacularQuotaError();
  }

  if (!response.ok) {
    throw new Error(`Spoonacular HTTP ${response.status}`);
  }

  return response.json();
}

/** Extract protein (g) and calories (kcal) from Spoonacular nutrition payloads. */
export function extractNutrientsFromSpoonacular(nutrition) {
  const nutrients = nutrition?.nutrients || nutrition?.nutrition?.nutrients || [];
  let proteinG = null;
  let caloriesKcal = null;

  for (const n of nutrients) {
    const name = String(n.name || '').toLowerCase();
    const amount = Number(n.amount);
    if (!Number.isFinite(amount)) continue;
    if (name === 'protein') proteinG = Math.round(amount);
    if (name === 'calories') caloriesKcal = Math.round(amount);
  }

  return { proteinG, caloriesKcal };
}

/** Search recipes by dish name for food-log nutrition lookup. */
export async function searchDishByName(query, number = 3) {
  if (!getSpoonacularApiKey()) return [];
  try {
    const data = await spoonacularFetch('/recipes/complexSearch', {
      query,
      number,
      addRecipeInformation: true,
      sort: 'popularity',
      language: 'en'
    });
    return data?.results || [];
  } catch (err) {
    if (err instanceof SpoonacularQuotaError) throw err;
    console.warn('Spoonacular dish search failed:', err);
    return [];
  }
}

/** Nutrition for a Spoonacular recipe id. */
export async function fetchRecipeNutrition(recipeId) {
  if (!getSpoonacularApiKey()) return null;
  try {
    return await spoonacularFetch(`/recipes/${recipeId}/nutritionWidget.json`);
  } catch (err) {
    if (err instanceof SpoonacularQuotaError) throw err;
    console.warn('Spoonacular recipe nutrition failed:', err);
    return null;
  }
}

/** Restaurant / takeaway menu items (kebab, etc.). */
export async function searchMenuItemByName(query, number = 3) {
  if (!getSpoonacularApiKey()) return [];
  try {
    const data = await spoonacularFetch('/food/menuItems/search', { query, number });
    return data?.menuItems || [];
  } catch (err) {
    if (err instanceof SpoonacularQuotaError) throw err;
    console.warn('Spoonacular menu search failed:', err);
    return [];
  }
}

/** Nutrition for a Spoonacular menu item id. */
export async function fetchMenuItemNutrition(menuItemId) {
  if (!getSpoonacularApiKey()) return null;
  try {
    return await spoonacularFetch(`/food/menuItems/${menuItemId}/nutritionWidget.json`);
  } catch (err) {
    if (err instanceof SpoonacularQuotaError) throw err;
    console.warn('Spoonacular menu nutrition failed:', err);
    return null;
  }
}

export function hasSpoonacularQuotaRemaining() {
  const quota = getSpoonacularQuota();
  if (!quota || quota.left == null) return !!getSpoonacularApiKey();
  return quota.left > 0;
}

function parseInstructions(recipe) {
  const analyzed = recipe.analyzedInstructions?.[0]?.steps;
  if (analyzed?.length) {
    return analyzed.map((s) => ({
      text: s.step,
      time_minutes: Math.max(5, Math.min(30, Math.ceil((recipe.readyInMinutes || 30) / analyzed.length))),
      video: null
    }));
  }
  if (recipe.instructions) {
    return recipe.instructions
      .split(/\.\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text, i) => ({
        text: text.endsWith('.') ? text : `${text}.`,
        time_minutes: 10 + i * 5,
        video: null
      }));
  }
  return [{ text: 'See source recipe for preparation steps.', time_minutes: 20, video: null }];
}

function parseIngredients(recipe) {
  const ext = recipe.extendedIngredients || [];
  if (ext.length) {
    return ext.map((ing) => ({
      name: ing.name || ing.originalName || 'Ingredient',
      amount: ing.amount ?? 1,
      unit: ing.unit || 'pcs',
      category: inferCategory(ing.name || '')
    }));
  }
  return (recipe.ingredients || []).map((name) => ({
    name,
    amount: 1,
    unit: 'pcs',
    category: inferCategory(name)
  }));
}

function inferWeatherTags(recipe) {
  const text = `${recipe.title} ${recipe.dishTypes?.join(' ')} ${recipe.cuisines?.join(' ')}`.toLowerCase();
  if (/soup|stew|braise|pie|comfort|ramen|pho/.test(text)) return ['rain', 'cold'];
  if (/salad|ceviche|grill|cold|fresh|sushi/.test(text)) return ['hot', 'sunny'];
  return ['mild'];
}

function inferMealTypes(recipe) {
  const types = new Set(['dinner']);
  const text = (recipe.dishTypes || []).join(' ').toLowerCase();
  if (/breakfast|brunch|morning/.test(text)) types.add('breakfast');
  if (/lunch|snack|appetizer/.test(text)) types.add('lunch');
  if (/brunch/.test(text)) types.add('brunch');
  return [...types];
}

export function mapSpoonacularRecipe(recipe) {
  const ingredients = parseIngredients(recipe);
  const slug = `spoon-${recipe.id}`;

  return {
    id: slug,
    spoonacularId: recipe.id,
    name: recipe.title,
    description: recipe.summary?.replace(/<[^>]+>/g, '').slice(0, 200) || recipe.title,
    image: recipe.image,
    technique: recipe.cuisines?.[0] || recipe.dishTypes?.[0] || 'International',
    flavor_profile: (recipe.dishTypes || []).slice(0, 3).join(', '),
    weather_tags: inferWeatherTags(recipe),
    exclude_tags: [],
    weather_trigger: {},
    meal_type: inferMealTypes(recipe),
    base_portions: recipe.servings || 2,
    rating: recipe.spoonacularScore ? Math.min(5, recipe.spoonacularScore / 20) : null,
    readyInMinutes: recipe.readyInMinutes,
    source: {
      name: recipe.sourceName || 'Spoonacular',
      url: recipe.sourceUrl || `https://spoonacular.com/recipes/${recipe.title}-${recipe.id}`,
      provider: 'Spoonacular',
      area: recipe.cuisines?.[0] || '',
      category: recipe.dishTypes?.[0] || ''
    },
    youtube: null,
    external: true,
    ingredients,
    steps: parseInstructions(recipe)
  };
}

/** Search recipes — respects maxReadyTime for effort-aware discovery */
export async function searchSpoonacularRecipes({ maxReadyTime = null, number = 8 } = {}) {
  if (!getSpoonacularApiKey()) return [];

  const params = {
    addRecipeInformation: true,
    fillIngredients: true,
    number,
    sort: 'popularity',
    language: 'en'
  };
  if (maxReadyTime) params.maxReadyTime = maxReadyTime;

  try {
    const data = await spoonacularFetch('/recipes/complexSearch', params);
    if (!data?.results?.length) return [];
    return data.results.map(mapSpoonacularRecipe);
  } catch (err) {
    console.warn('Spoonacular search failed:', err);
    return [];
  }
}

export function isSpoonacularConfigured() {
  return !!getSpoonacularApiKey();
}
