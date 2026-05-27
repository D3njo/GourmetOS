#!/usr/bin/env node
/**
 * Release smoke checks: PWA assets, manifest, shell markup, no removed vision modules.
 * Run: node scripts/release-smoke.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function fail(msg) {
  errors.push(msg);
}

function ok(msg) {
  passed.push(msg);
}

const errors = [];
const passed = [];

function extractUrlArray(swSource, constName) {
  const block = swSource.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\];`));
  if (!block) return [];
  return (block[1].match(/'\.\/[^']+'/g) || []).map((s) => s.slice(1, -1));
}

function extractSwUrls(swSource) {
  return [
    ...new Set([
      ...extractUrlArray(swSource, 'CORE_URLS'),
      ...extractUrlArray(swSource, 'DATA_URLS')
    ])
  ];
}

function checkSwAssets() {
  const sw = read('sw.js');
  const urls = extractSwUrls(sw);
  for (const url of urls) {
    const rel = url.replace(/^\.\//, '');
    if (!exists(rel)) fail(`SW precache missing file: ${rel}`);
  }
  ok(`SW precache: ${urls.length} assets on disk`);
}

function checkManifest() {
  const manifest = JSON.parse(read('manifest.json'));
  const required = ['name', 'short_name', 'start_url', 'display', 'icons'];
  for (const key of required) {
    if (!manifest[key]) fail(`manifest.json missing ${key}`);
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 1) {
    fail('manifest.json needs at least one icon');
  }
  for (const icon of manifest.icons || []) {
    const iconPath = icon.src?.replace(/^\.\//, '');
    if (iconPath && !exists(iconPath)) fail(`manifest icon missing: ${iconPath}`);
  }
  ok('manifest.json valid');
}

function checkShellMarkup() {
  const html = read('index.html');
  const requiredIds = [
    'view-today',
    'view-week',
    'view-preferences',
    'home-inventory',
    'shopping-list',
    'portion-bar',
    'app-status'
  ];
  for (const id of requiredIds) {
    if (!html.includes(`id="${id}"`)) fail(`index.html missing #${id}`);
  }
  if (!html.includes('data-view="today"')) fail('index.html missing dock today button');
  if (!html.includes('data-view="week"')) fail('index.html missing dock week button');
  if (!html.includes('data-view="preferences"')) fail('index.html missing dock preferences button');
  if (html.includes('home-inventory-photo')) fail('index.html still has photo inventory UI');
  ok('index.html shell markup');
}

function checkNoVisionModules() {
  const forbidden = [
    'js/inventory-photo-scan.js',
    'js/inventory-grocery-detector.js',
    'js/inventory-vlm-provider.js',
    'ml/grocery_vision/evaluate.py'
  ];
  for (const rel of forbidden) {
    if (exists(rel)) fail(`Removed feature still present: ${rel}`);
  }
  const app = read('js/app.js');
  if (/inventory-photo|inventory-vlm|grocery.detector/i.test(app)) {
    fail('js/app.js still references removed vision modules');
  }
  ok('no fridge-photo / vision stack in tree');
}

function checkAppBootGraph() {
  const app = read('js/app.js');
  if (!app.includes('registerServiceWorker')) fail('js/app.js missing service worker registration');
  if (!app.includes("import { syncPortionBarVisibility }")) fail('js/app.js missing portion bar');
  if (!app.includes('buildWeeklyPlan')) fail('js/app.js missing plan engine');
  ok('js/app.js boot graph');
}

function main() {
  checkSwAssets();
  checkManifest();
  checkShellMarkup();
  checkNoVisionModules();
  checkAppBootGraph();

  if (errors.length) {
    console.error('release-smoke: FAILED');
    for (const e of errors) console.error('  ✗', e);
    process.exit(1);
  }

  console.log('release-smoke: OK');
  for (const p of passed) console.log('  ✓', p);
}

main();
