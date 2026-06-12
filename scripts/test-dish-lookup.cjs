#!/usr/bin/env node
/**
 * Dish lookup unit tests (no live Spoonacular calls).
 * Run: node scripts/test-dish-lookup.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadEsm(relPath) {
  return import(pathToFileURL(path.join(__dirname, '..', relPath)).href);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stubLocalStorage() {
  const data = {};
  global.localStorage = {
    getItem(key) {
      return data[key] ?? null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    }
  };
}

async function main() {
  stubLocalStorage();

  const commonDishesPath = path.join(__dirname, '..', 'data/common-dishes.json');
  global.fetch = async (url) => {
    if (String(url).includes('common-dishes.json')) {
      const body = fs.readFileSync(commonDishesPath, 'utf8');
      return { ok: true, json: async () => JSON.parse(body) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const { normalizeDishQuery, lookupBundledDish, estimateNutritionFromRecipe } =
    await loadEsm('js/dish-lookup.js');
  const { extractNutrientsFromSpoonacular } = await loadEsm('js/spoonacular-api.js');
  const { addFoodLogEntry, getFoodLogForDate, getFoodLogDailyTotals } = await loadEsm('js/storage.js');

  assert(normalizeDishQuery('  Chicken Tikka Masala! ') === 'chicken tikka masala', 'normalize query');
  assert(normalizeDishQuery('Pho') === 'pho', 'normalize pho');

  const nutrients = extractNutrientsFromSpoonacular({
    nutrients: [
      { name: 'Calories', amount: 480 },
      { name: 'Protein', amount: 32.4 }
    ]
  });
  assert(nutrients.caloriesKcal === 480, 'extract calories');
  assert(nutrients.proteinG === 32, 'extract protein rounded');

  const tikka = await lookupBundledDish('chicken tikka masala');
  assert(tikka?.proteinG === 32, 'bundled tikka protein');
  assert(tikka?.caloriesKcal === 480, 'bundled tikka calories');

  const kebab = await lookupBundledDish('döner kebab');
  assert(kebab?.label === 'Kebab', 'bundled kebab alias');

  const recipeEst = estimateNutritionFromRecipe({
    id: 'test',
    name: 'Grilled Salmon',
    ingredients: [{ name: 'salmon' }, { name: 'lemon' }, { name: 'dill' }],
    base_portions: 2
  });
  assert(recipeEst.proteinG > 10, 'recipe estimate protein');
  assert(recipeEst.caloriesKcal > 200, 'recipe estimate calories');
  assert(recipeEst.estimated === true, 'recipe estimate flag');

  addFoodLogEntry({
    id: 'e1',
    query: 'pho',
    label: 'Pho',
    proteinG: 24,
    caloriesKcal: 420,
    source: 'bundled',
    createdAt: Date.now()
  });
  assert(getFoodLogForDate().length === 1, 'food log entry saved');
  const totals = getFoodLogDailyTotals();
  assert(totals.proteinG === 24 && totals.caloriesKcal === 420, 'food log totals');

  console.log('test-dish-lookup: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
