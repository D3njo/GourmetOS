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
  const { recipeMatchesDietPreferences } = await loadEsm('js/diet-preferences.js');
  const { getRecipeOptions } = await loadEsm('js/recipes.js');
  const { savePreferences } = await loadEsm('js/storage.js');

  const beef = { name: 'Beef Steak', ingredients: [{ name: 'beef' }], exclude_tags: [] };
  const veg = {
    name: 'Roasted Vegetable Medley',
    ingredients: [{ name: 'carrot' }, { name: 'olive oil' }],
    exclude_tags: [],
    weather_primary: 'mild',
    meal_type: ['dinner']
  };
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

  const seaBass = { name: 'Sea bass with ginger', ingredients: [], exclude_tags: [] };
  const haddock = { name: 'Smoked Haddock Kedgeree', ingredients: [], exclude_tags: [] };
  const saltfish = { name: 'Saltfish and Ackee', ingredients: [], exclude_tags: [] };
  const sardines = { name: 'Grilled Portuguese sardines', ingredients: [], exclude_tags: [] };
  const anchovySalad = {
    name: 'Mediterranean Salad',
    ingredients: [{ name: 'anchovies' }],
    exclude_tags: []
  };

  assert(!recipeMatchesDietPreferences(seaBass, ['vegetarian']), 'sea bass not vegetarian');
  assert(!recipeMatchesDietPreferences(haddock, ['vegetarian']), 'haddock not vegetarian');
  assert(!recipeMatchesDietPreferences(saltfish, ['vegetarian']), 'saltfish not vegetarian');
  assert(!recipeMatchesDietPreferences(sardines, ['vegetarian']), 'sardines not vegetarian');
  assert(!recipeMatchesDietPreferences(anchovySalad, ['vegetarian']), 'anchovies not vegetarian');

  const barramundiStub = {
    name: 'Barramundi with Moroccan spices',
    technique_en: 'Seafood',
    description: 'Balanced and versatile — fresh flavors via sear & butter, suited to medium effort.',
    ingredients: [],
    exclude_tags: []
  };
  const barramundiFull = {
    name: 'Barramundi with Moroccan spices',
    ingredients: [{ name: 'Barramundi fillets' }],
    exclude_tags: []
  };
  const oxtailStub = {
    name: 'Oxtail with broad beans',
    description: 'Toss the oxtail with the onion and garlic.',
    ingredients: [],
    exclude_tags: []
  };
  const oxtailFull = {
    name: 'Oxtail with broad beans',
    ingredients: [{ name: 'Oxtail' }],
    exclude_tags: []
  };

  assert(!recipeMatchesDietPreferences(barramundiStub, ['vegetarian']), 'barramundi stub not vegetarian');
  assert(!recipeMatchesDietPreferences(barramundiStub, ['vegan']), 'barramundi stub not vegan');
  assert(!recipeMatchesDietPreferences(barramundiFull, ['vegetarian']), 'barramundi full not vegetarian');
  assert(!recipeMatchesDietPreferences(oxtailStub, ['vegetarian']), 'oxtail stub not vegetarian');
  assert(!recipeMatchesDietPreferences(oxtailStub, ['vegan']), 'oxtail stub not vegan');
  assert(!recipeMatchesDietPreferences(oxtailFull, ['vegetarian']), 'oxtail full not vegetarian');
  assert(recipeMatchesDietPreferences(salmon, ['pescatarian']), 'salmon ok pescatarian');
  assert(!recipeMatchesDietPreferences(oxtailStub, ['pescatarian']), 'oxtail not pescatarian');

  assert(!recipeMatchesDietPreferences({ name: 'Gambas al ajillo', ingredients: [] }, ['vegetarian']), 'gambas');
  assert(
    !recipeMatchesDietPreferences({ name: 'Arroz con gambas y calamar', ingredients: [] }, ['vegetarian']),
    'gambas calamar'
  );
  assert(
    !recipeMatchesDietPreferences({ name: 'Pilchard puttanesca', ingredients: [] }, ['vegetarian']),
    'pilchard'
  );
  assert(
    !recipeMatchesDietPreferences({ name: 'Sledz w Oleju (Polish Herrings)', ingredients: [] }, ['vegetarian']),
    'herrings'
  );
  assert(
    !recipeMatchesDietPreferences({ name: 'Syrian Rice with Meat', ingredients: [] }, ['vegetarian']),
    'generic meat title'
  );
  assert(
    !recipeMatchesDietPreferences({ name: 'Bitterballen (Dutch meatballs)', ingredients: [] }, ['vegetarian']),
    'meatballs'
  );

  assert(
    recipeMatchesDietPreferences({ name: 'Kidney Bean Curry', ingredients: [{ name: 'kidney beans' }] }, ['vegetarian']),
    'kidney bean curry ok'
  );

  const stubCurry = { name: 'Thai Green Curry', ingredients: [], exclude_tags: [] };
  const fullCurry = {
    name: 'Thai Green Curry',
    ingredients: [{ name: 'Raw King Prawns' }, { name: 'Jasmine Rice' }],
    exclude_tags: []
  };
  assert(recipeMatchesDietPreferences(stubCurry, ['vegetarian']), 'stub curry name-only may pass');
  assert(!recipeMatchesDietPreferences(fullCurry, ['vegetarian']), 'full curry with prawns blocked');

  savePreferences({ dietPreferences: ['vegetarian'], excludedTags: [], customExclusions: [] });

  const fishDish = {
    id: 'sea-bass',
    name: 'Sea bass with ginger',
    weather_primary: 'mild',
    meal_type: ['dinner'],
    ingredients: [],
    exclude_tags: []
  };
  const barramundiDish = {
    id: 'barramundi',
    name: 'Barramundi with Moroccan spices',
    weather_primary: 'mild',
    meal_type: ['dinner'],
    ingredients: [],
    exclude_tags: []
  };
  const oxtailDish = {
    id: 'oxtail',
    name: 'Oxtail with broad beans',
    weather_primary: 'mild',
    meal_type: ['dinner'],
    ingredients: [],
    exclude_tags: []
  };
  const vegDish = { ...veg, id: 'veg-bowl' };
  const options = getRecipeOptions([fishDish, barramundiDish, oxtailDish, vegDish], {
    weatherTag: 'mild',
    limit: 5
  });
  assert(!options.some((o) => o.id === 'sea-bass'), 'options exclude sea bass');
  assert(!options.some((o) => o.id === 'barramundi'), 'options exclude barramundi');
  assert(!options.some((o) => o.id === 'oxtail'), 'options exclude oxtail');
  assert(options.some((o) => o.id === 'veg-bowl'), 'options include veg');

  savePreferences({ dietPreferences: [], excludedTags: [], customExclusions: [] });

  console.log('test-diet-preferences: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
