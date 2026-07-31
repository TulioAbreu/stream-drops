export const STUB_SCOPES = [
  "channel:read:subscriptions",
  "user:read:chat",
  "user:write:chat",
  "channel:manage:redemptions",
];

export function getStubConfig() {
  return {
    port: Number(process.env.STUB_PORT ?? 4010),
    clientId:
      process.env.STUB_TWITCH_CLIENT_ID ?? "your_twitch_client_id",
    broadcasterId: process.env.STUB_BROADCASTER_ID ?? "stub-broadcaster-1",
    broadcasterLogin: process.env.STUB_BROADCASTER_LOGIN ?? "stub_partner",
    broadcasterDisplayName:
      process.env.STUB_BROADCASTER_DISPLAY_NAME ?? "Stub Partner",
  };
}

export type RedemptionStatus = "UNFULFILLED" | "FULFILLED" | "CANCELED";
export type SubscriptionTier = "1000" | "2000" | "3000";

export interface StubUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  email: string;
  created_at: string;
}

export interface StubReward {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  id: string;
  title: string;
  prompt: string;
  cost: number;
  image: null;
  default_image: {
    url_1x: string;
    url_2x: string;
    url_4x: string;
  };
  background_color: string;
  is_enabled: boolean;
  is_user_input_required: boolean;
  max_per_stream_setting: { is_enabled: boolean; max_per_stream: number };
  max_per_user_per_stream_setting: {
    is_enabled: boolean;
    max_per_user_per_stream: number;
  };
  global_cooldown_setting: {
    is_enabled: boolean;
    global_cooldown_seconds: number;
  };
  is_paused: boolean;
  is_in_stock: boolean;
  redemptions_redeemed_current_stream: number | null;
  cooldown_expires_at: string | null;
}

export interface StubRedemption {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input: string;
  status: RedemptionStatus;
  redeemed_at: string;
  reward: {
    id: string;
    title: string;
    prompt: string;
    cost: number;
  };
}
