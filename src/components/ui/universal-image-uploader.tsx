"use client";

import * as React from "react";
import { Upload, Loader2, Crop, X, Check, Image as ImageIcon } from "lucide-react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { compressImage, getCroppedImg } from "@/lib/utils/image-utils";
import { uploadLibraryImage } from "@/extensions/library/lib/upload-client";
import { cn } from "@/lib/utils";

interface UniversalImageUploaderProps {
  initialImageUrl?: string | null;
  onUploadComplete: (urls: { original: string; cover: string }) => void;
  aspectRatio?: number;
  className?: string;
  label?: string;
}

export function UniversalImageUploader({
  initialImageUrl,
  onUploadComplete,
  aspectRatio = 1,
  className,
  label = "Upload Image",
}: UniversalImageUploaderProps) {
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const [showCropper, setShowCropper] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState<"IDLE" | "COMPRESSING" | "UPLOADING" | "SUCCESS">("IDLE");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(initialImageUrl || null);

  // Sync internal state when prop changes (e.g. after a save and refresh cycle)
  React.useEffect(() => {
    setPreviewUrl(initialImageUrl || null);
  }, [initialImageUrl]);


  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (_: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  };

  const handleFinalize = async () => {
    if (!imageFile || !imageSrc || !croppedAreaPixels) return;

    setUploadStatus("COMPRESSING");
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${imageFile.name.replace(/\s/g, "_")}`;

      // 1. Compress Original
      const compressedOriginal = await compressImage(imageFile);
      
      // 2. Crop Cover
      const croppedCoverBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedCoverBlob) throw new Error("Failed to crop image");

      // 3. Upload Both
      setUploadStatus("UPLOADING");
      const originalPath = `originals/${fileName}`;
      const coverPath = `covers/${fileName}`;

      const [originalUrl, coverUrl] = await Promise.all([
        uploadLibraryImage(compressedOriginal, originalPath),
        uploadLibraryImage(croppedCoverBlob, coverPath)
      ]);

      onUploadComplete({ original: originalUrl, cover: coverUrl });
      setPreviewUrl(coverUrl);
      setUploadStatus("IDLE");
      setShowCropper(false);
      toast.success("Image uploaded successfully");
    } catch (error) {
      setUploadStatus("IDLE");
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div 
        className={cn(
          "relative aspect-square rounded-[var(--ui-radius-card,1rem)] overflow-hidden group cursor-pointer transition-all duration-500",
          "border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-400 hover:shadow-xl hover:shadow-slate-200/40",
          previewUrl && "border-none shadow-md ring-1 ring-slate-200/50"
        )}
        onClick={() => !showCropper && uploadStatus === "IDLE" && document.getElementById("universal-image-input")?.click()}
      >
        {previewUrl ? (
          <div className="relative h-full w-full">
            <img src={previewUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Preview" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-xl backdrop-blur-md">
                   <ImageIcon className="h-5 w-5 text-slate-900" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full gap-4">
            <div className="h-16 w-16 rounded-[2rem] bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-slate-900 group-hover:scale-110 group-hover:rounded-2xl transition-all duration-500">
              <Upload className="h-7 w-7" />
            </div>
            <div className="text-center space-y-1">
              <span className="text-[11px] text-slate-900 font-bold uppercase tracking-[0.15em] block">{label}</span>
              <span className="text-[10px] text-slate-400 font-medium">Click to browse media library</span>
            </div>
          </div>
        )}

        <input
          id="universal-image-input"
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />

        {uploadStatus !== "IDLE" && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] animate-pulse">
              {uploadStatus === "COMPRESSING" ? "Processing..." : "Uploading..."}
            </span>
          </div>
        )}

        {previewUrl && !showCropper && uploadStatus === "IDLE" && (
           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewUrl(null);
                  onUploadComplete({ original: "", cover: "" });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
           </div>
        )}
      </div>

      <Dialog open={showCropper} onOpenChange={setShowCropper}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-[2rem]">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <DialogTitle className="font-serif text-xl font-medium flex items-center gap-2">
              <Crop className="h-5 w-5" /> Adjust Image Crop
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative h-[400px] bg-slate-100">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <DialogFooter className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zoom</span>
               <input
                 type="range"
                 value={zoom}
                 min={1}
                 max={3}
                 step={0.1}
                 onChange={(e) => setZoom(Number(e.target.value))}
                 className="flex-1 accent-slate-900"
               />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setShowCropper(false)} className="rounded-xl px-6 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                Cancel
              </Button>
              <Button onClick={handleFinalize} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8 shadow-xl shadow-slate-200 transition-all font-bold text-[10px] uppercase tracking-widest">
                Save & Upload
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
