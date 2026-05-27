# GourmetOS

Weather-adaptive haute cuisine meal planner — Progressive Web App for GitHub Pages. **English-only** UI and recipe metadata.

## Structure

```
GourmetOS/
├── index.html
├── manifest.json
├── sw.js                         # Service worker (see js/config.js → SW_CACHE_VERSION)
├── css/app.css
├── js/
│   ├── app.js                    # Thin orchestrator
│   ├── app-state.js              # Shared state
│   ├── app-bridge.js             # Cross-module callbacks
│   ├── measure-parse.js          # Ingredient amounts (fractions, pinch, etc.)
│   ├── exclusions.js             # Allergen exclusions + plan sanitize
│   ├── diet-preferences.js       # Vegetarian, vegan, low carb, …
│   ├── ui/                       # View modules
│   ├── recipes.js                # Planning pool + scoring
│   ├── recipe-idb.js             # IndexedDB recipe bodies
│   ├── recipe-loader.js          # Lazy resolve, image reconcile, online stubs
│   ├── pool-sync.js              # TheMealDB sync (+ optional Spoonacular)
│   └── …
├── scripts/
│   ├── build-recipe-index.js     # Crawl TheMealDB → index + bundled
│   ├── validate-data.js          # Data file checks
│   ├── test-measures.js          # Amount parsing / NaN guards
│   ├── test-exclusions.js        # Allergen filter + plan sanitize
│   ├── test-diet-preferences.js  # Diet-style filters
│   └── curate-premium-catalog.js # Premium catalog curation
└── data/
    ├── recipe-catalog.json       # Curated premium seeds
    ├── recipe-index.json         # Metadata index
    └── recipes-bundled.json      # Offline metadata stubs (no full instructions)
```

## Recipe pool

| Source | Role |
|--------|------|
| **recipe-index.json** | Planning metadata (637+ entries) |
| **recipes-bundled.json** | Offline metadata stubs (planning only) |
| **IndexedDB** | Full bodies after online sync (TheMealDB API) |
| **Spoonacular** (optional) | Extended pool with API key |

Premium recipes are ranked via `tier`, `qualityScore`, `chef`, and `fineDiningMeta`. Online-only entries show a badge and link to the source recipe.

## Preferences

- **Diet style** — vegetarian, vegan, pescatarian, low carb, gluten-free, dairy-free (combinable; filters plan immediately)
- **Exclusions** — fish, shellfish, beef, pork, duck, gluten, dairy, eggs, coriander + custom terms (fail-closed; stored plan IDs are sanitized on change)
- **Portions** — sticky control above the bottom nav on Today/Week; scales ingredients and shopping list
- **Units** — metric or imperial

## Sync

1. **TheMealDB** — syncs index IDs into IndexedDB (no API key required)
2. **Spoonacular** — optional, paginated expansion (API key + quota)
3. Progress appears under **Preferences → Refresh recipes**
4. **Clear pool** resets IndexedDB and re-syncs

## Scripts

```bash
npm test               # syntax + data + measures + exclusions + diet
npm run test:syntax    # ES module syntax check
npm run test:data      # Validate JSON data + compliance rules
npm run test:measures  # Measure parsing (no NaN in formatAmount)
npm run test:exclusions
npm run test:diet
npm run build:data     # Rebuild index + bundled from TheMealDB
npm run curate:catalog # Curate premium catalog seeds
npm run icons:build    # Regenerate PWA icons from assets/icons/icon.svg
```

## Local dev

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

After a service worker update, hard-reload the page (current cache version in `js/config.js`, e.g. **v32**). First launch runs a background sync to fill IndexedDB.

## Browser smoke test

Manual checks after changes:

1. App loads without console errors
2. **Today** — hero image matches recipe; ingredients without `NaN`; portion bar visible while scrolling to shopping list
3. **Week** — all 7 days; portion controls in shopping accordion
4. **Preferences** — exclusions and diet toggles remove incompatible dishes immediately (e.g. fish + shellfish → no prawn dishes)
5. **Reset menu** changes selections
6. **Refresh recipes** updates pool sync status
7. Offline reload works after the service worker installs

## Deployment (GitHub Pages)

Public deployments should follow [TheMealDB terms of use](https://www.themealdb.com/terms_of_use.php): attribute the data source in the app, use official API endpoints, and consider a [Patreon supporter key](https://www.patreon.com/themealdb) for production traffic.

Live demo: [https://d3njo.github.io/GourmetOS/](https://d3njo.github.io/GourmetOS/)

## License

GourmetOS application code is licensed under **GNU GPL v3.0 or later** — see [LICENSE](LICENSE).

Recipe metadata in `data/` is planning information with links to original publishers; full instructions are fetched at runtime via the TheMealDB API. Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Automated compliance checks do not replace legal advice.
