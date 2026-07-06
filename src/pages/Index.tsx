import { useState, useEffect, useCallback, useRef } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { ImageComparison } from "@/components/ImageComparison";
import { ProcessingIndicator } from "@/components/ProcessingIndicator";
import { ManualEditor } from "@/components/ManualEditor";
import { CropEditor } from "@/components/CropEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImageThumbnailList, ProcessedImageItem } from "@/components/ImageThumbnailList";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { removeBackground, loadImage } from "@/utils/backgroundRemoval";
import { upscaleImage } from "@/utils/imageUpscale";
import { isHeicFile, convertHeicToJpeg } from "@/utils/heicConverter";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Sparkles, Pipette, Download, Copy, Maximize2, Archive } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JSZip from "jszip";

// History state type for undo
interface HistoryState {
  images: ProcessedImageItem[];
  selectedImageId: string | null;
  hasCropped: boolean;
}

const Index = () => {
  const [images, setImages] = useState<ProcessedImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [isCropping, setIsCropping] = useState(false);
  const [hasCropped, setHasCropped] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const processingQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const historyRef = useRef<HistoryState[]>([]);
  const { toast } = useToast();

  const selectedImage = images.find((img) => img.id === selectedImageId) || null;

  // Save current state to history before making changes
  const saveToHistory = useCallback(() => {
    historyRef.current.push({
      images: images.map(img => ({ ...img })),
      selectedImageId,
      hasCropped,
    });
    // Limit history to 20 states
    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }
  }, [images, selectedImageId, hasCropped]);

  // Undo to previous state
  const handleUndo = useCallback(() => {
    const previousState = historyRef.current.pop();
    if (previousState) {
      setImages(previousState.images);
      setSelectedImageId(previousState.selectedImageId);
      setHasCropped(previousState.hasCropped);
      toast({
        title: "Undone",
        description: "Reverted to previous state",
      });
    } else {
      toast({
        title: "Nothing to undo",
        description: "No previous state available",
      });
    }
  }, [toast]);

  // Handle Ctrl+Z keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  // Process next image in queue
  const processNextInQueue = useCallback(async () => {
    if (processingQueueRef.current.length === 0 || isProcessingRef.current) return;

    const nextId = processingQueueRef.current[0];
    
    // Get current image from state
    setImages((currentImages) => {
      const imageToProcess = currentImages.find((img) => img.id === nextId);
      
      if (!imageToProcess || imageToProcess.status !== 'pending') {
        processingQueueRef.current.shift();
        // Schedule next processing
        setTimeout(() => processNextInQueue(), 0);
        return currentImages;
      }

      // Start processing
      isProcessingRef.current = true;
      setIsProcessing(true);
      setProgress(0);

      // Process asynchronously
      (async () => {
        try {
          const imgElement = await loadImage(imageToProcess.originalFile);
          const resultBlob = await removeBackground(imgElement, setProgress);
          const resultUrl = URL.createObjectURL(resultBlob);

          setImages((prev) =>
            prev.map((img) =>
              img.id === nextId
                ? { ...img, processedUrl: resultUrl, processedBlob: resultBlob, status: 'done' as const }
                : img
            )
          );

          toast({
            title: "Success!",
            description: `Background removed successfully`,
          });
        } catch (error) {
          console.error("Error processing image:", error);
          setImages((prev) =>
            prev.map((img) =>
              img.id === nextId ? { ...img, status: 'error' as const } : img
            )
          );
          toast({
            title: "Error",
            description: "Failed to remove background. Please try again.",
            variant: "destructive",
          });
        } finally {
          processingQueueRef.current.shift();
          isProcessingRef.current = false;
          setIsProcessing(false);
          // Process next in queue
          setTimeout(() => processNextInQueue(), 0);
        }
      })();

      // Update status to processing
      return currentImages.map((img) =>
        img.id === nextId ? { ...img, status: 'processing' as const } : img
      );
    });
  }, [toast]);

  const handleFilesSelect = useCallback(
    async (files: File[]) => {
      const newImages: ProcessedImageItem[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        originalFile: file,
        originalUrl: URL.createObjectURL(file),
        processedUrl: null,
        processedBlob: null,
        upscaledOriginalUrl: null,
        upscaledOriginalBlob: null,
        status: mode === "ai" ? 'pending' as const : 'done' as const,
      }));

      setImages((prev) => [...prev, ...newImages]);
      
      // Select the first new image
      if (newImages.length > 0) {
        setSelectedImageId(newImages[0].id);
        
        // Load image element for the first image
        loadImage(newImages[0].originalFile).then(setImageElement);
      }

      // Add to processing queue for AI mode
      if (mode === "ai") {
        processingQueueRef.current.push(...newImages.map((img) => img.id));
        processNextInQueue();
      }
    },
    [mode, processNextInQueue]
  );

  const handleGlobalDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isProcessingRef.current || isUpscaling) return;

      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(
        (file) => file.type.startsWith('image/') || isHeicFile(file)
      );

      if (imageFiles.length === 0) return;

      // Convert HEIC files if needed
      const processedFiles: File[] = [];
      for (const file of imageFiles) {
        if (isHeicFile(file)) {
          try {
            const converted = await convertHeicToJpeg(file);
            processedFiles.push(converted);
          } catch {
            processedFiles.push(file);
          }
        } else {
          processedFiles.push(file);
        }
      }

      setHasCropped(false);
      setIsCropping(false);
      handleFilesSelect(processedFiles);
    },
    [isUpscaling, handleFilesSelect]
  );

  const handleGlobalDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleManualProcessed = (blob: Blob, url: string) => {
    if (!selectedImageId) return;
    saveToHistory();
    setImages((prev) =>
      prev.map((img) =>
        img.id === selectedImageId
          ? { ...img, processedUrl: url, processedBlob: blob, status: 'done' as const }
          : img
      )
    );
  };

  const handleStartCrop = () => {
    setIsCropping(true);
  };

  const handleCropApplied = (blob: Blob, url: string) => {
    if (!selectedImageId) return;
    saveToHistory();
    setImages((prev) =>
      prev.map((img) =>
        img.id === selectedImageId
          ? { ...img, processedUrl: url, processedBlob: blob }
          : img
      )
    );
    setIsCropping(false);
    setHasCropped(true);
    toast({
      title: "Success!",
      description: "Image cropped successfully",
    });
  };

  const handleCropCancel = () => {
    setIsCropping(false);
  };

  const handleDownloadOriginal = () => {
    if (selectedImage) {
      const a = document.createElement("a");
      a.href = selectedImage.originalUrl;
      a.download = selectedImage.originalFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownload = () => {
    if (selectedImage?.processedBlob) {
      const url = URL.createObjectURL(selectedImage.processedBlob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = selectedImage.originalFile.name.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}.bg-eraser.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadAll = async () => {
    const doneImages = images.filter((img) => img.status === 'done' && img.processedBlob);
    if (doneImages.length === 0) return;

    const zip = new JSZip();
    doneImages.forEach((img, index) => {
      if (img.processedBlob) {
        const baseName = img.originalFile.name.replace(/\.[^/.]+$/, '');
        const name = `${baseName}.bg-eraser.png`;
        zip.file(name, img.processedBlob);
      }
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bg-removed-images-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded!",
      description: `${doneImages.length} images saved as ZIP`,
    });
  };

  const handleCopy = async () => {
    if (selectedImage?.processedBlob) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [selectedImage.processedBlob.type]: selectedImage.processedBlob,
          }),
        ]);
        toast({
          title: "Copied!",
          description: "Image copied to clipboard",
        });
      } catch (error) {
        console.error("Error copying image:", error);
        toast({
          title: "Error",
          description: "Failed to copy image to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpscale = async () => {
    if (!selectedImage?.processedUrl || !selectedImageId) return;
    saveToHistory();
    try {
      setIsUpscaling(true);
      setProgress(0);
      const { blob, url } = await upscaleImage(selectedImage.processedUrl, setProgress);
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId
            ? { ...img, processedUrl: url, processedBlob: blob }
            : img
        )
      );
      toast({
        title: "Success!",
        description: "Image upscaled to 2x resolution",
      });
    } catch (error) {
      console.error("Error upscaling image:", error);
      toast({
        title: "Error",
        description: "Failed to upscale image",
        variant: "destructive",
      });
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleReset = useCallback(() => {
    // Clean up URLs
    images.forEach((img) => {
      URL.revokeObjectURL(img.originalUrl);
      if (img.processedUrl) URL.revokeObjectURL(img.processedUrl);
    });
    setImages([]);
    setSelectedImageId(null);
    setImageElement(null);
    setProgress(0);
    setHasCropped(false);
    setIsCropping(false);
    setIsProcessing(false);
    isProcessingRef.current = false;
    processingQueueRef.current = [];
    historyRef.current = [];
  }, [images]);

  // Handle paste events for image pasting
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
      
      if (files.length > 0) {
        handleFilesSelect(files);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFilesSelect]);

  // Update imageElement when selecting a different image
  useEffect(() => {
    if (selectedImage) {
      loadImage(selectedImage.originalFile).then(setImageElement);
    }
  }, [selectedImageId]);

  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;
  const doneCount = images.filter((img) => img.status === 'done').length;

  return (
    <div
      className="min-h-screen bg-gradient-bg relative"
      onDrop={handleGlobalDrop}
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
    >
      <div className="container mx-auto px-4 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <header className="text-center mb-12 animate-fade-in">
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-3 mb-4 mx-auto group cursor-pointer"
            title="Click to start over"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
              <Wand2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
              BG Eraser
            </h1>
          </button>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Remove image backgrounds instantly with AI-powered precision. Upload your photo and get professional results
            in seconds.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          {!hasImages && !isProcessing && (
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

              <ImageUpload onImageSelect={handleFilesSelect} isProcessing={isProcessing} multiple={mode === "ai"} />
            </div>
          )}

          {/* Processing indicator */}
          {selectedImage?.status === 'processing' && <ProcessingIndicator progress={progress} />}

          {isUpscaling && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col items-center gap-6 p-8 bg-card rounded-lg shadow-soft">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center animate-pulse">
                  <Maximize2 className="w-8 h-8 text-primary-foreground animate-spin" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-foreground">Upscaling image...</p>
                  <p className="text-sm text-muted-foreground">Enhancing resolution to 2x</p>
                </div>
                <div className="w-full max-w-xs">
                  <Progress value={progress} className="h-2" />
                  <p className="text-center text-sm text-muted-foreground mt-2">{progress}%</p>
                </div>
              </div>
            </div>
          )}

          {selectedImage && mode === "manual" && !selectedImage.processedUrl && imageElement && !isProcessing && (
            <ManualEditor
              originalImage={selectedImage.originalUrl}
              imageElement={imageElement}
              onProcessed={handleManualProcessed}
            />
          )}

          {selectedImage && selectedImage.processedUrl && selectedImage.status === 'done' && !isProcessing && !isCropping && !hasCropped && !isUpscaling && (
            <div className="space-y-6">
              {/* Thumbnail sidebar for multiple images */}
              {hasMultipleImages && (
                <div className="flex gap-4">
                  <div className="w-20 flex-shrink-0 space-y-2">
                    <ImageThumbnailList
                      images={images}
                      selectedId={selectedImageId}
                      onSelect={setSelectedImageId}
                    />
                    {doneCount > 1 && (
                      <Button
                        onClick={handleDownloadAll}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                      >
                        <Archive className="w-3 h-3 mr-1" />
                        ZIP
                      </Button>
                    )}
                  </div>
                  <div className="flex-1">
                    <ImageComparison
                      originalImage={selectedImage.originalUrl}
                      processedImage={selectedImage.processedUrl}
                      onDownload={handleDownload}
                      onDownloadOriginal={handleDownloadOriginal}
                      onCopy={handleCopy}
                      onStartCrop={handleStartCrop}
                      onUpscale={handleUpscale}
                      isUpscaling={isUpscaling}
                    />
                  </div>
                </div>
              )}

              {/* Single image - original layout */}
              {!hasMultipleImages && (
                <ImageComparison
                  originalImage={selectedImage.originalUrl}
                  processedImage={selectedImage.processedUrl}
                  onDownload={handleDownload}
                  onDownloadOriginal={handleDownloadOriginal}
                  onCopy={handleCopy}
                  onStartCrop={handleStartCrop}
                  onUpscale={handleUpscale}
                  isUpscaling={isUpscaling}
                />
              )}

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

          {selectedImage && selectedImage.processedUrl && hasCropped && !isCropping && (
            <div className="space-y-6 animate-fade-in">
              <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden shadow-strong checkerboard">
                <img src={selectedImage.processedUrl} alt="Cropped result" className="w-full h-full object-contain" />
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
                <Button
                  onClick={handleDownload}
                  size="lg"
                  className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-soft"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download HD Image
                </Button>
              </div>
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

          {isCropping && selectedImage?.processedUrl && (
            <CropEditor imageUrl={selectedImage.processedUrl} onCropApplied={handleCropApplied} onCancel={handleCropCancel} />
          )}
        </main>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>
            Vibe coded with ❤️ by <a href="https://erwann.lovable.app">Erwann</a>
            <br />
            All processing happens in your browser. Your images never leave your device.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
