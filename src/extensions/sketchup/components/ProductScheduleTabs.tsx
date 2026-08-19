"use client";

import React from "react";

// Simple two-view switcher for the Product Schedule page: the catalog board and
// the render annotation boards. The inactive view is display:none so only the
// active one prints.
export function ProductScheduleTabs({
  schedule,
  renders,
}: {
  schedule: React.ReactNode;
  renders: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<"schedule" | "renders">("schedule");

  const tabClass = (active: boolean) =>
    `rounded-full border px-4 py-1 font-sans text-sm transition-colors ${
      active
        ? "border-[var(--ui-border-focus)] bg-[var(--ui-canvas-bg)] text-slate-900"
        : "border-slate-200 text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div>
      <div className="no-print mb-[var(--ui-section-gap)] flex items-center gap-2">
        <button type="button" className={tabClass(tab === "schedule")} onClick={() => setTab("schedule")}>
          Schedule
        </button>
        <button type="button" className={tabClass(tab === "renders")} onClick={() => setTab("renders")}>
          Render Boards
        </button>
      </div>
      <div style={{ display: tab === "schedule" ? "block" : "none" }}>{schedule}</div>
      <div style={{ display: tab === "renders" ? "block" : "none" }}>{renders}</div>
    </div>
  );
}
