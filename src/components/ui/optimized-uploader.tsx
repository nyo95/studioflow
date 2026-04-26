"use client";

import React from "react";
import { Upload, X, Crop, ImageIcon, Loader2, Sparkles, AlertCircle, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import imageCompression from "browser-image-compression";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UI_ENGINE_RADIUS_IMAGE, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_ACTION } from "@/ui_engine/tokens/layout";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens/typography";
import { VisualAsset } from "./visual-asset";

interface OptimizedUploaderProps {
  onUpload: (file: File) => Promise<string>;
  onColorSelect?: (colorUri: string) => Promise<void>;
  value?: string;
  onClear?: () => void;
  className?: string;
  aspect?: number;
}

export function OptimizedUploader({
  onUpload,
  onColorSelect,
  value,
  onClear,
  className,
  aspect = 1
}: OptimizedUploaderProps) {
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [rawImage, setRawImage] = React.useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = React.useState(false);
  const [isColorMode, setIsColorMode] = React.useState(() => value?.startsWith("color:") || false);

  // Sync isColorMode when value changes from outside (e.g. form reset or external update)
  React.useEffect(() => {
    setIsColorMode(value?.startsWith("color:") || false);
  }, [value]);
  
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (>10MB)");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        setRawImage(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to read file");
    }
  };

  const onCropComplete = React.useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!rawImage || !croppedAreaPixels) return;
    
    setIsCompressing(true);
    setCropModalOpen(false);

    try {
      // 1. Create cropped image
      const croppedImage = await getCroppedImg(rawImage, croppedAreaPixels);
      
      // 2. Compress
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(croppedImage, options);
      
      // 3. Upload
      setIsUploading(true);
      const url = await onUpload(compressedFile);
      toast.success("Image optimized and uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Image processing failed");
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
      setRawImage(null);
    }
  };

  const handleColorChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    if (onColorSelect) {
      setIsUploading(true);
      try {
        await onColorSelect(`color://${color}`);
      } catch {
        toast.error("Failed to set color");
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className={cn("relative group w-full", className)}>
      <div className={cn(
        "relative aspect-square w-full overflow-hidden border transition-all duration-500",
        UI_ENGINE_RADIUS_IMAGE,
        value 
          ? "border-transparent shadow-xl ring-1 ring-slate-200" 
          : "border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-2xl hover:shadow-slate-200/30",
        isUploading || isCompressing ? "opacity-50 cursor-wait" : ""
      )}>
        {value ? (
          <>
            <VisualAsset 
              src={value} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            />
            {/* Glassmorphism Overlay */}
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 backdrop-blur-[0px] group-hover:backdrop-blur-[2px] transition-all duration-500 flex items-center justify-center gap-3">
               <button 
                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear?.(); }}
                 className={cn("h-10 w-10 bg-white/90 backdrop-blur-md text-red-500 shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 hover:scale-110 hover:bg-white", UI_ENGINE_RADIUS_ACTION)}
               >
                 <X size={18} strokeWidth={3} />
               </button>
               {!isColorMode && (
                 <label className={cn("h-10 w-10 bg-white/90 backdrop-blur-md text-slate-900 shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-75 hover:scale-110 hover:bg-white cursor-pointer", UI_ENGINE_RADIUS_ACTION)}>
                   <input type="file" className="hidden" accept="image/*" onChange={onFileChange} disabled={isUploading || isCompressing} />
                   <ImageIcon size={18} strokeWidth={2.5} />
                 </label>
               )}
               {isColorMode && onColorSelect && (
                 <label className={cn("h-10 w-10 bg-white/90 backdrop-blur-md text-slate-900 shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-75 hover:scale-110 hover:bg-white cursor-pointer", UI_ENGINE_RADIUS_ACTION)}>
                   <input type="color" className="hidden" onChange={handleColorChange} disabled={isUploading} />
                   <Palette size={18} strokeWidth={2.5} />
                 </label>
               )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col">
            {/* Mode Toggle */}
            <div className="flex border-b border-slate-100 bg-slate-50/80 p-1">
              <button 
                onClick={() => setIsColorMode(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all",
                  !isColorMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600",
                  UI_ENGINE_RADIUS_CONTROL
                )}
              >
                <ImageIcon size={12} />
                Image
              </button>
              <button 
                onClick={() => setIsColorMode(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all",
                  isColorMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600",
                  UI_ENGINE_RADIUS_CONTROL
                )}
              >
                <Palette size={12} />
                Color
              </button>
            </div>

            {isColorMode ? (
              <label className="flex-1 flex flex-col items-center justify-center cursor-pointer p-8 text-center gap-4 hover:bg-white transition-colors">
                <input type="color" className="hidden" onChange={handleColorChange} disabled={isUploading} />
                <div className={cn(
                  "h-16 w-16 bg-white shadow-xl flex items-center justify-center text-slate-300 group-hover:text-slate-900 transition-all group-hover:scale-110 duration-700",
                  UI_ENGINE_RADIUS_CONTROL
                )}>
                  {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Palette size={24} strokeWidth={1.5} />}
                </div>
                <div className="space-y-0.5">
                  <p className={cn("text-slate-400 group-hover:text-slate-900 transition-colors font-black uppercase tracking-[0.2em] text-[9px]", UI_ENGINE_TYPE_META)}>Color Picker</p>
                  <p className="text-[10px] font-medium text-slate-400 group-hover:text-slate-500 transition-colors font-sans">Click to select solid color</p>
                </div>
              </label>
            ) : (
              <label className="flex-1 flex flex-col items-center justify-center cursor-pointer p-8 text-center gap-4">
                <input type="file" className="hidden" accept="image/*" onChange={onFileChange} disabled={isUploading || isCompressing} />
                <div className={cn(
                  "h-16 w-16 bg-white shadow-xl flex items-center justify-center text-slate-300 group-hover:text-slate-900 transition-all group-hover:scale-110 duration-700",
                  UI_ENGINE_RADIUS_CONTROL
                )}>
                  {isUploading || isCompressing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload size={24} strokeWidth={1.5} />}
                </div>
                <div className="space-y-0.5">
                  <p className={cn("text-slate-400 group-hover:text-slate-900 transition-colors font-black uppercase tracking-[0.2em] text-[9px]", UI_ENGINE_TYPE_META)}>Visual Harvester</p>
                  <p className="text-[10px] font-medium text-slate-400 group-hover:text-slate-500 transition-colors font-sans">Drop asset or browse</p>
                </div>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Cropping Modal */}
      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent className={cn("sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl bg-white focus-visible:outline-none", UI_ENGINE_RADIUS_CARD)}>
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-3">
               <div className={cn("h-10 w-10 bg-slate-950 text-white flex items-center justify-center", UI_ENGINE_RADIUS_ACTION)}>
                  <Crop size={18} />
               </div>
               Refine Visual Asset
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative h-[400px] w-full bg-slate-100 overflow-hidden">
             {rawImage && (
               <Cropper
                 image={rawImage}
                 crop={crop}
                 zoom={zoom}
                 aspect={aspect}
                 onCropChange={setCrop}
                 onZoomChange={setZoom}
                 onCropComplete={onCropComplete}
               />
             )}
          </div>

          <div className="p-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
             <div className="flex items-center gap-2 text-slate-400">
                <AlertCircle size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">StudioFlow Standard Crop (1:1)</span>
             </div>
             <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setCropModalOpen(false)} className={cn("px-6 font-black text-[10px] uppercase tracking-widest text-slate-400", UI_ENGINE_RADIUS_CONTROL)}>
                   Cancel
                </Button>
                <Button onClick={handleApplyCrop} className={cn("bg-slate-950 text-white px-8 h-11 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 transition-all hover:bg-black", UI_ENGINE_RADIUS_CONTROL)}>
                   Harvest Asset
                </Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper to handle coordinate conversion
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("No 2D context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Canvas is empty");
      resolve(new File([blob], "cropped_image.jpg", { type: "image/jpeg" }));
    }, "image/jpeg");
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}
