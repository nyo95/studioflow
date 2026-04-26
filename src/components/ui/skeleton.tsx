import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-slate-200/60 rounded-[var(--ui-radius-control,0.5rem)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
