#!/usr/bin/env node
/**
 * Diet preference filter tests.
 * Run: node scripts/test-diet-preferences.js
 */

const path = require('path');
const { pathToFileURL } = require('url');

async function loadEsm(relPath) {
  return import(pathToFileURL(path.join(__dirname, '..', relPath)).href);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { recipeMatchesDietPreferences } = await loadEsm('js/diet-preferences.js');

  const beef = { name: 'Beef Steak', ingredients: [{ name: 'beef' }], exclude_tags: [] };
  const veg = { name: 'Roasted Vegetable Medley', ingredients: [{ name: 'carrot' }, { name: 'olive oil' }], exclude_tags: [] };
  const salmon = { name: 'Grilled Salmon', ingredients: [{ name: 'salmon' }], exclude_tags: [] };
  const pasta = { name: 'Creamy Pasta', ingredients: [{ name: 'spaghetti' }, { name: 'cream' }], exclude_tags: [] };
  const veganSalad = { name: 'Vegan Buddha Bowl', ingredients: [{ name: 'chickpeas' }, { name: 'kale' }], exclude_tags: [] };
  const omelette = { name: 'French Omelette', ingredients: [{ name: 'eggs' }], exclude_tags: [] };

  assert(!recipeMatchesDietPreferences(beef, ['vegetarian']), 'beef not vegetarian');
  assert(recipeMatchesDietPreferences(veg, ['vegetarian']), 'veg ok vegetarian');
  assert(!recipeMatchesDietPreferences(salmon, ['vegetarian']), 'salmon not vegetarian');
  assert(recipeMatchesDietPreferences(salmon, ['pescatarian']), 'salmon pescatarian');
  assert(!recipeMatchesDietPreferences(beef, ['pescatarian']), 'beef not pescatarian');

  assert(recipeMatchesDietPreferences(veganSalad, ['vegan']), 'vegan bowl');
  assert(!recipeMatchesDietPreferences(omelette, ['vegan']), 'omelette not vegan');
  assert(!recipeMatchesDietPreferences(pasta, ['vegan']), 'cream pasta not vegan');

  assert(!recipeMatchesDietPreferences(pasta, ['low_carb']), 'pasta not low carb');
  assert(recipeMatchesDietPreferences(veg, ['low_carb']), 'veg low carb');

  console.log('test-diet-preferences: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
