/** UI string catalog — English app copy */

const STRINGS = {
    appVersion: 'GourmetOS v1.0',
    appTitle: "Today's Menu",
    navToday: 'Today',
    navWeek: 'Week',
    navPreferences: 'Preferences',
    navAria: 'Main navigation',
    viewToday: 'Today',
    viewWeek: 'Week',
    viewPreferences: 'Preferences',
    todayIntro:
      'Dishes matched to today\'s weather — adjust portions and check off ingredients as you shop.',
    weatherAuto: 'Location weather',
    weatherAutoHint: 'Open-Meteo · 7-day forecast · Auto adapts to your location',
    weatherAutoResolved: 'Auto',
    weatherUsingFallback: 'Default location (Berlin)',
    weatherUsingSaved: 'Saved location',
    weatherHot: 'Sun / Heat',
    weatherCold: 'Rain / Cold',
    weatherMild: 'Mild',
    weatherOverride: 'Weather mode',
    weatherLocating: 'Locating…',
    weatherUnavailable: 'Weather unavailable',
    chefSelection: "Chef's Selection",
    chefRationaleTitle: 'Why this dish',
    chefRationaleWhyNow: 'Why now',
    chefRationaleTaste: 'Taste arc',
    chefRationaleMove: 'Chef move',
    chefRationaleOccasion: 'Occasion',
    chefRationaleSkill: 'Skill focus',
    chefRationaleMise: 'Mise en place',
    taste_bright: 'Bright',
    taste_rich: 'Rich',
    taste_fresh: 'Fresh',
    taste_smoky: 'Smoky',
    taste_comforting: 'Comforting',
    taste_clean: 'Clean',
    taste_umami: 'Umami',
    occasion_solo: 'Solo night',
    'occasion_date_night': 'Date night',
    occasion_family: 'Family dinner',
    'occasion_rainy_evening': 'Rainy evening',
    'occasion_summer_lunch': 'Summer lunch',
    skill_searing: 'Searing',
    skill_braising: 'Braising',
    skill_plating: 'Plating',
    'skill_knife_work': 'Knife work',
    recipeLoading: 'Loading recipe…',
    appLoading: 'Planning your menu…',
    statusSyncing: 'Syncing recipe library…',
    statusOffline: 'Offline — cached recipes available',
    statusOnline: 'Back online',
    emptyShoppingList: 'No ingredients for this scope — try Week view or add meals.',
    ingredientsHiddenByExclusions:
      'Some ingredients are hidden because of your exclusion settings in Preferences.',
    ingredientsAllExcluded:
      'All ingredients for this dish conflict with your exclusions — open Preferences or swap the recipe.',
    shoppingIngredientsHidden:
      'Some shopping items were hidden due to your allergen exclusions.',
    altReason_faster: 'Faster',
    altReason_lighter: 'Lighter',
    altReason_richer: 'Richer',
    altReason_chefier: 'Chefier',
    altReason_differentProtein: 'Different protein',
    altReason_differentMood: 'Different mood',
    altReason_swap: 'Try this instead',
    weekCompositionSummary: 'Composition {score}/100 · {proteins} proteins · {cuisines} cuisines · {tastes} taste profiles',
    hidePantryBasics: 'Hide pantry basics (salt, oil, flour)',
    buyTiming_fresh: 'Buy fresh',
    buyTiming_now: 'Buy now',
    buyTiming_pantry: 'Pantry',
    startCookMode: 'Start Cook Mode',
    closeCookMode: 'Close',
    cookPrev: 'Back',
    cookNext: 'Next step',
    cookStartSteps: 'Start cooking',
    cookFinish: 'Finish & plate',
    cookPhaseMise: 'Mise en place',
    cookPhaseStep: 'Step {n} of {total}',
    cookPhaseFinish: 'Finish & plate',
    cookFinishHint: 'Rest the dish briefly, add fresh herbs or acid, and serve while aromas are still rising.',
    cookTimerCue: 'Timing cue: ~{min} min for this step',
    changePortions: 'Adjust portions',
    lessPortions: 'Fewer portions',
    morePortions: 'More portions',
    ingredients: 'Ingredients (Mise en Place)',
    preparation: 'Preparation',
    shoppingList: 'Shopping list (check off)',
    weekTitle: 'Planning matrix',
    weekIntro:
      'Meals per day and effort level — recipes adapt to weather and complexity (Mon–Fri quick, Sat/Sun elaborate).',
    meals: 'Meals',
    less: 'Less',
    more: 'More',
    prefsTitle: 'Preferences',
    prefsIntro:
      'Units, exclusions, and boosts — the algorithm filters recipes in milliseconds.',
    excludeTags: 'Exclusions',
    dietPreferences: 'Diet style',
    dietPreferencesHint: 'Active choices filter your plan immediately (works with exclusions below).',
    dietVegetarian: 'Vegetarian',
    dietVegan: 'Vegan',
    dietPescatarian: 'Pescatarian (fish ok)',
    dietLowCarb: 'Low carb',
    dietGlutenFree: 'Gluten-free',
    dietDairyFree: 'Dairy-free',
    dietHighProtein: 'High protein (strict filter)',
    mealBoosts: 'Recommendations',
    mealBoostsHint: 'Ranking boosts — your plan stays varied but favors matching dishes.',
    preferHighProtein: 'Prefer high-protein dishes',
    preferHighProteinHint: 'Ranks protein-rich recipes higher (estimated from ingredients, not nutrition labels).',
    preferHomeIngredients: 'Prefer ingredients at home',
    preferHomeIngredientsHint: 'Favors recipes that use what you already have and need less shopping.',
    homeInventory: 'Ingredients at home',
    homeInventoryHint: 'List what you have — recipes and the shopping list will account for it.',
    homeInventoryEmpty: 'No ingredients added yet.',
    addIngredient: 'Add',
    pasteIngredients: 'Paste list',
    pasteIngredientsHint: 'One ingredient per line (or comma-separated).',
    pasteIngredientsPlaceholder: 'e.g. eggs\nrice\nonions',
    addFromPaste: 'Add from list',
    scanFridgePhoto: 'Scan fridge photo',
    photoReviewHint: 'Scanning starts automatically. Review detected ingredients before saving.',
    photoReviewPlaceholder: 'Add missing items, one per line',
    photoScanLoading: 'Loading scanner…',
    photoScanScanning: 'Scanning photo…',
    photoScanFound: 'Found {n} possible ingredients. Tap chips to include or exclude them.',
    photoScanNone: 'No ingredients detected. Add items manually below.',
    photoScanFailed: 'Automatic scan failed. Add items manually below.',
    photoScanCandidate: '{name} · {confidence}%',
    addFromPhotoReview: 'Save ingredients',
    cancelPhotoReview: 'Cancel',
    quickAddIngredients: 'Quick add',
    removeInventoryItem: 'Remove',
    ingredientsAtHome: 'At home',
    ingredientsAtHomeCount: '{n} of {total} ingredients at home',
    missingIngredientsCount: 'Only {n} to buy',
    shoppingAtHome: 'At home',
    altReason_highProtein: 'More protein',
    altReason_usesHomeIngredients: 'Uses pantry',
    altReason_minimalShopping: 'Less shopping',
    recReason_highProtein: 'High protein',
    recReason_usesHomeIngredients: 'Uses ingredients at home',
    recReason_minimalShopping: 'Minimal shopping',
    units: 'Units',
    unitsMetric: 'Metric (g, kg, ml, l)',
    unitsImperial: 'Imperial (oz, lb, fl oz, cup)',
    locationWeather: 'Location weather',
    locationWeatherHint: 'Automatic via geolocation',
    offlineMode: 'Offline mode',
    offlineHint: 'Service worker active',
    darkMode: 'Dark mode',
    themeSwitchToLight: 'Switch to light mode',
    themeSwitchToDark: 'Switch to dark mode',
    forecastDay: 'Forecast',
    noForecast: 'No forecast',
    pastDay: 'Past',
    weatherHotLabel: 'Sun & heat',
    weatherColdLabel: 'Rain & cold',
    weatherMildLabel: 'Mild',
    excludeFish: 'Fish',
    excludeShellfish: 'Shellfish',
    excludeBeef: 'Beef',
    excludePork: 'Pork',
    excludeDuck: 'Duck',
    excludeGluten: 'Gluten',
    excludeDairy: 'Dairy',
    excludeEggs: 'Eggs',
    excludeCoriander: 'Coriander',
    tagAuto: 'Auto',
    tagPwa: 'PWA',
    shoppingScopeDay: 'Today\'s shop',
    shoppingScopeWeek: 'Weekly shop',
    swapRecipe: 'Swap',
    mealSlot: 'Meal',
    viewIngredients: 'Ingredients',
    todayHighlight: 'Today',
    mealType_breakfast: 'Breakfast',
    mealType_lunch: 'Lunch',
    mealType_dinner: 'Dinner',
    mealType_snack: 'Snack',
    mealType_brunch: 'Brunch',
    alternativeRecipes: 'Alternatives',
    slotOf: 'Meal {n} of {total}',
    customExclusions: 'Custom exclusions',
    customExclusionPlaceholder: 'e.g. nuts, celery…',
    addExclusion: 'Add',
    removeExclusion: 'Remove',
    favorites: 'Favorites',
    noFavorites: 'No favorites yet — tap the heart on any recipe.',
    addFavorite: 'Add to favorites',
    removeFavorite: 'Remove from favorites',
    editRecipe: 'Customize recipe',
    saveRecipe: 'Save',
    restoreDefault: 'Restore default',
    recipeSource: 'Recipe sources',
    recipeSourceInfo: 'Curated from BBC Good Food, Gordon Ramsay and other top sources via TheMealDB — each photo matches its dish.',
    sourceCurated: 'Curated',
    sourceExternal: 'Original recipe',
    sourceCustomized: 'Customized',
    openSourceRecipe: 'Open original recipe',
    effortQuick: 'Quick',
    effortMedium: 'Medium',
    effortElaborate: 'Elaborate',
    effortLabel: 'Effort',
    effortMinutes: 'min',
    effortIngredients: 'ingredients',
    refreshRecipes: 'Refresh recipes',
    refreshRecipesHint: 'Loads new dishes from TheMealDB & Spoonacular',
    refreshingRecipes: 'Loading recipes…',
    recipesRefreshed: 'Recipe pool updated',
    spoonacularKey: 'Spoonacular API key',
    spoonacularKeyHint: 'Optional — stored locally only, for personal use',
    spoonacularQuota: 'Spoonacular quota',
    spoonacularQuotaLeft: '{n} requests left',
    preferExotic: 'Prefer exotic ingredients',
    preferExoticHint: 'Favors recipes with more unusual or harder-to-find ingredients',
    recipePoolInfo: '{n} recipes in pool',
    recipePoolOffline: '{n} recipes available (offline) · target: {target}',
    recipePoolStats: '{offline} offline · {index} in index · {premium} premium · target {target}',
    recipePoolNoSpoonacular: 'TheMealDB mode (no Spoonacular)',
    recipePoolUpdated: 'Last updated: {date}',
    poolSyncProgress: '{n}/{target} recipes loaded',
    onlineOnlyRecipe: 'Full recipe online only',
    openFullRecipe: 'Open original on {source}',
    premiumBadge: 'Premium',
    clearPool: 'Clear pool',
    clearPoolHint: 'Removes all locally stored recipe bodies from IndexedDB',
    clearPoolConfirm: 'Clear the recipe pool? Offline recipes must be synced again.',
    recipeSourceInfo: 'Dynamic from TheMealDB (BBC Good Food, Gordon Ramsay …) + optional Spoonacular. Photos match each dish.',
    themealdbAttribution: 'Recipe data and images from ',
    editorName: 'Name',
    editorDescription: 'Description',
    editorIngredients: 'Ingredients (one per line: amount unit name)',
    editorSteps: 'Steps (one per line)',
    closeEditor: 'Close',
    resetMenu: 'Reset menu',
    resetMenuHint: 'Pick new dishes for your plan now (does not re-sync the recipe pool)',
    resetMenuDone: 'Menu reset'
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let locale = 'en';
const listeners = new Set();

export function getLocale() {
  return 'en';
}

export function setLocale(_next) {
  locale = 'en';
  document.documentElement.lang = 'en';
  listeners.forEach((fn) => fn('en'));
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate a UI string key */
export function t(key) {
  return STRINGS[key] ?? key;
}

export function getDayLabels() {
  return DAY_LABELS;
}

export function getDietPreferenceOptions() {
  return [
    { id: 'vegetarian', labelKey: 'dietVegetarian' },
    { id: 'vegan', labelKey: 'dietVegan' },
    { id: 'pescatarian', labelKey: 'dietPescatarian' },
    { id: 'low_carb', labelKey: 'dietLowCarb' },
    { id: 'gluten_free', labelKey: 'dietGlutenFree' },
    { id: 'dairy_free', labelKey: 'dietDairyFree' },
    { id: 'high_protein', labelKey: 'dietHighProtein' }
  ];
}

export function getExcludeOptions() {
  return [
    { id: 'fish', labelKey: 'excludeFish' },
    { id: 'shellfish', labelKey: 'excludeShellfish' },
    { id: 'beef', labelKey: 'excludeBeef' },
    { id: 'pork', labelKey: 'excludePork' },
    { id: 'duck', labelKey: 'excludeDuck' },
    { id: 'gluten', labelKey: 'excludeGluten' },
    { id: 'dairy', labelKey: 'excludeDairy' },
    { id: 'eggs', labelKey: 'excludeEggs' },
    { id: 'coriander', labelKey: 'excludeCoriander' }
  ];
}

export function weatherLabelKey(tag) {
  if (tag === 'hot') return 'weatherHotLabel';
  if (tag === 'cold') return 'weatherColdLabel';
  return 'weatherMildLabel';
}

export function effortLabelKey(effort) {
  if (effort === 'quick') return 'effortQuick';
  if (effort === 'elaborate') return 'effortElaborate';
  return 'effortMedium';
}

/** Apply data-i18n attributes in the static shell */
export function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const value = t(key);
    if (el.dataset.i18nAttr) {
      el.setAttribute(el.dataset.i18nAttr, value);
    } else {
      el.textContent = value;
    }
  });

  root.querySelectorAll('option[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
