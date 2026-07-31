export const CHANNEL_POINTS_MANAGE_SCOPE = "channel:manage:redemptions";

/** IRC scopes required by Subathon chat backup (tmi.js). */
export const CHAT_READ_SCOPE = "chat:read";
export const CHAT_EDIT_SCOPE = "chat:edit";

export const SUBATHON_TWITCH_SCOPES = [
  "channel:read:subscriptions",
  "bits:read",
  CHAT_READ_SCOPE,
  CHAT_EDIT_SCOPE,
] as const;

export const TWITCH_OAUTH_SCOPES = [
  "channel:read:subscriptions",
  "user:read:chat",
  "user:write:chat",
  CHAT_READ_SCOPE,
  CHAT_EDIT_SCOPE,
  "bits:read",
  CHANNEL_POINTS_MANAGE_SCOPE,
].join(" ");

export function hasSubathonTwitchScopes(
  scopes: string[] | null | undefined,
): boolean {
  const granted = new Set(scopes ?? []);
  return SUBATHON_TWITCH_SCOPES.every((scope) => granted.has(scope));
}

export const STUB_ACCESS_TOKEN = "stub-access-token";
export const TWITCH_STUB_ORIGIN = "http://localhost:4010";

export function isTwitchStubMode(): boolean {
  return import.meta.env.VITE_TWITCH_STUB === "true";
}

export function getTwitchHelixBaseUrl(): string {
  return isTwitchStubMode()
    ? `${TWITCH_STUB_ORIGIN}/helix`
    : "https://api.twitch.tv/helix";
}

export function getTwitchIdBaseUrl(): string {
  return isTwitchStubMode()
    ? `${TWITCH_STUB_ORIGIN}/oauth2`
    : "https://id.twitch.tv/oauth2";
}

export type TwitchAuthorizeOptions = {
  /**
   * Força a tela de consentimento da Twitch.
   * Necessário ao pedir scopes novos em cima de um token já autorizado.
   */
  forceVerify?: boolean;
};

function stripEnvQuotes(value: string | undefined): string {
  return String(value ?? "").replace(/^["']|["']$/g, "");
}

/**
 * Redirect OAuth deve bater com uma URI cadastrada no Twitch Console.
 * Em `vite dev`, prioriza `VITE_TWITCH_REDIRECT_URL` (localhost) para não
 * herdar origem de aba/popup antigo na Vercel.
 * Em produção, usa a origem atual (Vercel / preview).
 */
export function getTwitchRedirectUrl(): string {
  const fromEnv = stripEnvQuotes(import.meta.env.VITE_TWITCH_REDIRECT_URL);
  if (import.meta.env.DEV && fromEnv) {
    return fromEnv;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth`;
  }
  return fromEnv;
}

export function buildTwitchAuthorizeUrl(
  options: TwitchAuthorizeOptions = {}
): URL {
  const url = new URL("/oauth2/authorize", "https://id.twitch.tv");
  url.searchParams.set(
    "client_id",
    stripEnvQuotes(import.meta.env.VITE_TWITCH_CLIENT_ID),
  );
  url.searchParams.set("redirect_uri", getTwitchRedirectUrl());
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", TWITCH_OAUTH_SCOPES);
  if (options.forceVerify) {
    url.searchParams.set("force_verify", "true");
  }
  return url;
}

export function openTwitchLoginPopup(options: TwitchAuthorizeOptions = {}) {
  const authorizeUrl = buildTwitchAuthorizeUrl(options).toString();
  // Nome único: evita reaproveitar popup antigo ainda em stream-drops.vercel.app
  const popup = window.open(
    authorizeUrl,
    `twitch-login-${Date.now()}`,
    "width=500,height=700",
  );
  if (!popup) {
    console.warn(
      "[twitch-oauth] Popup bloqueado. URL seria:",
      authorizeUrl,
    );
  }
}
