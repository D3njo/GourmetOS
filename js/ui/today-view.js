import {
  getPreferences,
  savePreferences,
  getWeatherMode,
  getActivePlanModeKey,
  getLocale as getStoredLocale
} from '../storage.js';
import { getUnitSystem as getStoredUnitSystem } from '../units.js';
import { invalidateRecipeCache, loadRecipes } from '../recipes.js';
import { isOnlineOnly } from '../recipe-loader.js';
import { scaleIngredients, scaleSteps, formatAmount } from '../portions.js';
import { formatIngredientDisplayName } from '../ingredient-normalize.js';
import { filterAllowedIngredients } from '../exclusions.js';
import { recipeImageUrl } from '../recipe-loader.js';
import {
  setManualWeather,
  clearManualWeather,
  weatherIcon,
  resolveAutoWeatherTag,
  refreshForecast
} from '../weather.js';
import { getTodayDay, getTodayDayKey, cycleSlotAlternative } from '../plan-engine.js';
import { t, effortLabelKey, weatherLabelKey } from '../i18n.js';
import { formatTemperature as formatTempUnits } from '../units.js';
import {
  isFavorite,
  toggleFavorite,
  saveRecipeOverride,
  clearRecipeOverride,
  hasRecipeOverride,
  applyRecipeOverride,
  cloneRecipeForEdit,
  getFavorites
} from '../recipe-store.js';
import {
  ingredientsToText,
  stepsToText,
  overrideFromForm
} from '../recipe-editor.js';
import { getRecipeSourceLabel, getRecipeSourceUrl } from '../recipe-api.js';
import { formatEffortBadge } from '../recipe-complexity.js';
import { buildChefRationale, compareAlternativeReason, reasonLabel } from '../editorial-recipe.js';
import { addCustomExclusion, removeCustomExclusion } from '../exclusions.js';
import { bridge } from '../app-bridge.js';
import { state } from '../app-state.js';
import { $, $$, escapeHtml, escapeAttr } from './dom.js';
import { renderOnlineOnlyFallback } from './helpers.js';
import { syncCookModeButton } from './cook-mode.js';
import { syncPortionBarVisibility } from './portion-bar.js';

export function renderWeatherStatus() {
  const el = $('#weather-status');
  const tempEl = $('#weather-temp');
  if (!el) return;

  const mode = getWeatherMode();
  const current = state.forecast?.current;

  if (!current) {
    if (state.weatherError) {
      el.textContent = t('weatherUnavailable');
    } else if (mode !== 'auto') {
      el.textContent = `${t('weatherOverride')}: ${t(weatherLabelKey(mode))}`;
    } else {
      el.textContent = t('weatherLocating');
    }
  } else if (mode === 'auto') {
    const resolved = resolveAutoWeatherTag(state.forecast);
    el.textContent = `${t('weatherAutoResolved')}: ${t(weatherLabelKey(resolved))}`;
    if (state.coordsSource === 'fallback') {
      el.textContent += ` · ${t('weatherUsingFallback')}`;
    } else if (state.coordsSource === 'saved') {
      el.textContent += ` · ${t('weatherUsingSaved')}`;
    }
  } else {
    el.textContent = `${t('weatherOverride')}: ${t(weatherLabelKey(mode))}`;
  }

  if (tempEl) {
    tempEl.textContent =
      current?.temperature != null
        ? formatTempUnits(current.temperature, getStoredUnitSystem())
        : '—';
  }
}

