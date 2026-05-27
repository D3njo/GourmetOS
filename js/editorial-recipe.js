/**
 * Editorial recipe metadata: taste, occasion, chef rationale, mise en place.
 */

import { t, weatherLabelKey } from './i18n.js';
import { inferProtein } from './recipe-meta.js';

export const EDITORIAL_FIELDS = [
  'why_this_works',
  'chef_move',
  'taste_profile',
  'occasion',
  'skill_focus',
  'mise_en_place',
  'weather_mood'
];

export const TASTE_PROFILES = ['bright', 'rich', 'fresh', 'smoky', 'comforting', 'clean', 'umami'];
export const WEATHER_MOODS = {
  hot: 'sunny-light',
  cold: 'rain-comfort',
  mild: 'mild-balanced'
};

const TECHNIQUE_MAP = {
  Beef: 'Sear & Braise',
  Lamb: 'Slow Roast',
  Pork: 'Roast & Glaze',
  Chicken: 'Pan Roast',
  Seafood: 'Sear & Butter',
  Pasta: 'Emulsion & Toss',
  Soup: 'Simmer & Finish',
  Vegetarian: 'Roast & Herb',
  Vegan: 'Roast & Herb',
  Dessert: 'Bake & Set',
  Breakfast: 'Pan & Poach',
  Starter: 'Quick Sear',
  Side: 'Finish & Season',
  Miscellaneous: 'Classic Technique'
};

const TASTE_BY_WEATHER = {
  hot: 'bright',
  cold: 'comforting',
  mild: 'clean'
};

const TASTE_BY_TECHNIQUE = {
  'Sear & Braise': 'rich',
  'Slow Roast': 'rich',
  'Simmer & Finish': 'comforting',
  'Emulsion & Toss': 'clean',
  'Sear & Butter': 'fresh',
  'Bake & Set': 'rich'
};

export function inferTechnique(recipe) {
  if (recipe.technique && !TECHNIQUE_MAP[recipe.technique]) {
    const tec = recipe.technique;
    if (!['Beef', 'Chicken', 'Dessert', 'Vegetarian', 'Seafood', 'Pasta', 'Soup', 'Breakfast', 'Starter', 'Side', 'Miscellaneous'].includes(tec)) {
      return tec;
    }
  }
  const cat = recipe.source?.category || recipe.technique;
  return TECHNIQUE_MAP[cat] || recipe.technique || 'Classic Technique';
}

export function inferTasteProfile(recipe) {
  if (recipe.taste_profile && TASTE_PROFILES.includes(recipe.taste_profile)) {
    return recipe.taste_profile;
  }
  const primary = recipe.weather_primary || 'mild';
  const technique = inferTechnique(recipe);
  if (TASTE_BY_TECHNIQUE[technique]) return TASTE_BY_TECHNIQUE[technique];
  if (recipe.flavor_profile?.toLowerCase().includes('spicy')) return 'smoky';
  if (recipe.flavor_profile?.toLowerCase().includes('cream')) return 'rich';
  return TASTE_BY_WEATHER[primary] || 'clean';
}

export function inferWeatherMood(weatherTag) {
  return WEATHER_MOODS[weatherTag] || 'mild-balanced';
}

export function inferOccasion(recipe, weatherTag) {
  if (recipe.occasion) return recipe.occasion;
  if (recipe.fineDiningMeta?.service === 'tasting-menu') return 'date-night';
  if (weatherTag === 'cold') return 'rainy-evening';
  if (weatherTag === 'hot') return 'summer-lunch';
  if (recipe.effort === 'elaborate') return 'date-night';
  if (recipe.effort === 'quick') return 'solo';
  return 'family';
}

export function inferSkillFocus(recipe) {
  if (recipe.skill_focus) return recipe.skill_focus;
  const technique = inferTechnique(recipe);
  if (/Emulsion|Sear|Pan/.test(technique)) return 'searing';
  if (/Braise|Simmer|Roast/.test(technique)) return 'braising';
  if (/Bake/.test(technique)) return 'plating';
  return 'knife-work';
}

export function buildMiseEnPlace(recipe) {
  if (recipe.mise_en_place?.length) return recipe.mise_en_place;
  const items = [];
  const ings = (recipe.ingredients || []).slice(0, 5);
  for (const ing of ings) {
    items.push(`Prep ${ing.name}${ing.amount ? ` (${ing.amount}${ing.unit ? ' ' + ing.unit : ''})` : ''}`);
  }
  if (recipe.totalMinutes > 60) items.push('Measure aromatics and stock before searing');
  if (items.length < 3) items.push('Read through all steps once before starting');
  return items.slice(0, 4);
}

