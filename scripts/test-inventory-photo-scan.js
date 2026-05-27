#!/usr/bin/env node
/**
 * Inventory photo scan normalization tests.
 * Run: node scripts/test-inventory-photo-scan.js
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
  const {
    extractInventoryScanCandidates,
    shouldAutoSelectScanCandidate
  } = await loadEsm('js/inventory-scan-normalize.js');

  const candidates = extractInventoryScanCandidates({
    text: 'ORGANIC WHOLE MILK free range eggs Greek yogurt baby spinach basmati rice',
    words: [
      { text: 'MILK', confidence: 94 },
      { text: 'eggs', confidence: 88 },
      { text: 'yogurt', confidence: 81 },
      { text: 'spinach', confidence: 76 },
      { text: 'rice', confidence: 83 }
    ]
  });

  const names = candidates.map((candidate) => candidate.name);
  assert(names.includes('milk'), 'milk detected');
  assert(names.includes('eggs'), 'eggs detected');
  assert(names.includes('yogurt'), 'yogurt detected');
  assert(names.includes('spinach'), 'spinach detected');
  assert(names.includes('rice'), 'rice detected');
  assert(
    shouldAutoSelectScanCandidate(candidates.find((candidate) => candidate.name === 'milk')),
    'high confidence milk auto-selected'
  );

  const fuzzy = extractInventoryScanCandidates({ text: 'cheddr mozzarela yoghrt' });
  assert(!fuzzy.some((candidate) => candidate.name === 'cheese'), 'misspellings stay below threshold');

  const aliases = extractInventoryScanCandidates({ text: 'firm tofu black beans cherry tomatoes' });
  assert(aliases.some((candidate) => candidate.name === 'tofu'), 'tofu alias');
  assert(aliases.some((candidate) => candidate.name === 'beans'), 'beans alias');
  assert(aliases.some((candidate) => candidate.name === 'tomatoes'), 'tomato alias');

  console.log('test-inventory-photo-scan: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
