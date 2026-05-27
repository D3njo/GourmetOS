/**
 * Weekly plan composition — balance score, story, fatigue tracking.
 */

import { t } from './i18n.js';
import { inferTasteProfile } from './editorial-recipe.js';
import { inferProtein } from './recipe-meta.js';

export function createWeekDiversity() {
  return {
    usedIds: new Set(),
    usedCuisines: new Set(),
    usedProteins: new Set(),
    usedTastes: new Set(),
    usedTechniques: new Set()
  };
}

export function trackWeekRecipe(recipe, diversity) {
  if (!recipe || !diversity) return;
  diversity.usedIds.add(recipe.id);
  if (recipe.cuisine) diversity.usedCuisines.add(recipe.cuisine);
  diversity.usedProteins.add(inferProtein(recipe));
  diversity.usedTastes.add(recipe.taste_profile || inferTasteProfile(recipe));
  if (recipe.technique) diversity.usedTechniques.add(recipe.technique);
}

export function computeCompositionScore(weeklyPlan) {
  if (!weeklyPlan?.length) return { score: 0, proteins: 0, cuisines: 0, tastes: 0, efforts: [] };

  const proteins = new Set();
  const cuisines = new Set();
  const tastes = new Set();
  const efforts = [];

  for (const day of weeklyPlan) {
    for (const recipe of day.recipes || []) {
      if (!recipe) continue;
      proteins.add(inferProtein(recipe));
      if (recipe.cuisine) cuisines.add(recipe.cuisine);
      tastes.add(recipe.taste_profile || inferTasteProfile(recipe));
    }
    if (day.effortLevel) efforts.push(day.effortLevel);
  }

  const proteinScore = Math.min(proteins.size, 5) * 4;
  const cuisineScore = Math.min(cuisines.size, 6) * 3;
  const tasteScore = Math.min(tastes.size, 5) * 3;
  const effortVariety = new Set(efforts).size >= 2 ? 10 : 5;
  const score = Math.min(100, proteinScore + cuisineScore + tasteScore + effortVariety);

  return { score, proteins: proteins.size, cuisines: cuisines.size, tastes: tastes.size, efforts };
}

export function buildWeekStory(weeklyPlan) {
  if (!weeklyPlan?.length) return '';

  const coldDays = weeklyPlan.filter((d) => d.weatherTag === 'cold').length;
  const hotDays = weeklyPlan.filter((d) => d.weatherTag === 'hot').length;
  const premiumCount = weeklyPlan.reduce(
    (n, d) => n + (d.recipes || []).filter((r) => r?.tier === 'premium').length,
    0
  );
  const elaborateDays = weeklyPlan.filter((d) => d.effortLevel === 'elaborate').length;

  const parts = [];
  if (coldDays >= 3) parts.push('a comfort-forward arc for cooler days');
  else if (hotDays >= 3) parts.push('a bright, lighter rhythm for warm weather');
  else parts.push('a balanced week across moods and temperatures');

  if (premiumCount >= 3) parts.push(`${premiumCount} chef-curated picks`);
  if (elaborateDays >= 2) parts.push('weekend room for something elaborate');

  const seafoodBreak = weeklyPlan.find((d) =>
    (d.recipes || []).some((r) => inferProtein(r) === 'fish' || inferProtein(r) === 'seafood')
  );
  if (seafoodBreak && coldDays >= 2) {
    parts.push(`a seafood break on ${seafoodBreak.label}`);
  }

  return `This week: ${parts.join(', ')}.`;
}

export function compositionSummary(composition) {
  return t('weekCompositionSummary')
    .replace('{score}', String(composition.score))
    .replace('{proteins}', String(composition.proteins))
    .replace('{cuisines}', String(composition.cuisines))
    .replace('{tastes}', String(composition.tastes));
}
