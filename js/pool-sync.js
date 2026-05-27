/**
 * Resume-capable sync: TheMealDB full index + Spoonacular pagination → IndexedDB
 */

import {
  fetchMealById,
  loadCatalog,
  mapMealToRecipe,
  buildMetaFromMeal
} from './recipe-api.js';
import {
  countRecipes,
  getSyncMeta,
  putRecipes,
  setSyncMeta,
  getAllRecipes
} from './recipe-idb.js';
import {
  mapSpoonacularRecipe,
  getSpoonacularQuota
} from './spoonacular-api.js';
import { getSpoonacularApiKey } from './storage.js';
import { enrichRecipeComplexity } from './recipe-complexity.js';

const TARGET_POOL = 1000;
const SPOON_PAGE_SIZE = 100;
const SPOON_MAX_OFFSET = 900;
const TMD_BATCH = 6;

function getEffectiveTarget(indexCount) {
  if (getSpoonacularApiKey()) return TARGET_POOL;
  return indexCount || 637;
}

export async function loadRecipeIndex() {
  const res = await fetch('./data/recipe-index.json');
  if (!res.ok) throw new Error('recipe-index.json missing');
  return res.json();
}

async function spoonacularFetchPage(offset, query = '') {
  const apiKey = getSpoonacularApiKey();
  if (!apiKey) return { results: [], done: true };

  const url = new URL('https://api.spoonacular.com/recipes/complexSearch');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('number', String(SPOON_PAGE_SIZE));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('sort', 'popularity');
  url.searchParams.set('addRecipeInformation', 'true');
  url.searchParams.set('fillIngredients', 'true');
  url.searchParams.set('language', 'en');
  if (query) url.searchParams.set('query', query);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const left = response.headers.get('X-Api-Quota-Left');
  if (left != null) {
    const { setItem } = await import('./storage.js');
    setItem('gourmetos_spoonacular_quota', {
      left: Number(left),
      updatedAt: new Date().toISOString()
    });
  }

  if (!response.ok) {
    if (response.status === 402 || response.status === 429) {
      return { results: [], done: true, quotaExceeded: true };
    }
    throw new Error(`Spoonacular HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    results: (data.results || []).map(mapSpoonacularRecipe).map(enrichRecipeComplexity),
    done: !data.results?.length || offset >= SPOON_MAX_OFFSET,
    totalResults: data.totalResults
  };
}

function indexEntryToStub(entry) {
  return enrichRecipeComplexity({
    ...entry,
    description: entry.description || entry.name,
    flavor_profile: entry.cuisine || '',
    base_portions: 2,
    ingredients: [],
    steps: [],
    hasFullData: false,
    onlineOnly: true,
    external: true
  });
}

/** Sync TheMealDB meals from index into IndexedDB */
async function syncTheMealDb({ index, onProgress, existingIds, target = 637 }) {
  const catalog = await loadCatalog();
  const discovery = catalog.discovery || {};
  const overrides = {};
  for (const m of catalog.meals || []) {
    overrides[m.idMeal] = m;
  }

  const pending = index.entries.filter((e) => e.idMeal && !existingIds.has(e.id));
  let done = 0;

  for (let i = 0; i < pending.length; i += TMD_BATCH) {
    const batch = pending.slice(i, i + TMD_BATCH);
    const recipes = await Promise.all(
      batch.map(async (entry) => {
        try {
          const meal = await fetchMealById(entry.idMeal);
          const meta = overrides[entry.idMeal] || buildMetaFromMeal(meal, discovery);
          if (entry.tier === 'premium') meta.tier = 'premium';
          const recipe = mapMealToRecipe(meal, { ...meta, slug: entry.id });
          return {
            ...recipe,
            tier: entry.tier,
            qualityScore: entry.qualityScore,
            chef: entry.chef,
            weather_primary: entry.weather_primary,
            hasFullData: true,
            onlineOnly: false
          };
        } catch {
          return { ...indexEntryToStub(entry), hasFullData: false };
        }
      })
    );
    await putRecipes(recipes.filter(Boolean));
    done += batch.length;
    onProgress?.({
      phase: 'themealdb',
      done,
      total: pending.length,
      poolCount: existingIds.size + done,
      target,
      indexCount: index.count
    });
  }

  return pending.length;
}

/** Paginate Spoonacular until TARGET_POOL or quota */
async function syncSpoonacular({ onProgress, existingIds, startOffset = 0 }) {
  if (!getSpoonacularApiKey()) return { added: 0, offset: startOffset };

  let offset = startOffset;
  let added = 0;
  const queries = ['', 'gourmet', 'fine dining', 'French', 'Italian'];

  for (const query of queries) {
    while (offset <= SPOON_MAX_OFFSET && existingIds.size + added < TARGET_POOL) {
      const page = await spoonacularFetchPage(offset, query);
      if (page.quotaExceeded) break;

      const fresh = page.results.filter((r) => !existingIds.has(r.id));
      if (fresh.length) {
        const enriched = fresh.map((r) => ({
          ...r,
          tier: r.rating >= 4 ? 'premium' : 'standard',
          qualityScore: (r.rating || 0) / 2,
          ingredients: [],
          steps: [],
          hasFullData: false,
          onlineOnly: true
        }));
        await putRecipes(enriched);
        for (const r of enriched) {
          existingIds.add(r.id);
          added++;
        }
      }

      onProgress?.({
        phase: 'spoonacular',
        offset,
        poolCount: existingIds.size,
        target: TARGET_POOL,
        quota: getSpoonacularQuota()
      });

      if (page.done) break;
      offset += SPOON_PAGE_SIZE;
      if (existingIds.size >= TARGET_POOL) break;
    }
    if (existingIds.size >= TARGET_POOL) break;
    offset = 0;
  }

  return { added, offset };
}

/** Full pool sync — resumable */
export async function syncRecipePool({ force = false, onProgress } = {}) {
  const index = await loadRecipeIndex();
  let meta = (await getSyncMeta('pool_sync')) || {
    tmdComplete: false,
    spoonOffset: 0,
    lastRun: null
  };

  if (force) {
    meta = { tmdComplete: false, spoonOffset: 0, lastRun: null };
  }

  const existing = await getAllRecipes();
  const existingIds = new Set(existing.map((r) => r.id));

  if (!meta.tmdComplete) {
    const target = getEffectiveTarget(index.count);
    onProgress?.({
      phase: 'start',
      message: 'TheMealDB sync…',
      poolCount: existingIds.size,
      target,
      indexCount: index.count
    });
    await syncTheMealDb({ index, onProgress, existingIds, target });
    meta.tmdComplete = true;
    await setSyncMeta('pool_sync', meta);
  }

  const afterTmd = await getAllRecipes();
  afterTmd.forEach((r) => existingIds.add(r.id));

  if (existingIds.size < getEffectiveTarget(index.count) && getSpoonacularApiKey()) {
    onProgress?.({
      phase: 'spoonacular',
      message: 'Spoonacular sync…',
      poolCount: existingIds.size,
      target: getEffectiveTarget(index.count)
    });
    const result = await syncSpoonacular({
      onProgress,
      existingIds,
      startOffset: meta.spoonOffset || 0
    });
    meta.spoonOffset = result.offset;
    meta.spoonComplete = existingIds.size >= TARGET_POOL;
  }

  meta.lastRun = new Date().toISOString();
  meta.poolCount = await countRecipes();
  meta.indexCount = index.count;
  meta.premiumInIndex = index.premiumCount ?? index.entries.filter((e) => e.tier === 'premium').length;
  await setSyncMeta('pool_sync', meta);

  const target = getEffectiveTarget(index.count);
  onProgress?.({ phase: 'done', poolCount: meta.poolCount, target, indexCount: index.count });

  return meta;
}

export async function getSyncStatus() {
  const meta = await getSyncMeta('pool_sync');
  const poolCount = await countRecipes();
  let indexCount = meta?.indexCount ?? 637;
  let premiumInIndex = meta?.premiumInIndex ?? null;
  let premiumInPool = null;

  try {
    const index = await loadRecipeIndex();
    indexCount = index.count ?? index.entries?.length ?? indexCount;
    premiumInIndex = index.premiumCount ?? index.entries.filter((e) => e.tier === 'premium').length;
    const stored = await getAllRecipes();
    const storedIds = new Set(stored.map((r) => r.id));
    premiumInPool = index.entries.filter((e) => e.tier === 'premium' && storedIds.has(e.id)).length;
  } catch {
    /* offline stub */
  }

  const target = getEffectiveTarget(indexCount);
  const spoonacularEnabled = !!getSpoonacularApiKey();

  return {
    poolCount,
    target,
    indexCount,
    premiumInIndex,
    premiumInPool,
    spoonacularEnabled,
    meta,
    quota: getSpoonacularQuota()
  };
}

export { TARGET_POOL, getEffectiveTarget };