export function renderTodayView() {
  const slot = bridge.getActiveSlot();
  const recipe = slot?.selected ?? state.recipe;

  const heroImg = $('#hero-image');
  const heroTitle = $('#hero-title');
  const heroDesc = $('#hero-desc');

  if (!recipe) {
    if (heroTitle) heroTitle.textContent = t('recipeLoading');
    if (heroDesc) heroDesc.textContent = '';
    if (heroImg) {
      heroImg.removeAttribute('src');
      heroImg.alt = '';
      heroImg.classList.add('skeleton');
    }
    $('#hero-tags') && ($('#hero-tags').innerHTML = '');
    return;
  }

  state.recipe = recipe;
  const heroTags = $('#hero-tags');
  const weatherBadge = $('#weather-badge');

  if (heroImg) {
    const nextSrc = recipeImageUrl(recipe);
    const prevSrc = heroImg.getAttribute('src') || '';
    if (prevSrc && prevSrc !== nextSrc) {
      heroImg.classList.add('is-swapping');
      const done = () => heroImg.classList.remove('is-swapping');
      heroImg.addEventListener('load', done, { once: true });
      heroImg.addEventListener('error', done, { once: true });
      heroImg.removeAttribute('src');
    }
    if (nextSrc) heroImg.src = nextSrc;
    heroImg.alt = recipe.name;
    heroImg.dataset.recipeId = recipe.id;
    heroImg.classList.remove('skeleton');
  }
  if (heroTitle) heroTitle.textContent = recipe.name;
  if (heroDesc) heroDesc.textContent = recipe.description;

  if (heroTags) {
    const effortBadge = formatEffortBadge(recipe);
    const todayDay = getTodayDay(state.weeklyPlan);
    const effort = todayDay?.effortLevel ?? recipe.effort ?? 'medium';
    heroTags.innerHTML = `
      <span class="tag">${recipe.technique}</span>
      <span class="tag saffron">${recipe.flavor_profile}</span>
      <span class="tag effort-tag">${t(effortLabelKey(effort))} · ${effortBadge}</span>
      ${recipe.tier === 'premium' ? `<span class="tag premium-tag">${t('premiumBadge')}</span>` : ''}
      ${recipe.chef ? `<span class="tag chef-tag">${recipe.chef}</span>` : ''}
      ${isOnlineOnly(recipe) ? `<span class="tag online-tag">${t('onlineOnlyRecipe')}</span>` : ''}
      ${slot ? `<span class="tag">${slot.mealTypeLabel}</span>` : ''}
    `;
  }

  if (weatherBadge) {
    const mode = getWeatherMode();
    const tag =
      mode === 'auto'
        ? resolveAutoWeatherTag(state.forecast)
        : state.weatherTag;
    weatherBadge.innerHTML = `${weatherIcon(tag)} ${t(weatherLabelKey(tag))}`;
  }

  renderTodaySlotPicker();
  renderChefRationale(recipe);
  renderTodayAlternatives();
  renderRecipeMeta(recipe);
  syncCookModeButton(recipe);
  renderIngredients();
  renderSteps();
  document.querySelectorAll('[data-portion-display]').forEach((el) => {
    el.textContent = state.portions;
  });
  renderWeatherStatus();
  updateWeatherPills();
  syncPortionBarVisibility();
}

function labelKey(prefix, value) {
  const key = `${prefix}_${String(value || '').replace(/-/g, '_')}`;
  const label = t(key);
  return label !== key ? label : value;
}

