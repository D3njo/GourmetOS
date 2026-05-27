import {
  getTheme,
  saveTheme,
  getPreferences,
  savePreferences,
  getPortions,
  savePortions,
  getShoppingScope,
  saveShoppingScope
} from './storage.js';
import { invalidateRecipeCache, getActiveRecipeFromPlan, syncRecipePool } from './recipes.js';
import { buildWeeklyPlan, getTodayDay } from './plan-engine.js';
import {
  t,
  setLocale,
  onLocaleChange,
  applyStaticI18n
} from './i18n.js';
import { setUnitSystem, getUnitSystem as getStoredUnitSystem } from './units.js';
import { initWeatherEngine } from './weather.js';
import { bridge } from './app-bridge.js';
import { state } from './app-state.js';
import { $, $$ } from './ui/dom.js';
import { maybeAutoRefreshMenu, resetMenuManual, navigate } from './ui/navigation.js';
import {
  renderTodayView,
  renderWeatherStatus,
  bindWeatherPills,
  bindRecipeMetaActions,
  bindRecipeEditor,
  bindCustomExclusions,
  openRecipeEditor
} from './ui/today-view.js';
import { bindCookMode } from './ui/cook-mode.js';
import { renderWeekView } from './ui/week-view.js';
import {
  renderPreferences,
  bindPreferences,
  updatePoolSyncProgress,
  renderRecipeSourceSettings
} from './ui/preferences-view.js';
import { renderShoppingList } from './ui/shopping-view.js';
import { updateAppStatus, bindConnectivityStatus } from './ui/app-status.js';

let refreshPlanInFlight = null;
let initPhase = true;
let pendingInitRefresh = false;

function markPendingInitRefresh() {
  if (initPhase) pendingInitRefresh = true;
}

function updateThemeToggleA11y(isDark) {
  const toggle = $('#theme-toggle');
  if (!toggle) return;
  toggle.setAttribute('aria-checked', isDark ? 'true' : 'false');
  toggle.setAttribute('aria-label', isDark ? t('themeSwitchToLight') : t('themeSwitchToDark'));
}

function initTheme() {
  const prefs = getPreferences();
  const theme = prefs.darkMode === false ? 'light' : getTheme();
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeToggleA11y(theme === 'dark');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  savePreferences({ darkMode: next === 'dark' });
  document.documentElement.setAttribute('data-theme', next);
  updateThemeToggleA11y(next === 'dark');
}

function initLocaleAndUnits() {
  savePreferences({ locale: 'en' });
  setLocale('en');
  setUnitSystem(getStoredUnitSystem());
  state.shoppingScope = getShoppingScope();
}

function renderStaticUI() {
  applyStaticI18n();
  document.title = `GourmetOS — ${t('appTitle')}`;
}

export function getActiveSlot() {
  const today = getTodayDay(state.weeklyPlan);
  if (!today?.slots?.length) return null;
  const idx = Math.min(state.todaySlotIndex, today.slots.length - 1);
  return today.slots[idx];
}

export async function refreshPlan() {
  if (refreshPlanInFlight) return refreshPlanInFlight;

  refreshPlanInFlight = (async () => {
    state.appLoading = true;
    updateAppStatus();

    try {
      invalidateRecipeCache();
      const prefs = getPreferences();
      state.weeklyPlan = await buildWeeklyPlan(state.forecast, prefs.excludedTags || []);

      const { recipe, weatherTag, categories } = await getActiveRecipeFromPlan(state.weeklyPlan);
      const slot = getActiveSlot();
      state.recipe = slot?.selected ?? recipe;
      state.weatherTag = getTodayDay(state.weeklyPlan)?.weatherTag ?? weatherTag;
      state.categories = categories;

      renderTodayView();
      if (state.view === 'week') renderWeekView();
      renderShoppingList();
    } finally {
      state.appLoading = false;
      updateAppStatus();
    }
  })();

  try {
    await refreshPlanInFlight;
  } finally {
    refreshPlanInFlight = null;
  }
}

