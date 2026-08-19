"use client";

import React from "react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 bg-slate-900 text-white rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] text-sm font-semibold hover:bg-slate-800 transition-colors"
    >
      Print Document
    </button>
  );
}
