/**
 * Editorial metadata inference for build scripts (CommonJS).
 * Mirrors js/editorial-recipe.js without ESM dependencies.
 */

const TASTE_PROFILES = ['bright', 'rich', 'fresh', 'smoky', 'comforting', 'clean', 'umami'];

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

const TASTE_BY_WEATHER = { hot: 'bright', cold: 'comforting', mild: 'clean' };
const TASTE_BY_TECHNIQUE = {
  'Sear & Braise': 'rich',
  'Slow Roast': 'rich',
  'Simmer & Finish': 'comforting',
  'Emulsion & Toss': 'clean',
  'Sear & Butter': 'fresh',
  'Bake & Set': 'rich'
};

const WEATHER_MOODS = { hot: 'sunny-light', cold: 'rain-comfort', mild: 'mild-balanced' };

function inferTechnique(recipe) {
  if (recipe.technique && !TECHNIQUE_MAP[recipe.technique]) {
    const tec = recipe.technique;
    const cats = Object.keys(TECHNIQUE_MAP);
    if (!cats.includes(tec)) return tec;
  }
  const cat = recipe.source?.category || recipe.technique;
  return TECHNIQUE_MAP[cat] || recipe.technique || 'Classic Technique';
}

function inferTasteProfile(recipe) {
  if (recipe.taste_profile && TASTE_PROFILES.includes(recipe.taste_profile)) {
    return recipe.taste_profile;
  }
  const primary = recipe.weather_primary || 'mild';
  const technique = inferTechnique(recipe);
  if (TASTE_BY_TECHNIQUE[technique]) return TASTE_BY_TECHNIQUE[technique];
  const flavor = (recipe.flavor_profile || '').toLowerCase();
  if (flavor.includes('spicy')) return 'smoky';
  if (flavor.includes('cream')) return 'rich';
  return TASTE_BY_WEATHER[primary] || 'clean';
}

function inferOccasion(recipe, weatherTag) {
  if (recipe.occasion) return recipe.occasion;
  if (recipe.fineDiningMeta?.service === 'tasting-menu') return 'date-night';
  if (weatherTag === 'cold') return 'rainy-evening';
  if (weatherTag === 'hot') return 'summer-lunch';
  if (recipe.effort === 'elaborate') return 'date-night';
  if (recipe.effort === 'quick') return 'solo';
  return 'family';
}

function inferSkillFocus(recipe) {
  if (recipe.skill_focus) return recipe.skill_focus;
  const technique = inferTechnique(recipe);
  if (/Emulsion|Sear|Pan/.test(technique)) return 'searing';
  if (/Braise|Simmer|Roast/.test(technique)) return 'braising';
  if (/Bake/.test(technique)) return 'plating';
  return 'knife-work';
}

function buildMiseEnPlace(recipe) {
  if (recipe.mise_en_place?.length) return recipe.mise_en_place;
  const items = [];
  const ings = (recipe.ingredients || []).slice(0, 5);
  for (const ing of ings) {
    items.push(`Prep ${ing.name}${ing.amount ? ` (${ing.amount}${ing.unit ? ' ' + ing.unit : ''})` : ''}`);
  }
  if ((recipe.totalMinutes || 0) > 60) items.push('Measure aromatics and stock before searing');
  if (items.length < 3) items.push('Read through all steps once before starting');
  return items.slice(0, 4);
}

function buildWhyThisWorks(recipe, weatherTag, effortLevel) {
  if (recipe.why_this_works) return recipe.why_this_works;
  const mood = WEATHER_MOODS[weatherTag] || 'mild-balanced';
  const taste = inferTasteProfile(recipe);
  const technique = inferTechnique(recipe);
  const moodCopy = {
    'sunny-light': 'Light and vibrant for warm weather',
    'rain-comfort': 'Deep comfort for rainy, cooler days',
    'mild-balanced': 'Balanced and versatile for everyday cooking'
  };
  return `${moodCopy[mood] || 'Well matched to today'} — ${taste} flavors via ${technique.toLowerCase()}, suited to ${effortLevel || recipe.effort || 'medium'} effort.`;
}

function buildChefMove(recipe) {
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

const GENERIC_DESCRIPTION_PATTERNS = [
  'chef-curated premium selection',
  'refined technique and balanced flavors',
  'restaurant-level plating'
];

const INSTRUCTION_DESCRIPTION_PATTERNS = [
  /^step\s*\d/i,
  /^for the /i,
  /^heat\s/i,
  /^preheat/i,
  /^adjust oven/i,
  /^rinse the /i,
  /^slice\s/i,
  /^place them in a bowl/i,
  /^cook\s/i,
  /^break\s/i,
  /^mix\s/i,
  /^stir\s/i,
  /^grill\s/i,
  /^bake\s/i,
  /^boil\s/i,
  /^simmer\s/i,
  /^whisk\s/i,
  /^season\s/i,
  /^\d+\.\s/
];

function looksLikeInstruction(description) {
  const text = (description || '').trim();
  if (!text) return false;
  if (text.length > 200) return true;
  if (/\r?\n/.test(text)) return true;
  const firstLine = text.split(/\r?\n/)[0].trim();
  if (INSTRUCTION_DESCRIPTION_PATTERNS.some((re) => re.test(firstLine))) return true;
  if (/^in a\s/i.test(firstLine) || /^take a\s/i.test(firstLine) || /^\d+\)/.test(firstLine)) {
    return true;
  }
  if (/heat the oil|preheat oven|preheat the oven|preheat oven/i.test(text)) return true;
  return false;
}

function isGenericDescription(description) {
  const text = (description || '').trim().toLowerCase();
  return GENERIC_DESCRIPTION_PATTERNS.some((pattern) => text.includes(pattern));
}

function buildPremiumDescription(recipe) {
  const name = recipe.name || recipe.name_en || 'This dish';
  const technique = inferTechnique(recipe);
  const taste = inferTasteProfile(recipe);
  const cuisine = recipe.cuisine ? ` ${recipe.cuisine}` : '';
  const effort = recipe.effort || 'medium';
  return `${name}${cuisine ? ` (${cuisine.trim()})` : ''}: ${taste} flavors through ${technique.toLowerCase()}, tuned for ${effort} effort at home.`;
}

function ensureDescription(recipe, context = {}) {
  const name = (recipe.name || recipe.name_en || '').trim();
  let description = (recipe.description || recipe.description_en || '').trim();
  if (looksLikeInstruction(description)) description = '';
  if (!description || description === name || isGenericDescription(description)) {
    const editorial = enrichEditorialFields(recipe, context);
    description = editorial.why_this_works || buildPremiumDescription({ ...recipe, ...editorial });
  }
  return description;
}

function enrichEditorialFields(recipe, context = {}) {
  const weatherTag = context.weatherTag || recipe.weather_primary || 'mild';
  const effortLevel = context.effortLevel || recipe.effort || 'medium';
  return {
    taste_profile: inferTasteProfile(recipe),
    weather_mood: WEATHER_MOODS[weatherTag] || 'mild-balanced',
    occasion: inferOccasion(recipe, weatherTag),
    skill_focus: inferSkillFocus(recipe),
    mise_en_place: buildMiseEnPlace(recipe),
    why_this_works: buildWhyThisWorks(recipe, weatherTag, effortLevel),
    chef_move: buildChefMove(recipe),
    technique: inferTechnique(recipe)
  };
}

module.exports = {
  TASTE_PROFILES,
  enrichEditorialFields,
  inferTechnique,
  buildPremiumDescription,
  ensureDescription,
  looksLikeInstruction
};
