import { useMemo } from "react";
import { Wheel } from "react-custom-roulette";
import { Disc3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Paleta alinhada ao frame de vencedor (laranja / dourado / violeta / ciano) */
const SEGMENT_COLORS = [
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#c026d3",
  "#2563eb",
  "#d97706",
];

/**
 * Seta desenhada apontando para BAIXO.
 * O container gira -45° (eixo nativo da lib → topo). Contra-rotacionamos
 * a imagem em +45° para ela continuar apontando para o centro, sem parecer
 * “tortinha” em relação à página.
 */
const POINTER_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <path
    d="M32 58 L8 10 L56 10 Z"
    fill="url(#g)"
    stroke="#fbbf24"
    stroke-width="4"
    stroke-linejoin="round"
  />
</svg>
`);

/** Canto superior-direito → 12h. Issues #94/#126 da react-custom-roulette. */
const ORIENT_TO_TOP_DEG = -45;

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
          "roulette-wheel-shell roulette-wheel-shell--empty relative mx-auto flex flex-col items-center justify-center rounded-full border border-dashed border-violet-500/40 bg-gradient-to-br from-violet-950/40 via-slate-950 to-cyan-950/30 text-center",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-[10%] rounded-full border border-cyan-400/10" />
        <Disc3 className="mb-3 h-14 w-14 text-violet-400/70" />
        <p className="max-w-[240px] px-4 text-sm text-muted-foreground">
          {t(
            "ROULETTE_EMPTY_WHEEL_HINT",
            "Adicione opções ao lado para montar a roleta"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("roulette-wheel-shell relative mx-auto", className)}>
      <div className="roulette-wheel-frame">
        <div
          className="roulette-wheel-orient"
          style={{ transform: `rotate(${ORIENT_TO_TOP_DEG}deg)` }}
        >
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
            fontFamily="Helvetica"
            fontSize={options.length > 16 ? 13 : options.length > 10 ? 15 : 18}
            fontWeight={700}
            textDistance={58}
            spinDuration={0.55}
            disableInitialAnimation
            pointerProps={{
              src: POINTER_SRC,
              style: {
                width: "15%",
                right: "1%",
                top: "1%",
                zIndex: 6,
                transform: `rotate(${-ORIENT_TO_TOP_DEG}deg)`,
                transformOrigin: "center center",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
