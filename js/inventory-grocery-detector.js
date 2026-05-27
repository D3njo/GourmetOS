import { GROCERY_DETECTOR_CONFIG } from './inventory-grocery-classes.js';
import { normalizeIngredientName } from './ingredient-normalize.js';
import {
  decodeYoloTensor,
  detectionsToCandidates,
  letterboxDimensions
} from './inventory-yolo-postprocess.js';

let ortPromise = null;
let sessionPromise = null;
let labelMetaPromise = null;

function requireBrowser() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Grocery detector runs in the browser only.');
  }
}

function modelUrl(file) {
  return `${GROCERY_DETECTOR_CONFIG.modelBasePath}${file}`;
}

function loadOnnxRuntime() {
  requireBrowser();
  if (window.ort) return Promise.resolve(window.ort);
  if (ortPromise) return ortPromise;

  ortPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GROCERY_DETECTOR_CONFIG.onnxRuntimeCdn;
    script.async = true;
    script.onload = () => {
      if (window.ort) {
        window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
        resolve(window.ort);
      } else reject(new Error('ONNX Runtime loaded without ort global.'));
    };
    script.onerror = () => reject(new Error('Could not load ONNX Runtime.'));
    document.head.appendChild(script);
  });

  return ortPromise;
}

async function loadLabelMeta() {
  if (labelMetaPromise) return labelMetaPromise;
  labelMetaPromise = fetch(modelUrl(GROCERY_DETECTOR_CONFIG.labelsFile))
    .then((res) => {
      if (!res.ok) throw new Error(`labels.json HTTP ${res.status}`);
      return res.json();
    })
    .catch((err) => {
      labelMetaPromise = null;
      throw err;
    });
  return labelMetaPromise;
}

async function loadSession() {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const head = await fetch(modelUrl(GROCERY_DETECTOR_CONFIG.modelFile), { method: 'HEAD' });
    if (!head.ok) {
      throw new Error('Grocery detector model.onnx not found. Run ml/grocery_vision/download_model.py');
    }

    const ort = await loadOnnxRuntime();
    const response = await fetch(modelUrl(GROCERY_DETECTOR_CONFIG.modelFile));
    if (!response.ok) throw new Error(`model.onnx HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    return ort.InferenceSession.create(buffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
  })().catch((err) => {
    sessionPromise = null;
    throw err;
  });

  return sessionPromise;
}

async function imageFromFile(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image.'));
    };
    img.src = url;
  });
}

function preprocessImage(image, targetSize) {
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const letterbox = letterboxDimensions(width, height, targetSize);

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#114';
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(image, letterbox.padX, letterbox.padY, letterbox.newW, letterbox.newH);

  const { data } = ctx.getImageData(0, 0, targetSize, targetSize);
  const tensor = new Float32Array(3 * targetSize * targetSize);
  let offset = 0;
  for (let c = 0; c < 3; c += 1) {
    for (let i = c; i < data.length; i += 4) {
      tensor[offset] = data[i] / 255;
      offset += 1;
    }
  }

  return { tensor, letterbox, width, height };
}

export async function isGroceryDetectorAvailable() {
  try {
    const res = await fetch(modelUrl(GROCERY_DETECTOR_CONFIG.modelFile), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function detectGroceryIngredients(file, options = {}) {
  const { onProgress = () => {} } = options;
  requireBrowser();

  onProgress({ phase: 'loading-grocery-model', provider: 'localGrocery' });

  const [session, labelMeta] = await Promise.all([loadSession(), loadLabelMeta()]);
  const numClasses =
    labelMeta.numClasses ||
    labelMeta.modelClassNames?.length ||
    labelMeta.classes?.length ||
    33;

  onProgress({ phase: 'grocery-detection', provider: 'localGrocery' });

  const image = await imageFromFile(file);
  const inputSize = labelMeta.inputSize || GROCERY_DETECTOR_CONFIG.inputSize;
  const { tensor, letterbox, width, height } = preprocessImage(image, inputSize);
  if ('close' in image) image.close();

  const inputName = session.inputNames[0];
  const inputTensor = new window.ort.Tensor('float32', tensor, [1, 3, inputSize, inputSize]);
  const outputs = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const output = outputs[outputName];

  const detections = decodeYoloTensor(output, {
    numClasses,
    confThreshold: GROCERY_DETECTOR_CONFIG.confThreshold,
    iouThreshold: GROCERY_DETECTOR_CONFIG.iouThreshold,
    maxDetections: GROCERY_DETECTOR_CONFIG.maxDetections,
    inputSize
  });

  const rawCandidates = detectionsToCandidates(detections, labelMeta, {
    letterbox,
    imageWidth: width,
    imageHeight: height
  });

  return rawCandidates.map((item) => ({
    ...item,
    normalizedName: normalizeIngredientName(item.name)
  }));
}

export function groceryDetectorConfig() {
  return { ...GROCERY_DETECTOR_CONFIG };
}
