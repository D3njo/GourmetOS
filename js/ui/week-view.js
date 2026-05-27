import {
  getDayEffort,
  setDayEffort,
  clearDayPlanSelection,
  getActivePlanModeKey,
  getUnitSystem as getStoredUnitSystem
} from '../storage.js';
import { isOnlineOnly, recipeImageUrl } from '../recipe-loader.js';
import { scaleIngredients, formatAmount } from '../portions.js';
import { getMealCount, setMealCount } from '../meal-plan.js';
import { cycleSlotAlternative } from '../plan-engine.js';
import { t, weatherLabelKey } from '../i18n.js';
import { formatTemperature as formatTempUnits } from '../units.js';
import { weatherIcon } from '../weather.js';
import { getRecipeSourceLabel, getRecipeSourceUrl } from '../recipe-api.js';
import { bridge } from '../app-bridge.js';
import { state } from '../app-state.js';
import { $, escapeHtml, escapeAttr } from './dom.js';
import {
  effortPillsHtml,
  recipeEffortBadge,
  slotSourceLabel,
  slotExpandKey,
  addDays,
  localTodayStr
} from './helpers.js';
import { compareAlternativeReason, reasonLabel } from '../editorial-recipe.js';
import {
  buildWeekStory,
  computeCompositionScore,
  compositionSummary
} from '../week-composition.js';

function renderSlotIngredients(recipe) {
  if (isOnlineOnly(recipe)) {
    const url = getRecipeSourceUrl(recipe);
    const source = getRecipeSourceLabel(recipe);
    return `
      <p class="text-muted text-xs m-0 mb-2">${t('onlineOnlyRecipe')}</p>
      ${
        url
          ? `<button type="button" class="open-recipe-link ripple-host" data-url="${escapeAttr(url)}">${escapeHtml(t('openFullRecipe').replace('{source}', source))}</button>`
          : ''
      }
    `;
  }

  const scaled = scaleIngredients(recipe.ingredients, recipe.base_portions, state.portions);
  return scaled
    .map(
      (ing) => `
    <div class="ingredient-row">
      <span>${escapeHtml(ing.name)}</span>
      <span class="ingredient-amount">${escapeHtml(formatAmount(ing.amount, ing.unit))}</span>
    </div>
  `
    )
    .join('');
}

