/** Parse and serialize recipe fields for the customization editor */

export function ingredientsToText(ingredients) {
  return (ingredients || [])
    .map((i) => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join('\n');
}

export function stepsToText(steps) {
  return (steps || []).map((s) => s.text).join('\n');
}

export function textToIngredients(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([\d.,]+)\s+(\S+)\s+(.+)$/);
      if (match) {
        return {
          amount: parseFloat(match[1].replace(',', '.')) || 1,
          unit: match[2],
          name: match[3],
          category: 'produce'
        };
      }
      return { amount: 1, unit: 'pcs', name: line, category: 'produce' };
    });
}

export function textToSteps(text, existingSteps = []) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => ({
      text: line,
      time_minutes: existingSteps[i]?.time_minutes ?? 10,
      temp_celsius: existingSteps[i]?.temp_celsius,
      video: null
    }));
}

export function overrideFromForm(baseRecipe, form) {
  return {
    name: form.name.trim() || baseRecipe.name,
    description: form.description.trim() || baseRecipe.description,
    technique: baseRecipe.technique,
    flavor_profile: baseRecipe.flavor_profile,
    base_portions: baseRecipe.base_portions,
    ingredients: textToIngredients(form.ingredientsText),
    steps: textToSteps(form.stepsText, baseRecipe.steps)
  };
}
