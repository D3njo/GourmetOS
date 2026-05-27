/** Central meal plan engine — selections, alternatives, weekly plan assembly */

import {
  getMealPlan,
  getPlanSelectionsForMode,
  savePlanSelectionsForMode,
  getActivePlanModeKey,
  getDayEffort
} from './storage.js';
import { loadRecipes, getRecipeOptions, getRecipeById, prepareRecipe } from './recipes.js';
import { resolveRecipe } from './recipe-loader.js';
import { getRecipeWeatherPrimary } from './weather-buckets.js';
import { resolveRecipesForSlots } from './recipe-loader.js';
import { getWeatherTagForDate, getCurrentWeekDates, getManualWeatherMode } from './weather.js';
import { getDayLabels, t } from './i18n.js';
import { toDateKey } from './menu-refresh.js';
import { createWeekDiversity, trackWeekRecipe } from './week-composition.js';
import { isRecipeAllowed, sanitizePlanSelections } from './exclusions.js';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const MEAL_TYPE_ROTATION = ['breakfast', 'lunch', 'dinner', 'snack', 'brunch'];

export function getMealTypeForSlot(slotIndex, mealCount, dayKey) {
  if (dayKey === 'sunday' && mealCount === 1) return 'brunch';
  if (dayKey === 'monday' && mealCount === 1) return 'dinner';
  if (mealCount === 1) return 'dinner';
  if (mealCount === 2) return slotIndex === 0 ? 'lunch' : 'dinner';
  if (mealCount >= 3) {
    const types = ['breakfast', 'lunch', 'dinner', 'snack', 'dinner'];
    return types[slotIndex] || 'dinner';
  }
  return MEAL_TYPE_ROTATION[slotIndex % MEAL_TYPE_ROTATION.length];
}

export function mealTypeLabel(mealType) {
  const key = `mealType_${mealType}`;
  const label = t(key);
  return label !== key ? label : mealType;
}

function defaultRecipeId(options, slotIndex) {
  if (!options.length) return null;
  return options[slotIndex % options.length].id;
}

function trackRecipeDiversity(recipe, diversity) {
  trackWeekRecipe(recipe, diversity);
}

function resolveDaySelections(
  dayKey,
  mealCount,
  weatherTag,
  effortLevel,
  allRecipes,
  excludedTags,
  storedIds,
  diversity
) {
  const ids = [...(storedIds || [])]
    .slice(0, mealCount)
    .filter((id) => {
      const recipe = allRecipes.find((r) => r.id === id);
      return (
        recipe &&
        getRecipeWeatherPrimary(recipe) === weatherTag &&
        isRecipeAllowed(recipe, { presetTags: excludedTags })
      );
    });
  for (const id of ids) {
    trackRecipeDiversity(allRecipes.find((r) => r.id === id), diversity);
  }

  while (ids.length < mealCount) {
    const slotIndex = ids.length;
    const mealType = getMealTypeForSlot(slotIndex, mealCount, dayKey);
    const options = getRecipeOptions(allRecipes, {
      weatherTag,
      mealType,
      effortLevel,
      excludedTags,
      limit: 3,
      dayIndex: DAY_KEYS.indexOf(dayKey),
      usedIds: diversity?.usedIds,
      usedCuisines: diversity?.usedCuisines,
      usedProteins: diversity?.usedProteins,
      usedTastes: diversity?.usedTastes,
      usedTechniques: diversity?.usedTechniques
    });
    const pick = defaultRecipeId(
      options.filter((r) => !ids.includes(r.id)),
      slotIndex
    );
    const fallback = allRecipes.find((r) => isRecipeAllowed(r, { presetTags: excludedTags }));
    const recipeId = pick || options[0]?.id || fallback?.id;
    if (!recipeId) break;
    ids.push(recipeId);
    trackRecipeDiversity(
      allRecipes.find((r) => r.id === recipeId) || options[0],
      diversity
    );
  }

  return ids;
}

export { DAY_KEYS };

/**
 * After API resolve: re-validate full recipes (stubs may lack ingredients).
 * Replaces blocked selections with allowed options; filters alternatives.
 */
