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
    extractInventoryScanCandidates
  } = await loadEsm('js/inventory-scan-normalize.js');
  const { fuseScanCandidates, shouldAutoSelectScanCandidate } = await loadEsm(
    'js/inventory-scan-fusion.js'
  );

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

  const fused = fuseScanCandidates([
    [
      {
        name: 'milk',
        normalizedName: 'milk',
        confidence: 0.78,
        provider: 'localClip',
        raw: 'a fridge photo containing milk carton'
      },
      {
        name: 'milk',
        normalizedName: 'milk',
        confidence: 0.62,
        provider: 'tesseract',
        raw: 'MILK'
      }
    ],
    [
      {
        name: 'carrots',
        normalizedName: 'carrots',
        confidence: 0.91,
        provider: 'localObject',
        raw: 'carrot',
        bbox: { xmin: 1, ymin: 2, xmax: 3, ymax: 4 }
      }
    ]
  ]);

  const fusedMilk = fused.find((candidate) => candidate.name === 'milk');
  const fusedCarrots = fused.find((candidate) => candidate.name === 'carrots');
  const fusedGrocery = fuseScanCandidates([
    [
      {
        name: 'eggs',
        normalizedName: 'eggs',
        confidence: 0.9,
        provider: 'localGrocery',
        raw: 'Egg',
        bbox: { xmin: 4, ymin: 4, xmax: 40, ymax: 40 }
      }
    ]
  ]);
  assert(fusedMilk, 'fused milk present');
  assert(fusedMilk.providers.length === 2, 'milk providers merged');
  assert(shouldAutoSelectScanCandidate(fusedMilk), 'fused milk auto-selected');
  assert(fusedCarrots?.bbox, 'object detection bbox preserved');
  assert(fusedGrocery[0]?.provider === 'localGrocery', 'grocery provider weight');
  assert(fusedGrocery[0]?.bbox, 'grocery bbox preserved');

  console.log('test-inventory-photo-scan: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
