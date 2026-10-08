import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { LoaderCircleIcon } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--sd-radius-md)] text-sm font-semibold transition-[background,box-shadow] duration-[var(--sd-dur-fast)] ease-[var(--sd-ease-standard)] disabled:pointer-events-none disabled:opacity-[0.45] disabled:shadow-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:shadow-[var(--sd-focus)] aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_var(--sd-danger-soft)] hover:cursor-pointer disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default:
          "sd-btn-primary bg-primary text-primary-foreground",
        destructive:
          "bg-[#DC2626] text-white shadow-xs hover:bg-[#B91C1C]",
        outline:
          "border border-[var(--sd-border-strong)] bg-transparent text-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground shadow-none hover:border-[var(--sd-border-strong)] hover:bg-[var(--sd-surface-3)]",
        ghost:
          "hover:bg-muted hover:text-foreground",
        link: "text-[var(--sd-brand-amber-strong)] underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-9 px-3.5 has-[>svg]:px-3",
        sm: "h-[30px] rounded-[var(--sd-radius-sm)] gap-1.5 px-2.5 text-[13px] has-[>svg]:px-2",
        lg: "h-[42px] px-[18px] text-[15px] has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  loading,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  const { children, ...rest } = props;

  if (loading) {
    rest.disabled = true
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...rest}
    >
      {loading ? <LoaderCircleIcon className="animate-spin" /> : children}
    </Comp>
  )
}

export { Button, buttonVariants }