function enforceAllergenSafetyOnSlot(slot, day, dayIndex, allRecipes, excludedTags, diversity) {
  const allowOpts = { presetTags: excludedTags };

  const pickReplacement = () => {
    const options = getRecipeOptions(allRecipes, {
      weatherTag: day.weatherTag,
      mealType: slot.mealType,
      effortLevel: day.effortLevel,
      excludedTags,
      limit: 5,
      dayIndex,
      usedIds: diversity?.usedIds,
      usedCuisines: diversity?.usedCuisines,
      usedProteins: diversity?.usedProteins,
      usedTastes: diversity?.usedTastes,
      usedTechniques: diversity?.usedTechniques
    });
    return options.find((r) => isRecipeAllowed(r, allowOpts)) ?? null;
  };

  let selected = slot.selected;
  if (selected && !isRecipeAllowed(selected, allowOpts)) {
    selected = pickReplacement();
  }

  let alternatives = (slot.alternatives || [])
    .map((a) => (isRecipeAllowed(a, allowOpts) ? a : null))
    .filter(Boolean);

  if (selected?.id) {
    if (!alternatives.some((a) => a.id === selected.id)) {
      alternatives = [selected, ...alternatives].slice(0, 3);
    } else {
      alternatives = [selected, ...alternatives.filter((a) => a.id !== selected.id)].slice(0, 3);
    }
  } else {
    selected = alternatives[0] ?? null;
  }

  if (selected) {
    trackRecipeDiversity(selected, diversity);
  }

  return {
    ...slot,
    selected,
    alternatives,
    recipeId: selected?.id ?? null,
    allergenBlocked: !selected
  };
}

export function getTodayDayKey() {
  const weekDates = getCurrentWeekDates();
  const todayStr = toDateKey();
  const match = weekDates.find((d) => d.dateStr === todayStr);
  return match?.dayKey ?? weekDates[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]?.dayKey;
}

export async function buildWeeklyPlan(forecast, excludedTags = []) {
  const db = await loadRecipes();
  const plan = getMealPlan();
  const modeKey = getActivePlanModeKey();
  const manualOverride = getManualWeatherMode();
  const recipeById = new Map(db.recipes.map((r) => [r.id, r]));
  const rawSelections = getPlanSelectionsForMode(modeKey);
  const selections = sanitizePlanSelections(rawSelections, { presetTags: excludedTags, recipesById: recipeById });
  const weekDates = getCurrentWeekDates();
  const dayLabels = getDayLabels();
  const updatedSelections = { ...selections };
  const diversity = createWeekDiversity();

  const days = weekDates.map(({ dayKey, dateStr }, index) => {
    const mealCount = plan[dayKey] ?? 2;
    const weatherTag = getWeatherTagForDate(dateStr, forecast, manualOverride);
    const effortLevel = getDayEffort(dayKey);
    const dayForecast = forecast?.daily?.find((d) => d.date === dateStr);

    const storedIds = resolveDaySelections(
      dayKey,
      mealCount,
      weatherTag,
      effortLevel,
      db.recipes,
      excludedTags,
      selections[dayKey],
      diversity
    );
    updatedSelections[dayKey] = storedIds;

    const slots = storedIds.map((recipeId, slotIndex) => {
      const mealType = getMealTypeForSlot(slotIndex, mealCount, dayKey);
      let alternatives = getRecipeOptions(db.recipes, {
        weatherTag,
        mealType,
        effortLevel,
        excludedTags,
        limit: 3,
        dayIndex: index + slotIndex,
        usedIds: diversity.usedIds,
        usedCuisines: diversity.usedCuisines,
        usedProteins: diversity.usedProteins,
        usedTastes: diversity.usedTastes,
        usedTechniques: diversity.usedTechniques
      });

      let selected =
        getRecipeById(db.recipes, recipeId) ||
        alternatives[0] ||
        db.recipes.find((r) => isRecipeAllowed(r, { presetTags: excludedTags }));

      if (selected && !isRecipeAllowed(selected, { presetTags: excludedTags })) {
        selected = alternatives[0] ?? null;
      }

      alternatives = alternatives.filter((a) => isRecipeAllowed(a, { presetTags: excludedTags }));

      if (selected?.id && isRecipeAllowed(selected, { presetTags: excludedTags })) {
        if (!alternatives.some((a) => a.id === selected.id)) {
          alternatives = [selected, ...alternatives].slice(0, 3);
        } else {
          alternatives = [selected, ...alternatives.filter((a) => a.id !== selected.id)].slice(0, 3);
        }
      }

      return {
        slotIndex,
        mealType,
        mealTypeLabel: mealTypeLabel(mealType),
        selected,
        alternatives,
        recipeId: selected?.id
      };
    });

    return {
      dayKey,
      label: dayLabels[index],
      dateStr,
      mealCount,
      weatherTag,
      effortLevel,
      forecast: dayForecast,
      slots,
      recipes: slots.map((s) => s.selected)
    };
  });

  const allIds = days.flatMap((d) => d.slots.flatMap((s) => [s.recipeId, ...s.alternatives.map((a) => a.id)]));
  const resolvedMap = await resolveRecipesForSlots(allIds);

  const safeDays = days.map((day, index) => {
    const slots = day.slots.map((slot) => {
      const resolved = {
        ...slot,
        selected: resolvedMap.get(slot.recipeId) || slot.selected,
        alternatives: slot.alternatives.map((a) => resolvedMap.get(a.id) || a)
      };
      return enforceAllergenSafetyOnSlot(resolved, day, index, db.recipes, excludedTags, diversity);
    });

    updatedSelections[day.dayKey] = slots.map((s) => s.recipeId).filter(Boolean);

    return {
      ...day,
      slots,
      recipes: slots.map((s) => s.selected).filter(Boolean)
    };
  });

  savePlanSelectionsForMode(modeKey, updatedSelections);

  return safeDays;
}

