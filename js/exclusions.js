/** Preset + custom exclusion matching against recipes and ingredients */

import { getPreferences } from './storage.js';

export function getAllExcludedTerms() {
  const prefs = getPreferences();
  return {
    presetTags: prefs.excludedTags || [],
    customTerms: (prefs.customExclusions || []).map((t) => t.toLowerCase().trim()).filter(Boolean)
  };
}

function normalize(text) {
  return (text || '').toLowerCase().trim();
}

/** Check if a recipe violates preset exclude_tags or custom ingredient terms */
export function recipeMatchesExclusions(recipe, presetTags = null, customTerms = null) {
  const { presetTags: presets, customTerms: custom } = getAllExcludedTerms();
  const tags = presetTags ?? presets;
  const terms = customTerms ?? custom;

  if (tags.some((tag) => (recipe.exclude_tags || []).includes(tag))) {
    return false;
  }

  if (!terms.length) return true;

  const haystack = [
    recipe.name,
    recipe.description,
    recipe.technique,
    ...(recipe.ingredients || []).map((i) => i.name),
    ...(recipe.exclude_tags || [])
  ]
    .map(normalize)
    .join(' ');

  return !terms.some((term) => haystack.includes(term));
}

export function filterByExclusions(recipes, presetTags, customTerms) {
  return recipes.filter((r) => recipeMatchesExclusions(r, presetTags, customTerms));
}

export function addCustomExclusion(term) {
  const trimmed = term.trim();
  if (!trimmed) return getPreferences().customExclusions || [];

  const prefs = getPreferences();
  const list = [...(prefs.customExclusions || [])];
  const lower = trimmed.toLowerCase();
  if (!list.some((t) => t.toLowerCase() === lower)) {
    list.push(trimmed);
  }
  return list;
}

export function removeCustomExclusion(term) {
  const prefs = getPreferences();
  const lower = term.toLowerCase();
  return (prefs.customExclusions || []).filter((t) => t.toLowerCase() !== lower);
}
