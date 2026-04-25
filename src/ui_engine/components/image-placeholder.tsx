"use client";

import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UI_ENGINE_RADIUS_CONTROL } from "../tokens/layout";
import { UI_ENGINE_TYPE_META } from "../tokens/typography";

interface ImagePlaceholderProps {
  className?: string;
  iconSize?: number;
}

export function ImagePlaceholder({ className, iconSize = 24 }: ImagePlaceholderProps) {
  return (
    <div 
      className={cn(
        "w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200",
        UI_ENGINE_RADIUS_CONTROL,
        className
      )}
    >
      <ImageIcon 
        size={iconSize} 
        className="text-slate-300 mb-1" 
        strokeWidth={1.5}
      />
      <div className="flex flex-col items-center -space-y-0.5">
        <span className={cn("text-[8px] font-black text-slate-400/80 tracking-[0.2em] leading-none uppercase", UI_ENGINE_TYPE_META)}>
          No
        </span>
        <span className={cn("text-[8px] font-black text-slate-400/80 tracking-[0.2em] leading-none uppercase", UI_ENGINE_TYPE_META)}>
          Image
        </span>
      </div>
    </div>
  );
}
