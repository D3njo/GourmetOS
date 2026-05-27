import { t, effortLabelKey } from '../i18n.js';
import { formatEffortBadge } from '../recipe-complexity.js';
import { getRecipeSourceLabel, getRecipeSourceUrl } from '../recipe-api.js';
import { getLocale as getStoredLocale } from '../storage.js';
import { isOnlineOnly } from '../recipe-loader.js';
import { escapeAttr } from './dom.js';

export function effortPillsHtml(dayKey, activeEffort) {
  return ['quick', 'medium', 'elaborate']
    .map(
      (effort) => `
    <button type="button" class="effort-pill ripple-host ${effort === activeEffort ? 'active' : ''}"
      data-day="${dayKey}" data-effort="${effort}" aria-pressed="${effort === activeEffort ? 'true' : 'false'}">${t(effortLabelKey(effort))}</button>
  `
    )
    .join('');
}

export function recipeEffortBadge(recipe) {
  return formatEffortBadge(recipe);
}

export function slotSourceLabel(recipe) {
  const name = getRecipeSourceLabel(recipe);
  const rating = recipe.rating ? ` ★${recipe.rating.toFixed(1)}` : '';
  return `${name}${rating}`;
}

export function renderOnlineOnlyFallback(container, recipe) {
  const source = getRecipeSourceLabel(recipe);
  const url = getRecipeSourceUrl(recipe);
  container.innerHTML = `
    <p class="text-muted text-sm m-0 mb-2">${t('onlineOnlyRecipe')}</p>
    ${
      url
        ? `<button type="button" class="open-recipe-link ripple-host" data-url="${escapeAttr(url)}">${t('openFullRecipe').replace('{source}', source)}</button>`
        : ''
    }
  `;
  container.querySelectorAll('.btn-open-full-recipe, .open-recipe-link[data-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const u = btn.dataset.url;
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
    });
  });
}

export function slotExpandKey(dayKey, slotIndex) {
  return `${dayKey}-${slotIndex}`;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
