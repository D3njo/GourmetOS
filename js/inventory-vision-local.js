import {
  OBJECT_LABEL_TO_INGREDIENT,
  PROMPT_TO_INGREDIENT,
  VISION_INGREDIENT_LABELS,
  VISION_MODEL_CONFIG
} from './inventory-vision-labels.js';
import { isGroceryDetectorAvailable } from './inventory-grocery-detector.js';
import { normalizeIngredientName } from './ingredient-normalize.js';

let transformersPromise = null;
let objectDetectorPromise = null;
let clipClassifierPromise = null;

function requireBrowser() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Local vision scanning is only available in the browser.');
  }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image for local vision scan.'));
    reader.readAsDataURL(file);
  });
}

async function loadTransformers() {
  requireBrowser();
  if (transformersPromise) return transformersPromise;

  transformersPromise = import(VISION_MODEL_CONFIG.transformersCdn).then(async (mod) => {
    if (mod.env) {
      let allowRemote = VISION_MODEL_CONFIG.allowRemoteModelBootstrap;
      try {
        const groceryReady = await isGroceryDetectorAvailable();
        if (groceryReady) allowRemote = false;
      } catch {
        /* keep configured default */
      }
      mod.env.localModelPath = VISION_MODEL_CONFIG.localModelPath;
      mod.env.allowLocalModels = true;
      mod.env.allowRemoteModels = allowRemote;
      mod.env.useBrowserCache = true;
    }
    return mod;
  });

  return transformersPromise;
}

async function objectDetector() {
  if (!objectDetectorPromise) {
    objectDetectorPromise = loadTransformers().then(({ pipeline }) =>
      pipeline('object-detection', VISION_MODEL_CONFIG.objectModel)
    );
  }
  return objectDetectorPromise;
}

async function clipClassifier() {
  if (!clipClassifierPromise) {
    clipClassifierPromise = loadTransformers().then(({ pipeline }) =>
      pipeline('zero-shot-image-classification', VISION_MODEL_CONFIG.clipModel)
    );
  }
  return clipClassifierPromise;
}

function objectLabelToCandidate(label) {
  const mapped = OBJECT_LABEL_TO_INGREDIENT[String(label || '').toLowerCase()];
  if (!mapped) return null;
  return {
    name: mapped,
    normalizedName: normalizeIngredientName(mapped)
  };
}

function fromObjectDetections(detections) {
  return (detections || [])
    .map((item) => {
      const candidate = objectLabelToCandidate(item.label);
      if (!candidate) return null;
      return {
        ...candidate,
        confidence: Math.max(0, Math.min(1, item.score || 0)),
        provider: 'localObject',
        raw: item.label,
        bbox: item.box || null
      };
    })
    .filter(Boolean);
}

function clipScoreToConfidence(score, rank) {
  const raw = Math.max(0, Math.min(1, Number(score) || 0));
  const rankPenalty = Math.max(0, 1 - rank * 0.035);
  // CLIP scores are distributed across many labels, so calibrate them into review confidence.
  return Math.max(0, Math.min(0.9, (0.38 + raw * 4.2) * rankPenalty));
}

function fromClipResults(results) {
  return (results || [])
    .slice(0, VISION_MODEL_CONFIG.clipTopK)
    .map((item, index) => {
      const mapped = PROMPT_TO_INGREDIENT.get(item.label);
      if (!mapped) return null;
      return {
        ...mapped,
        confidence: Number(clipScoreToConfidence(item.score, index).toFixed(2)),
        provider: 'localClip',
        raw: item.label
      };
    })
    .filter(Boolean);
}

export async function detectLocalVisionIngredients(file, options = {}) {
  const { onProgress = () => {} } = options;
  const image = await fileToDataUrl(file);
  const promptLabels = VISION_INGREDIENT_LABELS.flatMap((item) => item.prompts);
  const candidates = [];

  onProgress({ phase: 'loading-model', provider: 'localObject' });
  try {
    const detector = await objectDetector();
    onProgress({ phase: 'local-object-detection', provider: 'localObject' });
    const detections = await detector(image, {
      threshold: VISION_MODEL_CONFIG.objectThreshold,
      percentage: false
    });
    candidates.push(...fromObjectDetections(detections));
  } catch (err) {
    console.warn('[inventory-scan] local object detection failed', err);
  }

  onProgress({ phase: 'loading-model', provider: 'localClip' });
  try {
    const classifier = await clipClassifier();
    onProgress({ phase: 'local-zero-shot', provider: 'localClip' });
    const results = await classifier(image, promptLabels);
    candidates.push(...fromClipResults(results));
  } catch (err) {
    console.warn('[inventory-scan] local zero-shot classification failed', err);
  }

  return candidates;
}

export function localVisionModelConfig() {
  return { ...VISION_MODEL_CONFIG };
}
