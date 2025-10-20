import { useState } from 'react';
import { ImageUpload } from '@/components/ImageUpload';
import { ImageComparison } from '@/components/ImageComparison';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { removeBackground, loadImage } from '@/utils/backgroundRemoval';
import { useToast } from '@/hooks/use-toast';
import { Wand2 } from 'lucide-react';

const Index = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const { toast } = useToast();

  const handleImageSelect = async (file: File) => {
    try {
      setIsProcessing(true);
      setProgress(0);
      setProcessedImage(null);

      // Load and display original image
      const imgElement = await loadImage(file);
      const originalUrl = URL.createObjectURL(file);
      setOriginalImage(originalUrl);

      // Remove background
      const resultBlob = await removeBackground(imgElement, setProgress);
      const resultUrl = URL.createObjectURL(resultBlob);
      
      setProcessedImage(resultUrl);
      setProcessedBlob(resultBlob);
      
      toast({
        title: 'Success!',
        description: 'Background removed successfully',
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove background. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (processedBlob) {
      const url = URL.createObjectURL(processedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `removed-bg-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setProcessedBlob(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
              <Wand2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BG Remover
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Remove image backgrounds instantly with AI-powered precision. Upload your photo and get professional results in seconds.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          {!originalImage && !isProcessing && (
            <div className="animate-fade-in">
              <ImageUpload onImageSelect={handleImageSelect} isProcessing={isProcessing} />
            </div>
          )}

          {isProcessing && (
            <ProcessingIndicator progress={progress} />
          )}

          {originalImage && processedImage && !isProcessing && (
            <div className="space-y-6">
              <ImageComparison
                originalImage={originalImage}
                processedImage={processedImage}
                onDownload={handleDownload}
              />
              <div className="flex justify-center">
                <button
                  onClick={handleReset}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Upload another image
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>All processing happens in your browser. Your images never leave your device.</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
