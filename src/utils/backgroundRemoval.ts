import { pipeline, env, RawImage } from '@huggingface/transformers';

// Configure transformers.js for optimal browser performance
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1; // Optimize for web workers

const MAX_IMAGE_DIMENSION = 1024;

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
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
    
    // Convert HTMLImageElement to canvas for preprocessing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Resize image if needed
    const wasResized = resizeImageIfNeeded(canvas, ctx, imageElement);
    console.log(`Image preprocessed. Dimensions: ${canvas.width}x${canvas.height}`);
    
    if (onProgress) onProgress(15);
    
    // Initialize segmentation pipeline with WebGPU (falls back to WASM automatically)
    console.log('Loading segmentation model with WebGPU acceleration...');
    const segmenter = await pipeline(
      'image-segmentation',
      'Xenova/segformer-b2-clothes',
      { 
        device: 'webgpu',
        dtype: 'fp16', // Use half-precision for faster inference
      }
    );
    
    if (onProgress) onProgress(40);
    
    // Convert canvas to format expected by the model
    const imageData = canvas.toDataURL('image/png');
    
    if (onProgress) onProgress(50);
    
    // Run inference
    console.log('Running segmentation inference...');
    const result = await segmenter(imageData, {
      threshold: 0.5,
      mask_threshold: 0.5,
    });
    
    if (onProgress) onProgress(75);
    
    console.log('Segmentation complete, applying alpha matting...');
    
    if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
      throw new Error('Invalid segmentation result');
    }
    
    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    // Draw original image
    outputCtx.drawImage(canvas, 0, 0);
    
    if (onProgress) onProgress(85);
    
    // Get image data for alpha channel manipulation
    const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    
    // Apply mask with alpha matting and feathering
    const maskData = result[0].mask.data;
    const invertedMask = new Float32Array(maskData.length);
    
    // Invert mask (keep subject, remove background)
    for (let i = 0; i < maskData.length; i++) {
      invertedMask[i] = 1 - maskData[i];
    }
    
    // Apply alpha matting with edge feathering
    applyAlphaMatting(outputImageData, invertedMask, 3);
    
    outputCtx.putImageData(outputImageData, 0, 0);
    console.log('Alpha matting applied with feathered edges');
    
    if (onProgress) onProgress(95);
    
    // Convert to high-quality PNG blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('Background removal complete');
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

