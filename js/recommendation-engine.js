/**
 * Explainable recommendation scoring v2 — weather mood, taste, occasion, diversity.
 */

import { getPreferences, getHomeInventory } from './storage.js';
import { highProteinBoost } from './protein-preferences.js';
import { homeIngredientBoost } from './home-inventory.js';
import { isFavorite } from './recipe-store.js';
import { effortScoreBoost } from './recipe-complexity.js';
import { inferProtein } from './recipe-meta.js';
import {
  inferTasteProfile,
  inferWeatherMood,
  inferOccasion
} from './editorial-recipe.js';

export function scoreRecipe(recipe, context = {}) {
  const {
    weatherTag = 'mild',
    mealType = null,
    effortLevel = null,
    dayIndex = 0,
    listIndex = 0,
    usedIds = null,
    usedCuisines = null,
    usedProteins = null,
    usedTastes = null,
    usedTechniques = null
  } = context;

  const prefs = getPreferences();
  const reasons = [];
  let score = 0;

  if (mealType && (recipe.meal_type || []).includes(mealType)) {
    score += 3;
    reasons.push('mealTypeMatch');
  }

  const effortBoost = effortScoreBoost(recipe.effort, effortLevel);
  if (effortBoost > 0) {
    score += effortBoost;
    reasons.push('effortMatch');
  }

  const recipeMood = recipe.weather_mood || inferWeatherMood(recipe.weather_primary || weatherTag);
  const targetMood = inferWeatherMood(weatherTag);
  if (recipeMood === targetMood) {
    score += 2.5;
    reasons.push('weatherMood');
  }

  const taste = recipe.taste_profile || inferTasteProfile(recipe);
  if (weatherTag === 'hot' && ['bright', 'fresh', 'clean'].includes(taste)) {
    score += 1.5;
    reasons.push('tasteWeather');
  } else if (weatherTag === 'cold' && ['comforting', 'rich', 'umami'].includes(taste)) {
    score += 1.5;
    reasons.push('tasteWeather');
  }

  const occasion = recipe.occasion || inferOccasion(recipe, weatherTag);
  if (effortLevel === 'elaborate' && occasion === 'date-night') {
    score += 1;
    reasons.push('occasionFit');
  }
  if (effortLevel === 'quick' && occasion === 'solo') {
    score += 0.8;
    reasons.push('occasionFit');
  }

  if (recipe.tier === 'premium') {
    score += 3;
    reasons.push('premium');
  }
  if (recipe.qualityScore) score += recipe.qualityScore * 1.2;
  if (recipe.rating) score += recipe.rating * 0.8;
  if (recipe.chef) score += 1;
  if (recipe.fineDiningMeta?.style === 'haute-cuisine') {
    score += 1.5;
    reasons.push('hauteCuisine');
  }
  if (recipe.hasFullData !== false && recipe.ingredients?.length) score += 0.5;
  if (recipe.external) score += 0.5;
  if (prefs.preferExoticIngredients && recipe.exoticScore) score += recipe.exoticScore * 0.8;
  if (isFavorite(recipe.id)) {
    score += 4;
    reasons.push('favorite');
  }

  if (prefs.preferHighProtein) {
    const proteinBoost = highProteinBoost(recipe);
    if (proteinBoost > 0) {
      score += proteinBoost;
      reasons.push('highProtein');
    }
  }

  if (prefs.preferHomeIngredients) {
    const inventory = context.homeInventory ?? getHomeInventory();
    const { boost, missing, total } = homeIngredientBoost(recipe, inventory);
    if (boost > 0) {
      score += boost;
      reasons.push('usesHomeIngredients');
      if (total > 0 && missing.length <= 2) reasons.push('minimalShopping');
    }
  }

  if (usedIds?.has(recipe.id)) {
    score -= 10;
    reasons.push('repeatDish');
  }
  if (recipe.cuisine && usedCuisines?.has(recipe.cuisine)) {
    score -= 4;
    reasons.push('repeatCuisine');
  }
  if (usedProteins?.has(inferProtein(recipe))) {
    score -= 5;
    reasons.push('repeatProtein');
  }
  if (usedTastes?.has(taste)) {
    score -= 2.5;
    reasons.push('repeatTaste');
  }
  const technique = recipe.technique || '';
  if (usedTechniques?.has(technique)) {
    score -= 2;
    reasons.push('repeatTechnique');
  }

  score -= (listIndex + dayIndex) * 0.01;

  return { score, reasons, taste, occasion, technique };
}

export function rankRecipes(recipes, context = {}) {
  return recipes
    .map((recipe, i) => {
      const result = scoreRecipe(recipe, { ...context, listIndex: i });
      return { recipe, ...result };
    })
    .sort((a, b) => b.score - a.score);
}