export function renderChefRationale(recipe) {
  const container = $('#chef-rationale');
  if (!container || !recipe) {
    if (container) container.hidden = true;
    return;
  }

  const todayDay = getTodayDay(state.weeklyPlan);
  const mode = getWeatherMode();
  const weatherTag =
    mode === 'auto' ? resolveAutoWeatherTag(state.forecast) : state.weatherTag;
  const temp = state.forecast?.current?.temperature;
  const effortLevel = todayDay?.effortLevel ?? recipe.effort ?? 'medium';

  const rationale = buildChefRationale(recipe, {
    weatherTag,
    temp,
    effortLevel
  });

  const misePreview = (rationale.miseEnPlace || []).slice(0, 3);

  container.hidden = false;
  container.innerHTML = `
    <p class="chef-rationale-kicker">${escapeHtml(t('chefRationaleTitle'))}</p>
    <p class="chef-rationale-lead">${escapeHtml(rationale.whyTonight)}</p>
    ${rationale.whyNow ? `<p class="chef-rationale-why-now"><span class="chef-rationale-label">${escapeHtml(t('chefRationaleWhyNow'))}</span> ${escapeHtml(rationale.whyNow)}</p>` : ''}
    <div class="chef-rationale-grid">
      <div class="chef-rationale-item">
        <span class="chef-rationale-label">${escapeHtml(t('chefRationaleTaste'))}</span>
        <span class="chef-rationale-value">${escapeHtml(labelKey('taste', rationale.tasteArc))}</span>
      </div>
      <div class="chef-rationale-item">
        <span class="chef-rationale-label">${escapeHtml(t('chefRationaleOccasion'))}</span>
        <span class="chef-rationale-value">${escapeHtml(labelKey('occasion', rationale.occasion))}</span>
      </div>
      <div class="chef-rationale-item">
        <span class="chef-rationale-label">${escapeHtml(t('chefRationaleSkill'))}</span>
        <span class="chef-rationale-value">${escapeHtml(labelKey('skill', rationale.skillFocus))}</span>
      </div>
    </div>
    <div class="chef-rationale-move">
      <span class="chef-rationale-label">${escapeHtml(t('chefRationaleMove'))}</span>
      <p class="chef-rationale-move-text m-0">${escapeHtml(rationale.chefMove)}</p>
    </div>
    ${
      misePreview.length
        ? `<div class="chef-rationale-mise">
            <span class="chef-rationale-label">${escapeHtml(t('chefRationaleMise'))}</span>
            <ul class="chef-rationale-mise-list m-0">${misePreview.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>`
        : ''
    }
  `;
}

export function renderRecipeMeta(recipe) {
  const favBtn = $('#btn-favorite');
  const editBtn = $('#btn-edit-recipe');
  const sourceBadge = $('#recipe-source-badge');
  const locale = getStoredLocale();

  if (favBtn) {
    const fav = isFavorite(recipe.id);
    favBtn.textContent = fav ? '♥' : '♡';
    favBtn.classList.toggle('fav-active', fav);
    favBtn.setAttribute('aria-label', fav ? t('removeFavorite') : t('addFavorite'));
    favBtn.dataset.recipeId = recipe.id;
  }

  if (editBtn) {
    editBtn.style.display = isFavorite(recipe.id) ? 'inline-flex' : 'none';
    editBtn.dataset.recipeId = recipe.id;
  }

  if (sourceBadge) {
    if (recipe.isCustomized || hasRecipeOverride(recipe.id)) {
      sourceBadge.textContent = t('sourceCustomized');
      sourceBadge.hidden = false;
      sourceBadge.disabled = true;
      sourceBadge.removeAttribute('data-source-url');
      sourceBadge.removeAttribute('title');
      sourceBadge.removeAttribute('aria-label');
    } else {
      const label = getRecipeSourceLabel(recipe, locale);
      const rating = recipe.rating ? ` ★ ${recipe.rating.toFixed(1)}` : '';
      const onlineHint = isOnlineOnly(recipe) ? ` · ${t('onlineOnlyRecipe')}` : '';
      const url = getRecipeSourceUrl(recipe);
      sourceBadge.textContent = `${label}${rating}${onlineHint}`;
      sourceBadge.hidden = false;
      if (url) {
        sourceBadge.disabled = false;
        sourceBadge.dataset.sourceUrl = url;
        sourceBadge.title = isOnlineOnly(recipe)
          ? t('openFullRecipe').replace('{source}', label)
          : t('openSourceRecipe');
        sourceBadge.setAttribute('aria-label', sourceBadge.title);
      } else {
        sourceBadge.disabled = true;
        sourceBadge.removeAttribute('data-source-url');
        sourceBadge.removeAttribute('title');
        sourceBadge.removeAttribute('aria-label');
      }
    }
  }
}

export function bindRecipeMetaActions() {
  $('#recipe-source-badge')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const url = btn?.dataset?.sourceUrl;
    if (url && !btn.disabled) window.open(url, '_blank', 'noopener,noreferrer');
  });

  $('#btn-favorite')?.addEventListener('click', async () => {
    const id = state.recipe?.id;
    if (!id) return;
    toggleFavorite(id);
    renderRecipeMeta(state.recipe);
    if (state.view === 'preferences') await renderFavoritesList();
    await bridge.refreshPlan();
  });

  $('#btn-edit-recipe')?.addEventListener('click', () => {
    const id = $('#btn-edit-recipe')?.dataset.recipeId;
    if (id) openRecipeEditor(id);
  });
}

