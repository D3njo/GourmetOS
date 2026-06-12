import {
  addFoodLogEntry,
  removeFoodLogEntry,
  getFoodLogForDate,
  getFoodLogDailyTotals,
  foodLogDateKey
} from '../storage.js';
import { lookupDishNutrition, SpoonacularQuotaError } from '../dish-lookup.js';
import { getSpoonacularQuota, isSpoonacularConfigured } from '../spoonacular-api.js';
import { loadRecipes } from '../recipes.js';
import { t } from '../i18n.js';
import { $, escapeHtml, escapeAttr } from './dom.js';

function formatMacro(value, unit) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}${unit}`;
}

function renderQuotaHint() {
  const el = $('#food-log-quota');
  if (!el) return;
  if (!isSpoonacularConfigured()) {
    el.textContent = t('foodLogNeedKey');
    return;
  }
  const quota = getSpoonacularQuota();
  if (quota?.left != null) {
    el.textContent = t('spoonacularQuotaLeft').replace('{n}', String(quota.left));
  } else {
    el.textContent = '';
  }
}

function renderFoodLogList() {
  const list = $('#food-log-list');
  const totalsEl = $('#food-log-totals');
  if (!list) return;

  const entries = getFoodLogForDate();
  if (!entries.length) {
    list.innerHTML = `<p class="text-muted text-xs m-0">${escapeHtml(t('foodLogEmpty'))}</p>`;
  } else {
    list.innerHTML = entries
      .map((entry) => {
        const est = entry.estimated ? ` · ${escapeHtml(t('foodLogEstimated'))}` : '';
        return `
      <span class="exclusion-chip food-log-chip">
        <span>
          ${escapeHtml(entry.label)}
          · ${formatMacro(entry.proteinG, 'g')} ${escapeHtml(t('foodLogProtein'))}
          · ${formatMacro(entry.caloriesKcal, ' ')} ${escapeHtml(t('foodLogCalories'))}${est}
        </span>
        <button type="button" class="exclusion-chip-remove" data-food-log-id="${escapeAttr(entry.id)}" aria-label="${escapeAttr(t('removeFoodLogEntry'))}">×</button>
      </span>
    `;
      })
      .join('');

    list.querySelectorAll('[data-food-log-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        removeFoodLogEntry(btn.dataset.foodLogId);
        renderFoodLogList();
        renderQuotaHint();
      });
    });
  }

  if (totalsEl) {
    const totals = getFoodLogDailyTotals();
    totalsEl.textContent = t('foodLogDailyTotal')
      .replace('{protein}', String(Math.round(totals.proteinG)))
      .replace('{calories}', String(Math.round(totals.caloriesKcal)));
  }
}

function setFoodLogStatus(message = '') {
  const el = $('#food-log-status');
  if (el) el.textContent = message;
}

async function addFoodFromInput() {
  const input = $('#food-log-input');
  const btn = $('#btn-food-log-add');
  const query = input?.value.trim();
  if (!query) return;

  if (btn) btn.disabled = true;
  setFoodLogStatus(t('foodLogLookingUp'));

  try {
    const db = await loadRecipes();
    const result = await lookupDishNutrition(query, { recipes: db.recipes || [] });

    if (!result) {
      setFoodLogStatus(t('foodLogNoMatch'));
      return;
    }

    addFoodLogEntry({
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      query,
      label: result.label,
      proteinG: result.proteinG ?? 0,
      caloriesKcal: result.caloriesKcal ?? 0,
      source: result.source,
      sourceId: result.sourceId ?? null,
      estimated: !!result.estimated,
      createdAt: Date.now()
    });

    if (input) input.value = '';
    setFoodLogStatus('');
    renderFoodLogList();
    renderQuotaHint();
  } catch (err) {
    if (err instanceof SpoonacularQuotaError) {
      setFoodLogStatus(t('foodLogQuotaEmpty'));
    } else {
      setFoodLogStatus(t('foodLogNoMatch'));
      console.warn('Food log lookup failed:', err);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function renderFoodLogSection() {
  const root = $('#food-log-section');
  if (!root) return;

  root.innerHTML = `
    <p class="text-[12px] uppercase tracking-widest font-bold accent-saffron m-0 mb-2">${escapeHtml(t('foodLog'))}</p>
    <p class="text-muted text-xs mb-3">${escapeHtml(t('foodLogHint'))}</p>

    <div class="custom-exclusion-form">
      <input type="text" id="food-log-input" class="pref-input" placeholder="${escapeAttr(t('foodLogPlaceholder'))}" autocomplete="off">
      <button type="button" id="btn-food-log-add" class="slot-swap-btn">${escapeHtml(t('foodLogAdd'))}</button>
    </div>

    <p id="food-log-status" class="text-muted text-xs mt-2 m-0" role="status" aria-live="polite"></p>
    <p id="food-log-quota" class="text-muted text-xs mt-1 m-0"></p>

    <div id="food-log-list" class="exclusion-chips mt-3"></div>
    <p id="food-log-totals" class="text-sm font-semibold mt-3 m-0"></p>
    <p class="text-muted text-xs mt-2 m-0">${escapeHtml(t('foodLogAttribution'))}</p>
  `;

  renderFoodLogList();
  renderQuotaHint();
  bindFoodLog();
}

export function bindFoodLog() {
  $('#btn-food-log-add')?.addEventListener('click', () => addFoodFromInput());
  $('#food-log-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFoodFromInput();
    }
  });
}
