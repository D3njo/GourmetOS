import {
  getPreferences,
  savePreferences
} from '../storage.js';
import {
  getHomeInventory,
  addHomeInventoryItems,
  removeHomeInventoryItem,
  COMMON_HOME_INGREDIENTS,
  formatInventoryChipLabel
} from '../home-inventory.js';
import { invalidateRecipeCache } from '../recipes.js';
import { scanHomeInventoryPhoto } from '../inventory-photo-scan.js';
import { shouldAutoSelectScanCandidate } from '../inventory-scan-normalize.js';
import { t } from '../i18n.js';
import { bridge } from '../app-bridge.js';
import { $, escapeHtml, escapeAttr } from './dom.js';

let scanReviewItems = [];
let activePreviewUrl = null;
let activeScanToken = 0;

function parseIngredientLines(text) {
  return text
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function setPhotoScanStatus(message, state = 'idle') {
  const el = $('#home-inventory-scan-status');
  if (!el) return;
  el.textContent = message || '';
  el.dataset.state = state;
  el.hidden = !message;
}

function renderScanResults() {
  const list = $('#home-inventory-scan-results');
  if (!list) return;

  if (!scanReviewItems.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = scanReviewItems
    .map((item) => {
      const label = t('photoScanCandidate')
        .replace('{name}', item.name)
        .replace('{confidence}', String(Math.round(item.confidence * 100)));
      return `
        <button type="button"
          class="scan-result-chip ${item.selected ? 'selected' : ''} ${item.confidence < 0.6 ? 'maybe' : ''}"
          data-scan-id="${escapeAttr(item.id)}"
          aria-pressed="${item.selected ? 'true' : 'false'}">
          ${escapeHtml(label)}
        </button>
      `;
    })
    .join('');

  list.querySelectorAll('[data-scan-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = scanReviewItems.find((candidate) => candidate.id === btn.dataset.scanId);
      if (!item) return;
      item.selected = !item.selected;
      renderScanResults();
    });
  });
}

function clearPhotoScanState() {
  scanReviewItems = [];
  activeScanToken += 1;
  setPhotoScanStatus('', 'idle');
  renderScanResults();
}

function clearPhotoPreview() {
  const preview = $('#home-inventory-photo-preview');
  if (activePreviewUrl) {
    URL.revokeObjectURL(activePreviewUrl);
    activePreviewUrl = null;
  }
  if (preview) {
    preview.removeAttribute('src');
    preview.hidden = true;
  }
}

