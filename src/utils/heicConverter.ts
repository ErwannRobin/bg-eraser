import decode from 'heic-decode';

export const isHeicFile = (file: File): boolean => {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
};

export const convertHeicToJpeg = async (file: File): Promise<File> => {
  const arrayBuffer = await file.arrayBuffer();
  const { width, height, data } = await decode({ buffer: arrayBuffer });

  // Create canvas and draw the decoded image data
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  // Create ImageData from the decoded RGBA data
  const imageData = new ImageData(new Uint8ClampedArray(data), width, height);
  ctx.putImageData(imageData, 0, 0);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create blob'));
      },
      'image/jpeg',
      0.9
    );
  });

  const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newFileName, { type: 'image/jpeg' });
};
