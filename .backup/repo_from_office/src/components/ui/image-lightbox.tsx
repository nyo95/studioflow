"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Maximize2, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ImageLightboxProps {
  src?: string | null;
  alt?: string;
  trigger?: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function ImageLightbox({ src, alt = "Image", trigger, className, onClose }: ImageLightboxProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(false);

  const isControlled = onClose !== undefined;
  const isOpen = isControlled ? !!src : internalIsOpen;

  const handleOpenChange = (open: boolean) => {
    if (!open && onClose) {
      onClose();
    }
    if (!isControlled) {
      setInternalIsOpen(open);
    }
  };

  const handleDownload = async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = alt || "download";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download image", error);
    }
  };

  if (!src && isControlled) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <div className={cn("relative cursor-zoom-in group", className)}>
            <img src={src!} alt={alt} className="w-full h-full object-cover rounded-md" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden flex flex-col items-center justify-center">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>Full size image preview</DialogDescription>
        </DialogHeader>
        
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <img
            src={src!}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300"
          />
        </div>
        
        <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md flex items-center justify-center"
          >
            <Download className="w-5 h-5" />
            <span className="sr-only">Download</span>
          </button>

          <button
            onClick={() => handleOpenChange(false)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md flex items-center justify-center"
          >
            <X className="w-6 h-6" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
