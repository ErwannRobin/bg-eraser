import { useState, useEffect } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { ImageComparison } from "@/components/ImageComparison";
import { ProcessingIndicator } from "@/components/ProcessingIndicator";
import { ManualEditor } from "@/components/ManualEditor";
import { CropEditor } from "@/components/CropEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { removeBackground, loadImage } from "@/utils/backgroundRemoval";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Sparkles, Pipette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [isCropping, setIsCropping] = useState(false);
  const { toast } = useToast();

  const handleImageSelect = async (file: File) => {
    try {
      // Load and display original image
      const imgElement = await loadImage(file);
      const originalUrl = URL.createObjectURL(file);
      setOriginalImage(originalUrl);
      setImageElement(imgElement);
      setProcessedImage(null);
      setProcessedBlob(null);

      // If AI mode, process immediately
      if (mode === "ai") {
        setIsProcessing(true);
        setProgress(0);

        // Remove background with AI
        const resultBlob = await removeBackground(imgElement, setProgress);
        const resultUrl = URL.createObjectURL(resultBlob);

        setProcessedImage(resultUrl);
        setProcessedBlob(resultBlob);

        toast({
          title: "Success!",
          description: "Background removed successfully",
        });
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error processing image:", error);
      toast({
        title: "Error",
        description: "Failed to remove background. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleManualProcessed = (blob: Blob, url: string) => {
    setProcessedImage(url);
    setProcessedBlob(blob);
  };

  const handleStartCrop = () => {
    setIsCropping(true);
  };

  const handleCropApplied = (blob: Blob, url: string) => {
    setProcessedImage(url);
    setProcessedBlob(blob);
    setIsCropping(false);
    toast({
      title: "Success!",
      description: "Image cropped successfully",
    });
  };

  const handleCropCancel = () => {
    setIsCropping(false);
  };

  const handleDownload = () => {
    if (processedBlob) {
      const url = URL.createObjectURL(processedBlob);
      const a = document.createElement("a");
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
    setImageElement(null);
    setProgress(0);
  };

  // Handle paste events for image pasting
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleImageSelect(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [mode, isProcessing]);

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="container mx-auto px-4 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <header className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
              <Wand2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BG Eraser
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Remove image backgrounds instantly with AI-powered precision. Upload your photo and get professional results
            in seconds.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          {!originalImage && !isProcessing && (
            <div className="animate-fade-in space-y-6">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "ai" | "manual")} className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                  <TabsTrigger value="ai" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Removal
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Pipette className="w-4 h-4" />
                    Manual Selection
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="ai" className="mt-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground">
                      Upload an image and let AI automatically detect and remove the background
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="manual" className="mt-6">
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground">
                      Upload an image and manually select which colors to remove
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <ImageUpload onImageSelect={handleImageSelect} isProcessing={isProcessing} />
            </div>
          )}

          {isProcessing && <ProcessingIndicator progress={progress} />}

          {originalImage && mode === "manual" && !processedImage && imageElement && !isProcessing && (
            <ManualEditor
              originalImage={originalImage}
              imageElement={imageElement}
              onProcessed={handleManualProcessed}
            />
          )}

          {originalImage && processedImage && !isProcessing && !isCropping && (
            <div className="space-y-6">
              <ImageComparison
                originalImage={originalImage}
                processedImage={processedImage}
                onDownload={handleDownload}
                onStartCrop={handleStartCrop}
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

          {isCropping && processedImage && (
            <CropEditor
              imageUrl={processedImage}
              onCropApplied={handleCropApplied}
              onCancel={handleCropCancel}
            />
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
