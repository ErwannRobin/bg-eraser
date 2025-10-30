import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface CropEditorProps {
  imageUrl: string;
  onCropApplied: (blob: Blob, url: string) => void;
  onCancel: () => void;
}

export const CropEditor = ({ imageUrl, onCropApplied, onCancel }: CropEditorProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (imageRef.current && imageLoaded) {
      // Auto-detect content bounds
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = imageRef.current.naturalWidth;
        canvas.height = imageRef.current.naturalHeight;
        ctx.drawImage(imageRef.current, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

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

        const padding = 2;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width - 1, maxX + padding);
        maxY = Math.min(canvas.height - 1, maxY + padding);

        setCrop({
          x: (minX / canvas.width) * 100,
          y: (minY / canvas.height) * 100,
          width: ((maxX - minX + 1) / canvas.width) * 100,
          height: ((maxY - minY + 1) / canvas.height) * 100,
        });
      }
    }
  }, [imageLoaded]);

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    if (handle) {
      setResizing(handle);
    } else {
      setIsDragging(true);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100;

    if (isDragging) {
      setCrop(prev => ({
        ...prev,
        x: Math.max(0, Math.min(100 - prev.width, prev.x + dx)),
        y: Math.max(0, Math.min(100 - prev.height, prev.y + dy)),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (resizing) {
      setCrop(prev => {
        let newCrop = { ...prev };
        
        if (resizing.includes('n')) {
          const newY = Math.max(0, Math.min(prev.y + prev.height - 5, prev.y + dy));
          newCrop.height = prev.height + (prev.y - newY);
          newCrop.y = newY;
        }
        if (resizing.includes('s')) {
          newCrop.height = Math.max(5, Math.min(100 - prev.y, prev.height + dy));
        }
        if (resizing.includes('w')) {
          const newX = Math.max(0, Math.min(prev.x + prev.width - 5, prev.x + dx));
          newCrop.width = prev.width + (prev.x - newX);
          newCrop.x = newX;
        }
        if (resizing.includes('e')) {
          newCrop.width = Math.max(5, Math.min(100 - prev.x, prev.width + dx));
        }
        
        return newCrop;
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizing(null);
  };

  const handleApplyCrop = async () => {
    if (!imageRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const cropX = (crop.x / 100) * naturalWidth;
    const cropY = (crop.y / 100) * naturalHeight;
    const cropWidth = (crop.width / 100) * naturalWidth;
    const cropHeight = (crop.height / 100) * naturalHeight;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      img,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          onCropApplied(blob, url);
        }
      },
      'image/png',
      1.0
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Adjust the crop area by dragging the corners and edges, or move the entire selection
        </p>
      </div>
      
      <div
        ref={containerRef}
        className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden shadow-strong"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Crop preview"
          className="w-full h-full object-contain"
          onLoad={() => setImageLoaded(true)}
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Crop area */}
        <div
          className="absolute border-2 border-primary cursor-move"
          style={{
            left: `${crop.x}%`,
            top: `${crop.y}%`,
            width: `${crop.width}%`,
            height: `${crop.height}%`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
          onMouseDown={(e) => handleMouseDown(e)}
        >
          {/* Resize handles */}
          {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((handle) => (
            <div
              key={handle}
              className="absolute w-3 h-3 bg-primary rounded-full border-2 border-background cursor-pointer hover:scale-125 transition-transform"
              style={{
                ...(handle.includes('n') && { top: -6 }),
                ...(handle.includes('s') && { bottom: -6 }),
                ...(handle.includes('w') && { left: -6 }),
                ...(handle.includes('e') && { right: -6 }),
                ...(handle === 'n' && { left: '50%', transform: 'translateX(-50%)' }),
                ...(handle === 's' && { left: '50%', transform: 'translateX(-50%)' }),
                ...(handle === 'e' && { top: '50%', transform: 'translateY(-50%)' }),
                ...(handle === 'w' && { top: '50%', transform: 'translateY(-50%)' }),
                cursor: handle.length === 2 ? `${handle}-resize` : `${handle === 'n' || handle === 's' ? 'ns' : 'ew'}-resize`,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, handle);
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Button
          onClick={onCancel}
          size="lg"
          variant="outline"
        >
          <X className="w-5 h-5 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleApplyCrop}
          size="lg"
          className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-soft"
        >
          <Check className="w-5 h-5 mr-2" />
          Apply Crop
        </Button>
      </div>
    </div>
  );
};
