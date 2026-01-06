export const isHeicFile = (file: File): boolean => {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
};

export const convertHeicToJpeg = async (file: File): Promise<File> => {
  // Dynamic import for browser version
  const convert = (await import('heic-convert/browser')).default;
  
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const outputBuffer = await convert({
    buffer: uint8Array,
    format: 'JPEG',
    quality: 0.9,
  });

  const blob = new Blob([new Uint8Array(outputBuffer)], { type: 'image/jpeg' });
  const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newFileName, { type: 'image/jpeg' });
};
