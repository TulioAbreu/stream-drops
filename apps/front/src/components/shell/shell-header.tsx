interface ShellHeaderProps {
  section: string;
  page: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function ShellHeader({
  section,
  page,
  title,
  description,
  actions,
  children,
}: ShellHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
          {section}
          {" / "}
          <span className="text-[var(--sd-brand-amber-strong)]">{page}</span>
        </p>
        <h1 className="mt-1.5 font-display text-[30px] leading-[1.15] font-extrabold">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
