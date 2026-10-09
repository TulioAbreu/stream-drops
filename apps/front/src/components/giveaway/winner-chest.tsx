import { useId } from "react";
import type { DropRarity } from "./winner-reveal";

const GEM: Record<DropRarity, { lt: string; md: string; dk: string }> = {
  common: { lt: "#E7E5E4", md: "#A8A29E", dk: "#57534E" },
  rare: { lt: "#BAE6FD", md: "#38BDF8", dk: "#0369A1" },
  epic: { lt: "#FBCFE8", md: "#F472B6", dk: "#9D174D" },
  legendary: { lt: "#FDE68A", md: "#FBBF24", dk: "#B45309" },
};

export function WinnerChest({ rarity }: { rarity: DropRarity }) {
  const gem = GEM[rarity];
  return (
    <svg className="sd-chest" viewBox="-8 -20 80 84" aria-hidden="true">
      <g className="b-all">
        <g className="b-breathe">
          <g className="b-feet">
            <ellipse cx="20" cy="61" rx="6" ry="3" fill="#C2410C" />
            <ellipse cx="44" cy="61" rx="6" ry="3" fill="#C2410C" />
          </g>
          <g className="b-armL">
            <path
              d="M10 46C6.2 47.6 4 51.2 3.6 55"
              fill="none"
              stroke="#F97316"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
            <circle cx="3.4" cy="56.6" r="3.4" fill="#FB923C" />
          </g>
          <g className="b-wave">
            <path
              d="M54 47C58.5 45 61 41 61.5 36"
              fill="none"
              stroke="#F97316"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
            <circle cx="61.6" cy="34.6" r="3.4" fill="#FB923C" />
          </g>
          <rect x="11" y="25" width="42" height="15" rx="3" fill="#1C1917" />
          <ellipse
            className="b-glow"
            cx="32"
            cy="39.2"
            rx="17"
            ry="2.2"
            fill={gem.lt}
            opacity="0"
          />
          <g className="b-eyes">
            <g className="b-eyeO">
              <ellipse cx="24" cy="33.6" rx="3.5" ry="3.7" fill="#FAFAFA" />
              <ellipse cx="40" cy="33.6" rx="3.5" ry="3.7" fill="#FAFAFA" />
              <g className="b-pup">
                <circle cx="24.6" cy="33.8" r="2" fill="#1C1917" />
                <circle cx="40.6" cy="33.8" r="2" fill="#1C1917" />
              </g>
            </g>
          </g>
          <g className="b-body">
            <path
              d="M9 40H55V53C55 56.9 51.9 60 48 60H16C12.1 60 9 56.9 9 53Z"
              fill="#FB923C"
            />
            <rect x="15" y="40" width="6" height="20" fill="#F97316" />
            <rect x="43" y="40" width="6" height="20" fill="#F97316" />
            <path
              d="M9 55H55V53.5C55 57.1 51.9 60 48 60H16C12.1 60 9 57.1 9 53.5Z"
              fill="#EA580C"
              opacity=".6"
            />
            <rect x="7" y="38" width="50" height="5" rx="2.5" fill="#FBBF24" />
            <rect x="27" y="42" width="10" height="10.5" rx="2.6" fill="#27272A" />
            <circle cx="32" cy="46.2" r="1.9" fill="#FBBF24" />
            <rect x="31.1" y="46.2" width="1.8" height="3.8" rx=".9" fill="#FBBF24" />
            <ellipse cx="12.5" cy="48.5" rx="2.2" ry="1.5" fill="#FECDD3" opacity=".85" />
            <ellipse cx="51.5" cy="48.5" rx="2.2" ry="1.5" fill="#FECDD3" opacity=".85" />
          </g>
          <g className="b-lid">
            <path
              d="M9 29V17C9 11.5 13 8 19 8H45C51 8 55 11.5 55 17V29Z"
              fill="#FBBF24"
            />
            <path d="M15 8H21V29H15ZM43 8H49V29H43Z" fill="#F59E0B" />
            <path
              d="M13.5 20C13.5 15.5 15.5 12.6 20 12.4"
              fill="none"
              stroke="#FDE68A"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <rect x="9" y="26" width="46" height="4" rx="2" fill="#D97706" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function WinnerGem({ rarity }: { rarity: DropRarity }) {
  const gem = GEM[rarity];
  const raw = useId().replace(/:/g, "");
  const clipId = `winner-gem-${raw}`;
  return (
    <svg className="sd-winner-gem-svg" viewBox="-22 -22 44 44" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d="M-9.72 -17L9.72 -17L18 -5.44L0 17L-18 -5.44Z" />
        </clipPath>
      </defs>
      <path
        d="M-9.72 -17L9.72 -17L18 -5.44L0 17L-18 -5.44Z"
        fill={gem.md}
        stroke="#15110E"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M-9.72 -17L9.72 -17L18 -5.44L-18 -5.44Z" fill={gem.lt} />
      <path d="M6.12 -5.44L18 -5.44L0 17Z" fill={gem.dk} />
      <path d="M9.72 -17L18 -5.44L6.12 -5.44Z" fill={gem.md} />
      <path d="M-9.72 -17L-6.12 -5.44L-18 -5.44Z" fill="#fff" opacity=".55" />
      <path d="M-6.12 -5.44L6.12 -5.44L0 17Z" fill={gem.md} />
      <path d="M-18 -5.44L-6.12 -5.44L0 17Z" fill={gem.lt} opacity=".45" />
      <g clipPath={`url(#${clipId})`}>
        <rect className="g-shine" x="-6" y="-24" width="9" height="48" fill="#fff" opacity="0" />
      </g>
      <path
        d="M-9.72 -17L9.72 -17L18 -5.44L0 17L-18 -5.44Z"
        fill="none"
        stroke="#15110E"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WinnerSpark({ color }: { color: string }) {
  return (
    <svg viewBox="-6 -6 12 12" aria-hidden="true" className="size-full">
      <path
        d="M0 -5.6C.65 -.65 .65 -.65 5.6 0C.65 .65 .65 .65 0 5.6C-.65 .65 -.65 .65 -5.6 0C-.65 -.65 -.65 -.65 0 -5.6Z"
        fill={color}
      />
    </svg>
  );
}

export function gemColor(rarity: DropRarity): string {
  return GEM[rarity].lt;
}

export function gemMid(rarity: DropRarity): string {
  return GEM[rarity].md;
}
