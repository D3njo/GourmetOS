import { state } from '../app-state.js';
import { t } from '../i18n.js';
import { $ } from './dom.js';

export function updateAppStatus() {
  const el = $('#app-status');
  if (!el) return;

  if (state.appLoading) {
    el.textContent = t('appLoading');
    el.dataset.status = 'loading';
    el.hidden = false;
    return;
  }

  if (state.poolSyncing) {
    el.textContent = t('statusSyncing');
    el.dataset.status = 'syncing';
    el.hidden = false;
    return;
  }

  if (state.offline) {
    el.textContent = t('statusOffline');
    el.dataset.status = 'offline';
    el.hidden = false;
    return;
  }

  el.hidden = true;
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