function bindAccordions() {
  $$('.accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const panel = trigger.nextElementSibling;
      trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      panel?.classList.toggle('open', !expanded);
    });
  });
}

function bindPortions() {
  $('#portion-minus')?.addEventListener('click', () => {
    state.portions = Math.max(1, state.portions - 1);
    savePortions(state.portions);
    renderTodayView();
    if (state.view === 'week') renderWeekView();
    renderShoppingList();
  });

  $('#portion-plus')?.addEventListener('click', () => {
    state.portions = Math.min(12, state.portions + 1);
    savePortions(state.portions);
    renderTodayView();
    if (state.view === 'week') renderWeekView();
    renderShoppingList();
  });
}

function bindDock() {
  $$('.dock-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigate(btn.dataset.view);
    });
  });
}

function bindRipples() {
  document.addEventListener('click', (e) => {
    const host = e.target.closest('.ripple-host, .pill, .effort-pill, .portion-btn, .dock-btn, .slot-swap-btn');
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    host.style.position = 'relative';
    host.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function wireBridge() {
  bridge.refreshPlan = refreshPlan;
  bridge.renderWeekView = renderWeekView;
  bridge.renderTodayView = renderTodayView;
  bridge.renderPreferences = renderPreferences;
  bridge.renderShoppingList = renderShoppingList;
  bridge.openRecipeEditor = openRecipeEditor;
  bridge.getActiveSlot = getActiveSlot;
  bridge.resetMenuManual = resetMenuManual;
  bridge.bindAccordions = bindAccordions;
}

async function init() {
  wireBridge();
  initLocaleAndUnits();
  initTheme();
  state.portions = getPortions();
  renderStaticUI();
  bindConnectivityStatus();
  updateAppStatus();

  bindDock();
  bindAccordions();
  bindPortions();
  bindWeatherPills();
  bindPreferences();
  bindRecipeMetaActions();
  bindRecipeEditor();
  bindCustomExclusions();
  bindCookMode();
  bindRipples();

  $('#theme-toggle')?.addEventListener('click', toggleTheme);

  onLocaleChange(() => {
    renderStaticUI();
    updateThemeToggleA11y(document.documentElement.getAttribute('data-theme') === 'dark');
    if (state.view === 'preferences') renderPreferences();
    if (state.view === 'week') renderWeekView();
    renderTodayView();
    renderShoppingList();
    updateAppStatus();
  });

  const refreshed = await maybeAutoRefreshMenu('init');
  if (!refreshed) await refreshPlan();
  else if (!state.weeklyPlan) await refreshPlan();
  await navigate('today', { skipMenuRefresh: true });

  initWeatherEngine(async ({ forecast, error, coordsSource }) => {
    if (forecast) {
      state.forecast = forecast;
      state.coordsSource = coordsSource ?? forecast.coordsSource ?? null;
    }
    state.weatherError = !!error && !state.forecast?.current;
    renderWeatherStatus();
    if (initPhase) {
      markPendingInitRefresh();
    } else {
      await refreshPlan();
    }
  });

  registerServiceWorker();

  initPhase = false;
  if (pendingInitRefresh) {
    pendingInitRefresh = false;
    await refreshPlan();
  }

  state.poolSyncing = true;
  updateAppStatus();

  syncRecipePool({ onProgress: updatePoolSyncProgress })
    .then(async () => {
      state.poolSyncing = false;
      updatePoolSyncProgress({ phase: 'done' });
      invalidateRecipeCache();
      await refreshPlan();
      if (state.view === 'preferences') await renderRecipeSourceSettings();
    })
    .catch(() => {
      state.poolSyncing = false;
      updatePoolSyncProgress({ phase: 'done' });
      updateAppStatus();
    });
}

document.addEventListener('DOMContentLoaded', init);
