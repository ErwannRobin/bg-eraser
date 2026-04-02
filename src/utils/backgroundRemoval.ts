import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';

// Configure transformers.js for optimal browser performance
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Optimize for web workers

const MAX_MODEL_DIMENSION = 1024;

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

export const removeBackground = async (
  imageElement: HTMLImageElement,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  try {
    console.log('Starting WebGPU-accelerated background removal...');
    
    if (onProgress) onProgress(5);
    
    // Create a small canvas for the model (max 1024px)
    const modelCanvas = createModelCanvas(imageElement);
    console.log(`Model input: ${modelCanvas.width}x${modelCanvas.height}, Original: ${imageElement.naturalWidth}x${imageElement.naturalHeight}`);
    
    if (onProgress) onProgress(15);
    
    // Initialize RMBG model with WebGPU (falls back to WASM automatically)
    console.log('Loading BRIA RMBG-1.4 model with WebGPU acceleration...');
    const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
      device: 'webgpu',
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
      } as any
    });
    
    if (onProgress) onProgress(40);
    
    // Run model on small canvas
    const image = await RawImage.fromURL(modelCanvas.toDataURL('image/png'));
    
    if (onProgress) onProgress(50);
    
    console.log('Running segmentation inference...');
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    
    if (onProgress) onProgress(75);
    
    console.log('Segmentation complete, applying mask to full-resolution image...');
    
    if (!output) {
      throw new Error('Invalid segmentation result');
    }
    
    // Create output canvas at FULL original resolution
    const fullWidth = imageElement.naturalWidth;
    const fullHeight = imageElement.naturalHeight;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = fullWidth;
    outputCanvas.height = fullHeight;
    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    // Draw original full-resolution image
    outputCtx.drawImage(imageElement, 0, 0);
    
    if (onProgress) onProgress(85);
    
    // Get full-res image data
    const outputImageData = outputCtx.getImageData(0, 0, fullWidth, fullHeight);
    
    // Resize mask to full resolution
    const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(fullWidth, fullHeight);
    
    // Convert mask to Float32Array for alpha matting
    const maskFloat = new Float32Array(mask.data.length);
    for (let i = 0; i < mask.data.length; i++) {
      maskFloat[i] = mask.data[i] / 255;
    }
    
    // Apply alpha matting with edge feathering
    applyAlphaMatting(outputImageData, maskFloat, 3);
    
    outputCtx.putImageData(outputImageData, 0, 0);
    console.log('Alpha matting applied at full resolution');
    
    if (onProgress) onProgress(95);
    
    // Convert to high-quality PNG blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('Background removal complete at full resolution');
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

