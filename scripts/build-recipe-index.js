#!/usr/bin/env node
/**
 * Builds data/recipe-index.json and data/recipes-bundled.json from TheMealDB.
 * Run: node scripts/build-recipe-index.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { enrichEditorialFields, ensureDescription } = require('./lib/editorial-inference.cjs');

const ROOT = path.join(__dirname, '..');
const API = 'https://www.themealdb.com/api/json/v1/1';

const PREMIUM_DOMAINS = [
  'bbcgoodfood.com',
  'goodtoknow.co.uk',
  'jamieoliver.com',
  'seriouseats.com',
  'gordonramsay.com',
  'bbc.co.uk/food'
];

const BUNDLED_COUNT = 120;
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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function slugify(name, idMeal) {
  const base = (name || 'meal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || `meal-${idMeal}`;
}

function uniqueSlug(baseSlug, idMeal, usedSlugs) {
  let slug = baseSlug;
  if (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${idMeal}`;
  }
  if (usedSlugs.has(slug)) {
    slug = `meal-${idMeal}`;
  }
  usedSlugs.add(slug);
  return slug;
}

function isPremium(url, override = {}) {
  if (override.tier === 'premium') return true;
  if (!url) return false;
  const lower = url.toLowerCase();
  return PREMIUM_DOMAINS.some((d) => lower.includes(d));
}

function computeQualityScore(meal, override, premium, effort, fineDining = {}) {
  let score = 0;
  if (premium) score += 3;
  if (override.rating) score += override.rating / 2;
  if (effort === 'elaborate') score += 2;
  if (effort === 'medium') score += 0.5;
  const area = meal.strArea || override.cuisine;
  if (area && (fineDining.cuisineBoost || []).includes(area)) score += 2;
  if (override.fineDiningMeta?.style === 'haute-cuisine') score += 1.5;
  const ic = countIngredients(meal);
  if (ic >= 8 && ic <= 18) score += 1;
  if (override.chef) score += 0.5;
  if (override.description_en && override.description_en !== (override.name_en || meal.strMeal)) {
    score += 0.5;
  }
  return score;
}

function extractSourceLabel(url) {
  if (url.includes('bbcgoodfood')) return 'BBC Good Food';
  if (url.includes('goodtoknow')) return 'GoodtoKnow';
  if (url.includes('jamieoliver')) return 'Jamie Oliver';
  return 'TheMealDB';
}

function inferMealType(category, tags) {
  const text = `${category} ${tags || ''}`.toLowerCase();
  const types = ['dinner'];
  if (/breakfast|brunch|pancake|egg/.test(text)) types.push('breakfast', 'brunch');
  if (/starter|snack|salad/.test(text)) types.push('snack');
  if (/lunch|soup/.test(text)) types.push('lunch');
  return [...new Set(types)];
}

function computeEffort(ingredientCount, stepCount) {
  const mins = Math.max(15, stepCount * 12);
  if (mins > 90 || ingredientCount >= 14) return 'elaborate';
  if (mins <= 45 && ingredientCount <= 8) return 'quick';
  return 'medium';
}

function countIngredients(meal) {
  let n = 0;
  for (let i = 1; i <= 20; i++) {
    if (meal[`strIngredient${i}`]?.trim()) n++;
  }
  return n;
}

function stepCount(meal) {
  return (meal.strInstructions || '').split(/\r?\n+/).filter(Boolean).length || 3;
}

async function crawlAllMeals() {
  const byId = new Map();
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  for (const letter of letters) {
    const data = await fetchJson(`${API}/search.php?f=${letter}`);
    for (const m of data.meals || []) {
      byId.set(m.idMeal, m);
    }
    process.stdout.write(`Letter ${letter}: ${byId.size} total\r`);
  }
  console.log(`\nCrawled ${byId.size} unique meals`);
  return [...byId.values()];
}

function inferWeatherPrimary(weatherTags = []) {
  const tags = weatherTags || [];
  if (tags.some((t) => ['hot', 'sunny'].includes(t))) return 'hot';
  if (tags.some((t) => ['rain', 'cold'].includes(t))) return 'cold';
  return 'mild';
}

function mealToIndexEntry(meal, catalogOverrides = {}, fineDining = {}, usedSlugs) {
  const override = catalogOverrides[meal.idMeal] || {};
  const category = meal.strCategory || 'Miscellaneous';
  const premium = isPremium(meal.strSource, override);
  const ingredientCount = countIngredients(meal);
  const steps = stepCount(meal);
  const effort = computeEffort(ingredientCount, steps);
  const weather = override.weather_tags || CATEGORY_WEATHER[category] || ['mild'];
  const weather_primary = inferWeatherPrimary(weather);
  const qualityScore = computeQualityScore(meal, override, premium, effort, fineDining);
  const baseSlug = override.slug || slugify(override.name_en || meal.strMeal, meal.idMeal);
  const id = uniqueSlug(baseSlug, meal.idMeal, usedSlugs);

  const baseEntry = {
    id,
    idMeal: meal.idMeal,
    name: override.name_en || meal.strMeal,
    description: override.description_en || meal.strInstructions?.slice(0, 160) || meal.strMeal,
    image: meal.strMealThumb,
    technique: override.technique_en || category,
    weather_tags: weather,
    weather_primary,
    meal_type: override.meal_type || inferMealType(category, meal.strTags),
    exclude_tags: override.exclude_tags || [],
    effort,
    ingredientCount,
    totalMinutes: Math.max(15, steps * 12),
    rating: override.rating ?? (premium ? 4.5 : null),
    tier: premium || override.tier === 'premium' ? 'premium' : 'standard',
    qualityScore,
    chef: override.chef || null,
    cuisine: meal.strArea || override.cuisine || null,
    fineDiningMeta: override.fineDiningMeta || null,
    taste_profile: override.taste_profile || null,
    why_this_works: override.why_this_works || null,
    chef_move: override.chef_move || null,
    occasion: override.occasion || null,
    skill_focus: override.skill_focus || null,
    mise_en_place: override.mise_en_place || null,
    source: {
      name: override.source_label_en || extractSourceLabel(meal.strSource || ''),
      url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
      provider: 'TheMealDB',
      category
    },
    external: true,
    hasFullData: false
  };

  const editorial = enrichEditorialFields(baseEntry, { weatherTag: weather_primary, effortLevel: effort });
  const description = ensureDescription(
    { ...baseEntry, description: baseEntry.description },
    { weatherTag: weather_primary, effortLevel: effort }
  );
  return { ...baseEntry, ...editorial, description, technique: editorial.technique || baseEntry.technique };
}

function parseMeasure(raw) {
  const text = (raw || '').trim();
  if (!text) return { amount: 1, unit: 'pcs' };
  const match = text.match(/^([\d./\s]+)\s*(.*)$/);
  if (match) {
    const amountPart = match[1].trim();
    const unit = match[2].trim();
    const numeric = amountPart.includes('/')
      ? amountPart
      : parseFloat(amountPart.replace(',', '.'));
    return {
      amount: Number.isFinite(numeric) ? numeric : amountPart || 1,
      unit: unit || 'pcs'
    };
  }
  return { amount: text, unit: 'pcs' };
}

function mealToFullRecipe(meal, entry) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    if (!name?.trim()) continue;
    const { amount, unit } = parseMeasure(meal[`strMeasure${i}`]);
    ingredients.push({
      name: name.trim(),
      amount,
      unit: unit || 'pcs',
      category: 'produce'
    });
  }
  const steps = (meal.strInstructions || '')
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => ({ text, time_minutes: 10 + i * 5, video: null }));

  return {
    ...entry,
    description: entry.description || entry.name,
    flavor_profile: (meal.strTags || '').replace(/,/g, ', ') || meal.strArea || '',
    base_portions: 2,
    ingredients,
    steps: steps.length ? steps : [{ text: meal.strInstructions || '', time_minutes: 15, video: null }],
    youtube: meal.strYoutube || null,
    hasFullData: true
  };
}

async function main() {
  const catalogPath = path.join(ROOT, 'data/recipe-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const overrides = {};
  for (const m of catalog.meals || []) {
    overrides[m.idMeal] = m;
  }

  const fineDining = catalog.fineDining || {};
  if (fineDining.qualityDomains?.length) {
    for (const d of fineDining.qualityDomains) {
      if (!PREMIUM_DOMAINS.includes(d)) PREMIUM_DOMAINS.push(d);
    }
  }

  const meals = await crawlAllMeals();
  const usedSlugs = new Set();
  const indexEntries = meals.map((m) => mealToIndexEntry(m, overrides, fineDining, usedSlugs));
  indexEntries.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  const premiumCount = indexEntries.filter((e) => e.tier === 'premium').length;

  const indexOut = {
    version: catalog.version || 3,
    generatedAt: new Date().toISOString(),
    count: indexEntries.length,
    premiumCount,
    entries: indexEntries
  };

  fs.writeFileSync(
    path.join(ROOT, 'data/recipe-index.json'),
    JSON.stringify(indexOut, null, 2),
    'utf8'
  );
  console.log(`Wrote recipe-index.json (${indexEntries.length} entries, ${premiumCount} premium)`);

  const bundledEntries = [
    ...indexEntries.filter((e) => e.tier === 'premium'),
    ...indexEntries.filter((e) => e.tier !== 'premium')
  ].slice(0, BUNDLED_COUNT);
  const bundledRecipes = [];
  for (const entry of bundledEntries) {
    const meal = meals.find((m) => m.idMeal === entry.idMeal);
    if (meal) bundledRecipes.push(mealToFullRecipe(meal, entry));
  }
  fs.writeFileSync(
    path.join(ROOT, 'data/recipes-bundled.json'),
    JSON.stringify({ version: indexOut.version, recipes: bundledRecipes }, null, 2),
    'utf8'
  );
  console.log(`Wrote recipes-bundled.json (${bundledRecipes.length} recipes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
