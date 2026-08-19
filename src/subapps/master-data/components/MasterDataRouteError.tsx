"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CARD, UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_H3 } from "@/ui_engine";
import { cn } from "@/lib/utils";

export function MasterDataRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    console.error("[Master Data route]", error);
  }, [error]);

  return (
    <section
      className={cn(
        "flex flex-1 flex-col items-center justify-center border bg-white p-[var(--ui-section-py)] text-center",
        UI_ENGINE_BORDER_SUBTLE,
        UI_ENGINE_RADIUS_CARD
      )}
    >
      <AlertTriangle
        aria-hidden="true"
        className="size-[var(--ui-icon-size-sm)] text-amber-700"
      />
      <h1 className={cn("mt-[calc(var(--ui-section-gap)/2)]", UI_ENGINE_TYPE_H3)}>
        Data tidak dapat dimuat
      </h1>
      <p
        className={cn(
          "mt-[calc(var(--ui-section-gap)/2)] max-w-[42rem] text-slate-500",
          UI_ENGINE_TYPE_BODY
        )}
      >
        Coba muat ulang bagian ini. Data yang sudah tersimpan tidak diubah.
      </p>
      <Button
        type="button"
        onClick={unstable_retry}
        className={cn(
          "mt-[var(--ui-section-gap)] bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
          UI_ENGINE_RADIUS_ACTION
        )}
      >
        Coba lagi
      </Button>
    </section>
  );
}
