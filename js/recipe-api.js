/**
 * TheMealDB mapping and recipe metadata helpers
 */

import { enrichRecipeComplexity } from './recipe-complexity.js';
import { inferRecipeExcludeTags } from './exclusions.js';

const API_BASE = 'https://www.themealdb.com/api/json/v1/1';

const INGREDIENT_CATEGORIES = {
  butchery: [
    'beef', 'chicken', 'lamb', 'pork', 'duck', 'salmon', 'tuna', 'fish',
    'prawn', 'shrimp', 'ham', 'bacon', 'sausage', 'mince', 'fillet', 'steak',
    'cod', 'haddock', 'crab', 'clam', 'mussel', 'squid', 'anchovy'
  ],
  spices: [
    'salt', 'pepper', 'garlic', 'onion', 'ginger', 'chilli', 'chili', 'mustard',
    'paprika', 'cumin', 'coriander', 'parsley', 'basil', 'thyme', 'rosemary',
    'saffron', 'nutmeg', 'cinnamon', 'herb', 'spice'
  ],
  produce: [
    'tomato', 'mushroom', 'carrot', 'potato', 'lemon', 'lime', 'orange', 'apple',
    'banana', 'cucumber', 'pepper', 'aubergine', 'eggplant', 'zucchini', 'courgette',
    'fennel', 'spinach', 'lettuce', 'celery', 'bean', 'pea', 'corn', 'broccoli', 'cabbage'
  ]
};

const CATEGORY_WEATHER = {
  Beef: ['rain', 'cold'],
  Lamb: ['rain', 'cold'],
  Pork: ['rain', 'cold', 'mild'],
  Soup: ['rain', 'cold'],
  Seafood: ['hot', 'mild', 'sunny'],
  Chicken: ['mild'],
  Pasta: ['mild', 'rain', 'cold'],
  Breakfast: ['mild'],
  Starter: ['hot', 'mild'],
  Vegetarian: ['hot', 'mild', 'sunny'],
  Vegan: ['hot', 'mild'],
  Dessert: ['mild'],
  Side: ['mild']
};

function inferCategory(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(INGREDIENT_CATEGORIES)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'dry_goods';
}

function parseMeasure(raw) {
  const text = (raw || '').trim();
  if (!text) return { amount: null, unit: '' };
  const match = text.match(/^([\d./\s]+)\s*(.*)$/);
  if (match) {
    const amountPart = match[1].trim();
    const unit = match[2].trim();
    const numeric = amountPart.includes('/')
      ? amountPart
      : parseFloat(amountPart.replace(',', '.'));
    return {
      amount: Number.isFinite(numeric) ? numeric : amountPart || null,
      unit: unit || (Number.isFinite(numeric) ? 'g' : '')
    };
  }
  return { amount: text, unit: '' };
}

function extractIngredients(meal) {
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    if (!name?.trim()) continue;
    const { amount, unit } = parseMeasure(meal[`strMeasure${i}`]);
    items.push({
      name: name.trim(),
      amount: amount ?? 1,
      unit: unit || 'pcs',
      category: inferCategory(name)
    });
  }
  return items;
}

function extractSteps(instructions) {
  const chunks = (instructions || '')
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!chunks.length) {
    return [{ text: instructions || 'Prepare according to source recipe.', time_minutes: 15, video: null }];
  }
  return chunks.map((text, i) => ({
    text,
    time_minutes: Math.max(5, Math.min(45, 10 + i * 5)),
    video: null
  }));
}


function slugify(name, idMeal) {
  const base = (name || 'meal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || `meal-${idMeal}`;
}

function inferMealTypeFromCategory(category, tags) {
  const text = `${category} ${tags || ''}`.toLowerCase();
  const types = new Set(['dinner']);
  if (/breakfast|brunch|pancake|egg/.test(text)) {
    types.add('breakfast');
    types.add('brunch');
  }
  if (/starter|snack|salad|appetizer/.test(text)) types.add('snack');
  if (/lunch|soup/.test(text)) types.add('lunch');
  return [...types];
}

function isPreferredSource(url, domains) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return domains.some((d) => lower.includes(d));
}

function extractSourceLabel(url) {
  if (url.includes('bbcgoodfood')) return 'BBC Good Food';
  if (url.includes('goodtoknow')) return 'GoodtoKnow';
  if (url.includes('jamieoliver')) return 'Jamie Oliver';
  return 'TheMealDB';
}

export function buildMetaFromMeal(meal, discovery) {
  const category = meal.strCategory || 'Miscellaneous';
  const weather = CATEGORY_WEATHER[category] || ['mild'];
  const sourceUrl = meal.strSource || '';
  const preferred = isPreferredSource(sourceUrl, discovery.preferredSourceDomains || []);

  return {
    slug: slugify(meal.strMeal, meal.idMeal),
    rating: preferred ? 4.5 : null,
    source_label_en: preferred ? extractSourceLabel(sourceUrl) : 'TheMealDB',
    technique_en: category,
    weather_tags: weather,
    meal_type: inferMealTypeFromCategory(category, meal.strTags),
    exclude_tags: [],
    name_en: meal.strMeal,
    description_en: meal.strInstructions?.slice(0, 160) || meal.strMeal
  };
}

export function mapMealToRecipe(meal, meta) {
  const ingredients = extractIngredients(meal);

  return enrichRecipeComplexity({
    id: meta.slug || `meal-${meal.idMeal}`,
    idMeal: meal.idMeal,
    name: meta.name_en || meal.strMeal,
    description: meta.description_en || meal.strInstructions?.slice(0, 160),
    image: meal.strMealThumb,
    technique: meta.technique_en || meal.strCategory,
    flavor_profile: meal.strTags?.replace(/,/g, ', ') || meal.strArea || '',
    weather_tags: meta.weather_tags || ['mild'],
    exclude_tags: inferRecipeExcludeTags({
      name: meta.name_en || meal.strMeal,
      description: meta.description_en,
      ingredients,
      exclude_tags: meta.exclude_tags || []
    }),
    weather_trigger: {},
    meal_type: meta.meal_type || ['dinner'],
    base_portions: 2,
    rating: meta.rating ?? null,
    tier: meta.tier,
    chef: meta.chef,
    source: {
      name: meta.source_label_en || 'TheMealDB',
      url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      provider: 'TheMealDB',
      area: meal.strArea,
      category: meal.strCategory
    },
    youtube: meal.strYoutube || null,
    external: true,
    ingredients,
    steps: extractSteps(meal.strInstructions)
  });
}

export async function fetchMealById(idMeal) {
  const url = `${API_BASE}/lookup.php?i=${idMeal}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`TheMealDB HTTP ${response.status}`);
  const data = await response.json();
  const meal = data?.meals?.[0];
  if (!meal) throw new Error(`Meal ${idMeal} not found`);
  return meal;
}

export async function loadCatalog() {
  const response = await fetch('./data/recipe-catalog.json');
  if (!response.ok) throw new Error('recipe-catalog.json missing');
  return response.json();
}

export function getRecipeSourceLabel(recipe) {
  if (recipe.isCustomized) return 'Customized';
  if (recipe.external && recipe.source?.name) return recipe.source.name;
  return 'Curated';
}

export function getRecipeSourceUrl(recipe) {
  return recipe.source?.url || null;
}
