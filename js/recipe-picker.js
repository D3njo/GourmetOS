/**
 * Weighted recipe selection from ranked candidates — avoids always picking rank #1.
 */

const DEFAULT_TOP_N = 12;

/**
 * @param {Array<{ id: string, _recScore?: number, score?: number }>} candidates
 * @param {{ excludeIds?: Set<string>|string[], topN?: number, slotIndex?: number }} [opts]
 * @returns {string|null} recipe id
 */
export function pickWeightedRecipeId(candidates, opts = {}) {
  const { excludeIds = [], topN = DEFAULT_TOP_N, slotIndex = 0 } = opts;
  const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);

  const pool = candidates
    .filter((c) => c?.id && !exclude.has(c.id))
    .slice(0, topN);

  if (!pool.length) return null;
  if (pool.length === 1) return pool[0].id;

  const scores = pool.map((c) => {
    const raw = c._recScore ?? c.score ?? 0;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
  });
  const minScore = Math.min(...scores);
  const weights = scores.map((s) => Math.max(0.1, s - minScore + 1));
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i].id;
  }

  return pool[slotIndex % pool.length].id;
}

/**
 * Pick from prepared recipe options (with _recScore from getRecipeOptions).
 */
export function pickFromRankedOptions(options, slotIndex = 0, excludeIds = []) {
  return pickWeightedRecipeId(options, { excludeIds, slotIndex, topN: DEFAULT_TOP_N });
}

/**
 * Pick from rankRecipes output: [{ recipe, score, ... }]
 */
export function pickFromRankedList(ranked, slotIndex = 0, excludeIds = []) {
  const candidates = ranked.map(({ recipe, score }) => ({
    id: recipe.id,
    score
  }));
  return pickWeightedRecipeId(candidates, { excludeIds, slotIndex, topN: DEFAULT_TOP_N });
}
