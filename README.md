# GourmetOS

Weather-adaptive haute cuisine meal planner — Progressive Web App for GitHub Pages. **English-only** UI and recipe metadata.

## Structure

```
GourmetOS/
├── index.html
├── manifest.json
├── sw.js                         # Service worker v12
├── css/app.css
├── js/
│   ├── app.js                    # Thin orchestrator
│   ├── app-state.js              # Shared state
│   ├── app-bridge.js             # Cross-module callbacks
│   ├── ui/                       # View modules
│   ├── recipes.js                # Planning pool + scoring
│   ├── recipe-idb.js             # IndexedDB recipe bodies
│   ├── recipe-loader.js          # Lazy resolve + online-only stubs
│   ├── pool-sync.js              # TheMealDB sync (+ optional Spoonacular)
│   └── …
├── scripts/
│   ├── build-recipe-index.js     # Crawl TheMealDB → index + bundled
│   ├── validate-data.js          # Data file checks
│   └── curate-premium-catalog.js # Premium catalog curation
└── data/
    ├── recipe-catalog.json       # Curated premium seeds
    ├── recipe-index.json         # Metadata index
    └── recipes-bundled.json      # Top offline full recipes
```

## Recipe pool

| Source | Role |
|--------|------|
| **recipe-index.json** | Planning metadata (637+ entries) |
| **recipes-bundled.json** | Offline fallback with full recipes |
| **IndexedDB** | Full bodies after background sync |
| **Spoonacular** (optional) | Extended pool with API key |

Premium recipes are ranked via `tier`, `qualityScore`, `chef`, and `fineDiningMeta`. Online-only entries show a badge and link to the source recipe.

## Sync

1. **TheMealDB** — syncs index IDs into IndexedDB (no API key required)
2. **Spoonacular** — optional, paginated expansion (API key + quota)
3. Progress appears under **Preferences → Refresh recipes**
4. **Clear pool** resets IndexedDB and re-syncs

## Scripts

```bash
npm run test:syntax    # ES module syntax check
npm run test:data      # Validate JSON data files
npm run build:data     # Rebuild index + bundled from TheMealDB
npm run curate:catalog # Curate premium catalog seeds
```

## Local dev

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

After a service worker update, hard-reload the page (cache **v12**). First launch runs a background sync to fill IndexedDB.

## Browser smoke test

Manual checks after changes:

1. App loads without console errors
2. **Today** shows recipe image, ingredients, and steps
3. **Week** renders all 7 days with meal slots
4. **Reset menu** in Preferences changes selections
5. **Refresh recipes** updates pool sync status
6. Offline reload works after the service worker installs

## License

MIT
