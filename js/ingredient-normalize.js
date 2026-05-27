/**
 * Ingredient normalization, pantry basics, and buy-timing hints.
 */

import { t } from './i18n.js';

const PANTRY_BASICS = new Set([
  'salt',
  'pepper',
  'black pepper',
  'olive oil',
  'vegetable oil',
  'oil',
  'water',
  'sugar',
  'flour',
  'butter'
]);

const NAME_ALIASES = [
  ['flat leaf parsley', 'parsley'],
  ['fresh parsley', 'parsley'],
  ['chopped parsley', 'parsley'],
  ['garlic clove', 'garlic'],
  ['garlic cloves', 'garlic'],
  ['brown onion', 'onion'],
  ['red onion', 'onion'],
  ['yellow onion', 'onion'],
  ['cherry tomatoes', 'tomatoes'],
  ['tomato', 'tomatoes']
];

const FRESH_HINTS = ['herb', 'parsley', 'basil', 'mint', 'salmon', 'prawn', 'shrimp', 'fish', 'lettuce', 'spinach'];
const PANTRY_LIKELY = ['salt', 'pepper', 'oil', 'flour', 'sugar', 'stock cube', 'vinegar'];

export function normalizeIngredientName(name) {
  let normalized = (name || '').trim().toLowerCase();
  for (const [from, to] of NAME_ALIASES) {
    if (normalized.includes(from)) normalized = to;
  }
  return normalized.replace(/\s+/g, ' ');
}

/** Display-friendly title case for ingredient names. */
export function formatIngredientDisplayName(name) {
  const raw = (name || '').trim();
  if (!raw) return '';

  const lowerParticles = new Set(['and', 'or', 'of', 'with']);

  return raw
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && lowerParticles.has(lower)) return lower;
      if (word.length <= 2 && /^[a-z]{1,2}$/i.test(word)) return word.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function isPantryBasic(name) {
  const n = normalizeIngredientName(name);
  return PANTRY_BASICS.has(n) || PANTRY_LIKELY.some((p) => n.includes(p));
}

export function getBuyTiming(name) {
  const n = normalizeIngredientName(name);
  if (isPantryBasic(n)) return 'pantry';
  if (FRESH_HINTS.some((h) => n.includes(h))) return 'fresh';
  return 'now';
}

export function buyTimingLabel(timing) {
  return t(`buyTiming_${timing}`);
}

export function enrichShoppingItem(item, options = {}) {
  const { hidePantry = false } = options;
  const normalizedName = normalizeIngredientName(item.name);
  const timing = getBuyTiming(item.name);
  const pantry = isPantryBasic(item.name);

  if (hidePantry && pantry) return null;

  return {
    ...item,
    normalizedName,
    buyTiming: timing,
    isPantry: pantry,
    atHome: !!item.atHome,
    displayName: formatIngredientDisplayName(item.name)
  };
}

export function enrichShoppingGroups(groups, options = {}) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => enrichShoppingItem(item, options))
        .filter(Boolean)
        .sort((a, b) => {
          const order = { fresh: 0, now: 1, pantry: 2 };
          return (order[a.buyTiming] ?? 1) - (order[b.buyTiming] ?? 1);
        })
    }))
    .filter((g) => g.items.length);
}

export { PANTRY_BASICS, NAME_ALIASES };
