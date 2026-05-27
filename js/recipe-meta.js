/** Shared recipe metadata helpers (no circular imports). */

const PROTEIN_HINTS = [
  ['chicken', 'chicken'],
  ['turkey', 'poultry'],
  ['duck', 'poultry'],
  ['beef', 'beef'],
  ['oxtail', 'beef'],
  ['lamb', 'lamb'],
  ['pork', 'pork'],
  ['bacon', 'pork'],
  ['chorizo', 'pork'],
  ['venison', 'beef'],
  ['rabbit', 'pork'],
  ['meatball', 'beef'],
  ['meatloaf', 'beef'],
  ['salmon', 'fish'],
  ['tuna', 'fish'],
  ['cod', 'fish'],
  ['haddock', 'fish'],
  ['hake', 'fish'],
  ['bass', 'fish'],
  ['barramundi', 'fish'],
  ['monkfish', 'fish'],
  ['saltfish', 'fish'],
  ['sardine', 'fish'],
  ['pilchard', 'fish'],
  ['herring', 'fish'],
  ['anchovy', 'fish'],
  ['anchovies', 'fish'],
  ['mackerel', 'fish'],
  ['trout', 'fish'],
  ['snapper', 'fish'],
  ['swordfish', 'fish'],
  ['seafood', 'fish'],
  ['prawn', 'seafood'],
  ['shrimp', 'seafood'],
  ['gambas', 'seafood'],
  ['calamar', 'seafood'],
  ['lobster', 'seafood'],
  ['crab', 'seafood'],
  ['tofu', 'tofu'],
  ['lentil', 'legume'],
  ['chickpea', 'legume'],
  ['egg', 'egg']
];

export function inferProtein(recipe) {
  if (!recipe) return 'other';
  const text = [
    recipe.name,
    recipe.name_en,
    recipe.name_de,
    recipe.technique,
    recipe.technique_en,
    recipe.technique_de,
    recipe.source?.category,
    ...(recipe.ingredients || []).map((i) => i.name)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\bmeat\b/.test(text) && !/\bno\s+meat\b/.test(text)) return 'meat';

  for (const [hint, protein] of PROTEIN_HINTS) {
    if (text.includes(hint)) return protein;
  }
  return recipe.cuisine?.toLowerCase() || 'other';
}
