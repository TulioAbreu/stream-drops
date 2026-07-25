/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TWITCH_CLIENT_ID: string;
  readonly VITE_TWITCH_REDIRECT_URL: string;
  readonly VITE_TWITCH_STUB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
