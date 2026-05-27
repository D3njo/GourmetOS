/** IndexedDB storage for full recipe bodies and sync metadata */

const DB_NAME = 'gourmetos_recipes';
const DB_VERSION = 1;
const STORE_RECIPES = 'recipes';
const STORE_META = 'sync_meta';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_RECIPES)) {
        const store = db.createObjectStore(STORE_RECIPES, { keyPath: 'id' });
        store.createIndex('idMeal', 'idMeal', { unique: false });
        store.createIndex('tier', 'tier', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDb().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

export async function getRecipe(id) {
  const store = await tx(STORE_RECIPES, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function putRecipes(recipes) {
  if (!recipes?.length) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_RECIPES, 'readwrite');
    const store = transaction.objectStore(STORE_RECIPES);
    for (const recipe of recipes) {
      if (recipe?.id) store.put(recipe);
    }
    transaction.oncomplete = () => resolve(recipes.length);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllRecipes() {
  const store = await tx(STORE_RECIPES, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function countRecipes() {
  const store = await tx(STORE_RECIPES, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearRecipes() {
  const store = await tx(STORE_RECIPES, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getSyncMeta(key = 'default') {
  const store = await tx(STORE_META, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setSyncMeta(key, value) {
  const store = await tx(STORE_META, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value, updatedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

/** Migrate legacy localStorage pool into IndexedDB once */
export async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem('gourmetos_recipe_pool');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.recipes?.length) return false;
    const existing = await countRecipes();
    if (existing > 0) return false;
    await putRecipes(parsed.recipes);
    return true;
  } catch {
    return false;
  }
}
