import { useId } from "react"
import { useTranslation } from "@/i18n"
import { cn } from "@/lib/utils"

export const RARITY_LEVELS = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const

export type RarityLevel = (typeof RARITY_LEVELS)[number]

const RARITY_LABEL_KEY: Record<RarityLevel, string> = {
  common: "BADGES_RARITY_COMMON",
  uncommon: "BADGES_RARITY_UNCOMMON",
  rare: "BADGES_RARITY_RARE",
  epic: "BADGES_RARITY_EPIC",
  legendary: "BADGES_RARITY_LEGENDARY",
}

const ORNAMENT: Record<RarityLevel, string> = {
  common: "ring",
  uncommon: "notched",
  rare: "double",
  epic: "points",
  legendary: "crown",
}

type RarityBadgeProps = {
  name: string
  rarity: RarityLevel
  size?: number
  className?: string
}

export function RarityBadge({
  name,
  rarity,
  size = 48,
  className,
}: RarityBadgeProps) {
  const { t } = useTranslation()
  const rawId = useId().replace(/:/g, "")
  const gradientId = `sd-rarity-${rarity}-${rawId}`
  const label = t(RARITY_LABEL_KEY[rarity])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${name}, ${label}`}
      data-slot="rarity-badge"
      data-rarity={rarity}
      data-ornament={ORNAMENT[rarity]}
      className={cn(rarity === "legendary" && "sd-rarity-glow", className)}
      style={{ ["--rarity-badge-size" as string]: `${size}px` }}
    >
      <title>{`${name}, ${label}`}</title>
      <RarityFrame rarity={rarity} gradientId={gradientId} />
    </svg>
  )
}

function RarityFrame({
  rarity,
  gradientId,
}: {
  rarity: RarityLevel
  gradientId: string
}) {
  if (rarity === "common") {
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E7E5E4" />
            <stop offset="0.55" stopColor="#A8A29E" />
            <stop offset="1" stopColor="#57534E" />
          </linearGradient>
        </defs>
        <polygon
          points="24.00,7.40 40.11,16.70 40.11,35.30 24.00,44.60 7.89,35.30 7.89,16.70"
          fill="#15110E"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.6"
        />
      </>
    )
  }

  if (rarity === "uncommon") {
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#BBF7D0" />
            <stop offset="0.55" stopColor="#4ADE80" />
            <stop offset="1" stopColor="#15803D" />
          </linearGradient>
        </defs>
        <polygon
          points="21.23,9.00 24.00,10.28 26.77,9.00 37.34,15.10 37.61,18.14 40.11,19.90 40.11,32.10 37.61,33.86 37.34,36.90 26.77,43.00 24.00,41.72 21.23,43.00 10.66,36.90 10.39,33.86 7.89,32.10 7.89,19.90 10.39,18.14 10.66,15.10"
          fill="#15110E"
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
        />
      </>
    )
  }

  if (rarity === "rare") {
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#BAE6FD" />
            <stop offset="0.55" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#0369A1" />
          </linearGradient>
        </defs>
        <polygon
          points="24.00,7.00 40.45,16.50 40.45,35.50 24.00,45.00 7.55,35.50 7.55,16.50"
          fill="#15110E"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.6"
        />
        <polygon
          points="24.00,11.20 36.82,18.60 36.82,33.40 24.00,40.80 11.18,33.40 11.18,18.60"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="1.7"
          strokeOpacity="0.9"
        />
      </>
    )
  }

  if (rarity === "epic") {
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FBCFE8" />
            <stop offset="0.55" stopColor="#F472B6" />
            <stop offset="1" stopColor="#9D174D" />
          </linearGradient>
        </defs>
        <path d="M20.60 7.40 L24.00 2.56 L27.40 7.40z" fill={`url(#${gradientId})`} />
        <path d="M38.41 13.76 L44.30 14.28 L41.81 19.64z" fill={`url(#${gradientId})`} />
        <path d="M41.81 32.36 L44.30 37.72 L38.41 38.24z" fill={`url(#${gradientId})`} />
        <path d="M27.40 44.60 L24.00 49.44 L20.60 44.60z" fill={`url(#${gradientId})`} />
        <path d="M9.59 38.24 L3.70 37.72 L6.19 32.36z" fill={`url(#${gradientId})`} />
        <path d="M6.19 19.64 L3.70 14.28 L9.59 13.76z" fill={`url(#${gradientId})`} />
        <polygon
          points="24.00,7.00 40.45,16.50 40.45,35.50 24.00,45.00 7.55,35.50 7.55,16.50"
          fill="#15110E"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.6"
        />
        <polygon
          points="24.00,11.20 36.82,18.60 36.82,33.40 24.00,40.80 11.18,33.40 11.18,18.60"
          fill="none"
          stroke="#F472B6"
          strokeWidth="1.7"
          strokeOpacity="0.9"
        />
      </>
    )
  }

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="0.55" stopColor="#FBBF24" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <g className="sd-rarity-rays" data-rarity-rays="">
        <path d="M24 26 L33.4 5.0 L37.5 7.4z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L42.6 12.5 L45.0 16.6z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L46.9 23.6 L46.9 28.4z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L45.0 35.4 L42.6 39.5z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L37.5 44.6 L33.4 47.0z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L26.4 48.9 L21.6 48.9z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L14.6 47.0 L10.5 44.6z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L5.4 39.5 L3.0 35.4z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L1.1 28.4 L1.1 23.6z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L3.0 16.6 L5.4 12.5z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L10.5 7.4 L14.6 5.0z" fill="#FBBF24" fillOpacity="0.28" />
        <path d="M24 26 L21.6 3.1 L26.4 3.1z" fill="#FBBF24" fillOpacity="0.28" />
      </g>
      <path d="M38.41 13.76 L44.30 14.28 L41.81 19.64z" fill={`url(#${gradientId})`} />
      <path d="M41.81 32.36 L44.30 37.72 L38.41 38.24z" fill={`url(#${gradientId})`} />
      <path d="M27.40 44.60 L24.00 49.44 L20.60 44.60z" fill={`url(#${gradientId})`} />
      <path d="M9.59 38.24 L3.70 37.72 L6.19 32.36z" fill={`url(#${gradientId})`} />
      <path d="M6.19 19.64 L3.70 14.28 L9.59 13.76z" fill={`url(#${gradientId})`} />
      <path
        d="M15.6 9.2 14.4 1.6 19.4 5.4 24 .4 28.6 5.4 33.6 1.6 32.4 9.2z"
        fill={`url(#${gradientId})`}
        stroke="#15110E"
        strokeWidth="1"
        data-rarity-crown=""
      />
      <polygon
        points="24.00,7.00 40.45,16.50 40.45,35.50 24.00,45.00 7.55,35.50 7.55,16.50"
        fill="#15110E"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
      />
      <polygon
        points="24.00,11.20 36.82,18.60 36.82,33.40 24.00,40.80 11.18,33.40 11.18,18.60"
        fill="none"
        stroke="#FBBF24"
        strokeWidth="1.7"
        strokeOpacity="0.9"
      />
    </>
  )
}