let editorFocusReturn = null;

function getFocusableElements(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function trapEditorFocus(e) {
  const panel = $('.editor-panel');
  if (!panel || e.key !== 'Tab') return;

  const focusables = getFocusableElements(panel);
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function onEditorKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeRecipeEditor();
    return;
  }
  trapEditorFocus(e);
}

export async function openRecipeEditor(recipeId) {
  const db = await loadRecipes();
  const base = db.recipes.find((r) => r.id === recipeId);
  if (!base) return;

  const recipe = applyRecipeOverride(base);
  const clone = cloneRecipeForEdit(recipe);

  $('#editor-recipe-id').value = recipeId;
  $('#editor-name').value = clone.name;
  $('#editor-description').value = clone.description;
  $('#editor-ingredients').value = ingredientsToText(clone.ingredients);
  $('#editor-steps').value = stepsToText(clone.steps);

  const modal = $('#recipe-editor-modal');
  editorFocusReturn = document.activeElement;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  document.addEventListener('keydown', onEditorKeydown);
  $('#editor-name')?.focus();
}

export function closeRecipeEditor() {
  const modal = $('#recipe-editor-modal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  document.removeEventListener('keydown', onEditorKeydown);
  if (editorFocusReturn && typeof editorFocusReturn.focus === 'function') {
    editorFocusReturn.focus();
  }
  editorFocusReturn = null;
}

export function bindRecipeEditor() {
  $$('[data-close-editor]').forEach((el) => {
    el.addEventListener('click', closeRecipeEditor);
  });

  $('#recipe-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const recipeId = $('#editor-recipe-id').value;
    const db = await loadRecipes();
    const base = db.recipes.find((r) => r.id === recipeId);
    if (!base) return;

    const override = overrideFromForm(base, {
      name: $('#editor-name').value,
      description: $('#editor-description').value,
      ingredientsText: $('#editor-ingredients').value,
      stepsText: $('#editor-steps').value
    });
    saveRecipeOverride(recipeId, override);
    closeRecipeEditor();
    invalidateRecipeCache();
    await bridge.refreshPlan();
  });

  $('#btn-restore-recipe')?.addEventListener('click', async () => {
    const recipeId = $('#editor-recipe-id').value;
    if (!recipeId) return;
    clearRecipeOverride(recipeId);
    closeRecipeEditor();
    invalidateRecipeCache();
    await bridge.refreshPlan();
  });
}

export function renderCustomExclusions() {
  const list = $('#custom-exclusion-list');
  if (!list) return;

  const terms = getPreferences().customExclusions || [];
  if (!terms.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = terms
    .map(
      (term) => `
    <span class="exclusion-chip">
      ${escapeHtml(term)}
      <button type="button" class="exclusion-chip-remove" data-term="${escapeAttr(term)}" aria-label="${escapeAttr(t('removeExclusion'))}">×</button>
    </span>
  `
    )
    .join('');

  list.querySelectorAll('.exclusion-chip-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      savePreferences({ customExclusions: removeCustomExclusion(btn.dataset.term) });
      renderCustomExclusions();
      await bridge.refreshPlan();
    });
  });
}

