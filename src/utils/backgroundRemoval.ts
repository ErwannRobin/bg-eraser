import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { guidedFilter } from './guidedFilter';
import { debugLog, forcedDevice, logWebGpuInfo } from './debugLog';

// Configure transformers.js for optimal browser performance
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Optimize for web workers

const MAX_MODEL_DIMENSION = 1024;

// iOS Safari kills the tab when memory runs out ("A problem repeatedly occurred"). The
// full-resolution steps below hold many pixel-sized buffers, so cap the output size there.
const MAX_OUTPUT_PIXELS_IOS = 4_000_000;

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// Size of the result: the original size, reduced on iOS when the image is too large.
function getOutputSize(image: HTMLImageElement): { width: number; height: number } {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!isIOS() || width * height <= MAX_OUTPUT_PIXELS_IOS) return { width, height };
  const ratio = Math.sqrt(MAX_OUTPUT_PIXELS_IOS / (width * height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

// Load the model once. Loading it on every image leaked GPU/WASM memory.
let modelPromise: Promise<{
  model: Awaited<ReturnType<typeof AutoModel.from_pretrained>>;
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
}> | null = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = loadModel().catch((error) => {
      modelPromise = null; // allow a retry
      throw error;
    });
  }
  return modelPromise;
}

// Guided filter settings used to sharpen the upscaled mask against the original image
const GUIDED_FILTER_EPS = 1e-3;
const FEATHER_RADIUS = 1;

function createModelCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_MODEL_DIMENSION || height > MAX_MODEL_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_MODEL_DIMENSION) / width);
      width = MAX_MODEL_DIMENSION;
    } else {
      width = Math.round((width * MAX_MODEL_DIMENSION) / height);
      height = MAX_MODEL_DIMENSION;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

// Apply alpha matting with feathering for smooth edges
function applyAlphaMatting(
  imageData: ImageData,
  mask: Float32Array,
  featherRadius: number = 2
): void {
  const { data, width, height } = imageData;
  const tempAlpha = new Float32Array(mask.length);
  
  // Copy mask to temp array
  for (let i = 0; i < mask.length; i++) {
    tempAlpha[i] = mask[i];
  }
  
  // Apply Gaussian blur for feathering
  const kernel = [];
  const sigma = featherRadius / 2;
  for (let x = -featherRadius; x <= featherRadius; x++) {
    for (let y = -featherRadius; y <= featherRadius; y++) {
      const weight = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel.push({ x, y, weight });
    }
  }
  
  // Normalize kernel
  const kernelSum = kernel.reduce((sum, k) => sum + k.weight, 0);
  kernel.forEach(k => k.weight /= kernelSum);
  
  // Apply feathering
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let blurred = 0;
      
      for (const k of kernel) {
        const nx = x + k.x;
        const ny = y + k.y;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          blurred += tempAlpha[ny * width + nx] * k.weight;
        }
      }
      
      // Apply to alpha channel
      data[idx * 4 + 3] = Math.round(blurred * 255);
    }
  }
}

async function loadModel() {
  // WebGPU when the browser has it, WASM otherwise
  // WebGPU crashes the tab on iOS Safari (iPhone 16, Safari 27.0.1) while the model runs,
  // so iOS uses WASM. ?device=wasm|webgpu or the debug panel button overrides the choice.
  const device = forcedDevice ?? (!isIOS() && 'gpu' in navigator ? 'webgpu' : 'wasm');
  debugLog('loading model', { device });
  await logWebGpuInfo();
  const t0 = performance.now();
  const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
    device,
    // transformers.js config typings do not cover this custom model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: { model_type: 'custom' } as any,
  });

  const processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      feature_extractor_type: "ImageFeatureExtractor",
      image_std: [1, 1, 1],
      resample: 2,
      rescale_factor: 0.00392156862745098,
      size: { width: 1024, height: 1024 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  });

  debugLog('model and processor loaded', `${Math.round(performance.now() - t0)} ms`);
  return { model, processor };
}

export const removeBackground = async (
  imageElement: HTMLImageElement,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  try {
    debugLog('removeBackground start', {
      image: `${imageElement.naturalWidth}x${imageElement.naturalHeight}`,
      ios: isIOS(),
    });
    if (onProgress) onProgress(5);
    
    // Create a small canvas for the model (max 1024px)
    const modelCanvas = createModelCanvas(imageElement);
    
    debugLog('model canvas', `${modelCanvas.width}x${modelCanvas.height}`);
    if (onProgress) onProgress(15);
    
    const { model, processor } = await getModel();
    
    debugLog('model ready (progress 40)');
    if (onProgress) onProgress(40);
    
    // Run model on small canvas
    const image = await RawImage.fromURL(modelCanvas.toDataURL('image/png'));
    
    debugLog('image for model ready (progress 50)', `${image.width}x${image.height}`);
    if (onProgress) onProgress(50);
    
    debugLog('preprocessing');
    const { pixel_values } = await processor(image);
    debugLog('preprocessing done, running inference', { dims: pixel_values.dims });
    const tInference = performance.now();
    const { output } = await model({ input: pixel_values });
    debugLog('inference done', `${Math.round(performance.now() - tInference)} ms`);
    
    if (onProgress) onProgress(75);
    
    if (!output) {
      throw new Error('Invalid segmentation result');
    }
    
    // Create output canvas at FULL original resolution
    const { width: fullWidth, height: fullHeight } = getOutputSize(imageElement);
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = fullWidth;
    outputCanvas.height = fullHeight;
    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    // Draw original full-resolution image
    outputCtx.drawImage(imageElement, 0, 0, fullWidth, fullHeight);
    
    debugLog('full-resolution image data read', `${fullWidth}x${fullHeight}`);
    if (onProgress) onProgress(85);
    
    // Get full-res image data
    const outputImageData = outputCtx.getImageData(0, 0, fullWidth, fullHeight);
    
    // Resize mask to full resolution
    const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(fullWidth, fullHeight);
    
    debugLog('mask resized to full resolution');
    // Convert mask to Float32Array
    const maskFloat = new Float32Array(mask.data.length);
    for (let i = 0; i < mask.data.length; i++) {
      maskFloat[i] = mask.data[i] / 255;
    }
    
    // The model saw a downscaled copy, so the upscaled mask is blurry. Snap its edges
    // back onto the real edges of the full-resolution image. The radius grows with the
    // upscale factor.
    const scale = Math.max(fullWidth, fullHeight) / MAX_MODEL_DIMENSION;
    debugLog('guided filter start', { scale });
    const refined = guidedFilter(
      outputImageData.data,
      maskFloat,
      fullWidth,
      fullHeight,
      Math.max(2, Math.round(scale * 2)),
      GUIDED_FILTER_EPS
    );
    
    debugLog('guided filter done');
    // Apply alpha matting with a light edge feathering
    applyAlphaMatting(outputImageData, refined, FEATHER_RADIUS);
    
    outputCtx.putImageData(outputImageData, 0, 0);
    
    debugLog('alpha applied, encoding PNG (progress 95)');
    if (onProgress) onProgress(95);
    
    // Convert to high-quality PNG blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            debugLog('done', `${blob.size} bytes`);
            if (onProgress) onProgress(100);
            resolve(blob);
          } else {
            reject(new Error('Failed to create output blob'));
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    debugLog('removeBackground FAILED', error);
    console.error('Background removal error:', error);
    throw error;
  }
};

export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

