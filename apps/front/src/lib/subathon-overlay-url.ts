const PRODUCTION_APP_ORIGIN = "https://stream-drops.vercel.app";

/** URL pública do front — overlay OBS sempre aponta para o site oficial. */
export function getPublicAppOrigin(): string {
  return import.meta.env.VITE_PUBLIC_APP_URL ?? PRODUCTION_APP_ORIGIN;
}

export function getSubathonOverlayPath() {
  return "/subathon-overlay";
}

export function getSubathonOverlayUrl() {
  return `${getPublicAppOrigin()}${getSubathonOverlayPath()}`;
}
