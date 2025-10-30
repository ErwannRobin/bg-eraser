import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Crop } from 'lucide-react';

interface ImageComparisonProps {
  originalImage: string;
  processedImage: string;
  onDownload: () => void;
  onStartCrop: () => void;
}

export const ImageComparison = ({
  originalImage,
  processedImage,
  onDownload,
  onStartCrop,
}: ImageComparisonProps) => {
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden shadow-strong checkerboard">
        <div className="absolute inset-0">
          <img
            src={processedImage}
            alt="Processed"
            className="w-full h-full object-contain"
          />
        </div>
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src={originalImage}
            alt="Original"
            className="w-full h-full object-contain"
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full shadow-lg flex items-center justify-center">
            <div className="w-1 h-4 bg-primary-foreground rounded" />
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPosition}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
          Original
        </div>
        <div className="absolute top-4 right-4 bg-primary/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-primary-foreground">
          Processed
        </div>
      </div>
      <div className="flex justify-center gap-3">
        <Button
          onClick={onStartCrop}
          size="lg"
          variant="outline"
        >
          <Crop className="w-5 h-5 mr-2" />
          Crop Image
        </Button>
        <Button
          onClick={onDownload}
          size="lg"
          className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-soft"
        >
          <Download className="w-5 h-5 mr-2" />
          Download HD Image
        </Button>
      </div>
    </div>
  );
};