export async function renderFavoritesList() {
  const container = $('#favorites-list');
  if (!container) return;

  const ids = getFavorites();

  if (!ids.length) {
    container.innerHTML = `<p class="text-muted text-sm m-0">${t('noFavorites')}</p>`;
    return;
  }

  const db = await loadRecipes();
  container.innerHTML = ids
    .map((id) => {
      const r = applyRecipeOverride(db.recipes.find((rec) => rec.id === id) || { id, name: id });
      const customized = hasRecipeOverride(id);
      return `
      <div class="fav-row">
        <span class="fav-row-name">${escapeHtml(r.name)}${customized ? ` <span class="tag tag-sm">${escapeHtml(t('sourceCustomized'))}</span>` : ''}</span>
        <button type="button" class="slot-swap-btn fav-edit-btn" data-recipe-id="${escapeAttr(id)}">${escapeHtml(t('editRecipe'))}</button>
      </div>
    `;
    })
    .join('');

  container.querySelectorAll('.fav-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openRecipeEditor(btn.dataset.recipeId));
  });
}

export function bindCustomExclusions() {
  $('#btn-add-exclusion')?.addEventListener('click', async () => {
    const input = $('#custom-exclusion-input');
    const term = input?.value?.trim();
    if (!term) return;
    const list = addCustomExclusion(term);
    savePreferences({ customExclusions: list });
    input.value = '';
    renderCustomExclusions();
    await bridge.refreshPlan();
  });

  $('#custom-exclusion-input')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#btn-add-exclusion')?.click();
    }
  });
}

export function renderTodaySlotPicker() {
  const container = $('#today-slot-picker');
  if (!container) return;

  const today = getTodayDay(state.weeklyPlan);
  if (!today || today.slots.length <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = today.slots
    .map(
      (slot, i) => `
    <button type="button" class="pill slot-pill ${i === state.todaySlotIndex ? 'active' : ''}"
      data-slot="${i}" aria-pressed="${i === state.todaySlotIndex ? 'true' : 'false'}">${slot.mealTypeLabel}</button>
  `
    )
    .join('');

  container.querySelectorAll('[data-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.todaySlotIndex = Number(btn.dataset.slot);
      renderTodayView();
    });
  });
}

