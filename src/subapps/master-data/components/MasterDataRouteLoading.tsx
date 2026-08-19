import { Skeleton, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD } from "@/ui_engine";
import { cn } from "@/lib/utils";

export function MasterDataRouteLoading() {
  return (
    <div className="flex flex-1 flex-col gap-[var(--ui-section-gap)]">
      <div className="flex items-center justify-between gap-[var(--ui-section-gap)]">
        <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
          <Skeleton className="h-[2rem] w-[16rem]" />
          <Skeleton className="h-[1rem] w-[24rem] max-w-full" />
        </div>
        <Skeleton className="h-[2.25rem] w-[8rem]" />
      </div>
      <div
        className={cn(
          "flex-1 border bg-white p-[var(--ui-section-py)]",
          UI_ENGINE_BORDER_SUBTLE,
          UI_ENGINE_RADIUS_CARD
        )}
      >
        <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-[3rem] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
