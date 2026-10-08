import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "horizontal" | "symbol";
  className?: string;
}

/**
 * "claro" / "escuro" no nome do arquivo é o tema do fundo:
 * claro = wordmark escuro para fundo claro;
 * escuro = wordmark claro para fundo escuro.
 * A troca segue a classe `.dark` no documento (sem gravar preferência nova).
 */
const SOURCES = {
  horizontal: {
    light: "/brand/logo-horizontal-claro.svg",
    dark: "/brand/logo-horizontal-escuro.svg",
  },
  symbol: {
    light: "/brand/simbolo-claro.svg",
    dark: "/brand/simbolo-escuro.svg",
  },
} as const;

export function BrandLogo({
  variant = "horizontal",
  className,
}: BrandLogoProps) {
  const sources = SOURCES[variant];

  return (
    <span className="inline-flex items-center">
      <img
        src={sources.light}
        alt="Stream Drops"
        className={cn("dark:hidden", className)}
      />
      <img
        src={sources.dark}
        alt=""
        aria-hidden
        className={cn("hidden dark:block", className)}
      />
    </span>
  );
}
