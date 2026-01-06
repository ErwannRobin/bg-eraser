import { useCallback, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import heic2any from 'heic2any';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  isProcessing: boolean;
}

export const ImageUpload = ({ onImageSelect, isProcessing }: ImageUploadProps) => {
  const { toast } = useToast();
  const [isConverting, setIsConverting] = useState(false);

  const isHeicFile = (file: File): boolean => {
    return (
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')
    );
  };

  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
      setIsConverting(true);
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      });
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      return new File([blob], newFileName, { type: 'image/jpeg' });
    } finally {
      setIsConverting(false);
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      try {
        if (isHeicFile(file)) {
          toast({
            title: 'Converting HEIC...',
            description: 'Please wait while we convert your image',
          });
          const convertedFile = await convertHeicToJpeg(file);
          onImageSelect(convertedFile);
        } else if (file.type.startsWith('image/')) {
          onImageSelect(file);
        } else {
          toast({
            title: 'Invalid file',
            description: 'Please upload an image file',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: 'Conversion failed',
          description: 'Failed to convert HEIC image. Please try a different format.',
          variant: 'destructive',
        });
        setIsConverting(false);
      }
    },
    [onImageSelect, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isProcessing || isConverting) return;

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find(
        (file) => file.type.startsWith('image/') || isHeicFile(file)
      );

      if (imageFile) {
        processFile(imageFile);
      } else {
        toast({
          title: 'Invalid file',
          description: 'Please upload an image file',
          variant: 'destructive',
        });
      }
    },
    [processFile, isProcessing, isConverting, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const isDisabled = isProcessing || isConverting;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="relative border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer bg-card group"
    >
      <input
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFileInput}
        disabled={isDisabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
          {isConverting ? (
            <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-primary-foreground" />
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground mb-1">
            {isConverting ? 'Converting HEIC...' : 'Drop your image here'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse, or paste (Ctrl+V) • PNG, JPG, WEBP, HEIC
          </p>
        </div>
      </div>
    </div>
  );
};
