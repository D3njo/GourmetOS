/**
 * YOLO-style detection post-processing (YOLOv8/v11/v12 export layout).
 * Pure functions for unit tests in Node and browser inference.
 */

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function letterboxDimensions(width, height, targetSize) {
  const scale = Math.min(targetSize / width, targetSize / height);
  const newW = Math.round(width * scale);
  const newH = Math.round(height * scale);
  const padX = Math.floor((targetSize - newW) / 2);
  const padY = Math.floor((targetSize - newH) / 2);
  return { scale, newW, newH, padX, padY };
}

export function mapBoxToImage(box, letterbox, imageWidth, imageHeight) {
  const { scale, padX, padY } = letterbox;
  const xmin = (box.xmin - padX) / scale;
  const ymin = (box.ymin - padY) / scale;
  const xmax = (box.xmax - padX) / scale;
  const ymax = (box.ymax - padY) / scale;
  return {
    xmin: Math.max(0, Math.min(imageWidth, xmin)),
    ymin: Math.max(0, Math.min(imageHeight, ymin)),
    xmax: Math.max(0, Math.min(imageWidth, xmax)),
    ymax: Math.max(0, Math.min(imageHeight, ymax))
  };
}

function boxIoU(a, b) {
  const x1 = Math.max(a.xmin, b.xmin);
  const y1 = Math.max(a.ymin, b.ymin);
  const x2 = Math.min(a.xmax, b.xmax);
  const y2 = Math.min(a.ymax, b.ymax);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a.xmax - a.xmin) * Math.max(0, a.ymax - a.ymin);
  const areaB = Math.max(0, b.xmax - b.xmin) * Math.max(0, b.ymax - b.ymin);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

export function nonMaxSuppression(boxes, iouThreshold = 0.45, limit = 100) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept = [];

  for (const box of sorted) {
    if (kept.length >= limit) break;
    let overlap = false;
    for (const other of kept) {
      if (other.classIndex === box.classIndex && boxIoU(box, other) > iouThreshold) {
        overlap = true;
        break;
      }
    }
    if (!overlap) kept.push(box);
  }

  return kept;
}

/**
 * Decode [1, 4+numClasses, numPredictions] or [1, numPredictions, 4+numClasses] tensors.
 */
export function decodeYoloTensor(output, options = {}) {
  const {
    numClasses,
    confThreshold = 0.35,
    iouThreshold = 0.45,
    maxDetections = 100,
    inputSize = 640
  } = options;

  let data = output;
  let dims = [];

  if (output && typeof output === 'object' && 'data' in output) {
    data = output.data;
    dims = output.dims || [];
  } else if (Array.isArray(output)) {
    dims = inferDims(output, numClasses);
    data = flattenNested(output);
  }

  if (!data || !data.length) return [];

  const flat = data instanceof Float32Array ? data : Float32Array.from(data);
  const channels = dims.length === 3 ? dims[1] : 4 + numClasses;
  const anchors = dims.length === 3 ? dims[2] : Math.floor(flat.length / Math.max(channels, 1));
  const transposed = dims.length === 3 && channels < anchors;

  const boxes = [];

  for (let i = 0; i < anchors; i += 1) {
    let cx;
    let cy;
    let w;
    let h;
    let bestClass = -1;
    let bestScore = 0;

    if (transposed) {
      cx = flat[i];
      cy = flat[anchors + i];
      w = flat[2 * anchors + i];
      h = flat[3 * anchors + i];
      for (let c = 0; c < numClasses; c += 1) {
        const score = sigmoid(flat[(4 + c) * anchors + i]);
        if (score > bestScore) {
          bestScore = score;
          bestClass = c;
        }
      }
    } else {
      const base = i * channels;
      cx = flat[base];
      cy = flat[base + 1];
      w = flat[base + 2];
      h = flat[base + 3];
      for (let c = 0; c < numClasses; c += 1) {
        const score = sigmoid(flat[base + 4 + c]);
        if (score > bestScore) {
          bestScore = score;
          bestClass = c;
        }
      }
    }

    if (bestScore < confThreshold || bestClass < 0) continue;

    const halfW = (w * inputSize) / 2;
    const halfH = (h * inputSize) / 2;
    const centerX = cx * inputSize;
    const centerY = cy * inputSize;

    boxes.push({
      classIndex: bestClass,
      score: bestScore,
      xmin: centerX - halfW,
      ymin: centerY - halfH,
      xmax: centerX + halfW,
      ymax: centerY + halfH
    });
  }

  return nonMaxSuppression(boxes, iouThreshold, maxDetections);
}

function inferDims(nested, numClasses) {
  if (!Array.isArray(nested) || !nested.length) return [];
  if (Array.isArray(nested[0])) {
    if (Array.isArray(nested[0][0])) return [1, nested[0].length, nested[0][0].length];
    return [1, nested.length, nested[0].length];
  }
  return [1, 4 + numClasses, Math.floor(nested.length / (4 + numClasses))];
}

function flattenNested(arr) {
  if (!Array.isArray(arr)) return arr;
  if (typeof arr[0] === 'number') return arr;
  return arr.flat(Infinity);
}

export function detectionsToCandidates(detections, labelMeta, options = {}) {
  const { letterbox = null, imageWidth = 1, imageHeight = 1 } = options;
  const mapping = labelMeta?.mapping || {};
  const modelClassNames = labelMeta?.modelClassNames || [];
  const byIngredient = new Map();

  for (const det of detections) {
    const modelLabel = modelClassNames[det.classIndex] || String(det.classIndex);
    const ingredient =
      mapping[String(det.classIndex)] ||
      mapping[modelLabel] ||
      mapping[String(modelLabel).toLowerCase()];

    if (!ingredient) continue;

    let bbox = {
      xmin: det.xmin,
      ymin: det.ymin,
      xmax: det.xmax,
      ymax: det.ymax
    };
    if (letterbox) {
      bbox = mapBoxToImage(bbox, letterbox, imageWidth, imageHeight);
    }

    const existing = byIngredient.get(ingredient);
    if (!existing || det.score > existing.confidence) {
      byIngredient.set(ingredient, {
        name: ingredient,
        confidence: Number(det.score.toFixed(2)),
        provider: 'localGrocery',
        raw: modelLabel,
        bbox
      });
    }
  }

  return [...byIngredient.values()];
}
