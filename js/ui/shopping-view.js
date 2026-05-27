import { saveShoppingScope, getPreferences, savePreferences } from '../storage.js';
import { formatAmount } from '../portions.js';
import {
  buildShoppingListFromPlan,
  getItemKey,
  toggleItemChecked,
  isItemChecked
} from '../shopping-list.js';
import { t } from '../i18n.js';
import { state } from '../app-state.js';
import { $, escapeHtml, escapeAttr } from './dom.js';

function scopeSuffix(containerId) {
  return containerId.includes('week') ? '-week' : '';
}

function buildShoppingHtml(groups, idSuffix) {
  if (groups.length === 0) {
    return `<p class="text-muted text-sm">${escapeHtml(t('emptyShoppingList'))}</p>`;
  }

  return groups
    .map(
      (group) => `
      <div class="shop-category">
        <div class="shop-category-title">${escapeHtml(group.emoji)} ${escapeHtml(group.label)}</div>
        ${group.items
          .map((item) => {
            const key = getItemKey(group.id, item.name, item.unit);
            const checked = isItemChecked(key);
            const inputId = `shop-${key.replace(/[^a-z0-9_-]/gi, '-')}${idSuffix}`;
            return `
              <label class="shop-item ${checked ? 'checked' : ''}" for="${escapeAttr(inputId)}">
                <input type="checkbox" id="${escapeAttr(inputId)}" class="shop-item-input" data-key="${escapeAttr(key)}" ${checked ? 'checked' : ''}>
                <div class="shop-checkbox" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <span class="shop-item-label">${escapeHtml(item.displayName || item.name)}</span>
                <span class="shop-item-meta">
                  ${item.buyTiming ? `<span class="buy-timing buy-timing-${escapeAttr(item.buyTiming)}">${escapeHtml(t(`buyTiming_${item.buyTiming}`))}</span>` : ''}
                  <span class="ingredient-amount">${escapeHtml(formatAmount(item.amount, item.unit))}</span>
                </span>
              </label>
            `;
          })
          .join('')}
      </div>
    `
    )
    .join('');
}

export function renderShoppingScopeToggle(containerId) {
  const container = $(containerId);
  if (!container) return;

  const suffix = scopeSuffix(containerId);

  container.innerHTML = `
    <div class="scope-toggle" role="group" aria-label="${escapeAttr(t('shoppingList'))}">
      <button type="button" class="scope-btn ${state.shoppingScope === 'day' ? 'active' : ''}" data-scope="day"
        aria-pressed="${state.shoppingScope === 'day' ? 'true' : 'false'}">
        ${escapeHtml(t('shoppingScopeDay'))}
      </button>
      <button type="button" class="scope-btn ${state.shoppingScope === 'week' ? 'active' : ''}" data-scope="week"
        aria-pressed="${state.shoppingScope === 'week' ? 'true' : 'false'}">
        ${escapeHtml(t('shoppingScopeWeek'))}
      </button>
    </div>
    <label class="shopping-pantry-toggle">
      <input type="checkbox" id="hide-pantry-basics${suffix}" ${getPreferences().hidePantryBasics ? 'checked' : ''}>
      <span>${escapeHtml(t('hidePantryBasics'))}</span>
    </label>
  `;

  container.querySelector(`#hide-pantry-basics${suffix}`)?.addEventListener('change', (e) => {
    savePreferences({ hidePantryBasics: e.target.checked });
    renderShoppingList();
  });

  container.querySelectorAll('[data-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.shoppingScope = btn.dataset.scope;
      saveShoppingScope(state.shoppingScope);
      renderShoppingList();
    });
  });
}

export function renderShoppingList() {
  const containers = [
    { list: '#shopping-list', scope: '#shopping-scope-toggle', suffix: '' },
    { list: '#shopping-list-week', scope: '#shopping-scope-toggle-week', suffix: '-week' }
  ];

  containers.forEach(({ scope }) => renderShoppingScopeToggle(scope));

  if (!state.weeklyPlan) return;

  const groups = buildShoppingListFromPlan(
    state.weeklyPlan,
    state.portions,
    state.categories,
    { scope: state.shoppingScope }
  );

  containers.forEach(({ list, suffix }) => {
    const el = $(list);
    if (!el) return;
    el.innerHTML = buildShoppingHtml(groups, suffix);
    el.querySelectorAll('.shop-item-input').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.key;
        const desired = input.checked;
        if (isItemChecked(key) !== desired) {
          toggleItemChecked(key);
        }
        input.closest('.shop-item')?.classList.toggle('checked', desired);
      });
    });
  });
}