export function setSlotSelection(dayKey, slotIndex, recipeId) {
  const modeKey = getActivePlanModeKey();
  const selections = getPlanSelectionsForMode(modeKey);
  const ids = [...(selections[dayKey] || [])];
  ids[slotIndex] = recipeId;
  selections[dayKey] = ids;
  savePlanSelectionsForMode(modeKey, selections);
}

/** Stable ring: selected first, then other alternatives in list order (for cycling). */
export function buildAlternativeRing(selected, alternatives = []) {
  const byId = new Map();
  const ring = [];

  const add = (recipe) => {
    if (!recipe?.id || byId.has(recipe.id)) return;
    byId.set(recipe.id, recipe);
    ring.push(recipe);
  };

  add(selected);
  for (const alt of alternatives) add(alt);
  return ring;
}

export function getNextAlternativeId(alternatives, currentId, selected) {
  const ring = buildAlternativeRing(
    selected || alternatives?.find((r) => r.id === currentId),
    alternatives
  );
  if (ring.length <= 1) return currentId ?? ring[0]?.id ?? null;
  const idx = ring.findIndex((r) => r.id === currentId);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % ring.length;
  return ring[nextIdx].id;
}

export function cycleSlotAlternative(_dayKey, _slotIndex, alternatives, currentId, selected) {
  return getNextAlternativeId(alternatives, currentId, selected);
}

/** Reorder alternatives with selected first — keeps pills/chips stable after a swap. */
export function normalizeSlotAlternatives(slot) {
  if (!slot?.selected) return slot?.alternatives ?? [];
  const selected = slot.selected;
  const others = (slot.alternatives || []).filter((a) => a.id !== selected.id);
  return [selected, ...others].slice(0, 3);
}

/**
 * Update one slot in the in-memory weekly plan (no full rebuild).
 * Resolves recipe body only when needed.
 */
export async function refreshSlotInPlan(weeklyPlan, dayKey, slotIndex, recipeId) {
  const day = weeklyPlan?.find((d) => d.dayKey === dayKey);
  const slot = day?.slots?.[slotIndex];
  if (!slot || !recipeId) return;

  setSlotSelection(dayKey, slotIndex, recipeId);

  const context = {
    weatherTag: day.weatherTag,
    effortLevel: day.effortLevel ?? slot.selected?.effort
  };

  let recipe =
    slot.alternatives?.find((a) => a.id === recipeId) ||
    (slot.selected?.id === recipeId ? slot.selected : null);

  if (!recipe?.ingredients?.length) {
    recipe = await resolveRecipe(recipeId);
  }
  if (!recipe) {
    const db = await loadRecipes();
    recipe = getRecipeById(db.recipes, recipeId);
  }
  if (!recipe || !isRecipeAllowed(recipe)) {
    const ring = buildAlternativeRing(slot.selected, slot.alternatives);
    const allowed = ring.find((r) => r.id !== recipeId && isRecipeAllowed(r));
    if (!allowed) return;
    recipeId = allowed.id;
    setSlotSelection(dayKey, slotIndex, recipeId);
    recipe = allowed;
    if (!recipe.ingredients?.length) {
      recipe = await resolveRecipe(recipeId);
    }
    if (!recipe || !isRecipeAllowed(recipe)) return;
  }

  slot.selected = prepareRecipe(recipe, context);
  slot.recipeId = slot.selected.id;
  slot.alternatives = normalizeSlotAlternatives({
    selected: slot.selected,
    alternatives: (slot.alternatives || []).filter((a) => isRecipeAllowed(a))
  });
  day.recipes = day.slots.map((s) => s.selected);
}

export function getTodayPrimarySlot(weeklyPlan) {
  const dayKey = getTodayDayKey();
  const day = weeklyPlan?.find((d) => d.dayKey === dayKey);
  return day?.slots?.[0] ?? null;
}

export function getTodaySlots(weeklyPlan) {
  const dayKey = getTodayDayKey();
  const day = weeklyPlan?.find((d) => d.dayKey === dayKey);
  return day?.slots ?? [];
}

export function getTodayDay(weeklyPlan) {
  const dayKey = getTodayDayKey();
  return weeklyPlan?.find((d) => d.dayKey === dayKey) ?? null;
}
