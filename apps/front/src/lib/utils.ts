import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatChancePercentage(value: number, decimalPlaces = 4) {
  const rounded = Number(value.toFixed(decimalPlaces))
  if (rounded === 0 && value > 0) {
    const minDisplay = (1 / Math.pow(10, decimalPlaces)).toFixed(decimalPlaces)
    return `<${minDisplay}%`
  }
  return `${value.toFixed(decimalPlaces)}%`
}

/**
 * Composes a Twitch chat embed URL for the given channel
 * @param channelLogin The Twitch channel login name
 * @returns The complete embed URL with parent parameter and dark mode enabled
 */
export function composeTwitchChatEmbedUrl(channelLogin: string): string {
  const url = new URL(`https://www.twitch.tv/embed/${channelLogin}/chat`)
  url.searchParams.set('parent', window.location.hostname)
  url.searchParams.set('darkpopout', 'true')
  return url.toString()
}
