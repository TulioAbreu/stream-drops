import { cn } from "@/lib/utils";

interface InventoryPanelProps {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function InventoryPanel({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
}: InventoryPanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[14px] border border-border bg-card shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),var(--sd-shadow-1)]",
        className,
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <h2 className="text-[11.5px] font-bold tracking-[0.14em] uppercase">
          {title}
        </h2>
        {meta ? (
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            {meta}
          </span>
        ) : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
