#!/usr/bin/env node
/**
 * Exclusion filter tests (all presets + plan sanitize).
 * Run: node scripts/test-exclusions.js
 */

const path = require('path');
const { pathToFileURL } = require('url');

async function loadEsm(relPath) {
  const full = path.join(__dirname, '..', relPath);
  return import(pathToFileURL(full).href);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const PRESET_SAMPLES = {
  fish: { name: 'Grilled Salmon', allowed: false },
  shellfish: { name: 'Laksa King Prawn Noodles', allowed: false },
  beef: { name: 'Beef Wellington', allowed: false },
  pork: { name: 'Pork Chops with Bacon', allowed: false },
  duck: { name: 'Duck Breast Orange', allowed: false },
  gluten: { name: 'Spaghetti Carbonara', allowed: false },
  dairy: { name: 'Creamy Parmesan Pasta', allowed: false },
  eggs: { name: 'French Omelette', allowed: false },
  coriander: { name: 'Salad with fresh Coriander', allowed: false }
};

async function main() {
  const {
    inferRecipeExcludeTags,
    recipeMatchesExclusions,
    isRecipeAllowed,
    sanitizePlanSelections,
    EXCLUSION_PRESET_IDS,
    ingredientViolatesExclusions,
    filterAllowedIngredients
  } = await loadEsm('js/exclusions.js');
  const { recipeMatchesDietPreferences } = await loadEsm('js/diet-preferences.js');

  assert(EXCLUSION_PRESET_IDS.length === 9, 'nine presets');

  for (const [tag, sample] of Object.entries(PRESET_SAMPLES)) {
    const recipe = { name: sample.name, ingredients: [], exclude_tags: [] };
    const inferred = inferRecipeExcludeTags(recipe);
    assert(inferred.includes(tag), `${tag} inferred for ${sample.name}: ${inferred.join(',')}`);
    assert(
      recipeMatchesExclusions(recipe, [tag], []) === sample.allowed,
      `${tag} match for ${sample.name}`
    );
  }

  const laksa = {
    id: 'laksa',
    name: 'Laksa King Prawn Noodles',
    ingredients: [],
    exclude_tags: ['shellfish', 'fish']
  };
  assert(!isRecipeAllowed(laksa, { presetTags: ['fish', 'shellfish'] }), 'laksa blocked');

  const veg = { name: 'Roasted Vegetable Medley', ingredients: [{ name: 'carrot' }], exclude_tags: [] };
  const beef = { name: 'Beef Steak', ingredients: [{ name: 'beef' }], exclude_tags: [] };
  assert(isRecipeAllowed(veg, { presetTags: ['fish', 'shellfish'] }), 'veg allowed');

  const recipesById = new Map([
    ['laksa', laksa],
    ['veg', veg]
  ]);
  const sanitized = sanitizePlanSelections(
    { monday: ['laksa', 'veg'], tuesday: ['laksa'] },
    { presetTags: ['shellfish'], recipesById }
  );
  assert(sanitized.monday.length === 1 && sanitized.monday[0] === 'veg', 'sanitize monday');
  assert(sanitized.tuesday.length === 0, 'sanitize tuesday');

  const nuts = { name: 'Walnut Salad', ingredients: [], exclude_tags: [] };
  assert(!isRecipeAllowed(nuts, { presetTags: [], customTerms: ['walnut'] }), 'custom walnut');

  assert(!isRecipeAllowed(beef, { presetTags: [], dietPreferences: ['vegetarian'] }), 'diet+allowed gate');
  assert(
    isRecipeAllowed(veg, { presetTags: ['fish'], dietPreferences: ['vegetarian'] }),
    'veg vegetarian still ok without fish tag'
  );

  const stubCurry = { name: 'Thai Green Curry', ingredients: [], exclude_tags: [] };
  assert(
    isRecipeAllowed(stubCurry, { presetTags: ['shellfish'] }),
    'stub without ingredients may pass name-only'
  );
  assert(
    isRecipeAllowed(stubCurry, { dietPreferences: ['vegetarian'] }),
    'stub curry may pass vegetarian on name alone'
  );

  const seaBass = { name: 'Sea bass with ginger', ingredients: [], exclude_tags: [] };
  assert(!recipeMatchesDietPreferences(seaBass, ['vegetarian']), 'sea bass blocked for vegetarian');
  assert(!isRecipeAllowed(seaBass, { dietPreferences: ['vegetarian'] }), 'isRecipeAllowed sea bass');

  const barramundi = {
    name: 'Barramundi with Moroccan spices',
    technique_en: 'Seafood',
    ingredients: [],
    exclude_tags: []
  };
  const oxtail = {
    name: 'Oxtail with broad beans',
    description: 'Toss the oxtail with onion.',
    ingredients: [],
    exclude_tags: []
  };
  assert(inferRecipeExcludeTags(barramundi).includes('fish'), 'barramundi infers fish');
  assert(inferRecipeExcludeTags(oxtail).includes('beef'), 'oxtail infers beef');
  assert(!isRecipeAllowed(barramundi, { dietPreferences: ['vegetarian'] }), 'barramundi blocked');
  assert(!isRecipeAllowed(oxtail, { dietPreferences: ['vegan'] }), 'oxtail blocked vegan');

  const fullCurry = {
    name: 'Thai Green Curry',
    ingredients: [{ name: 'Raw King Prawns' }, { name: 'Jasmine Rice' }],
    exclude_tags: []
  };
  assert(!isRecipeAllowed(fullCurry, { presetTags: ['fish', 'shellfish'] }), 'full recipe blocked');
  assert(!isRecipeAllowed(fullCurry, { dietPreferences: ['vegetarian'] }), 'full curry blocked vegetarian');

  assert(ingredientViolatesExclusions('Raw King Prawns', { presetTags: ['shellfish'] }), 'ingredient prawn');
  const filtered = filterAllowedIngredients(fullCurry.ingredients, { presetTags: ['shellfish'] });
  assert(filtered.length === 1 && filtered[0].name.includes('Rice'), 'filter keeps rice');

  console.log('test-exclusions: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
