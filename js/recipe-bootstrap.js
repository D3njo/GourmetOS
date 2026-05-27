/** Bootstrap IndexedDB from bundled recipes when empty */

import { countRecipes, putRecipes } from './recipe-idb.js';

export async function bootstrapFromBundledIfEmpty() {
  const count = await countRecipes();
  if (count > 0) return count;

  try {
    const res = await fetch('./data/recipes-bundled.json');
    if (!res.ok) return 0;
    const data = await res.json();
    const recipes = (data.recipes || []).map((r) => ({
      ...r,
      hasFullData: true,
      onlineOnly: false
    }));
    if (recipes.length) await putRecipes(recipes);
    return recipes.length;
  } catch {
    return 0;
  }
}
