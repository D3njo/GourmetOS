#!/usr/bin/env node
/**
 * Validates recipe data files before release.
 * Run: node scripts/validate-data.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function loadJson(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    fail(`Missing file: ${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`${rel}: invalid JSON (${e.message})`);
    return null;
  }
}

const EDITORIAL_FIELDS = [
  'why_this_works',
  'chef_move',
  'taste_profile',
  'occasion',
  'skill_focus',
  'mise_en_place',
  'weather_mood'
];

const CATEGORY_TECHNIQUES = new Set([
  'Beef',
  'Lamb',
  'Pork',
  'Chicken',
  'Seafood',
  'Pasta',
  'Soup',
  'Vegetarian',
  'Vegan',
  'Dessert',
  'Breakfast',
  'Starter',
  'Side',
  'Miscellaneous'
]);

const GENERIC_DESCRIPTION_PATTERNS = [
  'chef-curated premium selection',
  'refined technique and balanced flavors'
];

const VALID_TASTES = ['bright', 'rich', 'fresh', 'smoky', 'comforting', 'clean', 'umami'];

function validateIndex(index) {
  const entries = index.entries || [];
  const ids = new Map();
  const idMeals = new Map();
  const bucketIds = { hot: new Set(), cold: new Set(), mild: new Set() };

  for (const e of entries) {
    if (!e.id) fail(`Index entry missing id (${e.name})`);
    if (!e.name) fail(`Index entry ${e.id} missing name`);
    if (!e.image) warn(`Index entry ${e.id} missing image`);
    if (!e.source?.url) warn(`Index entry ${e.id} missing source.url`);
    if (!e.weather_tags?.length) warn(`Index entry ${e.id} missing weather_tags`);
    if (!e.meal_type?.length) warn(`Index entry ${e.id} missing meal_type`);
    if (!e.tier) warn(`Index entry ${e.id} missing tier`);

    if (!e.weather_primary) {
      fail(`Index entry ${e.id} missing weather_primary`);
    } else if (!['hot', 'cold', 'mild'].includes(e.weather_primary)) {
      fail(`Index entry ${e.id} invalid weather_primary "${e.weather_primary}"`);
    } else {
      bucketIds[e.weather_primary].add(e.id);
    }

    if (ids.has(e.id)) {
      fail(`Duplicate index id "${e.id}" (${ids.get(e.id)} vs ${e.idMeal})`);
    } else {
      ids.set(e.id, e.idMeal);
    }

    if (e.idMeal) {
      if (idMeals.has(e.idMeal)) {
        fail(`Duplicate idMeal ${e.idMeal} for ids ${idMeals.get(e.idMeal)} and ${e.id}`);
      } else {
        idMeals.set(e.idMeal, e.id);
      }
    }

    if (e.tier === 'premium') {
      if (e.description && e.name && e.description.trim() === e.name.trim()) {
        fail(`Premium index entry ${e.id} has description equal to name`);
      }
      if (e.description && GENERIC_DESCRIPTION_PATTERNS.some((p) => e.description.includes(p))) {
        warn(`Premium index entry ${e.id} uses generic templated description`);
      }
      if (e.technique && CATEGORY_TECHNIQUES.has(e.technique)) {
        warn(`Index entry ${e.id} uses category label as technique: ${e.technique}`);
      }
      for (const field of EDITORIAL_FIELDS) {
        if (!e[field]) warn(`Premium index entry ${e.id} missing editorial field ${field}`);
      }
      if (e.taste_profile && !VALID_TASTES.includes(e.taste_profile)) {
        fail(`Index entry ${e.id} invalid taste_profile "${e.taste_profile}"`);
      }
      if (e.mise_en_place && !Array.isArray(e.mise_en_place)) {
        fail(`Index entry ${e.id} mise_en_place must be an array`);
      }
    }
  }

  const overlap = (a, b) => [...bucketIds[a]].filter((id) => bucketIds[b].has(id));
  const hotCold = overlap('hot', 'cold');
  const hotMild = overlap('hot', 'mild');
  const coldMild = overlap('cold', 'mild');
  if (hotCold.length) fail(`Bucket overlap hot/cold: ${hotCold.slice(0, 3).join(', ')}`);
  if (hotMild.length) fail(`Bucket overlap hot/mild: ${hotMild.slice(0, 3).join(', ')}`);
  if (coldMild.length) fail(`Bucket overlap cold/mild: ${coldMild.slice(0, 3).join(', ')}`);

  if (index.count !== entries.length) {
    warn(`Index count mismatch: header ${index.count} vs entries ${entries.length}`);
  }
}

function validateBundled(data) {
  for (const r of data.recipes || []) {
    if (!r.id) fail('Bundled recipe missing id');
    if (!r.weather_primary) fail(`Bundled recipe ${r.id} missing weather_primary`);
    if (!r.taste_profile) warn(`Bundled recipe ${r.id} missing taste_profile`);
    if (!r.why_this_works) warn(`Bundled recipe ${r.id} missing why_this_works`);
    if (!r.ingredients?.length) fail(`Bundled recipe ${r.id} missing ingredients`);
    if (!r.steps?.length) fail(`Bundled recipe ${r.id} missing steps`);
    for (const ing of r.ingredients || []) {
      if (ing.unit === 'Stk') warn(`Bundled recipe ${r.id} uses German unit Stk`);
    }
  }
}

function validateCatalog(catalog) {
  const idMeals = new Set();
  for (const m of catalog.meals || []) {
    if (!m.idMeal) fail(`Catalog seed ${m.slug} missing idMeal`);
    if (idMeals.has(m.idMeal)) fail(`Catalog duplicate idMeal ${m.idMeal}`);
    idMeals.add(m.idMeal);
    if (!m.name_en && !m.name) warn(`Catalog seed ${m.slug} missing English name`);
  }
}

const index = loadJson('data/recipe-index.json');
const bundled = loadJson('data/recipes-bundled.json');
const catalog = loadJson('data/recipe-catalog.json');

if (index) validateIndex(index);
if (bundled) validateBundled(bundled);
if (catalog) validateCatalog(catalog);

console.log(`Validation: ${errors.length} error(s), ${warnings.length} warning(s)`);
for (const w of warnings.slice(0, 10)) console.warn('WARN:', w);
if (warnings.length > 10) console.warn(`... and ${warnings.length - 10} more warnings`);
for (const e of errors) console.error('ERROR:', e);

process.exit(errors.length ? 1 : 0);
