export const CHANNEL_POINTS_MANAGE_SCOPE = "channel:manage:redemptions";

export const TWITCH_OAUTH_SCOPES = [
  "channel:read:subscriptions",
  "user:read:chat",
  "user:write:chat",
  CHANNEL_POINTS_MANAGE_SCOPE,
].join(" ");

export type TwitchAuthorizeOptions = {
  /**
   * Força a tela de consentimento da Twitch.
   * Necessário ao pedir scopes novos em cima de um token já autorizado.
   */
  forceVerify?: boolean;
};

export function buildTwitchAuthorizeUrl(
  options: TwitchAuthorizeOptions = {}
): URL {
  const url = new URL("/oauth2/authorize", "https://id.twitch.tv");
  url.searchParams.set("client_id", import.meta.env.VITE_TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", import.meta.env.VITE_TWITCH_REDIRECT_URL);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", TWITCH_OAUTH_SCOPES);
  if (options.forceVerify) {
    url.searchParams.set("force_verify", "true");
  }
  return url;
}

export function openTwitchLoginPopup(options: TwitchAuthorizeOptions = {}) {
  window.open(
    buildTwitchAuthorizeUrl(options).toString(),
    "twitch-login",
    "width=500,height=700"
  );
}
