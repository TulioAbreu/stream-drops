import { useMemo } from "react";
import { Wheel } from "react-custom-roulette";
import { Disc3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Paleta alinhada ao frame de vencedor (laranja / dourado / violeta / ciano) */
const SEGMENT_COLORS = [
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#ea580c", // orange
  "#4f46e5", // indigo
  "#0d9488", // teal
  "#c026d3", // fuchsia
  "#2563eb", // blue
  "#d97706", // amber
];

const POINTER_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#22d3ee" flood-opacity="0.85"/>
    </filter>
  </defs>
  <path d="M24 40 L8 8 L40 8 Z" fill="url(#g)" stroke="#fbbf24" stroke-width="2" filter="url(#glow)"/>
</svg>
`);

interface RouletteWheelProps {
  options: string[];
  mustSpin: boolean;
  prizeIndex: number;
  onStopSpinning: () => void;
  className?: string;
}

export function RouletteWheel({
  options,
  mustSpin,
  prizeIndex,
  onStopSpinning,
  className,
}: RouletteWheelProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () =>
      options.map((option, index) => ({
        option: option.length > 18 ? `${option.slice(0, 16)}…` : option,
        style: {
          backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
          textColor: "#f8fafc",
        },
      })),
    [options]
  );

  if (options.length === 0) {
    return (
      <div
        className={cn(
          "relative flex aspect-square w-full max-w-[420px] flex-col items-center justify-center rounded-full border border-dashed border-violet-500/40 bg-gradient-to-br from-violet-950/40 via-slate-950 to-cyan-950/30 text-center",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-6 rounded-full border border-cyan-400/10" />
        <Disc3 className="mb-3 h-12 w-12 text-violet-400/70" />
        <p className="max-w-[220px] px-4 text-sm text-muted-foreground">
          {t("ROULETTE_EMPTY_WHEEL_HINT", "Adicione opções ao lado para montar a roleta")}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "roulette-wheel-shell relative mx-auto w-full max-w-[420px]",
        className
      )}
    >
      <div className="roulette-wheel-glow" aria-hidden />
      <div className="relative z-10 flex justify-center [&_img]:drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]">
        <Wheel
          mustStartSpinning={mustSpin}
          prizeNumber={Math.min(prizeIndex, options.length - 1)}
          data={data}
          onStopSpinning={onStopSpinning}
          backgroundColors={SEGMENT_COLORS}
          textColors={["#f8fafc"]}
          outerBorderColor="#1e1b4b"
          outerBorderWidth={8}
          innerRadius={12}
          innerBorderColor="#22d3ee"
          innerBorderWidth={4}
          radiusLineColor="#0f172a"
          radiusLineWidth={2}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize={options.length > 12 ? 12 : options.length > 8 ? 14 : 16}
          fontWeight={700}
          textDistance={58}
          spinDuration={0.55}
          disableInitialAnimation
          pointerProps={{
            src: POINTER_SRC,
            style: {
              width: 42,
              height: 42,
              top: -8,
              filter: "drop-shadow(0 0 8px rgba(34, 211, 238, 0.7))",
            },
          }}
        />
      </div>
    </div>
  );
}
