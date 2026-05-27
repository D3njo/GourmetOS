/**
 * High-protein heuristics (no nutrition API — ingredient/name signals only).
 */

import { recipeTextBlob } from './exclusions.js';
import { inferProtein } from './recipe-meta.js';

const PROTEIN_SIGNALS = [
  [/\b(chicken|hähnchen|huhn)\b/i, 3],
  [/\b(turkey|pute)\b/i, 3],
  [/\b(beef|rind|steak|mince|oxtail)\b/i, 2.5],
  [/\b(pork|schwein|bacon|chorizo)\b/i, 2.5],
  [/\b(lamb|lamm)\b/i, 2.5],
  [/\b(salmon|tuna|cod|haddock|trout|fish|sea bass|barramundi)\b/i, 2.5],
  [/\b(prawn|shrimp|seafood|lobster|crab|calamar)\b/i, 2.5],
  [/\b(tofu|tempeh|seitan)\b/i, 3],
  [/\b(lentil|linsen|chickpea|kichererbse|bean|bohnen|black bean)\b/i, 2.5],
  [/\b(egg|eggs|ei\b|eier)\b/i, 2],
  [/\b(greek yogurt|skyr|cottage cheese|quark|skyr)\b/i, 2.5],
  [/\b(yogurt|joghurt)\b/i, 1.5],
  [/\b(protein powder|whey)\b/i, 3]
];

const STRONG_PROTEIN_TYPES = new Set([
  'beef',
  'pork',
  'poultry',
  'chicken',
  'meat',
  'fish',
  'seafood',
  'egg',
  'tofu',
  'legume'
]);

const LOW_PROTEIN_DISH =
  /\b(fruit salad|green salad|caesar salad without|dessert|cake|cookie|brownie|sorbet|ice cream|mousse|pudding|jam tart|meringue)\b/i;

/** Estimated protein emphasis score (0–10), not grams of protein. */
export function estimateProteinScore(recipe) {
  if (!recipe) return 0;

  const text = recipeTextBlob(recipe);
  let score = 0;

  for (const [pattern, weight] of PROTEIN_SIGNALS) {
    if (pattern.test(text)) score += weight;
  }

  const protein = inferProtein(recipe);
  if (STRONG_PROTEIN_TYPES.has(protein)) score += 2;

  const namedIngredients = (recipe.ingredients || []).filter((i) => i?.name).length;
  if (namedIngredients >= 6 && score >= 2) score += 0.5;

  if (LOW_PROTEIN_DISH.test(text) && score < 3) return Math.min(score, 1);

  return Math.min(10, score);
}

/** Strict diet-style filter for high_protein preference. */
export function isHighProteinRecipe(recipe) {
  return estimateProteinScore(recipe) >= 4;
}

/** Ranking boost when preferHighProtein is enabled. */
export function highProteinBoost(recipe) {
  const score = estimateProteinScore(recipe);
  if (score >= 7) return 3;
  if (score >= 5) return 2;
  if (score >= 4) return 1.5;
  if (score >= 2.5) return 0.5;
  return 0;
}
