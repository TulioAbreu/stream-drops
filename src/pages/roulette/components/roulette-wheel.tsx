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

/** Imagem 1x1 transparente — esconde o ponteiro nativo da lib */
const HIDDEN_POINTER_SRC =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`
  );

/**
 * A lib posiciona o ponteiro no canto superior-direito do quadrado (~1–2h)
 * e calibra o ângulo do vencedor para esse eixo (~43°).
 *
 * Estratégia anti-desync:
 * 1. Escondemos o ponteiro nativo
 * 2. Giramos o wheel inteiro ~-60° para mapear esse eixo para as 12h
 * 3. Desenhamos nossa seta fixa no topo (fora do rotate)
 *
 * Assim a fatia sob a seta continua sendo exatamente o prizeNumber.
 */
const LIB_POINTER_TO_TOP_DEG = -60;

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
          {t(
            "ROULETTE_EMPTY_WHEEL_HINT",
            "Adicione opções ao lado para montar a roleta"
          )}
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
      {/* Seta fixa no topo (12h) — não gira com a roleta */}
      <div className="roulette-pointer-fixed" aria-hidden>
        <svg
          viewBox="0 0 48 48"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="roulette-pointer-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <path
            d="M24 44 L6 8 L42 8 Z"
            fill="url(#roulette-pointer-grad)"
            stroke="#fbbf24"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="roulette-wheel-glow" aria-hidden />

      <div className="roulette-wheel-frame">
        <div
          className="roulette-wheel-orient"
          style={{ transform: `rotate(${LIB_POINTER_TO_TOP_DEG}deg)` }}
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
            fontSize={options.length > 12 ? 12 : options.length > 8 ? 14 : 16}
            fontWeight={700}
            textDistance={58}
            spinDuration={0.55}
            disableInitialAnimation
            pointerProps={{
              src: HIDDEN_POINTER_SRC,
              style: {
                opacity: 0,
                width: 0,
                height: 0,
                pointerEvents: "none",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