export function buildWhyThisWorks(recipe, weatherTag, effortLevel) {
  if (recipe.why_this_works) return recipe.why_this_works;
  const mood = inferWeatherMood(weatherTag);
  const taste = inferTasteProfile(recipe);
  const technique = inferTechnique(recipe);
  const moodCopy = {
    'sunny-light': 'Light and vibrant for warm weather',
    'rain-comfort': 'Deep comfort for rainy, cooler days',
    'mild-balanced': 'Balanced and versatile for everyday cooking'
  };
  return `${moodCopy[mood] || 'Well matched to today'} — ${taste} flavors via ${technique.toLowerCase()}, suited to ${effortLevel || recipe.effort || 'medium'} effort.`;
}

export function buildChefMove(recipe) {
  if (recipe.chef_move) return recipe.chef_move;
  const technique = inferTechnique(recipe);
  const moves = {
    'Sear & Braise': 'Sear protein deeply before adding liquid — color equals flavor.',
    'Emulsion & Toss': 'Reserve pasta water; finish off heat for a silky emulsion.',
    'Simmer & Finish': 'Skim the surface early for a cleaner, richer broth.',
    'Sear & Butter': 'Baste with butter in the last minute for gloss and aroma.',
    'Slow Roast': 'Rest the protein before slicing to keep juices inside.',
    'Bake & Set': 'Cool slightly before serving so textures set beautifully.'
  };
  return moves[technique] || 'Season in layers — salt early, acid and herbs at the finish.';
}

export function enrichEditorial(recipe, context = {}) {
  const weatherTag = context.weatherTag || recipe.weather_primary || 'mild';
  const effortLevel = context.effortLevel || recipe.effort || 'medium';
  return {
    ...recipe,
    technique: inferTechnique(recipe),
    taste_profile: inferTasteProfile(recipe),
    weather_mood: inferWeatherMood(weatherTag),
    occasion: inferOccasion(recipe, weatherTag),
    skill_focus: inferSkillFocus(recipe),
    mise_en_place: buildMiseEnPlace(recipe),
    why_this_works: buildWhyThisWorks(recipe, weatherTag, effortLevel),
    chef_move: buildChefMove(recipe)
  };
}

export function buildChefRationale(recipe, context = {}) {
  const enriched = enrichEditorial(recipe, context);
  const { weatherTag, temp, effortLevel } = context;
  const whyNow = weatherTag
    ? `${t(weatherLabelKey(weatherTag))}${temp != null ? ` · ${Math.round(temp)}°` : ''} · ${effortLevel || enriched.effort || 'medium'} effort`
    : '';
  return {
    whyTonight: enriched.why_this_works,
    whyNow,
    tasteArc: enriched.taste_profile,
    chefMove: enriched.chef_move,
    occasion: enriched.occasion,
    skillFocus: enriched.skill_focus,
    weatherMood: enriched.weather_mood,
    miseEnPlace: enriched.mise_en_place
  };
}

export function compareAlternativeReason(selected, alternative) {
  if (!selected || !alternative) return 'swap';
  const reasons = [];
  if ((alternative.totalMinutes || 999) < (selected.totalMinutes || 999) - 15) {
    reasons.push('faster');
  } else if ((alternative.totalMinutes || 0) > (selected.totalMinutes || 0) + 15) {
    reasons.push('richer');
  }
  if ((alternative.ingredientCount || 99) < (selected.ingredientCount || 99) - 3) {
    reasons.push('lighter');
  } else if ((alternative.ingredientCount || 0) > (selected.ingredientCount || 0) + 3) {
    reasons.push('richer');
  }
  if (alternative.tier === 'premium' && selected.tier !== 'premium') reasons.push('chefier');
  if (inferProtein(alternative) !== inferProtein(selected)) reasons.push('differentProtein');
  if (inferTasteProfile(alternative) !== inferTasteProfile(selected)) reasons.push('differentMood');
  return reasons[0] || 'swap';
}

export function reasonLabel(reasonKey) {
  const key = `altReason_${reasonKey}`;
  const label = t(key);
  return label !== key ? label : reasonKey;
}
