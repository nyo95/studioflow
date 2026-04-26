"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ImagePlaceholder } from "@/ui_engine/components/image-placeholder";
import { UI_ENGINE_RADIUS_IMAGE } from "@/ui_engine/tokens/layout";

interface VisualAssetProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  iconSize?: number;
}

export function VisualAsset({ src, alt, className, fallbackClassName, iconSize = 24 }: VisualAssetProps) {
  if (!src) {
    return <ImagePlaceholder iconSize={iconSize} className={cn(fallbackClassName, className)} />;
  }

  // Check if it's a color URI: color: or color://
  if (src.startsWith("color:")) {
    const colorCode = src.replace(/^color:(\/\/)?/, "");
    return (
      <div 
        className={cn("w-full h-full", className)} 
        style={{ backgroundColor: colorCode }}
        title={`Color: ${colorCode}`}
      />
    );
  }

  // Default to image
  return (
    <img
      src={src}
      alt={alt || "Product image"}
      className={cn("w-full h-full object-cover", className)}
    />
  );
}
