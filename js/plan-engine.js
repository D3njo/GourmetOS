/** Central meal plan engine — selections, alternatives, weekly plan assembly */

import {
  getMealPlan,
  getPlanSelectionsForMode,
  savePlanSelectionsForMode,
  getActivePlanModeKey,
  getDayEffort
} from './storage.js';
import { loadRecipes, getRecipeOptions, getRecipeById } from './recipes.js';
import { getRecipeWeatherPrimary } from './weather-buckets.js';
import { resolveRecipesForSlots } from './recipe-loader.js';
import { getWeatherTagForDate, getCurrentWeekDates, getManualWeatherMode } from './weather.js';
import { getDayLabels, t } from './i18n.js';
import { toDateKey } from './menu-refresh.js';
import { createWeekDiversity, trackWeekRecipe } from './week-composition.js';

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
      return recipe && getRecipeWeatherPrimary(recipe) === weatherTag;
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
    const recipeId = pick || options[0]?.id || allRecipes[0]?.id;
    ids.push(recipeId);
    trackRecipeDiversity(
      allRecipes.find((r) => r.id === recipeId) || options[0],
      diversity
    );
  }

  return ids;
}

export { DAY_KEYS };

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
  const selections = getPlanSelectionsForMode(modeKey);
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
      const selected =
        getRecipeById(db.recipes, recipeId) ||
        alternatives[0] ||
        db.recipes[0];

      if (selected && !alternatives.some((a) => a.id === selected.id)) {
        alternatives = [selected, ...alternatives].slice(0, 3);
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

  savePlanSelectionsForMode(modeKey, updatedSelections);

  const allIds = days.flatMap((d) => d.slots.flatMap((s) => [s.recipeId, ...s.alternatives.map((a) => a.id)]));
  const resolvedMap = await resolveRecipesForSlots(allIds);

  return days.map((day) => {
    const slots = day.slots.map((slot) => ({
      ...slot,
      selected: resolvedMap.get(slot.recipeId) || slot.selected,
      alternatives: slot.alternatives.map((a) => resolvedMap.get(a.id) || a)
    }));
    return {
      ...day,
      slots,
      recipes: slots.map((s) => s.selected)
    };
  });
}

export function setSlotSelection(dayKey, slotIndex, recipeId) {
  const modeKey = getActivePlanModeKey();
  const selections = getPlanSelectionsForMode(modeKey);
  const ids = [...(selections[dayKey] || [])];
  ids[slotIndex] = recipeId;
  selections[dayKey] = ids;
  savePlanSelectionsForMode(modeKey, selections);
}

export function cycleSlotAlternative(dayKey, slotIndex, alternatives, currentId) {
  if (!alternatives?.length) return currentId;
  const idx = alternatives.findIndex((r) => r.id === currentId);
  const next = alternatives[(idx + 1) % alternatives.length];
  setSlotSelection(dayKey, slotIndex, next.id);
  return next.id;
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
