import {
  getPreferences,
  savePreferences,
  saveSpoonacularApiKey,
  clearPlanSelections
} from '../storage.js';
import { clearRecipePool, refreshRecipeCatalog, getSyncStatus, invalidateRecipeCache } from '../recipes.js';
import { getSpoonacularQuota } from '../spoonacular-api.js';
import { getExcludeOptions, getDietPreferenceOptions, t } from '../i18n.js';
import { getLocale as getStoredLocale } from '../storage.js';
import { setUnitSystem } from '../units.js';
import { bridge } from '../app-bridge.js';
import { state } from '../app-state.js';
import { $ } from './dom.js';
import { updateAppStatus } from './app-status.js';
import {
  renderCustomExclusions,
  renderFavoritesList,
  renderWeatherStatus
} from './today-view.js';

function renderDietPreferences(prefs) {
  const container = $('#diet-preferences');
  if (!container) return;

  container.innerHTML = getDietPreferenceOptions()
    .map(
      (opt) => `
    <label class="pref-row" style="cursor:pointer">
      <span>${t(opt.labelKey)}</span>
      <input type="checkbox" data-diet="${opt.id}" ${prefs.dietPreferences?.includes(opt.id) ? 'checked' : ''}
        style="width:20px;height:20px;accent-color:var(--color-matcha)">
    </label>
  `
    )
    .join('');

  container.querySelectorAll('input[data-diet]').forEach((input) => {
    input.addEventListener('change', async () => {
      const diets = [...container.querySelectorAll('input[data-diet]:checked')].map(
        (el) => el.dataset.diet
      );
      savePreferences({ dietPreferences: diets });
      invalidateRecipeCache();
      await bridge.refreshPlan();
    });
  });
}

export async function renderPreferences() {
  const excludeContainer = $('#exclude-tags');
  const unitSelect = $('#unit-select');
  const prefs = getPreferences();

  if (unitSelect) unitSelect.value = prefs.unitSystem || 'metric';

  renderDietPreferences(prefs);

  if (!excludeContainer) return;

  excludeContainer.innerHTML = getExcludeOptions()
    .map(
      (opt) => `
    <label class="pref-row" style="cursor:pointer">
      <span>${t(opt.labelKey)}</span>
      <input type="checkbox" data-tag="${opt.id}" ${prefs.excludedTags?.includes(opt.id) ? 'checked' : ''}
        style="width:20px;height:20px;accent-color:var(--color-matcha)">
    </label>
  `
    )
    .join('');

  excludeContainer.querySelectorAll('input[data-tag]').forEach((input) => {
    input.addEventListener('change', async () => {
      const tags = [...excludeContainer.querySelectorAll('input[data-tag]:checked')].map(
        (el) => el.dataset.tag
      );
      savePreferences({ excludedTags: tags });
      invalidateRecipeCache();
      await bridge.refreshPlan();
    });
  });

  renderCustomExclusions();
  await renderRecipeSourceSettings();
  await renderFavoritesList();
}

export function updatePoolSyncProgress(progress) {
  const wrap = $('#pool-sync-wrap');
  const fill = $('#pool-sync-fill');
  const text = $('#pool-sync-text');
  if (!wrap || !fill || !text) return;

  if (!progress || progress.phase === 'done') {
    wrap.hidden = true;
    state.poolSyncing = false;
    updateAppStatus();
    return;
  }

  state.poolSyncing = true;
  updateAppStatus();
  wrap.hidden = false;
  const target = progress.target ?? 1000;
  const count = progress.poolCount ?? 0;
  const pct = Math.min(100, Math.round((count / target) * 100));
  fill.style.width = `${pct}%`;
  text.textContent = t('poolSyncProgress')
    .replace('{n}', String(count))
    .replace('{target}', String(target));
}

export async function renderRecipeSourceSettings() {
  const prefs = getPreferences();
  const keyInput = $('#spoonacular-key');
  const quotaEl = $('#spoonacular-quota');
  const poolEl = $('#recipe-pool-info');
  const exoticCheck = $('#prefer-exotic');

  if (keyInput) keyInput.value = prefs.spoonacularApiKey || '';
  if (exoticCheck) exoticCheck.checked = !!prefs.preferExoticIngredients;

  const quota = getSpoonacularQuota();
  if (quotaEl) {
    quotaEl.textContent =
      quota?.left != null
        ? t('spoonacularQuotaLeft').replace('{n}', String(quota.left))
        : '';
  }

  const status = await getSyncStatus();
  if (poolEl) {
    const date = status.meta?.lastRun
      ? new Date(status.meta.lastRun).toLocaleString(getStoredLocale())
      : null;
    const stats = t('recipePoolStats')
      .replace('{offline}', String(status.poolCount))
      .replace('{index}', String(status.indexCount))
      .replace('{premium}', String(status.premiumInIndex ?? '—'))
      .replace('{target}', String(status.target));
    poolEl.textContent = date
      ? `${stats} · ${t('recipePoolUpdated').replace('{date}', date)}`
      : stats;
    if (!status.spoonacularEnabled && status.indexCount) {
      poolEl.textContent += ` · ${t('recipePoolNoSpoonacular')}`;
    }
  }
}

export function bindPreferences() {
  $('#unit-select')?.addEventListener('change', async (e) => {
    savePreferences({ unitSystem: e.target.value });
    setUnitSystem(e.target.value);
    bridge.renderTodayView();
    bridge.renderShoppingList();
    if (state.view === 'week') bridge.renderWeekView();
    renderWeatherStatus();
  });

  $('#spoonacular-key')?.addEventListener('change', (e) => {
    saveSpoonacularApiKey(e.target.value);
    renderRecipeSourceSettings();
  });

  $('#prefer-exotic')?.addEventListener('change', async (e) => {
    savePreferences({ preferExoticIngredients: e.target.checked });
    clearPlanSelections();
    await bridge.refreshPlan();
    if (state.view === 'week') bridge.renderWeekView();
    bridge.renderTodayView();
  });

  $('#btn-refresh-recipes')?.addEventListener('click', async () => {
    const btn = $('#btn-refresh-recipes');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('refreshingRecipes');
    }
    try {
      await refreshRecipeCatalog(updatePoolSyncProgress);
      clearPlanSelections();
      await bridge.refreshPlan();
      if (state.view === 'week') bridge.renderWeekView();
      bridge.renderTodayView();
      await renderRecipeSourceSettings();
    } finally {
      updatePoolSyncProgress({ phase: 'done' });
      if (btn) {
        btn.disabled = false;
        btn.textContent = t('refreshRecipes');
      }
    }
  });

  $('#btn-reset-menu')?.addEventListener('click', async () => {
    const btn = $('#btn-reset-menu');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('refreshingRecipes');
    }
    try {
      await bridge.resetMenuManual();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = t('resetMenu');
      }
    }
  });

  $('#btn-clear-pool')?.addEventListener('click', async () => {
    if (!confirm(t('clearPoolConfirm'))) return;
    await clearRecipePool();
    clearPlanSelections();
    await bridge.refreshPlan();
    if (state.view === 'week') bridge.renderWeekView();
    bridge.renderTodayView();
    await renderRecipeSourceSettings();
  });
}
