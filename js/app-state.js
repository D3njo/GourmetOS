/** Shared application state */
import { getPortions, getShoppingScope } from './storage.js';

export const state = {
  view: 'today',
  recipe: null,
  weatherTag: 'cold',
  forecast: null,
  categories: {},
  portions: getPortions(),
  weeklyPlan: null,
  weatherError: false,
  coordsSource: null,
  todaySlotIndex: 0,
  shoppingScope: getShoppingScope(),
  expandedSlots: new Set(),
  appLoading: true,
  poolSyncing: false,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  swUpdateReady: false,
  strictFilterPending: false
};
