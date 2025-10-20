export interface ColorToRemove {
  id: string;
  color: string;
  rgb: { r: number; g: number; b: number };
}

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

export const getColorAtPixel = (
  imageData: ImageData,
  x: number,
  y: number
): { r: number; g: number; b: number } => {
  const index = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
  };
};

export const colorDistance = (
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number => {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
};

export const removeColorFromImage = (
  image: HTMLImageElement,
  colorsToRemove: ColorToRemove[],
  tolerance: number
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const pixelColor = {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    };

    for (const colorToRemove of colorsToRemove) {
      const distance = colorDistance(pixelColor, colorToRemove.rgb);
      
      if (distance <= tolerance) {
        data[i + 3] = 0; // Make transparent
        break;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/png',
      1.0
    );
  });
};
