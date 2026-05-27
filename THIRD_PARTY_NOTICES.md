# Third-party notices

This document lists components used by GourmetOS that are not covered solely by the
application license in [LICENSE](LICENSE) (GNU GPL v3.0 or later).

## GourmetOS application code

- **License:** GPL-3.0-or-later
- **Files:** HTML, CSS, JavaScript under `js/`, `css/`, `index.html`, `sw.js`, `manifest.json`, and build scripts under `scripts/` (excluding third-party data).

## TheMealDB

- **Website:** https://www.themealdb.com
- **Terms:** https://www.themealdb.com/terms_of_use.php
- **Use in GourmetOS:** Recipe metadata, images (hotlinked), and full recipe bodies fetched at runtime via the official JSON API. Committed files under `data/` contain planning metadata and links to original publishers — not full cooking instructions.
- **Your obligations:** Use official API endpoints; attribute TheMealDB as the data source; do not remove copyright or trademark notices; consider a Patreon supporter key for public production deployments.

## Original recipe publishers

Entries may link to third-party sites (e.g. BBC Good Food, Serious Eats, Jamie Oliver). GourmetOS does not claim ownership of those recipes. Users should open the linked original for full instructions. Do not redistribute publisher content outside what TheMealDB and applicable law permit.

## Spoonacular (optional)

- **Website:** https://spoonacular.com
- **Use in GourmetOS:** Optional API key stored locally in the browser. Recipes are fetched on demand; extended results are not committed to this repository.
- **Your obligations:** Comply with Spoonacular API terms; the API key is for personal use by the user who provides it.

## Google Fonts

- **Fonts:** DM Sans, Playfair Display
- **Delivery:** Loaded from `fonts.googleapis.com` / `fonts.gstatic.com` (see [index.html](index.html))
- **License:** SIL Open Font License 1.1 — https://scripts.sil.org/OFL

## App icons

- **Files:** `assets/icons/icon-192.png`, `assets/icons/icon-512.png`
- **Origin:** Project-authored simple icons for the PWA manifest.

## Disclaimer

Automated validation in this repository checks for common compliance issues but does not
constitute legal advice. You are responsible for how you deploy and use GourmetOS.
