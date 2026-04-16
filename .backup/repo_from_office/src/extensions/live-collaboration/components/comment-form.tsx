"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommentFormProps {
  onPost: (content: string) => Promise<void>;
  isPending: boolean;
}

export function CommentForm({ onPost, isPending }: CommentFormProps) {
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isPending) return;

    const currentContent = content;
    setContent(""); // Clear before to feel faster
    try {
      await onPost(currentContent);
    } catch {
      setContent(currentContent); // Revert on error
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        placeholder="Type a message..."
        value={content}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
        maxLength={5000}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white/50 px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none font-sans text-xs focus-visible:ring-slate-400"
        )}
        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as unknown as React.FormEvent);
          }
        }}
      />
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={!content.trim() || isPending}
          size="sm"
          className="h-8 rounded-sm bg-slate-900 px-4 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-slate-800"
        >
          {isPending ? "Posting..." : (
            <>
              Post <Send className="ml-2 h-3 w-3" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
