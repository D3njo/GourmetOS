#!/usr/bin/env node
/**
 * Grocery vision V2 unit tests (YOLO postprocess, confidence tiers, fusion).
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
  const { decodeYoloTensor, detectionsToCandidates, nonMaxSuppression } = await loadEsm(
    'js/inventory-yolo-postprocess.js'
  );
  const { fuseScanCandidates, shouldAutoSelectScanCandidate, SCAN_CONFIDENCE } = await loadEsm(
    'js/inventory-scan-fusion.js'
  );
  const { scanConfidenceTier, CONFIDENCE_TIER, groupScanCandidatesByTier } = await loadEsm(
    'js/inventory-scan-confidence.js'
  );
  const { GROCERY_V2_CLASSES } = await loadEsm('js/inventory-grocery-classes.js');

  assert(GROCERY_V2_CLASSES.length >= 30, 'V2 class list present');

  const numClasses = 2;
  const anchors = 2;
  const tensor = new Float32Array([
    0.5, 0.5, 0.2, 0.2, 0.1, 0.9,
    0.5, 0.5, 0.2, 0.2, 0.85, 0.1
  ]);
  const detections = decodeYoloTensor(
    { data: tensor, dims: [1, 4 + numClasses, anchors] },
    { numClasses, confThreshold: 0.5, inputSize: 640 }
  );
  assert(detections.length >= 1, 'YOLO decode returns detections');

  const labelMeta = {
    modelClassNames: ['Melk', 'Egg'],
    mapping: { 0: 'milk', 1: 'eggs', Melk: 'milk', Egg: 'eggs' }
  };
  const candidates = detectionsToCandidates(detections, labelMeta);
  assert(candidates.some((c) => c.name === 'milk' || c.name === 'eggs'), 'class mapping works');

  const nms = nonMaxSuppression(
    [
      { classIndex: 0, score: 0.9, xmin: 0, ymin: 0, xmax: 10, ymax: 10 },
      { classIndex: 0, score: 0.85, xmin: 1, ymin: 1, xmax: 11, ymax: 11 }
    ],
    0.45,
    10
  );
  assert(nms.length === 1, 'NMS suppresses overlap');

  const fused = fuseScanCandidates([
    [
      {
        name: 'milk',
        normalizedName: 'milk',
        confidence: 0.88,
        provider: 'localGrocery',
        raw: 'Melk'
      }
    ]
  ]);
  assert(fused[0].name === 'milk', 'grocery provider fused');
  assert(shouldAutoSelectScanCandidate(fused[0]), 'grocery high confidence auto-selects');

  assert(scanConfidenceTier({ confidence: 0.8 }) === CONFIDENCE_TIER.high, 'high tier');
  assert(scanConfidenceTier({ confidence: 0.5 }) === CONFIDENCE_TIER.medium, 'medium tier');
  assert(scanConfidenceTier({ confidence: 0.2 }) === CONFIDENCE_TIER.low, 'low tier');

  const groups = groupScanCandidatesByTier([
    { confidence: 0.8 },
    { confidence: 0.5 },
    { confidence: 0.2 }
  ]);
  assert(groups.high.length === 1 && groups.medium.length === 1 && groups.low.length === 1, 'tier groups');
  assert(SCAN_CONFIDENCE.autoSelect === 0.74, 'auto threshold');

  console.log('test-grocery-vision: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
