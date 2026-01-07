import { useCallback, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isHeicFile, convertHeicToJpeg } from '@/utils/heicConverter';

interface ImageUploadProps {
  onImageSelect: (files: File[]) => void;
  isProcessing: boolean;
  multiple?: boolean;
}

export const ImageUpload = ({ onImageSelect, isProcessing, multiple = false }: ImageUploadProps) => {
  const { toast } = useToast();
  const [isConverting, setIsConverting] = useState(false);

  const processFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter(
        (file) => file.type.startsWith('image/') || isHeicFile(file)
      );

      if (imageFiles.length === 0) {
        toast({
          title: 'Invalid files',
          description: 'Please upload image files',
          variant: 'destructive',
        });
        return;
      }

      try {
        setIsConverting(true);
        const processedFiles: File[] = [];

        for (const file of imageFiles) {
          if (isHeicFile(file)) {
            toast({
              title: 'Converting HEIC...',
              description: `Converting ${file.name}`,
            });
            const convertedFile = await convertHeicToJpeg(file);
            processedFiles.push(convertedFile);
          } else {
            processedFiles.push(file);
          }
        }

        setIsConverting(false);
        onImageSelect(processedFiles);
      } catch (error) {
        console.error('Error processing files:', error);
        toast({
          title: 'Conversion failed',
          description: 'Failed to convert some HEIC images.',
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
      const imageFiles = files.filter(
        (file) => file.type.startsWith('image/') || isHeicFile(file)
      );

      if (imageFiles.length > 0) {
        processFiles(multiple ? imageFiles : [imageFiles[0]]);
      } else {
        toast({
          title: 'Invalid file',
          description: 'Please upload an image file',
          variant: 'destructive',
        });
      }
    },
    [processFiles, isProcessing, isConverting, toast, multiple]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
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
        multiple={multiple}
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
            {isConverting ? 'Converting HEIC...' : multiple ? 'Drop your images here' : 'Drop your image here'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse, or paste (Ctrl+V) • PNG, JPG, WEBP, HEIC{multiple ? ' • Multiple files supported' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};
