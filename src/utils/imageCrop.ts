/**
 * Crops an image to its non-transparent content bounds
 */
export const cropToContent = async (imageUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw image to get pixel data
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      // Find bounding box of non-transparent pixels
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      // Add small padding
      const padding = 2;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width - 1, maxX + padding);
      maxY = Math.min(canvas.height - 1, maxY + padding);

      const croppedWidth = maxX - minX + 1;
      const croppedHeight = maxY - minY + 1;

      // Create new canvas with cropped dimensions
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = croppedWidth;
      croppedCanvas.height = croppedHeight;
      const croppedCtx = croppedCanvas.getContext('2d');

      if (!croppedCtx) {
        reject(new Error('Could not get cropped canvas context'));
        return;
      }

      // Draw cropped portion
      croppedCtx.drawImage(
        canvas,
        minX, minY, croppedWidth, croppedHeight,
        0, 0, croppedWidth, croppedHeight
      );

      croppedCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create cropped blob'));
          }
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};
