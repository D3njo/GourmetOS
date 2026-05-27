/**
 * Scheduled menu refresh: today once per day, full week once on Sunday.
 */

import { getItem, setItem } from './storage.js';

const MENU_REFRESH_KEY = 'gourmetos_menu_refresh';

function toDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local date of the Sunday that starts the current calendar week */
function sundayDateStr(d = new Date()) {
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return toDateKey(sunday);
}

function getMeta() {
  return getItem(MENU_REFRESH_KEY, { lastTodayRefresh: null, lastWeekRefresh: null });
}

function saveMeta(meta) {
  setItem(MENU_REFRESH_KEY, meta);
}

export function shouldRefreshWeekPlan() {
  const now = new Date();
  if (now.getDay() !== 0) return false;
  const meta = getMeta();
  return meta.lastWeekRefresh !== sundayDateStr(now);
}

export function shouldRefreshTodayMenu() {
  const meta = getMeta();
  return meta.lastTodayRefresh !== toDateKey();
}

export function markWeekPlanRefreshed() {
  const now = new Date();
  saveMeta({
    lastWeekRefresh: sundayDateStr(now),
    lastTodayRefresh: toDateKey(now)
  });
}

export function markTodayMenuRefreshed() {
  const meta = getMeta();
  saveMeta({ ...meta, lastTodayRefresh: toDateKey() });
}

export function markManualMenuReset() {
  const now = new Date();
  const meta = { lastTodayRefresh: toDateKey(now) };
  if (now.getDay() === 0) {
    meta.lastWeekRefresh = sundayDateStr(now);
  }
  saveMeta(meta);
}

export function getMenuRefreshMeta() {
  return getMeta();
}

export { toDateKey };
