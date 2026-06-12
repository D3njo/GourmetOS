/**
 * Weighted recipe selection from ranked candidates — avoids always picking rank #1.
 */

const DEFAULT_TOP_N = 24;

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

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
  const weights = scores.map((s) => 1 + Math.pow(Math.max(0, s - minScore) + 0.5, 0.35));
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

/** Pick diverse swap options from a wider ranked band (not always the same top 3). */
export function pickDiverseAlternatives(options, { selectedId = null, count = 2, bandStart = 1, bandEnd = 16 } = {}) {
  const exclude = new Set(selectedId ? [selectedId] : []);
  const band = options.filter((o) => o?.id && !exclude.has(o.id)).slice(bandStart, bandEnd);
  shuffleInPlace(band);

  const picked = [];
  for (const option of band) {
    if (picked.length >= count) break;
    if (exclude.has(option.id)) continue;
    picked.push(option);
    exclude.add(option.id);
  }

  if (picked.length < count) {
    for (const option of options) {
      if (picked.length >= count) break;
      if (!option?.id || exclude.has(option.id)) continue;
      picked.push(option);
      exclude.add(option.id);
    }
  }

  return picked;
}
