import { normalizeIngredientName } from './ingredient-normalize.js';
import { GROCERY_V2_CLASSES } from './inventory-grocery-classes.js';

export const VISION_MODEL_CONFIG = {
  transformersCdn: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
  localModelPath: './assets/models/',
  objectModel: 'Xenova/yolos-tiny',
  clipModel: 'Xenova/clip-vit-base-patch32',
  objectThreshold: 0.45,
  clipTopK: 12,
  /** Disabled when grocery ONNX is available; otherwise allows one-time Hub fetch for CLIP/YOLOS. */
  allowRemoteModelBootstrap: true
};

export { GROCERY_V2_CLASSES };

const LABELS = [
  ['milk', ['milk carton', 'bottle of milk', 'dairy milk', 'oat milk']],
  ['eggs', ['eggs', 'egg carton', 'box of eggs']],
  ['yogurt', ['yogurt cup', 'greek yogurt', 'skyr', 'yoghurt']],
  ['cheese', ['cheese block', 'cheddar cheese', 'mozzarella', 'feta cheese']],
  ['butter', ['butter', 'butter packet']],
  ['cream', ['cream carton', 'sour cream', 'creme fraiche']],
  ['chicken', ['raw chicken', 'chicken breast', 'pack of chicken']],
  ['beef', ['raw beef', 'steak', 'minced beef']],
  ['pork', ['pork', 'bacon', 'ham', 'sausage']],
  ['salmon', ['salmon fillet', 'smoked salmon']],
  ['fish', ['fish fillet', 'white fish', 'tuna']],
  ['tofu', ['tofu block', 'firm tofu']],
  ['beans', ['beans', 'can of beans', 'black beans']],
  ['chickpeas', ['chickpeas', 'can of chickpeas']],
  ['lentils', ['lentils', 'red lentils']],
  ['rice', ['bag of rice', 'cooked rice']],
  ['pasta', ['pasta packet', 'spaghetti', 'penne pasta']],
  ['bread', ['bread loaf', 'sliced bread', 'bagel']],
  ['potatoes', ['potatoes', 'sweet potatoes']],
  ['tomatoes', ['tomatoes', 'cherry tomatoes']],
  ['lettuce', ['lettuce head', 'romaine lettuce']],
  ['spinach', ['spinach leaves', 'baby spinach']],
  ['kale', ['kale leaves']],
  ['cucumber', ['cucumber']],
  ['carrots', ['carrots']],
  ['onions', ['onions', 'red onions']],
  ['garlic', ['garlic bulb']],
  ['peppers', ['bell peppers', 'red pepper']],
  ['mushrooms', ['mushrooms']],
  ['broccoli', ['broccoli']],
  ['avocado', ['avocado']],
  ['apples', ['apples']],
  ['bananas', ['bananas']],
  ['lemons', ['lemons']],
  ['limes', ['limes']],
  ['oranges', ['oranges']],
  ['berries', ['berries', 'strawberries', 'blueberries']],
  ['herbs', ['fresh herbs', 'parsley', 'basil']],
  ['juice', ['orange juice', 'juice carton']],
  ['mayonnaise', ['mayonnaise jar']],
  ['mustard', ['mustard jar']],
  ['soy sauce', ['soy sauce bottle']],
  ['hot sauce', ['hot sauce bottle']]
];

export const VISION_INGREDIENT_LABELS = LABELS.map(([name, prompts]) => ({
  name,
  normalizedName: normalizeIngredientName(name),
  prompts: prompts.map((prompt) => `a fridge photo containing ${prompt}`)
}));

export const PROMPT_TO_INGREDIENT = new Map(
  VISION_INGREDIENT_LABELS.flatMap((item) =>
    item.prompts.map((prompt) => [
      prompt,
      {
        name: item.name,
        normalizedName: item.normalizedName
      }
    ])
  )
);

export const OBJECT_LABEL_TO_INGREDIENT = {
  banana: 'bananas',
  apple: 'apples',
  orange: 'oranges',
  broccoli: 'broccoli',
  carrot: 'carrots'
};