export function renderWeekView() {
  const container = $('#week-matrix');
  if (!container || !state.weeklyPlan) return;

  const storyEl = $('#week-story');
  if (storyEl) {
    const composition = computeCompositionScore(state.weeklyPlan);
    const story = buildWeekStory(state.weeklyPlan);
    storyEl.hidden = false;
    storyEl.innerHTML = `
      <p class="week-story-text m-0 mb-2">${escapeHtml(story)}</p>
      <p class="week-composition m-0">${escapeHtml(compositionSummary(composition))}</p>
    `;
  }

  const todayStr = localTodayStr();
  const planningStart = state.forecast?.planningStart;

  container.innerHTML = state.weeklyPlan
    .map((day) => {
      const isToday = day.dateStr === todayStr;
      const inWindow =
        planningStart &&
        day.dateStr >= planningStart &&
        day.dateStr <= addDays(planningStart, 6);
      const temp =
        day.forecast != null
          ? formatTempUnits(
              (day.forecast.tempMax + day.forecast.tempMin) / 2,
              getStoredUnitSystem()
            )
          : null;

      const slotsHtml = day.slots
        .map((slot) => {
          const expandKey = slotExpandKey(day.dayKey, slot.slotIndex);
          const isExpanded = state.expandedSlots.has(expandKey);
          const r = slot.selected;

          return `
          <div class="meal-slot-card glass-inner">
            <div class="meal-slot-header">
              <img class="meal-slot-thumb" src="${escapeAttr(recipeImageUrl(r))}" alt="" loading="lazy">
              <div class="meal-slot-info">
                <span class="meal-slot-type">${escapeHtml(slot.mealTypeLabel)}</span>
                <h4 class="meal-slot-title">${escapeHtml(r.name)}</h4>
                <span class="tag tag-sm">${escapeHtml(r.technique)}</span>
                <span class="tag tag-sm effort-tag">${recipeEffortBadge(r)}</span>
                <span class="tag tag-sm">${slotSourceLabel(r)}${r.isCustomized ? ' · ' + t('sourceCustomized') : ''}${isOnlineOnly(r) ? ' · ' + t('onlineOnlyRecipe') : ''}</span>
                ${r.tier === 'premium' ? `<span class="tag tag-sm premium-tag">${t('premiumBadge')}</span>` : ''}
              </div>
            </div>
            <div class="meal-slot-actions">
              <button type="button" class="slot-expand-btn" data-expand="${expandKey}" aria-expanded="${isExpanded}">
                ${t('viewIngredients')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <button type="button" class="slot-swap-btn ripple-host" data-day="${day.dayKey}" data-slot="${slot.slotIndex}">
                ↻ ${t('swapRecipe')}
              </button>
            </div>
            <div class="meal-slot-alts">
              ${slot.alternatives
                .map((alt) => {
                  const reason = compareAlternativeReason(r, alt);
                  const reasonText = reasonLabel(reason);
                  const name = alt.name.length > 20 ? alt.name.slice(0, 18) + '…' : alt.name;
                  return `
                <button type="button" class="alt-chip ${alt.id === r.id ? 'active' : ''}"
                  data-recipe-id="${escapeAttr(alt.id)}" data-day="${escapeAttr(day.dayKey)}" data-slot="${slot.slotIndex}"
                  title="${escapeAttr(`${name} — ${reasonText}`)}">
                  <span class="alt-chip-reason">${escapeHtml(reasonText)}</span>
                  <span class="alt-chip-name">${escapeHtml(name)}</span>
                </button>
              `;
                })
                .join('')}
            </div>
            <div class="meal-slot-ingredients ${isExpanded ? 'open' : ''}" id="ing-${expandKey}">
              ${renderSlotIngredients(r)}
            </div>
          </div>
        `;
        })
        .join('');

      return `
      <article class="day-card ${isToday ? 'day-card-today' : ''}">
        <div class="day-card-header">
          <div>
            <span class="day-label">${day.label}</span>
            ${isToday ? `<span class="today-badge">${t('todayHighlight')}</span>` : ''}
            <div class="day-meta">${day.dateStr.slice(5)}</div>
          </div>
          <div class="day-weather">
            <span class="weather-badge weather-badge-sm">${weatherIcon(day.weatherTag)} ${t(weatherLabelKey(day.weatherTag))}</span>
            <span class="day-temp">${temp ?? (inWindow ? t('noForecast') : t('pastDay'))}</span>
          </div>
          <div class="effort-pills" data-day="${day.dayKey}">
            ${effortPillsHtml(day.dayKey, day.effortLevel ?? getDayEffort(day.dayKey))}
          </div>
          <div class="meal-stepper">
            <button type="button" data-day="${day.dayKey}" data-action="dec" aria-label="${t('less')}">−</button>
            <span class="meal-count">${day.mealCount}</span>
            <button type="button" data-day="${day.dayKey}" data-action="inc" aria-label="${t('more')}">+</button>
          </div>
        </div>
        <div class="day-slots">${slotsHtml}</div>
      </article>
    `;
    })
    .join('');

  container.querySelectorAll('.effort-pill[data-day]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayKey = btn.dataset.day;
      setDayEffort(dayKey, btn.dataset.effort);
      clearDayPlanSelection(dayKey, getActivePlanModeKey());
      await bridge.refreshPlan();
      renderWeekView();
    });
  });

  container.querySelectorAll('button[data-day][data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const day = btn.dataset.day;
      const current = getMealCount(day);
      const next = btn.dataset.action === 'inc' ? current + 1 : current - 1;
      setMealCount(day, next);
      await bridge.refreshPlan();
      renderWeekView();
    });
  });

  container.querySelectorAll('.open-recipe-link[data-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const u = btn.dataset.url;
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
    });
  });

  container.querySelectorAll('.slot-swap-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const day = state.weeklyPlan.find((d) => d.dayKey === btn.dataset.day);
      const slot = day?.slots?.[Number(btn.dataset.slot)];
      if (!slot) return;
      const nextId = cycleSlotAlternative(
        btn.dataset.day,
        Number(btn.dataset.slot),
        slot.alternatives,
        slot.selected.id,
        slot.selected
      );
      if (!nextId || nextId === slot.selected.id) return;
      await bridge.applySlotSelection(btn.dataset.day, Number(btn.dataset.slot), nextId);
    });
  });

  container.querySelectorAll('.alt-chip[data-recipe-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayKey = btn.dataset.day;
      const slotIndex = Number(btn.dataset.slot);
      const recipeId = btn.dataset.recipeId;
      const day = state.weeklyPlan.find((d) => d.dayKey === dayKey);
      const slot = day?.slots?.[slotIndex];
      if (!slot || slot.selected?.id === recipeId) return;
      await bridge.applySlotSelection(dayKey, slotIndex, recipeId);
    });
  });

  container.querySelectorAll('.slot-expand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.expand;
      const panel = document.getElementById(`ing-${key}`);
      const expanded = state.expandedSlots.has(key);
      if (expanded) {
        state.expandedSlots.delete(key);
        panel?.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        state.expandedSlots.add(key);
        panel?.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}
