/** Preset + custom exclusion matching against recipes and ingredients */

import { getPreferences } from './storage.js';
import { recipeMatchesDietPreferences, getActiveDietPreferences } from './diet-preferences.js';

/** Preset checkbox id → pattern on recipe name / ingredients (EN + DE). */
const PRESET_PATTERNS = {
  fish: /\b(fish|fisch|salmon|lachs|tuna|thunfisch|cod|kabeljau|trout|forelle|anchov|sardine|mackerel|hering|eel|aal|halibut|seezunge|fish\s*sauce|fischsauce)\b/i,
  shellfish:
    /\b(shellfish|prawn|prawns|shrimp|shrimps|garnelen|garnele|crab|crabs|krabbe|lobster|hummer|mussel|muschel|clam|squid|calamari|oyster|austern|scallop|jakobsmuschel|langoustine|crayfish|king\s+prawn|king\s+prawns)\b/i,
  beef: /\b(beef|rind|rindfleisch|steak|fillet|mince|brisket|veal|kalb|burger\s*patty|entrecôte|entrecote)\b/i,
  pork: /\b(pork|schwein|schweinefleisch|bacon|speck|ham|schinken|sausage|wurst|chorizo|pancetta|prosciutto|salami|guanciale)\b/i,
  duck: /\b(duck|ente|duck\s*breast|entenbrust|canard)\b/i,
  dairy:
    /\b(milk|milch|cream|sahne|cheese|käse|kaese|butter|yogurt|joghurt|parmesan|mozzarella|cheddar|feta|ricotta|mascarpone|ghee|buttermilk|sour\s*cream|crème|creme\s*fraiche)\b/i,
  eggs: /\b(eggs?|ei\b|eier|egg\s*white|egg\s*yolk|mayonnaise|mayo|meringue|omelette|omelet|frittata)\b/i,
  gluten:
    /\b(gluten|wheat|weizen|pasta|noodle|nudeln|bread|brot|flour|mehl|pastry|couscous|bulgur|semolina|spaghetti|penne|udon|ramen|baguette|tortilla|panko|breadcrumbs|brotkrumen)\b/i,
  coriander: /\b(coriander|cilantro|koriander)\b/i
};

export const EXCLUSION_PRESET_IDS = Object.keys(PRESET_PATTERNS);

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

/** Strip technique phrases that mention butter without being a dairy dish. */
function sanitizeExclusionText(text) {
  return (text || '')
    .replace(/sear\s*&\s*butter/gi, ' ')
    .replace(/baste with butter/gi, ' ')
    .replace(/via\s+[\w\s&]+\s+effort/gi, ' ');
}

export function recipeTextBlob(recipe) {
  const ingredients = (recipe.ingredients || []).map((i) => i.name);
  const parts = [recipe.name, recipe.name_en, recipe.name_de, ...ingredients];

  if (ingredients.length) {
    parts.push(recipe.description, recipe.description_en, recipe.description_de);
  } else if (recipe.description && !/flavors via|suited to .* effort/i.test(recipe.description)) {
    parts.push(recipe.description);
  }

  return parts
    .filter(Boolean)
    .map((p) => sanitizeExclusionText(normalize(p)))
    .join(' ');
}

/**
 * Infer allergen / diet tags from recipe text (not only stored exclude_tags).
 */
export function inferRecipeExcludeTags(recipe) {
  const tags = new Set(recipe?.exclude_tags || []);
  const text = recipeTextBlob(recipe);

  for (const [tag, pattern] of Object.entries(PRESET_PATTERNS)) {
    if (pattern.test(text)) tags.add(tag);
  }

  return [...tags];
}

/** True when recipe is allowed (does not violate any active exclusion). */
export function recipeMatchesExclusions(recipe, presetTags = null, customTerms = null) {
  const { presetTags: presets, customTerms: custom } = getAllExcludedTerms();
  const tags = presetTags ?? presets;
  const terms = customTerms ?? custom;

  const recipeTags = inferRecipeExcludeTags(recipe);

  if (tags.length && tags.some((tag) => recipeTags.includes(tag))) {
    return false;
  }

  if (!terms.length) return true;

  const haystack = `${recipeTextBlob(recipe)} ${recipeTags.join(' ')}`;
  return !terms.some((term) => term.length > 0 && haystack.includes(term));
}

/** Alias — allergen + diet gate used across plan + UI. */
export function isRecipeAllowed(recipe, options = {}) {
  const { presetTags = null, customTerms = null, dietPreferences = null } = options;
  if (!recipeMatchesExclusions(recipe, presetTags, customTerms)) return false;
  if (!recipeMatchesDietPreferences(recipe, dietPreferences)) return false;
  return true;
}

export { getActiveDietPreferences };

export function filterByExclusions(recipes, presetTags, customTerms) {
  return recipes.filter((r) => recipeMatchesExclusions(r, presetTags, customTerms));
}

/**
 * Remove stored plan recipe IDs that violate current exclusions.
 * @returns {Record<string, string[]>}
 */
export function sanitizePlanSelections(selections, options = {}) {
  const { presetTags = null, customTerms = null, recipesById = null } = options;
  const out = {};

  for (const [dayKey, ids] of Object.entries(selections || {})) {
    if (!Array.isArray(ids)) continue;
    out[dayKey] = ids.filter((id) => {
      const recipe = recipesById?.get?.(id) ?? recipesById?.[id];
      if (!recipe) return true;
      return isRecipeAllowed(recipe, { presetTags, customTerms });
    });
  }

  return out;
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
