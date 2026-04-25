"use client";

import React from "react";
import { Upload, X, Crop, ImageIcon, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import imageCompression from "browser-image-compression";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface OptimizedUploaderProps {
  onUpload: (file: File) => Promise<string>;
  value?: string;
  onClear?: () => void;
  className?: string;
  aspect?: number;
}

export function OptimizedUploader({
  onUpload,
  value,
  onClear,
  className,
  aspect = 1
}: OptimizedUploaderProps) {
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [rawImage, setRawImage] = React.useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = React.useState(false);
  
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

  return (
    <div className={cn("relative group w-full", className)}>
      <div className={cn(
        "relative aspect-square w-full rounded-[2.5rem] overflow-hidden border-2 border-dashed transition-all duration-500",
        value ? "border-transparent shadow-2xl" : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300",
        isUploading || isCompressing ? "opacity-50 cursor-wait" : ""
      )}>
        {value ? (
          <>
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-all flex items-center justify-center gap-2">
               <button 
                 onClick={() => onClear?.()}
                 className="h-12 w-12 rounded-full bg-white text-red-500 shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:scale-110"
               >
                 <X size={20} strokeWidth={3} />
               </button>
            </div>
          </>
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer p-8 text-center gap-4">
             <input type="file" className="hidden" accept="image/*" onChange={onFileChange} disabled={isUploading || isCompressing} />
             <div className="h-20 w-20 rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center text-slate-300 group-hover:text-slate-900 transition-all group-hover:scale-110 duration-500">
               {isUploading || isCompressing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Upload size={28} strokeWidth={2.5} />}
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-900 transition-colors">Catalog Harvester</p>
                <p className="text-sm font-lora font-medium text-slate-400 mt-1">Drop image or click to browse</p>
             </div>
             
             <div className="flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-400 text-[9px] font-black uppercase tracking-widest animate-pulse">
                <Sparkles size={10} />
                Auto-Optimization Active
             </div>
          </label>
        )}
      </div>

      {/* Cropping Modal */}
      <Dialog open={cropModalOpen} onOpenChange={setCropModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none rounded-[3rem] shadow-2xl bg-white focus-visible:outline-none">
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="font-lora text-2xl font-medium text-slate-900 flex items-center gap-3">
               <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
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

          <div className="p-8 bg-slate-50/50 flex items-center justify-between">
             <div className="flex items-center gap-2 text-slate-400">
                <AlertCircle size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">StudioFlow Standard Crop (1:1)</span>
             </div>
             <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => setCropModalOpen(false)} className="rounded-xl px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Cancel
                </Button>
                <Button onClick={handleApplyCrop} className="bg-slate-900 text-white rounded-xl px-8 h-11 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200">
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
