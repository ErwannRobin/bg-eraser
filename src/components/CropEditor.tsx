import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react';

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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const updateImageDimensions = () => {
      if (imageRef.current && containerRef.current && imageLoaded) {
        const img = imageRef.current;
        const container = containerRef.current;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const containerAspect = containerWidth / containerHeight;
        
        let displayWidth, displayHeight, offsetX, offsetY;
        
        if (imgAspect > containerAspect) {
          displayWidth = containerWidth;
          displayHeight = containerWidth / imgAspect;
          offsetX = 0;
          offsetY = (containerHeight - displayHeight) / 2;
        } else {
          displayHeight = containerHeight;
          displayWidth = containerHeight * imgAspect;
          offsetY = 0;
          offsetX = (containerWidth - displayWidth) / 2;
        }
        
        setImageDimensions({ width: displayWidth, height: displayHeight, offsetX, offsetY });

        // Auto-detect content bounds
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);

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

          // Convert natural coordinates to display percentages
          const xPercent = ((minX / canvas.width) * displayWidth + offsetX) / containerWidth * 100;
          const yPercent = ((minY / canvas.height) * displayHeight + offsetY) / containerHeight * 100;
          const widthPercent = ((maxX - minX + 1) / canvas.width) * displayWidth / containerWidth * 100;
          const heightPercent = ((maxY - minY + 1) / canvas.height) * displayHeight / containerHeight * 100;

          setCrop({
            x: xPercent,
            y: yPercent,
            width: widthPercent,
            height: heightPercent,
          });
        }
      }
    };

    updateImageDimensions();
    window.addEventListener('resize', updateImageDimensions);
    return () => window.removeEventListener('resize', updateImageDimensions);
  }, [imageLoaded]);

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (handle) {
      setResizing(handle);
    } else {
      setIsDragging(true);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePanMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking outside the crop area and zoomed in
    if (zoom > 1 && !isDragging && !resizing) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoom > 1) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      // Limit pan to reasonable bounds
      const maxPan = (zoom - 1) * 200;
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, newX)),
        y: Math.max(-maxPan, Math.min(maxPan, newY)),
      });
      return;
    }

    if (!containerRef.current || imageDimensions.width === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100 / zoom;
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100 / zoom;

    const minX = (imageDimensions.offsetX / rect.width) * 100;
    const minY = (imageDimensions.offsetY / rect.height) * 100;
    const maxX = ((imageDimensions.offsetX + imageDimensions.width) / rect.width) * 100;
    const maxY = ((imageDimensions.offsetY + imageDimensions.height) / rect.height) * 100;

    if (isDragging) {
      setCrop(prev => ({
        ...prev,
        x: Math.max(minX, Math.min(maxX - prev.width, prev.x + dx)),
        y: Math.max(minY, Math.min(maxY - prev.height, prev.y + dy)),
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (resizing) {
      setCrop(prev => {
        let newCrop = { ...prev };
        
        if (resizing.includes('n')) {
          const newY = Math.max(minY, Math.min(prev.y + prev.height - 5, prev.y + dy));
          newCrop.height = prev.height + (prev.y - newY);
          newCrop.y = newY;
        }
        if (resizing.includes('s')) {
          newCrop.height = Math.max(5, Math.min(maxY - prev.y, prev.height + dy));
        }
        if (resizing.includes('w')) {
          const newX = Math.max(minX, Math.min(prev.x + prev.width - 5, prev.x + dx));
          newCrop.width = prev.width + (prev.x - newX);
          newCrop.x = newX;
        }
        if (resizing.includes('e')) {
          newCrop.width = Math.max(5, Math.min(maxX - prev.x, prev.width + dx));
        }
        
        return newCrop;
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizing(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(1, Math.min(4, prev + delta)));
  };

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
    if (value[0] === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleApplyCrop = async () => {
    if (!imageRef.current || !containerRef.current || imageDimensions.width === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const container = containerRef.current;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Convert container percentages to display pixels
    const cropXDisplay = (crop.x / 100) * container.clientWidth - imageDimensions.offsetX;
    const cropYDisplay = (crop.y / 100) * container.clientHeight - imageDimensions.offsetY;
    const cropWidthDisplay = (crop.width / 100) * container.clientWidth;
    const cropHeightDisplay = (crop.height / 100) * container.clientHeight;

    // Convert display pixels to natural pixels
    const scaleX = naturalWidth / imageDimensions.width;
    const scaleY = naturalHeight / imageDimensions.height;
    
    const cropX = cropXDisplay * scaleX;
    const cropY = cropYDisplay * scaleY;
    const cropWidth = cropWidthDisplay * scaleX;
    const cropHeight = cropHeightDisplay * scaleY;

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
          Adjust the crop area. Use scroll wheel or slider to zoom for precision.
        </p>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-4 px-4">
        <ZoomOut className="w-4 h-4 text-muted-foreground" />
        <Slider
          value={[zoom]}
          onValueChange={handleZoomChange}
          min={1}
          max={4}
          step={0.1}
          className="w-48"
        />
        <ZoomIn className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground w-12">{Math.round(zoom * 100)}%</span>
      </div>
      
      <div
        ref={containerRef}
        className="relative w-full bg-muted rounded-lg overflow-hidden shadow-strong checkerboard cursor-crosshair"
        style={{ aspectRatio: imageRef.current ? `${imageRef.current.naturalWidth} / ${imageRef.current.naturalHeight}` : '16/9' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handlePanMouseDown}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          }}
          className="w-full h-full"
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Crop preview"
            className="w-full h-full object-contain"
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
          
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
