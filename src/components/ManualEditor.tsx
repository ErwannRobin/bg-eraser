import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Pipette, Plus } from 'lucide-react';
import {
  ColorToRemove,
  getColorAtPixel,
  hexToRgb,
  rgbToHex,
  removeColorFromImage,
} from '@/utils/manualBackgroundRemoval';
import { useToast } from '@/hooks/use-toast';

interface ManualEditorProps {
  originalImage: string;
  imageElement: HTMLImageElement;
  onProcessed: (blob: Blob, url: string) => void;
}

export const ManualEditor = ({
  originalImage,
  imageElement,
  onProcessed,
}: ManualEditorProps) => {
  const [colors, setColors] = useState<ColorToRemove[]>([]);
  const [tolerance, setTolerance] = useState(30);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [manualColor, setManualColor] = useState('#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (canvasRef.current && imageElement) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      ctx.drawImage(imageElement, 0, 0);
    }
  }, [imageElement]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickerActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pickedColor = getColorAtPixel(imageData, x, y);
    const hex = rgbToHex(pickedColor.r, pickedColor.g, pickedColor.b);

    addColor(hex, pickedColor);
    setIsPickerActive(false);
  };

  const addColor = (hex: string, rgb: { r: number; g: number; b: number }) => {
    const newColor: ColorToRemove = {
      id: `${Date.now()}-${Math.random()}`,
      color: hex,
      rgb,
    };

    setColors((prev) => {
      // Check if color already exists
      const exists = prev.some((c) => c.color === hex);
      if (exists) {
        toast({
          title: 'Color already added',
          description: 'This color is already in the list',
        });
        return prev;
      }
      return [...prev, newColor];
    });
  };

  const handleManualColorAdd = () => {
    const rgb = hexToRgb(manualColor);
    if (rgb) {
      addColor(manualColor, rgb);
    }
  };

  const removeColor = (id: string) => {
    setColors((prev) => prev.filter((c) => c.id !== id));
  };

  const handleProcess = async () => {
    if (colors.length === 0) {
      toast({
        title: 'No colors selected',
        description: 'Please select at least one color to remove',
        variant: 'destructive',
      });
      return;
    }

    try {
      const blob = await removeColorFromImage(imageElement, colors, tolerance);
      const url = URL.createObjectURL(blob);
      onProcessed(blob, url);
      
      toast({
        title: 'Success!',
        description: 'Colors removed successfully',
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: 'Failed to process image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-card p-6 rounded-lg shadow-soft space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Select Colors to Remove</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click on the image to pick colors, or use the color picker below
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={() => setIsPickerActive(!isPickerActive)}
              variant={isPickerActive ? 'default' : 'outline'}
              size="sm"
              className={isPickerActive ? 'bg-gradient-primary' : ''}
            >
              <Pipette className="w-4 h-4 mr-2" />
              {isPickerActive ? 'Click on image' : 'Pick from image'}
            </Button>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={manualColor}
                onChange={(e) => setManualColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-border"
              />
              <Button onClick={handleManualColorAdd} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add color
              </Button>
            </div>
          </div>

          {colors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {colors.map((color) => (
                <Badge
                  key={color.id}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 flex items-center gap-2"
                >
                  <div
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: color.color }}
                  />
                  <span className="text-xs">{color.color}</span>
                  <button
                    onClick={() => removeColor(color.id)}
                    className="hover:bg-muted rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tolerance: {tolerance}
            </label>
            <Slider
              value={[tolerance]}
              onValueChange={(values) => setTolerance(values[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Higher values remove similar colors
            </p>
          </div>
        </div>

        <Button
          onClick={handleProcess}
          disabled={colors.length === 0}
          className="w-full bg-gradient-primary hover:opacity-90"
        >
          Remove Selected Colors
        </Button>
      </div>

      <div className="relative w-full bg-muted rounded-lg overflow-hidden shadow-strong">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`max-w-full h-auto ${
            isPickerActive ? 'cursor-crosshair' : 'cursor-default'
          }`}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        {isPickerActive && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-strong animate-pulse">
            Click on a color to select it
          </div>
        )}
      </div>
    </div>
  );
};