export function renderTodayAlternatives() {
  const container = $('#today-alternatives');
  if (!container) return;

  const slot = bridge.getActiveSlot();
  if (!slot?.alternatives?.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <p class="text-[11px] uppercase tracking-widest text-muted font-bold mb-2">${t('alternativeRecipes')}</p>
    <div class="alt-pills">
      ${slot.alternatives
        .map((r) => {
          const reason = compareAlternativeReason(slot.selected, r);
          const reasonText = reasonLabel(reason);
          const name = r.name.length > 24 ? r.name.slice(0, 22) + '…' : r.name;
          return `
        <button type="button" class="pill alt-pill ${r.id === slot.selected.id ? 'active' : ''}"
          data-recipe-id="${escapeAttr(r.id)}" data-day="${escapeAttr(getTodayDayKey())}" data-slot="${slot.slotIndex}"
          title="${escapeAttr(`${name} — ${reasonText}`)}">
          <span class="alt-pill-reason">${escapeHtml(reasonText)}</span>
          <span class="alt-pill-name">${escapeHtml(name)}</span>
        </button>
      `;
        })
        .join('')}
      <button type="button" class="pill swap-pill ripple-host"
        data-day="${getTodayDayKey()}" data-slot="${slot.slotIndex}" data-action="cycle">
        ↻ ${t('swapRecipe')}
      </button>
    </div>
  `;

  bindAlternativeButtons(container);
}

export function bindAlternativeButtons(container) {
  container.querySelectorAll('[data-recipe-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayKey = btn.dataset.day;
      const slotIndex = Number(btn.dataset.slot);
      const recipeId = btn.dataset.recipeId;
      const slot = getTodayDay(state.weeklyPlan)?.slots?.[slotIndex];
      if (!slot || slot.selected?.id === recipeId) return;
      await bridge.applySlotSelection(dayKey, slotIndex, recipeId);
    });
  });

  container.querySelectorAll('[data-action="cycle"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const today = getTodayDay(state.weeklyPlan);
      const slot = today?.slots?.[Number(btn.dataset.slot)];
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
}

export function renderIngredients() {
  const list = $('#ingredients-list');
  if (!list || !state.recipe) return;

  if (isOnlineOnly(state.recipe)) {
    renderOnlineOnlyFallback(list, state.recipe);
    return;
  }

  const total = state.recipe.ingredients?.length || 0;
  const allowed = filterAllowedIngredients(state.recipe.ingredients || []);
  const scaled = scaleIngredients(allowed, state.recipe.base_portions, state.portions);

  if (!scaled.length && total > 0) {
    list.innerHTML = `<p class="text-muted text-sm m-0">${escapeHtml(t('ingredientsAllExcluded'))}</p>`;
    return;
  }

  const hiddenNote =
    total > allowed.length
      ? `<p class="text-muted text-xs mb-2">${escapeHtml(t('ingredientsHiddenByExclusions'))}</p>`
      : '';

  list.innerHTML =
    hiddenNote +
    scaled
      .map(
        (ing) => `
      <div class="ingredient-row">
        <span>${escapeHtml(formatIngredientDisplayName(ing.name))}</span>
        <span class="ingredient-amount">${escapeHtml(formatAmount(ing.amount, ing.unit))}</span>
      </div>
    `
      )
      .join('');
}

export function renderSteps() {
  const list = $('#steps-list');
  if (!list || !state.recipe) return;

  if (isOnlineOnly(state.recipe)) {
    renderOnlineOnlyFallback(list, state.recipe);
    return;
  }

  const steps = scaleSteps(state.recipe.steps, state.recipe.base_portions, state.portions);

  list.innerHTML = steps
    .map(
      (step, i) => `
      <div class="step-text">
        <strong>${i + 1}.</strong> ${escapeHtml(step.displayText)}
      </div>
    `
    )
    .join('');
}

let weatherSwitchInFlight = false;

export function updateWeatherPills() {
  const mode = getWeatherMode();

  $$('.pill[data-weather]').forEach((pill) => {
    const w = pill.dataset.weather;
    const active = w === 'auto' ? mode === 'auto' : mode === w;
    pill.classList.toggle('active', active);
    pill.toggleAttribute('aria-pressed', active);
    pill.disabled = weatherSwitchInFlight;
  });
}

async function applyWeatherMode(weather) {
  const currentMode = getWeatherMode();
  const targetMode = weather === 'auto' ? 'auto' : weather;
  if (currentMode === targetMode) {
    updateWeatherPills();
    return;
  }

  if (weatherSwitchInFlight) return;
  weatherSwitchInFlight = true;
  updateWeatherPills();

  try {
    if (weather === 'auto') {
      clearManualWeather();
    } else {
      setManualWeather(weather);
    }

    updateWeatherPills();
    renderWeatherStatus();
    await bridge.refreshPlan();

    if (weather === 'auto') {
      refreshForecast()
        .then((forecast) => {
          state.forecast = forecast;
          state.coordsSource = forecast.coordsSource;
          state.weatherError = false;
          renderWeatherStatus();
          return bridge.refreshPlan();
        })
        .catch(() => {
          state.weatherError = !state.forecast?.current;
          renderWeatherStatus();
        });
    }
  } finally {
    weatherSwitchInFlight = false;
    updateWeatherPills();
  }
}

export function bindWeatherPills() {
  $$('.pill[data-weather]').forEach((pill) => {
    pill.addEventListener('click', () => {
      void applyWeatherMode(pill.dataset.weather);
    });
  });
}
