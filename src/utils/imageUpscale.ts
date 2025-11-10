/**
 * Upscale an image by 2x using high-quality canvas interpolation
 */
export const upscaleImage = async (
  imageUrl: string,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; url: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        onProgress?.(25);
        
        // Create canvas with 2x dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { 
          alpha: true,
          willReadFrequently: false 
        });
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        onProgress?.(50);
        
        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw upscaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        onProgress?.(75);
        
        // Apply sharpening filter for better detail
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const sharpened = applySharpen(imageData);
        ctx.putImageData(sharpened, 0, 0);
        
        onProgress?.(90);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              onProgress?.(100);
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

/**
 * Apply a sharpening filter to enhance details
 */
const applySharpen = (imageData: ImageData): ImageData => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new ImageData(width, height);
  
  // Sharpening kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += data[idx] * kernel[kernelIdx];
          }
        }
        const outputIdx = (y * width + x) * 4 + c;
        output.data[outputIdx] = Math.max(0, Math.min(255, sum));
      }
      // Copy alpha channel
      const alphaIdx = (y * width + x) * 4 + 3;
      output.data[alphaIdx] = data[alphaIdx];
    }
  }
  
  return output;
};
