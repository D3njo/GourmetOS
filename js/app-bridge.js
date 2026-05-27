/** Cross-module callbacks wired from app.js */
export const bridge = {
  refreshPlan: async () => {},
  applySlotSelection: async () => {},
  renderWeekView: () => {},
  renderTodayView: () => {},
  renderPreferences: async () => {},
  renderShoppingList: () => {},
  openRecipeEditor: async () => {},
  getActiveSlot: () => null,
  resetMenuManual: async () => {},
  bindAccordions: () => {}
};
