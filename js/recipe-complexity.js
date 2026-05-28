/** Recipe effort & complexity scoring */

export const EXOTIC_INGREDIENTS = [
  'yuzu',
  'saffron',
  'miso',
  'katsuobushi',
  'kombu',
  'dashi',
  'tamarind',
  'galangal',
  'lemongrass',
  'harissa',
  'sumac',
  'zaatar',
  'pomegranate molasses',
  'fish sauce',
  'oyster sauce',
  'mirin',
  'sake',
  'gochujang',
  'kimchi',
  'truffle',
  'caviar',
  'foie gras',
  'duck fat',
  'xanthan',
  'agar',
  'sous-vide',
  'cardamom',
  'star anise',
  'fenugreek',
  'tahini',
  'preserved lemon',
  'bonito',
  'nori',
  'wasabi',
  'matcha',
  'panko',
  'sambal',
  'palm sugar',
  'jaggery',
  'chipotle',
  'ancho',
  'guajillo'
];

export const EFFORT_LEVELS = ['quick', 'medium', 'elaborate'];

export function computeTotalMinutes(recipe) {
  if (recipe.readyInMinutes != null && recipe.readyInMinutes > 0) {
    return recipe.readyInMinutes;
  }
  const steps = recipe.steps || [];
  if (steps.length) {
    const sum = steps.reduce((acc, s) => acc + (s.time_minutes || 0), 0);
    if (sum > 0) return sum;
  }
  return Math.max(15, (steps.length || 3) * 12);
}

export function computeIngredientCount(recipe) {
  return (recipe.ingredients || []).filter((i) => i.name?.trim()).length;
}

export function computeExoticScore(recipe) {
  const text = (recipe.ingredients || [])
    .map((i) => i.name.toLowerCase())
    .join(' ');
  let score = 0;
  for (const term of EXOTIC_INGREDIENTS) {
    if (text.includes(term.toLowerCase())) score += 1;
  }
  return score;
}

export function computeEffortLevel(recipe) {
  const totalMinutes = recipe.totalMinutes ?? computeTotalMinutes(recipe);
  const ingredientCount = recipe.ingredientCount ?? computeIngredientCount(recipe);
  const exoticScore = recipe.exoticScore ?? computeExoticScore(recipe);

  if (totalMinutes > 90 || ingredientCount >= 14 || exoticScore >= 3) {
    return 'elaborate';
  }
  if (totalMinutes <= 45 && ingredientCount <= 8 && exoticScore <= 1) {
    return 'quick';
  }
  return 'medium';
}

/** Enrich recipe with complexity fields */
export function enrichRecipeComplexity(recipe) {
  const totalMinutes = computeTotalMinutes(recipe);
  const ingredientCount = computeIngredientCount(recipe);
  const exoticScore = computeExoticScore(recipe);
  const effort = computeEffortLevel({ ...recipe, totalMinutes, ingredientCount, exoticScore });

  return {
    ...recipe,
    totalMinutes,
    ingredientCount,
    exoticScore,
    effort
  };
}

export function effortMatchesFilter(recipeEffort, targetEffort) {
  if (!targetEffort) return true;
  const effort = recipeEffort || 'medium';
  if (targetEffort === 'quick') {
    return effort === 'quick' || effort === 'medium';
  }
  if (targetEffort === 'elaborate') {
    return effort === 'elaborate' || effort === 'medium';
  }
  return true;
}

export function effortScoreBoost(recipeEffort, targetEffort) {
  if (!targetEffort || !recipeEffort) return 0;
  if (recipeEffort === targetEffort) return 3;
  if (targetEffort === 'quick' && recipeEffort === 'medium') return 1;
  if (targetEffort === 'elaborate' && recipeEffort === 'medium') return 1;
  if (targetEffort === 'medium' && recipeEffort === 'medium') return 2;
  return 0;
}

export function formatEffortBadge(recipe) {
  const mins = recipe.totalMinutes ?? computeTotalMinutes(recipe);
  const count = recipe.ingredientCount ?? computeIngredientCount(recipe);
  return `${mins} min · ${count} ingredients`;
}
