/** Shared recipe metadata helpers (no circular imports). */

const PROTEIN_HINTS = [
  ['chicken', 'chicken'],
  ['turkey', 'poultry'],
  ['duck', 'poultry'],
  ['beef', 'beef'],
  ['lamb', 'lamb'],
  ['pork', 'pork'],
  ['bacon', 'pork'],
  ['chorizo', 'pork'],
  ['salmon', 'fish'],
  ['tuna', 'fish'],
  ['cod', 'fish'],
  ['haddock', 'fish'],
  ['hake', 'fish'],
  ['bass', 'fish'],
  ['monkfish', 'fish'],
  ['saltfish', 'fish'],
  ['sardine', 'fish'],
  ['anchovy', 'fish'],
  ['anchovies', 'fish'],
  ['mackerel', 'fish'],
  ['trout', 'fish'],
  ['prawn', 'seafood'],
  ['shrimp', 'seafood'],
  ['lobster', 'seafood'],
  ['crab', 'seafood'],
  ['tofu', 'tofu'],
  ['lentil', 'legume'],
  ['chickpea', 'legume'],
  ['egg', 'egg']
];

export function inferProtein(recipe) {
  if (!recipe) return 'other';
  const text = `${recipe.name} ${(recipe.ingredients || []).map((i) => i.name).join(' ')}`.toLowerCase();
  for (const [hint, protein] of PROTEIN_HINTS) {
    if (text.includes(hint)) return protein;
  }
  return recipe.cuisine?.toLowerCase() || 'other';
}
