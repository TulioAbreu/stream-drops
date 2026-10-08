import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=checked]:border-transparent data-[state=unchecked]:bg-input focus-visible:shadow-[var(--sd-focus)] inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-border shadow-none transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-[0.45]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)] ring-0 transition-transform data-[state=checked]:translate-x-[20px] data-[state=checked]:bg-[#1C1408] data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-[#FAF7F2]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
