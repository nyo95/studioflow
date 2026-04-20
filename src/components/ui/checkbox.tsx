"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-sm border border-slate-200 outline-none transition-all focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 data-[state=checked]:text-white",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="size-3" strokeWidth={4} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