function renderInventoryChips() {
  const list = $('#home-inventory-chips');
  if (!list) return;

  const items = getHomeInventory();
  if (!items.length) {
    list.innerHTML = `<p class="text-muted text-xs m-0">${escapeHtml(t('homeInventoryEmpty'))}</p>`;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
    <span class="exclusion-chip">
      ${escapeHtml(formatInventoryChipLabel(item))}
      <button type="button" class="exclusion-chip-remove" data-inventory-id="${escapeAttr(item.id)}" aria-label="${escapeAttr(t('removeInventoryItem'))}">×</button>
    </span>
  `
    )
    .join('');

  list.querySelectorAll('[data-inventory-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      removeHomeInventoryItem(btn.dataset.inventoryId);
      renderInventoryChips();
      invalidateRecipeCache();
      await bridge.refreshPlan();
    });
  });
}

async function addFromInput() {
  const input = $('#home-inventory-input');
  if (!input?.value.trim()) return;
  addHomeInventoryItems(parseIngredientLines(input.value), 'manual');
  input.value = '';
  renderInventoryChips();
  invalidateRecipeCache();
  await bridge.refreshPlan();
}

async function addFromPaste() {
  const area = $('#home-inventory-paste');
  if (!area?.value.trim()) return;
  addHomeInventoryItems(parseIngredientLines(area.value), 'manual');
  area.value = '';
  const panel = $('#home-inventory-paste-panel');
  if (panel) panel.hidden = true;
  renderInventoryChips();
  invalidateRecipeCache();
  await bridge.refreshPlan();
}

function renderPhotoReview(options = {}) {
  const { resetManualInput = true } = options;
  const panel = $('#home-inventory-photo-review');
  if (!panel) return;
  panel.hidden = false;
  const preview = $('#home-inventory-photo-preview');
  const area = $('#home-inventory-photo-lines');
  if (area && resetManualInput) area.value = '';
  if (preview && !preview.src) {
    preview.alt = t('scanFridgePhoto');
  }
}

async function startPhotoScan(file) {
  const token = activeScanToken + 1;
  activeScanToken = token;
  scanReviewItems = [];
  renderScanResults();
  setPhotoScanStatus(t('photoScanLoading'), 'running');

  try {
    const result = await scanHomeInventoryPhoto(file, {
      onProgress(progress) {
        if (token !== activeScanToken) return;
        if (progress.phase === 'loading') {
          setPhotoScanStatus(t('photoScanLoading'), 'running');
          return;
        }
        const base = t('photoScanScanning');
        const percent = progress.percent != null ? ` ${progress.percent}%` : '';
        setPhotoScanStatus(`${base}${percent}`, 'running');
      }
    });

    if (token !== activeScanToken) return;

    scanReviewItems = result.candidates.map((candidate, index) => ({
      ...candidate,
      id: `scan-${index}-${candidate.normalizedName}`,
      selected: shouldAutoSelectScanCandidate(candidate)
    }));
    renderScanResults();

    if (scanReviewItems.length) {
      setPhotoScanStatus(
        t('photoScanFound').replace('{n}', String(scanReviewItems.length)),
        'success'
      );
    } else {
      setPhotoScanStatus(t('photoScanNone'), 'warning');
    }
  } catch (err) {
    if (token !== activeScanToken) return;
    console.warn('[inventory-scan] photo scan failed', err);
    setPhotoScanStatus(t('photoScanFailed'), 'error');
  }
}

export function renderMealBoostPreferences(prefs = getPreferences()) {
  const container = $('#meal-prefs-boost');
  if (!container) return;

  container.innerHTML = `
    <label class="pref-row" style="cursor:pointer">
      <div>
        <span class="font-semibold text-sm">${escapeHtml(t('preferHighProtein'))}</span>
        <p class="m-0 text-muted text-xs mt-1">${escapeHtml(t('preferHighProteinHint'))}</p>
      </div>
      <input type="checkbox" id="prefer-high-protein" ${prefs.preferHighProtein ? 'checked' : ''}
        style="width:20px;height:20px;accent-color:var(--color-matcha)">
    </label>
    <label class="pref-row mt-2" style="cursor:pointer;border-bottom:none">
      <div>
        <span class="font-semibold text-sm">${escapeHtml(t('preferHomeIngredients'))}</span>
        <p class="m-0 text-muted text-xs mt-1">${escapeHtml(t('preferHomeIngredientsHint'))}</p>
      </div>
      <input type="checkbox" id="prefer-home-ingredients" ${prefs.preferHomeIngredients ? 'checked' : ''}
        style="width:20px;height:20px;accent-color:var(--color-matcha)">
    </label>
  `;

  $('#prefer-high-protein')?.addEventListener('change', async (e) => {
    savePreferences({ preferHighProtein: e.target.checked });
    invalidateRecipeCache();
    await bridge.refreshPlan();
  });

  $('#prefer-home-ingredients')?.addEventListener('change', async (e) => {
    savePreferences({ preferHomeIngredients: e.target.checked });
    invalidateRecipeCache();
    await bridge.refreshPlan();
  });
}

export function renderHomeInventorySection() {
  const root = $('#home-inventory');
  if (!root) return;

  root.innerHTML = `
    <p class="text-[12px] uppercase tracking-widest font-bold accent-saffron m-0 mb-2">${escapeHtml(t('homeInventory'))}</p>
    <p class="text-muted text-xs mb-3">${escapeHtml(t('homeInventoryHint'))}</p>

    <div class="custom-exclusion-form">
      <input type="text" id="home-inventory-input" class="pref-input" placeholder="${escapeAttr(t('addIngredient'))}">
      <button type="button" id="btn-add-inventory" class="slot-swap-btn">${escapeHtml(t('addIngredient'))}</button>
    </div>

    <div class="home-inventory-actions mt-2">
      <button type="button" id="btn-inventory-paste" class="slot-swap-btn">${escapeHtml(t('pasteIngredients'))}</button>
      <label class="slot-swap-btn home-inventory-photo-btn">
        ${escapeHtml(t('scanFridgePhoto'))}
        <input type="file" id="home-inventory-photo" accept="image/*" capture="environment" hidden>
      </label>
    </div>

    <div id="home-inventory-paste-panel" class="mt-3" hidden>
      <p class="text-muted text-xs mb-2">${escapeHtml(t('pasteIngredientsHint'))}</p>
      <textarea id="home-inventory-paste" class="pref-input pref-textarea" rows="4" placeholder="${escapeAttr(t('pasteIngredientsPlaceholder'))}"></textarea>
      <button type="button" id="btn-inventory-paste-confirm" class="slot-swap-btn mt-2">${escapeHtml(t('addFromPaste'))}</button>
    </div>

    <div id="home-inventory-photo-review" class="home-inventory-photo-review mt-3" hidden>
      <p class="text-muted text-xs mb-2">${escapeHtml(t('photoReviewHint'))}</p>
      <img id="home-inventory-photo-preview" class="home-inventory-preview" alt="" hidden>
      <p id="home-inventory-scan-status" class="home-inventory-scan-status text-xs mt-2 mb-2" role="status" hidden></p>
      <div id="home-inventory-scan-results" class="scan-result-list mt-2"></div>
      <textarea id="home-inventory-photo-lines" class="pref-input pref-textarea mt-2" rows="3" placeholder="${escapeAttr(t('photoReviewPlaceholder'))}"></textarea>
      <button type="button" id="btn-inventory-photo-confirm" class="slot-swap-btn mt-2">${escapeHtml(t('addFromPhotoReview'))}</button>
      <button type="button" id="btn-inventory-photo-cancel" class="slot-swap-btn mt-2">${escapeHtml(t('cancelPhotoReview'))}</button>
    </div>

    <p class="text-muted text-xs mt-3 mb-2">${escapeHtml(t('quickAddIngredients'))}</p>
    <div class="home-inventory-quick" id="home-inventory-quick">
      ${COMMON_HOME_INGREDIENTS.map(
        (name) =>
          `<button type="button" class="alt-chip" data-quick-ingredient="${escapeAttr(name)}">${escapeHtml(name)}</button>`
      ).join('')}
    </div>

    <div id="home-inventory-chips" class="exclusion-chips mt-3"></div>
  `;

  renderInventoryChips();
  bindHomeInventory();
}

export function bindHomeInventory() {
  $('#btn-add-inventory')?.addEventListener('click', () => addFromInput());
  $('#home-inventory-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFromInput();
    }
  });

  $('#btn-inventory-paste')?.addEventListener('click', () => {
    const panel = $('#home-inventory-paste-panel');
    if (panel) panel.hidden = !panel.hidden;
  });

  $('#btn-inventory-paste-confirm')?.addEventListener('click', () => addFromPaste());

  $('#home-inventory-quick')?.querySelectorAll('[data-quick-ingredient]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      addHomeInventoryItems([btn.dataset.quickIngredient], 'manual');
      renderInventoryChips();
      invalidateRecipeCache();
      await bridge.refreshPlan();
    });
  });

  $('#home-inventory-photo')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = $('#home-inventory-photo-preview');
    clearPhotoPreview();
    activePreviewUrl = URL.createObjectURL(file);
    if (preview) {
      preview.src = activePreviewUrl;
      preview.hidden = false;
    }
    renderPhotoReview();
    startPhotoScan(file);
    e.target.value = '';
  });

  $('#btn-inventory-photo-confirm')?.addEventListener('click', async () => {
    const area = $('#home-inventory-photo-lines');
    const detected = scanReviewItems.filter((item) => item.selected).map((item) => item.name);
    const manual = parseIngredientLines(area?.value || '');
    const names = [...detected, ...manual];
    if (!names.length) return;
    addHomeInventoryItems(names, 'photo');
    if (area) area.value = '';
    const panel = $('#home-inventory-photo-review');
    if (panel) panel.hidden = true;
    clearPhotoScanState();
    clearPhotoPreview();
    renderInventoryChips();
    invalidateRecipeCache();
    await bridge.refreshPlan();
  });

  $('#btn-inventory-photo-cancel')?.addEventListener('click', () => {
    const panel = $('#home-inventory-photo-review');
    if (panel) panel.hidden = true;
    clearPhotoScanState();
    clearPhotoPreview();
    const area = $('#home-inventory-photo-lines');
    if (area) area.value = '';
  });
}
