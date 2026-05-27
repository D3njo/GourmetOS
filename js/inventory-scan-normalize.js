import { normalizeIngredientName } from './ingredient-normalize.js';

const MIN_CONFIDENCE = 0.45;

const SCAN_INGREDIENTS = [
  ['eggs', ['egg', 'eggs', 'egg carton', 'free range eggs']],
  ['milk', ['milk', 'whole milk', 'semi skimmed milk', 'skimmed milk', 'oat milk', 'almond milk']],
  ['yogurt', ['yogurt', 'yoghurt', 'greek yogurt', 'plain yogurt', 'skyr']],
  ['cheese', ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'goat cheese']],
  ['butter', ['butter', 'unsalted butter', 'salted butter']],
  ['cream', ['cream', 'double cream', 'single cream', 'sour cream', 'creme fraiche']],
  ['chicken', ['chicken', 'chicken breast', 'chicken thighs']],
  ['beef', ['beef', 'steak', 'minced beef', 'ground beef']],
  ['pork', ['pork', 'bacon', 'ham', 'sausage']],
  ['salmon', ['salmon', 'smoked salmon']],
  ['fish', ['fish', 'cod', 'haddock', 'tuna']],
  ['tofu', ['tofu', 'firm tofu', 'silken tofu']],
  ['beans', ['beans', 'black beans', 'kidney beans', 'white beans']],
  ['chickpeas', ['chickpeas', 'garbanzo beans']],
  ['lentils', ['lentils', 'red lentils', 'green lentils']],
  ['rice', ['rice', 'basmati rice', 'jasmine rice', 'brown rice']],
  ['pasta', ['pasta', 'spaghetti', 'penne', 'fusilli', 'linguine']],
  ['bread', ['bread', 'sourdough', 'toast', 'bagel']],
  ['potatoes', ['potato', 'potatoes', 'new potatoes', 'sweet potatoes']],
  ['tomatoes', ['tomato', 'tomatoes', 'cherry tomatoes', 'passata']],
  ['lettuce', ['lettuce', 'romaine', 'little gem']],
  ['spinach', ['spinach', 'baby spinach']],
  ['kale', ['kale']],
  ['cucumber', ['cucumber']],
  ['carrots', ['carrot', 'carrots']],
  ['onions', ['onion', 'onions', 'red onion', 'yellow onion']],
  ['garlic', ['garlic', 'garlic cloves']],
  ['peppers', ['pepper', 'peppers', 'bell pepper', 'red pepper']],
  ['mushrooms', ['mushroom', 'mushrooms']],
  ['broccoli', ['broccoli']],
  ['avocado', ['avocado', 'avocados']],
  ['apples', ['apple', 'apples']],
  ['bananas', ['banana', 'bananas']],
  ['lemons', ['lemon', 'lemons']],
  ['limes', ['lime', 'limes']],
  ['oranges', ['orange', 'oranges']],
  ['berries', ['berries', 'strawberries', 'blueberries', 'raspberries']],
  ['herbs', ['parsley', 'basil', 'mint', 'cilantro', 'coriander', 'dill']],
  ['stock', ['stock', 'chicken stock', 'vegetable stock', 'stock cubes']],
  ['mayonnaise', ['mayonnaise', 'mayo']],
  ['mustard', ['mustard', 'dijon mustard']],
  ['soy sauce', ['soy sauce']],
  ['hot sauce', ['hot sauce', 'sriracha']],
  ['juice', ['juice', 'orange juice', 'apple juice']]
].map(([name, aliases]) => ({
  name,
  normalizedName: normalizeIngredientName(name),
  aliases: aliases.map((alias) => normalizeIngredientName(alias))
}));

function normalizeScanText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function tokenize(text) {
  return normalizeScanText(text)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function wordConfidence(words, aliasTokens) {
  if (!Array.isArray(words) || !words.length || !aliasTokens.length) return null;

  const hits = words
    .map((word) => ({
      text: normalizeScanText(word.text),
      confidence: Number.isFinite(word.confidence) ? word.confidence / 100 : null
    }))
    .filter((word) => word.text && word.confidence != null)
    .filter((word) => aliasTokens.some((token) => word.text === token || word.text.includes(token)));

  if (!hits.length) return null;
  return hits.reduce((sum, word) => sum + word.confidence, 0) / hits.length;
}

function scoreIngredient(normalizedText, textTokens, words, ingredient) {
  let bestScore = 0;
  let raw = '';

  for (const alias of ingredient.aliases) {
    const aliasTokens = alias.split(/\s+/).filter(Boolean);
    let score = 0;

    if (normalizedText.includes(alias)) {
      score = alias === ingredient.normalizedName ? 0.92 : 0.84;
    } else {
      const matchedTokens = aliasTokens.filter((token) => textTokens.includes(token));
      if (matchedTokens.length) {
        score = Math.min(0.72, 0.38 + matchedTokens.length / Math.max(aliasTokens.length, 2) * 0.28);
      }
    }

    const ocrConfidence = wordConfidence(words, aliasTokens);
    if (ocrConfidence != null && score > 0) {
      score = Math.min(0.96, score * 0.75 + ocrConfidence * 0.25);
    }

    if (score > bestScore) {
      bestScore = score;
      raw = alias;
    }
  }

  return bestScore >= MIN_CONFIDENCE
    ? {
        name: ingredient.name,
        normalizedName: ingredient.normalizedName,
        confidence: Number(bestScore.toFixed(2)),
        raw
      }
    : null;
}

export function extractInventoryScanCandidates(input = {}) {
  const normalizedText = normalizeScanText(input.text || '');
  if (!normalizedText) return [];

  const textTokens = tokenize(normalizedText);
  return SCAN_INGREDIENTS.map((ingredient) =>
    scoreIngredient(normalizedText, textTokens, input.words, ingredient)
  )
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export function shouldAutoSelectScanCandidate(candidate) {
  return (candidate?.confidence || 0) >= 0.55;
}

export { SCAN_INGREDIENTS };
