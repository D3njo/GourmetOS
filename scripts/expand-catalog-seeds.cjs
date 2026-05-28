#!/usr/bin/env node
/**
 * Adds top premium TheMealDB entries to recipe-catalog.json as curated seeds.
 * Run: node scripts/expand-catalog-seeds.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_TOTAL = 100;

const TECHNIQUE_BY_CATEGORY = {
  Beef: 'Roast & Braise',
  Lamb: 'Braise & Roast',
  Pork: 'Roast & Pan',
  Seafood: 'Fish & Seafood',
  Chicken: 'Poultry & Oven',
  Pasta: 'Pasta & Sauce',
  Soup: 'Soup & Stock',
  Dessert: 'Pastry',
  Starter: 'Starter & Salad',
  Vegetarian: 'Vegetarian & Oven',
  Vegan: 'Vegan & Pan',
  Breakfast: 'Breakfast & Brunch',
  Side: 'Side & Oven'
};

function chefFromSource(url, name) {
  const u = (url || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (n.includes('gordon ramsay') || u.includes('gordon')) return 'Gordon Ramsay';
  if (u.includes('jamieoliver')) return 'Jamie Oliver';
  if (u.includes('bbcgoodfood')) return 'BBC Good Food';
  if (u.includes('goodtoknow')) return 'GoodtoKnow';
  if (u.includes('seriouseats')) return 'Serious Eats';
  return 'BBC Good Food';
}

function sourceLabel(url) {
  const chef = chefFromSource(url);
  return chef;
}

function buildSeed(entry) {
  const category = entry.cuisine || 'Miscellaneous';
  const tech = TECHNIQUE_BY_CATEGORY[category] || 'Classic';
  const chef = entry.chef || chefFromSource(entry.source?.url, entry.name);
  const label = sourceLabel(entry.source?.url);

  return {
    idMeal: entry.idMeal,
    slug: entry.id,
    tier: 'premium',
    rating: entry.rating || 4.5,
    chef,
    cuisine: entry.cuisine || category,
    fineDiningMeta: {
      style: entry.effort === 'elaborate' ? 'haute-cuisine' : 'fine-dining',
      inspiration: `${chef} · ${entry.cuisine || 'International'}`
    },
    source_label_en: label,
    technique_en: tech,
    weather_tags: entry.weather_tags || ['mild'],
    meal_type: entry.meal_type || ['dinner'],
    exclude_tags: entry.exclude_tags || [],
    name_en: entry.name,
    description_en: entry.name
  };
}

function main() {
  const catalogPath = path.join(ROOT, 'data/recipe-catalog.json');
  const indexPath = path.join(ROOT, 'data/recipe-index.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const existing = new Set((catalog.meals || []).map((m) => m.idMeal));
  const need = Math.max(0, TARGET_TOTAL - catalog.meals.length);

  const candidates = index.entries
    .filter((e) => e.idMeal && e.tier === 'premium' && !existing.has(e.idMeal))
    .sort((a, b) => {
      const sa = (b.qualityScore || 0) + (b.rating || 0) + (b.effort === 'elaborate' ? 2 : 0);
      const sb = (a.qualityScore || 0) + (a.rating || 0) + (a.effort === 'elaborate' ? 2 : 0);
      return sa - sb;
    })
    .slice(0, need);

  for (const entry of candidates) {
    catalog.meals.push(buildSeed(entry));
    existing.add(entry.idMeal);
  }

  catalog.version = (catalog.version || 4) + 1;
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(`Catalog expanded: ${catalog.meals.length} meals (+${candidates.length} seeds)`);
}

main();
