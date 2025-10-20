import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProcessingIndicatorProps {
  progress: number;
}

export const ProcessingIndicator = ({ progress }: ProcessingIndicatorProps) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-lg shadow-soft">
        <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center animate-pulse">
          <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">
            Removing background...
          </p>
          <p className="text-sm text-muted-foreground">
            Processing your image with AI
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground mt-2">
            {progress}%
          </p>
        </div>
      </div>
    </div>
  );
};
