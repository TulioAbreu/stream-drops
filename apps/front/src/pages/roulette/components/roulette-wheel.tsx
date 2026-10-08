import { useEffect, useMemo, useState } from "react";
import { Wheel } from "react-custom-roulette";
import { Disc3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  SLICE_TOKENS,
  TEXT_TOKENS,
  pointerSrc,
  readToken,
  slicePaint,
} from "./roulette-palette";

/** Canto superior-direito → 12h. Issues #94/#126 da react-custom-roulette. */
const ORIENT_TO_TOP_DEG = -45;
const SPIN_DURATION = 0.55;
const SPIN_DURATION_REDUCED = 0.01;

interface RouletteWheelProps {
  options: string[];
  mustSpin: boolean;
  prizeIndex: number;
  onStopSpinning: () => void;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RouletteWheel({
  options,
  mustSpin,
  prizeIndex,
  onStopSpinning,
  className,
}: RouletteWheelProps) {
  const { t } = useTranslation();
  const [paletteTick, setPaletteTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setPaletteTick((tick) => tick + 1);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const palette = useMemo(() => {
    const fills = SLICE_TOKENS.map(readToken).filter(Boolean);
    const inks = TEXT_TOKENS.map(readToken).filter(Boolean);
    const border = readToken("--sd-brand-wood") || readToken("--border");
    const hub = readToken("--primary") || fills[0] || "";
    const line = readToken("--background") || readToken("--card");
    const pointerFill = readToken("--primary") || fills[0] || "";
    const pointerStroke = readToken("--sd-brand-wood") || inks[0] || "";
    return { fills, inks, border, hub, line, pointerFill, pointerStroke };
    // paletteTick relê os tokens quando o tema troca de classe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteTick]);

  const data = useMemo(
    () =>
      options.map((option, index) => {
        const fill =
          palette.fills[index % Math.max(palette.fills.length, 1)] ?? "";
        const paint = slicePaint(fill, palette.inks);
        return {
          option: option.length > 18 ? `${option.slice(0, 16)}…` : option,
          style: {
            backgroundColor: paint.background,
            textColor: paint.text,
          },
        };
      }),
    [options, palette]
  );

  if (options.length === 0) {
    return (
      <div
        className={cn(
          "roulette-wheel-shell roulette-wheel-shell--empty relative mx-auto flex flex-col items-center justify-center rounded-full border border-dashed border-border bg-card text-center",
          className
        )}
      >
        <Disc3 className="mb-3 h-14 w-14 text-muted-foreground" />
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
    <div
      className={cn("roulette-wheel-shell relative mx-auto", className)}
      data-roulette-wheel
      data-motion={reducedMotion ? "reduced" : "full"}
    >
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
            backgroundColors={palette.fills}
            textColors={palette.inks}
            outerBorderColor={palette.border}
            outerBorderWidth={8}
            innerRadius={12}
            innerBorderColor={palette.hub}
            innerBorderWidth={4}
            radiusLineColor={palette.line}
            radiusLineWidth={2}
            fontFamily="sans-serif"
            fontSize={options.length > 16 ? 13 : options.length > 10 ? 15 : 18}
            fontWeight={700}
            textDistance={58}
            spinDuration={reducedMotion ? SPIN_DURATION_REDUCED : SPIN_DURATION}
            disableInitialAnimation
            pointerProps={{
              src: pointerSrc(palette.pointerFill, palette.pointerStroke),
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
