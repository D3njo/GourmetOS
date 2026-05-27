import { SCAN_CONFIDENCE } from './inventory-scan-fusion.js';

export const CONFIDENCE_TIER = {
  high: 'high',
  medium: 'medium',
  low: 'low'
};

/** Classify fused candidate confidence for V2 review UI. */
export function scanConfidenceTier(candidate) {
  const value = candidate?.confidence || 0;
  if (value >= SCAN_CONFIDENCE.autoSelect) return CONFIDENCE_TIER.high;
  if (value >= SCAN_CONFIDENCE.show) return CONFIDENCE_TIER.medium;
  return CONFIDENCE_TIER.low;
}

export function groupScanCandidatesByTier(candidates = []) {
  const groups = {
    [CONFIDENCE_TIER.high]: [],
    [CONFIDENCE_TIER.medium]: [],
    [CONFIDENCE_TIER.low]: []
  };

  for (const candidate of candidates) {
    groups[scanConfidenceTier(candidate)].push(candidate);
  }

  return groups;
}
