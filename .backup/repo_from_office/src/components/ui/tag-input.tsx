"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "./badge";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  placeholder?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function TagInput({
  placeholder = "Add tag...",
  tags = [],
  onChange,
  className
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    
    // Split by comma in case someone pastes a list or types fast
    const newTags = trimmed.split(/[,]+/)
      .map(t => t.trim())
      .filter(t => t && !tags.includes(t));

    if (newTags.length > 0) {
      onChange([...tags, ...newTags]);
      setInputValue("");
    } else {
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-2 min-h-10 p-2 rounded-xl bg-slate-50 border border-transparent focus-within:border-slate-200 transition-all">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="pl-2 pr-1 py-1 h-7 border-none bg-white shadow-sm text-slate-700 font-inter text-[11px] font-bold group flex items-center gap-1 animate-in zoom-in-95 duration-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="h-5 w-5 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-900"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-inter min-w-[120px] h-7"
        />
      </div>
      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest px-1 flex items-center gap-1.5">
         <Plus className="h-3 w-3" /> Press Enter or Comma to add tags
      </p>
    </div>
  );
}
