import { clearPlanSelections, clearDayPlanSelection, getActivePlanModeKey, recordPlanRecipeIds } from '../storage.js';
import { getTodayDayKey } from '../plan-engine.js';
import { toDateKey } from '../menu-refresh.js';
import {
  shouldRefreshWeekPlan,
  shouldRefreshTodayMenu,
  markWeekPlanRefreshed,
  markTodayMenuRefreshed,
  markManualMenuReset
} from '../menu-refresh.js';
import { bridge } from '../app-bridge.js';
import { state } from '../app-state.js';
import { $, $$ } from './dom.js';
import { syncPortionBarVisibility } from './portion-bar.js';

export async function maybeAutoRefreshMenu(trigger) {
  if (shouldRefreshWeekPlan()) {
    clearPlanSelections();
    markWeekPlanRefreshed();
    await bridge.refreshPlan();
    return true;
  }

  if ((trigger === 'init' || trigger === 'today') && shouldRefreshTodayMenu()) {
    clearDayPlanSelection(getTodayDayKey(), getActivePlanModeKey());
    markTodayMenuRefreshed();
    await bridge.refreshPlan();
    return true;
  }

  return false;
}

export async function resetMenuManual() {
  if (state.weeklyPlan?.length) {
    for (const day of state.weeklyPlan) {
      const ids = day.slots?.map((slot) => slot.recipeId).filter(Boolean) ?? [];
      if (ids.length) recordPlanRecipeIds(ids, day.dateStr || toDateKey());
    }
  }
  clearPlanSelections();
  markManualMenuReset();
  await bridge.refreshPlan();
  if (state.view === 'week') bridge.renderWeekView();
  bridge.renderTodayView();
}

export async function navigate(view, opts = {}) {
  const { skipMenuRefresh = false } = opts;
  state.view = view;
  $$('.view').forEach((el) => el.classList.remove('active'));
  $(`#view-${view}`)?.classList.add('active');
  $$('.dock-btn').forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    btn.toggleAttribute('aria-current', active);
  });

  $('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });

  syncPortionBarVisibility();

  if (view === 'today') {
    if (!skipMenuRefresh) await maybeAutoRefreshMenu('today');
    bridge.renderTodayView();
  }
  if (view === 'week') {
    bridge.renderWeekView();
  }
  if (view === 'preferences') await bridge.renderPreferences();
  if (view === 'today' || view === 'week') bridge.renderShoppingList();
}
