# Release QA checklist

Run before shipping:

```bash
npm test
```

## Automated (CI)

- [ ] `npm test` — syntax, data, measures, exclusions, diet, inventory, release-smoke

## Manual — mobile PWA

- [ ] Cold start offline → app loads from cache; status banner sensible
- [ ] Today → open Ingredients accordion → portion bar appears; change servings updates list
- [ ] Shopping list → items marked **At home** are read-only (not fake checkboxes)
- [ ] Week → empty slot (if any) shows sensible copy
- [ ] Preferences → Reset menu / Clear pool → confirm destructive actions
- [ ] Dock: Today / Week / Preferences navigation and scroll-to-top
- [ ] Cook mode: open, Escape closes, focus trapped
- [ ] Screen reader: alternative recipes, remove ingredient, dock `aria-current`
- [ ] 320px width + notched device: dock, portion bar, modals not clipped
- [ ] Hard refresh after deploy → no 404 for deleted `inventory-*` scripts in Network tab
- [ ] Service worker update banner → **Reload** applies new version without manual cache clear

## Installability

- [ ] `manifest.json` loads; Add to Home Screen works (Android / iOS)
- [ ] Service worker registers (`gourmetos-core-v32`)
