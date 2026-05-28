#!/usr/bin/env node
/**
 * Home inventory matching tests.
 * Run: node scripts/test-home-inventory.js
 */

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

  const { saveHomeInventory, addHomeInventoryItems } = await loadEsm('js/storage.js');
  const {
    normalizeHomeIngredientName,
    recipeInventoryCoverage,
    homeIngredientBoost,
    isIngredientAtHome,
    missingIngredientsForRecipe
  } = await loadEsm('js/home-inventory.js');
  const { scoreRecipe } = await loadEsm('js/recommendation-engine.js');
  const { savePreferences } = await loadEsm('js/storage.js');
  const { isHighProteinRecipe, estimateProteinScore, highProteinBoost } = await loadEsm(
    'js/protein-preferences.js'
  );
  const { recipeMatchesDietPreferences } = await loadEsm('js/diet-preferences.js');

  assert(normalizeHomeIngredientName('  Greek Yogurt ') === 'greek yogurt', 'normalize');

  saveHomeInventory([]);
  addHomeInventoryItems(['eggs', 'rice', 'onions']);

  assert(isIngredientAtHome('rice'), 'rice match');
  assert(!isIngredientAtHome('salt'), 'salt not in inventory');

  const chickenRice = {
    name: 'Chicken fried rice',
    ingredients: [
      { name: 'chicken breast' },
      { name: 'rice' },
      { name: 'onion' },
      { name: 'soy sauce' },
      { name: 'salt' }
    ]
  };

  const cov = recipeInventoryCoverage(chickenRice);
  assert(cov.total === 4, 'pantry salt excluded from total');
  assert(cov.matched >= 2, 'rice/onion matched');
  assert(cov.coverage > 0.4, 'coverage positive');

  const missing = missingIngredientsForRecipe(chickenRice);
  assert(missing.length === cov.missing.length, 'missing list');

  const boost = homeIngredientBoost(chickenRice);
  assert(boost.boost > 0, 'home boost');

  savePreferences({ preferHomeIngredients: true, preferHighProtein: false });
  const ranked = scoreRecipe(chickenRice, {});
  assert(ranked.reasons.includes('usesHomeIngredients'), 'ranking uses home');

  const salad = {
    name: 'Green salad',
    ingredients: [{ name: 'lettuce' }, { name: 'cucumber' }],
    exclude_tags: []
  };
  const steak = {
    name: 'Grilled steak',
    ingredients: [{ name: 'beef steak' }, { name: 'butter' }]
  };
  const tofuBowl = {
    name: 'Tofu power bowl',
    ingredients: [{ name: 'tofu' }, { name: 'lentils' }, { name: 'kale' }]
  };
  const lentilTomato = {
    name: 'Lentil curry',
    ingredients: [{ name: 'lentils' }, { name: 'tomatoes' }]
  };

  assert(!isHighProteinRecipe(salad), 'salad not high protein');
  assert(isHighProteinRecipe(steak), 'steak high protein');
  assert(isHighProteinRecipe(tofuBowl), 'tofu bowl high protein');
  assert(estimateProteinScore(steak) > estimateProteinScore(salad), 'steak scores higher');
  assert(highProteinBoost(steak) > 0, 'steak boost');

  assert(recipeMatchesDietPreferences(steak, ['high_protein']), 'steak matches high_protein diet');
  assert(!recipeMatchesDietPreferences(salad, ['high_protein']), 'salad blocked high_protein');
  assert(recipeMatchesDietPreferences(tofuBowl, ['vegan', 'high_protein']), 'vegan high protein tofu');
  assert(recipeMatchesDietPreferences(lentilTomato, ['vegan', 'high_protein']), 'vegan lentil high protein');

  savePreferences({ preferHighProtein: true, preferHomeIngredients: false });
  const proteinRank = scoreRecipe(steak, {});
  assert(proteinRank.reasons.includes('highProtein'), 'high protein reason');

  console.log('test-home-inventory: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
