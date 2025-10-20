import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Composes a Twitch chat embed URL for the given channel
 * @param channelLogin The Twitch channel login name
 * @returns The complete embed URL with parent parameter
 */
export function composeTwitchChatEmbedUrl(channelLogin: string): string {
  const url = new URL(`https://www.twitch.tv/embed/${channelLogin}/chat`)
  url.searchParams.set('parent', window.location.hostname)
  return url.toString()
}
