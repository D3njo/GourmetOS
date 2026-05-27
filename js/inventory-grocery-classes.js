/** GourmetOS V2 grocery detector target classes (30 core + mapping helpers). */

export const GROCERY_V2_CLASSES = [
  'milk', 'eggs', 'yogurt', 'cheese', 'butter', 'cream',
  'chicken', 'beef', 'pork', 'fish', 'salmon', 'tofu',
  'beans', 'chickpeas', 'lentils', 'rice', 'pasta', 'bread', 'juice',
  'tomatoes', 'lettuce', 'spinach', 'cucumber', 'carrots', 'onions', 'garlic',
  'peppers', 'mushrooms', 'broccoli',
  'apples', 'bananas', 'lemons', 'berries'
];

export const GROCERY_DETECTOR_CONFIG = {
  modelBasePath: './assets/models/gourmetos-grocery-detector/',
  modelFile: 'model.onnx',
  labelsFile: 'labels.json',
  metadataFile: 'metadata.json',
  onnxRuntimeCdn: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js',
  inputSize: 640,
  confThreshold: 0.35,
  iouThreshold: 0.45,
  maxDetections: 24,
  /** Prefer vendored ONNX; no remote model bootstrap for V2 primary detector. */
  requireLocalModel: false
};
