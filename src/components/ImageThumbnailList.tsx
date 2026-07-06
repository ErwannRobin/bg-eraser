import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcessedImageItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  processedUrl: string | null;
  processedBlob: Blob | null;
  upscaledOriginalUrl: string | null;
  upscaledOriginalBlob: Blob | null;
  status: 'pending' | 'processing' | 'done' | 'error';
}

interface ImageThumbnailListProps {
  images: ProcessedImageItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const ImageThumbnailList = ({ images, selectedId, onSelect }: ImageThumbnailListProps) => {
  return (
    <div className="flex flex-col gap-2 p-2 overflow-y-auto h-full">
      {images.map((image) => (
        <button
          key={image.id}
          onClick={() => onSelect(image.id)}
          className={cn(
            "relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-all",
            selectedId === image.id
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/50"
          )}
        >
          <img
            src={image.processedUrl || image.originalUrl}
            alt="Thumbnail"
            className={cn(
              "w-full h-full object-cover",
              image.status === 'processing' && "opacity-50"
            )}
          />
          
          {/* Status overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            {image.status === 'pending' && (
              <div className="w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              </div>
            )}
            {image.status === 'processing' && (
              <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              </div>
            )}
            {image.status === 'done' && (
              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            {image.status === 'error' && (
              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                <AlertCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
