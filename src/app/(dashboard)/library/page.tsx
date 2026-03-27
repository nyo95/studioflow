import { DashboardPageShell, PageHeader } from "@/ui_engine";

export default function LibraryPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Extension Slot"
        title="GLOBAL LIBRARY"
        description="The materials and asset library is reserved for a future release."
      />

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>

        <p className="max-w-xs font-sans text-sm font-light text-slate-400">
          The materials and asset library is coming in a future release. This module
          is not yet available.
        </p>
      </div>
    </DashboardPageShell>
  );
}
