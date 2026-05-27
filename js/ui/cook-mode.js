import { t } from '../i18n.js';
import { scaleSteps } from '../portions.js';
import { state } from '../app-state.js';
import { isOnlineOnly } from '../recipe-loader.js';
import { $, escapeHtml } from './dom.js';

let cookIndex = 0;
let cookSteps = [];
let cookMise = [];
let cookFocusReturn = null;

function getFocusableElements(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function trapCookFocus(e) {
  const panel = document.querySelector('.cook-mode-panel');
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

function onCookKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeCookMode();
    return;
  }
  trapCookFocus(e);
}

function renderCookBody() {
  const body = $('#cook-mode-body');
  const phase = $('#cook-mode-phase');
  const prev = $('#cook-mode-prev');
  const next = $('#cook-mode-next');
  if (!body) return;

  if (cookIndex < 0) {
    phase.textContent = t('cookPhaseMise');
    body.innerHTML = `
      <ul class="cook-mise-list">
        ${cookMise.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    `;
    if (prev) prev.disabled = true;
    if (next) next.textContent = t('cookStartSteps');
    return;
  }

  if (cookIndex >= cookSteps.length) {
    phase.textContent = t('cookPhaseFinish');
    body.innerHTML = `<p class="cook-finish-text">${escapeHtml(t('cookFinishHint'))}</p>`;
    if (prev) prev.disabled = false;
    if (next) next.textContent = t('closeCookMode');
    return;
  }

  const step = cookSteps[cookIndex];
  phase.textContent = t('cookPhaseStep')
    .replace('{n}', String(cookIndex + 1))
    .replace('{total}', String(cookSteps.length));
  const minutes = step.time_minutes;
  body.innerHTML = `
    <p class="cook-step-text">${escapeHtml(step.displayText || step.text)}</p>
    ${minutes ? `<p class="cook-step-timer">${escapeHtml(t('cookTimerCue').replace('{min}', String(minutes)))}</p>` : ''}
  `;
  if (prev) prev.disabled = cookIndex === 0 && !cookMise.length;
  if (next) next.textContent = cookIndex === cookSteps.length - 1 ? t('cookFinish') : t('cookNext');
}

export function canStartCookMode(recipe) {
  return Boolean(recipe && !isOnlineOnly(recipe) && (recipe.steps || []).length);
}

export function openCookMode(recipe) {
  if (!recipe || !state.portions || !canStartCookMode(recipe)) return;

  cookMise = recipe.mise_en_place || [];
  cookSteps = scaleSteps(recipe.steps || [], recipe.base_portions, state.portions);
  cookIndex = cookMise.length ? -1 : 0;

  const modal = $('#cook-mode');
  const title = $('#cook-mode-title');
  if (title) title.textContent = recipe.name;
  if (modal) {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
  cookFocusReturn = document.activeElement;
  document.body.classList.add('no-scroll');
  document.addEventListener('keydown', onCookKeydown);
  renderCookBody();
  $('#cook-mode-next')?.focus();
}

export function closeCookMode() {
  const modal = $('#cook-mode');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('no-scroll');
  document.removeEventListener('keydown', onCookKeydown);
  if (cookFocusReturn && typeof cookFocusReturn.focus === 'function') {
    cookFocusReturn.focus();
  }
  cookFocusReturn = null;
  cookIndex = 0;
  cookSteps = [];
  cookMise = [];
}

export function bindCookMode() {
  $('#btn-start-cook-mode')?.addEventListener('click', () => {
    if (state.recipe) openCookMode(state.recipe);
  });

  $('#cook-mode-close')?.addEventListener('click', closeCookMode);

  $('#cook-mode-prev')?.addEventListener('click', () => {
    if (cookIndex <= -1) return;
    if (cookIndex === 0 && cookMise.length) {
      cookIndex = -1;
    } else {
      cookIndex -= 1;
    }
    renderCookBody();
  });

  $('#cook-mode-next')?.addEventListener('click', () => {
    if (cookIndex < cookSteps.length) {
      cookIndex += 1;
      renderCookBody();
      if (cookIndex > cookSteps.length) closeCookMode();
    } else {
      closeCookMode();
    }
  });
}

export function syncCookModeButton(recipe) {
  const btn = $('#btn-start-cook-mode');
  if (!btn) return;
  const enabled = canStartCookMode(recipe);
  btn.hidden = !enabled;
  btn.disabled = !enabled;
}
