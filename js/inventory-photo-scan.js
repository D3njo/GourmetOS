import { extractInventoryScanCandidates } from './inventory-scan-normalize.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const MAX_SCAN_DIMENSION = 1600;

let tesseractLoadPromise = null;

function requireBrowser() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Photo scanning is only available in the browser.');
  }
}

function loadTesseract() {
  requireBrowser();
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoadPromise) return tesseractLoadPromise;

  tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_URL;
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('Scanner library loaded without Tesseract global.'));
    };
    script.onerror = () => reject(new Error('Could not load the scanner library.'));
    document.head.appendChild(script);
  });

  return tesseractLoadPromise;
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

async function prepareImageForOcr(file) {
  requireBrowser();
  const image = await imageFromFile(file);
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  if ('close' in image) image.close();

  return canvas;
}

function progressPercent(message) {
  if (!message || !Number.isFinite(message.progress)) return null;
  return Math.max(0, Math.min(100, Math.round(message.progress * 100)));
}

export async function scanHomeInventoryPhoto(file, options = {}) {
  if (!file) throw new Error('No image selected.');
  const { onProgress = () => {} } = options;

  onProgress({ phase: 'loading', percent: 0 });
  const [Tesseract, image] = await Promise.all([loadTesseract(), prepareImageForOcr(file)]);

  onProgress({ phase: 'scanning', percent: 0 });
  const result = await Tesseract.recognize(image, 'eng', {
    logger(message) {
      const percent = progressPercent(message);
      if (message?.status || percent != null) {
        onProgress({ phase: 'scanning', status: message.status, percent });
      }
    }
  });

  const text = result?.data?.text || '';
  const words = result?.data?.words || [];
  const candidates = extractInventoryScanCandidates({ text, words }).map((candidate) => ({
    ...candidate,
    source: 'photo',
    provider: 'tesseract'
  }));

  return {
    provider: 'tesseract',
    text,
    candidates,
    createdAt: Date.now()
  };
}
