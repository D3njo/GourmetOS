import { state } from '../app-state.js';
import { t } from '../i18n.js';
import { $ } from './dom.js';

export function updateAppStatus() {
  const el = $('#app-status');
  const textEl = $('#app-status-text');
  const reloadBtn = $('#btn-sw-reload');
  if (!el || !textEl) return;

  if (state.appLoading) {
    textEl.textContent = t('appLoading');
    el.dataset.status = 'loading';
    el.hidden = false;
    if (reloadBtn) reloadBtn.hidden = true;
    return;
  }

  if (state.swUpdateReady) {
    textEl.textContent = t('statusUpdateAvailable');
    el.dataset.status = 'update';
    el.hidden = false;
    if (reloadBtn) reloadBtn.hidden = false;
    return;
  }

  if (state.poolSyncing) {
    textEl.textContent = t('statusSyncing');
    el.dataset.status = 'syncing';
    el.hidden = false;
    if (reloadBtn) reloadBtn.hidden = true;
    return;
  }

  if (state.strictFilterPending) {
    textEl.textContent = t('statusStrictFilterPending');
    el.dataset.status = 'filter-pending';
    el.hidden = false;
    if (reloadBtn) reloadBtn.hidden = true;
    return;
  }

  if (state.offline) {
    textEl.textContent = t('statusOffline');
    el.dataset.status = 'offline';
    el.hidden = false;
    if (reloadBtn) reloadBtn.hidden = true;
    return;
  }

  el.hidden = true;
  if (reloadBtn) reloadBtn.hidden = true;
}

export function bindConnectivityStatus() {
  const sync = () => {
    state.offline = !navigator.onLine;
    updateAppStatus();
  };

  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}
