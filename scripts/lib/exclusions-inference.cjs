/** CJS mirror of js/exclusions.js preset inference for build scripts */

const PRESET_PATTERNS = {
  fish: /\b(fish|fisch|salmon|lachs|tuna|thunfisch|cod|kabeljau|trout|forelle|anchov|sardine|mackerel|hering|eel|aal|halibut|seezunge)\b/i,
  shellfish: /\b(shellfish|prawn|shrimp|garnelen|garnele|crab|krabbe|lobster|hummer|mussel|muschel|clam|squid|calamari|oyster|austern|scallop|jakobsmuschel)\b/i,
  beef: /\b(beef|rind|rindfleisch|steak|fillet|mince|brisket|veal|kalb|burger patty)\b/i,
  pork: /\b(pork|schwein|schweinefleisch|bacon|speck|ham|schinken|sausage|wurst|chorizo|pancetta|prosciutto)\b/i,
  duck: /\b(duck|ente|duck breast|entenbrust)\b/i,
  dairy: /\b(milk|milch|cream|sahne|cheese|käse|butter|yogurt|joghurt|parmesan|mozzarella|cheddar|feta|ricotta|mascarpone)\b/i,
  eggs: /\b(eggs?|ei\b|eier|egg white|egg yolk|mayonnaise|mayo)\b/i,
  gluten: /\b(gluten|wheat|weizen|pasta|noodle|nudeln|bread|brot|flour|mehl|pastry|couscous|bulgur|semolina|spaghetti|penne|udon|ramen)\b/i,
  coriander: /\b(coriander|cilantro|koriander)\b/i
};

function mealIngredientNames(meal) {
  const names = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    if (name?.trim()) names.push(name.trim());
  }
  return names;
}

function inferFromMeal(meal, existing = []) {
  const text = [
    meal.strMeal,
    meal.strTags,
    meal.strCategory,
    ...mealIngredientNames(meal)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const tags = new Set(existing);
  for (const [tag, pattern] of Object.entries(PRESET_PATTERNS)) {
    if (pattern.test(text)) tags.add(tag);
  }
  return [...tags];
}

function sanitizeExclusionText(text) {
  return (text || '')
    .replace(/sear\s*&\s*butter/gi, ' ')
    .replace(/baste with butter/gi, ' ')
    .replace(/via\s+[\w\s&]+\s+effort/gi, ' ');
}

function inferFromEntry(entry) {
  const desc = entry.description || entry.description_en;
  const useDesc = desc && !/flavors via|suited to .* effort/i.test(desc) ? desc : null;
  const text = [entry.name, entry.name_en, entry.name_de, useDesc]
    .filter(Boolean)
    .map((s) => sanitizeExclusionText(s.toLowerCase()))
    .join(' ');

  const tags = new Set(entry.exclude_tags || []);
  for (const [tag, pattern] of Object.entries(PRESET_PATTERNS)) {
    if (pattern.test(text)) tags.add(tag);
  }
  return [...tags];
}

module.exports = { inferFromMeal, inferFromEntry, PRESET_PATTERNS };
