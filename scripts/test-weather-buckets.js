#!/usr/bin/env node
/**
 * Verifies exclusive weather bucket partition in recipe-index.json.
 * Run: node scripts/test-weather-buckets.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/recipe-index.json'), 'utf8'));

function inferPrimary(tags = []) {
  if (tags.some((t) => ['hot', 'sunny'].includes(t))) return 'hot';
  if (tags.some((t) => ['rain', 'cold'].includes(t))) return 'cold';
  return 'mild';
}

const buckets = { hot: new Set(), cold: new Set(), mild: new Set() };
let mismatch = 0;

for (const e of index.entries || []) {
  const expected = inferPrimary(e.weather_tags);
  if (e.weather_primary !== expected) mismatch++;
  buckets[e.weather_primary]?.add(e.id);
}

function overlap(a, b) {
  return [...buckets[a]].filter((id) => buckets[b].has(id));
}

const hotCold = overlap('hot', 'cold');
const hotMild = overlap('hot', 'mild');
const coldMild = overlap('cold', 'mild');
const total = (buckets.hot?.size || 0) + (buckets.cold?.size || 0) + (buckets.mild?.size || 0);

console.log('Bucket sizes:', {
  hot: buckets.hot.size,
  cold: buckets.cold.size,
  mild: buckets.mild.size,
  total
});
console.log('Overlaps:', { hotCold: hotCold.length, hotMild: hotMild.length, coldMild: coldMild.length });
console.log('weather_primary mismatches:', mismatch);

const ok =
  hotCold.length === 0 &&
  hotMild.length === 0 &&
  coldMild.length === 0 &&
  mismatch === 0 &&
  total === (index.entries || []).length;

if (!ok) {
  console.error('Weather bucket test FAILED');
  process.exit(1);
}

console.log('Weather bucket test PASSED');
