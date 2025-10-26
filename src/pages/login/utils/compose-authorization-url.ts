const TWITCH_ID_API_BASE_URL = "https://id.twitch.tv";
const TWITCH_ID_API_AUTHORIZE_PATH = "/oauth2/authorize";

export function composeTwitchAuthorizationURL(params: {
    twitchClientId: string,
    redirectUri: string,
    scope: string,
}): URL {
    const url = new URL(TWITCH_ID_API_AUTHORIZE_PATH, TWITCH_ID_API_BASE_URL);

    url.searchParams.set("client_id", params.twitchClientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("response_type", "token");
    url.searchParams.set("scope", params.scope);

    return url;
}
