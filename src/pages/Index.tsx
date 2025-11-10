import { useState, useEffect } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { ImageComparison } from "@/components/ImageComparison";
import { ProcessingIndicator } from "@/components/ProcessingIndicator";
import { ManualEditor } from "@/components/ManualEditor";
import { CropEditor } from "@/components/CropEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { removeBackground, loadImage } from "@/utils/backgroundRemoval";
import { upscaleImage } from "@/utils/imageUpscale";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Sparkles, Pipette, Download, Copy, Maximize2 } from "lucide-react";
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
  const [hasCropped, setHasCropped] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const {
    toast
  } = useToast();
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
          description: "Background removed successfully"
        });
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error processing image:", error);
      toast({
        title: "Error",
        description: "Failed to remove background. Please try again.",
        variant: "destructive"
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
    setHasCropped(true);
    toast({
      title: "Success!",
      description: "Image cropped successfully"
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

  const handleCopy = async () => {
    if (processedBlob) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [processedBlob.type]: processedBlob
          })
        ]);
        toast({
          title: "Copied!",
          description: "Image copied to clipboard"
        });
      } catch (error) {
        console.error("Error copying image:", error);
        toast({
          title: "Error",
          description: "Failed to copy image to clipboard",
          variant: "destructive"
        });
      }
    }
  };

  const handleUpscale = async () => {
    if (!processedImage) return;
    
    try {
      setIsUpscaling(true);
      setProgress(0);
      
      const { blob, url } = await upscaleImage(processedImage, setProgress);
      
      setProcessedImage(url);
      setProcessedBlob(blob);
      
      toast({
        title: "Success!",
        description: "Image upscaled to 2x resolution"
      });
    } catch (error) {
      console.error("Error upscaling image:", error);
      toast({
        title: "Error",
        description: "Failed to upscale image",
        variant: "destructive"
      });
    } finally {
      setIsUpscaling(false);
    }
  };
  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setProcessedBlob(null);
    setImageElement(null);
    setProgress(0);
    setHasCropped(false);
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
  return <div className="min-h-screen bg-gradient-bg">
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
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Remove image backgrounds instantly with AI-powered precision.
Upload your photo and get professional results in seconds.</p>
        </header>

        <main className="max-w-4xl mx-auto">
          {!originalImage && !isProcessing && <div className="animate-fade-in space-y-6">
              <Tabs value={mode} onValueChange={v => setMode(v as "ai" | "manual")} className="w-full">
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
            </div>}

          {isProcessing && <ProcessingIndicator progress={progress} />}
          
          {isUpscaling && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-lg shadow-soft">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center animate-pulse">
                  <Maximize2 className="w-8 h-8 text-primary-foreground animate-spin" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    Upscaling image...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enhancing resolution to 2x
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
          )}

          {originalImage && mode === "manual" && !processedImage && imageElement && !isProcessing && <ManualEditor originalImage={originalImage} imageElement={imageElement} onProcessed={handleManualProcessed} />}

          {originalImage && processedImage && !isProcessing && !isCropping && !hasCropped && !isUpscaling && <div className="space-y-6">
              <ImageComparison 
                originalImage={originalImage} 
                processedImage={processedImage} 
                onDownload={handleDownload} 
                onCopy={handleCopy} 
                onStartCrop={handleStartCrop}
                onUpscale={handleUpscale}
                isUpscaling={isUpscaling}
              />
              <div className="flex justify-center">
                <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline">
                  Upload another image
                </button>
              </div>
            </div>}

          {processedImage && !isProcessing && !isCropping && hasCropped && <div className="space-y-6 animate-fade-in">
              <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden shadow-strong checkerboard">
                <img src={processedImage} alt="Cropped result" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={handleUpscale} size="lg" variant="secondary" disabled={isUpscaling}>
                  <Maximize2 className="w-5 h-5 mr-2" />
                  Upscale 2x
                </Button>
                <Button onClick={handleCopy} size="lg" variant="outline">
                  <Copy className="w-5 h-5 mr-2" />
                  Copy to Clipboard
                </Button>
                <Button onClick={handleDownload} size="lg" className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-soft">
                  <Download className="w-5 h-5 mr-2" />
                  Download HD Image
                </Button>
              </div>
              <div className="flex justify-center">
                <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline">
                  Upload another image
                </button>
              </div>
            </div>}

          {isCropping && processedImage && <CropEditor imageUrl={processedImage} onCropApplied={handleCropApplied} onCancel={handleCropCancel} />}
        </main>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>All processing happens in your browser. Your images never leave your device.</p>
        </footer>
      </div>
    </div>;
};
export default Index;