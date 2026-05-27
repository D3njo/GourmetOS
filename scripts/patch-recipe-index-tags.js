#!/usr/bin/env node
/**
 * Re-infer exclude_tags on recipe-index.json using current PRESET_PATTERNS.
 * Run: node scripts/patch-recipe-index-tags.js
 */

const fs = require('fs');
const path = require('path');
const { inferFromEntry } = require('./lib/exclusions-inference.cjs');

const INDEX_PATH = path.join(__dirname, '..', 'data', 'recipe-index.json');
const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

let updated = 0;
for (const entry of index.entries) {
  const next = inferFromEntry(entry);
  const prev = (entry.exclude_tags || []).slice().sort().join(',');
  const merged = next.slice().sort().join(',');
  if (prev !== merged) {
    entry.exclude_tags = next;
    updated++;
  }
}

fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
console.log(`patch-recipe-index-tags: updated ${updated} / ${index.entries.length} entries`);
