import { normalizeIngredientName } from './ingredient-normalize.js';

const PROVIDER_WEIGHT = {
  barcode: 1,
  localGrocery: 1,
  localObject: 0.95,
  localClip: 0.82,
  tesseract: 0.45,
  ocr: 0.45
};

export const SCAN_CONFIDENCE = {
  show: 0.42,
  autoSelect: 0.74
};

function providerWeight(provider) {
  return PROVIDER_WEIGHT[provider] ?? 0.6;
}

function displayName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreCandidate(candidate) {
  const base = Number.isFinite(candidate.confidence) ? candidate.confidence : candidate.score;
  const confidence = Math.max(0, Math.min(1, Number(base) || 0));
  return Math.max(0, Math.min(1, confidence * providerWeight(candidate.provider)));
}

function mergeConfidence(existingConfidence, nextConfidence) {
  return 1 - (1 - existingConfidence) * (1 - nextConfidence);
}

export function fuseScanCandidates(providerResults = []) {
  const byName = new Map();

  for (const result of providerResults.flat()) {
    if (!result?.name) continue;
    const normalizedName = result.normalizedName || normalizeIngredientName(result.name);
    if (!normalizedName) continue;

    const weightedConfidence = scoreCandidate(result);
    if (weightedConfidence < SCAN_CONFIDENCE.show && !byName.has(normalizedName)) continue;

    const source = {
      provider: result.provider || 'unknown',
      confidence: Number(weightedConfidence.toFixed(2)),
      raw: result.raw || result.label || result.name,
      bbox: result.bbox || result.box || null
    };

    if (!byName.has(normalizedName)) {
      byName.set(normalizedName, {
        name: displayName(result.name),
        normalizedName,
        confidence: weightedConfidence,
        source: 'photo',
        provider: source.provider,
        providers: [source],
        bbox: source.bbox,
        raw: source.raw
      });
      continue;
    }

    const existing = byName.get(normalizedName);
    existing.confidence = mergeConfidence(existing.confidence, weightedConfidence);
    existing.providers.push(source);
    existing.providers.sort((a, b) => b.confidence - a.confidence);
    existing.provider = existing.providers[0].provider;
    existing.raw = existing.providers[0].raw;
    existing.bbox = existing.providers.find((item) => item.bbox)?.bbox || existing.bbox;
  }

  return [...byName.values()]
    .map((candidate) => ({
      ...candidate,
      confidence: Number(Math.min(0.98, candidate.confidence).toFixed(2)),
      providerLabel: candidate.providers.map((item) => item.provider).join('+')
    }))
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export function shouldAutoSelectScanCandidate(candidate) {
  return (candidate?.confidence || 0) >= SCAN_CONFIDENCE.autoSelect;
}
