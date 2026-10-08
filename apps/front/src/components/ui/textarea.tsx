import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "sd-field border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-[var(--sd-focus)] aria-invalid:border-[var(--sd-danger)] aria-invalid:shadow-[0_0_0_3px_var(--sd-danger-soft)] flex field-sizing-content min-h-24 w-full rounded-[var(--sd-radius-md)] border px-3 py-2.5 font-mono text-[13px] leading-relaxed shadow-none transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-[0.45]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
