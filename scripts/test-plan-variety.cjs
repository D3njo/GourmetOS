#!/usr/bin/env node
/**
 * Plan variety tests — weighted pick + recent-recipe penalties.
 * Run: node scripts/test-plan-variety.cjs
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

function makeRecipe(id, overrides = {}) {
  return {
    id,
    name: id,
    weather_primary: 'mild',
    meal_type: ['dinner'],
    effort: 'medium',
    ingredients: [{ name: 'Salt' }],
    exclude_tags: [],
    ...overrides
  };
}

async function main() {
  stubLocalStorage();

  const { pickWeightedRecipeId, pickFromRankedList } = await loadEsm('js/recipe-picker.js');
  const { rankRecipes, scoreRecipe } = await loadEsm('js/recommendation-engine.js');
  const { recordPlanRecipeIds, getRecentRecipeScorePenalty } = await loadEsm('js/storage.js');

  const candidates = [
    { id: 'premium-top', _recScore: 20 },
    { id: 'premium-second', _recScore: 18 },
    { id: 'standard-a', _recScore: 12 },
    { id: 'standard-b', _recScore: 11 },
    { id: 'standard-c', _recScore: 10 }
  ];

  const picks = new Set();
  for (let i = 0; i < 40; i++) {
    const id = pickWeightedRecipeId(candidates);
    if (id) picks.add(id);
  }
  assert(picks.size > 1, 'weighted pick should not always return the same recipe');
  assert(picks.has('premium-top'), 'top scorer should still appear sometimes');

  const pool = [
    makeRecipe('french-onion-soup', {
      tier: 'premium',
      qualityScore: 9.4,
      rating: 4.8,
      fineDiningMeta: { style: 'haute-cuisine' },
      weather_primary: 'cold'
    }),
    makeRecipe('pasta-a', { weather_primary: 'cold', qualityScore: 6, rating: 4 }),
    makeRecipe('pasta-b', { weather_primary: 'cold', qualityScore: 5.5, rating: 3.9 }),
    makeRecipe('stew-a', { weather_primary: 'cold', qualityScore: 5, rating: 4 }),
    makeRecipe('stew-b', { weather_primary: 'cold', qualityScore: 4.8, rating: 3.8 }),
    makeRecipe('soup-a', { weather_primary: 'cold' }),
    makeRecipe('soup-b', { weather_primary: 'cold' }),
    makeRecipe('roast-a', { weather_primary: 'cold' }),
    makeRecipe('roast-b', { weather_primary: 'cold' }),
    makeRecipe('grain-a', { weather_primary: 'cold' }),
    makeRecipe('grain-b', { weather_primary: 'cold' }),
    makeRecipe('salad-a', { weather_primary: 'cold' }),
    makeRecipe('salad-b', { weather_primary: 'cold' }),
    makeRecipe('fish-a', { weather_primary: 'cold' }),
    makeRecipe('fish-b', { weather_primary: 'cold' })
  ];

  const rankedPicks = new Set();
  for (let i = 0; i < 30; i++) {
    const ranked = rankRecipes(pool, {
      weatherTag: 'cold',
      mealType: 'dinner',
      effortLevel: 'medium',
      dayIndex: 0
    });
    const id = pickFromRankedList(ranked, 0);
    if (id) rankedPicks.add(id);
  }
  assert(rankedPicks.size > 1, 'ranked weighted pick should vary across runs');

  recordPlanRecipeIds(['french-onion-soup'], '2026-06-10');
  const penalty = getRecentRecipeScorePenalty('french-onion-soup', new Date('2026-06-12'));
  assert(penalty === -8, `expected -8 recent penalty within 7 days, got ${penalty}`);

  stubLocalStorage();
  const { recordPlanRecipeIds: recordFresh, getRecentRecipeScorePenalty: penaltyFresh } =
    await loadEsm('js/storage.js');
  const { scoreRecipe: scoreFresh } = await loadEsm('js/recommendation-engine.js');

  const recipe = makeRecipe('thai-green-curry', {
    tier: 'premium',
    qualityScore: 9,
    rating: 4.5,
    weather_primary: 'mild'
  });
  const ctx = { weatherTag: 'mild', mealType: 'dinner', effortLevel: 'medium' };
  const before = scoreFresh(recipe, ctx).score;
  assert(penaltyFresh('thai-green-curry') === 0, 'fresh recipe should have no recent penalty');
  recordFresh(['thai-green-curry'], '2026-06-12');
  const after = scoreFresh(recipe, ctx).score;
  assert(after < before, 'recently served recipe should score lower after recordPlanRecipeIds');
  assert(penaltyFresh('thai-green-curry', new Date('2026-06-12')) === -8, 'same-day penalty is -8');

  console.log('test-plan-variety: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
