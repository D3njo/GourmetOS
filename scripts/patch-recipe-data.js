#!/usr/bin/env node
/**
 * Patches committed recipe data with editorial fields and non-generic descriptions.
 * Run: node scripts/patch-recipe-data.js
 */

const fs = require('fs');
const path = require('path');
const { enrichEditorialFields, ensureDescription } = require('./lib/editorial-inference.cjs');
const { inferFromEntry } = require('./lib/exclusions-inference.cjs');

const ROOT = path.join(__dirname, '..');

function entryToBundledStub(entry) {
  return {
    id: entry.id,
    idMeal: entry.idMeal,
    name: entry.name,
    description: entry.description,
    image: entry.image,
    technique: entry.technique,
    weather_tags: entry.weather_tags,
    weather_primary: entry.weather_primary,
    meal_type: entry.meal_type,
    exclude_tags: entry.exclude_tags || [],
    effort: entry.effort,
    ingredientCount: entry.ingredientCount,
    totalMinutes: entry.totalMinutes,
    rating: entry.rating,
    tier: entry.tier,
    qualityScore: entry.qualityScore,
    chef: entry.chef,
    cuisine: entry.cuisine,
    fineDiningMeta: entry.fineDiningMeta,
    taste_profile: entry.taste_profile,
    why_this_works: entry.why_this_works,
    chef_move: entry.chef_move,
    occasion: entry.occasion,
    skill_focus: entry.skill_focus,
    mise_en_place: entry.mise_en_place,
    weather_mood: entry.weather_mood,
    source: entry.source,
    flavor_profile: entry.cuisine || '',
    base_portions: 2,
    ingredients: [],
    steps: [],
    hasFullData: false,
    onlineOnly: true,
    external: true
  };
}

function loadJson(rel) {
  const file = path.join(ROOT, rel);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2), 'utf8');
}

const catalog = loadJson('data/recipe-catalog.json');
const overrides = {};
for (const m of catalog.meals || []) {
  overrides[m.idMeal] = m;
}

const index = loadJson('data/recipe-index.json');
let indexUpdated = 0;

index.entries = (index.entries || []).map((entry) => {
  const override = overrides[entry.idMeal] || {};
  const merged = {
    ...entry,
    ...override,
    name: entry.name,
    id: entry.id,
    idMeal: entry.idMeal,
    technique: override.technique_en || entry.technique,
    weather_primary: entry.weather_primary || override.weather_primary || 'mild',
    effort: entry.effort || override.effort || 'medium',
    cuisine: entry.cuisine || override.cuisine || null
  };

  const context = {
    weatherTag: merged.weather_primary,
    effortLevel: merged.effort
  };

  const editorial = enrichEditorialFields(merged, context);
  const description = ensureDescription(
    { ...merged, description: override.description_en || entry.description },
    context
  );

  const next = {
    ...merged,
    ...editorial,
    description,
    technique: editorial.technique || merged.technique,
    exclude_tags: inferFromEntry({
      name: merged.name,
      name_en: override.name_en || merged.name_en,
      name_de: override.name_de || merged.name_de,
      description: override.description_en || null,
      exclude_tags: override.exclude_tags || []
    })
  };

  if (JSON.stringify(next) !== JSON.stringify(entry)) indexUpdated++;
  return next;
});

saveJson('data/recipe-index.json', index);

const indexById = new Map(index.entries.map((e) => [e.id, e]));
const bundled = loadJson('data/recipes-bundled.json');
let bundledUpdated = 0;

bundled.recipes = (bundled.recipes || []).map((recipe) => {
  const entry = indexById.get(recipe.id);
  if (!entry) {
    return entryToBundledStub({
      ...recipe,
      ingredients: [],
      steps: [],
      hasFullData: false,
      onlineOnly: true
    });
  }

  const context = {
    weatherTag: entry.weather_primary,
    effortLevel: entry.effort
  };
  const editorial = enrichEditorialFields(entry, context);
  const description = ensureDescription(
    { ...entry, description: entry.description },
    context
  );

  const next = entryToBundledStub({
    ...entry,
    ...editorial,
    description,
    technique: editorial.technique || entry.technique
  });

  if (JSON.stringify(next) !== JSON.stringify(recipe)) bundledUpdated++;
  return next;
});

saveJson('data/recipes-bundled.json', bundled);

console.log(`Patched recipe-index.json (${indexUpdated} entries updated)`);
console.log(`Patched recipes-bundled.json (${bundledUpdated} recipes updated)`);
