import type { AxiosError } from "axios";

export type TwitchBroadcasterType = "" | "affiliate" | "partner";

export function hasChannelPointsAccess(
  broadcasterType: string | null | undefined
): boolean {
  return broadcasterType === "affiliate" || broadcasterType === "partner";
}

type TwitchErrorBody = {
  message?: string;
  error?: string;
  status?: number;
};

export type ChannelPointsApiErrorKind =
  | "not_affiliate"
  | "missing_scope"
  | "title_taken"
  | "max_rewards"
  | "generic";

export function classifyChannelPointsApiError(
  error: AxiosError<TwitchErrorBody> | unknown
): ChannelPointsApiErrorKind {
  if (!error || typeof error !== "object" || !("isAxiosError" in error || "response" in error)) {
    return "generic";
  }

  const axiosError = error as AxiosError<TwitchErrorBody>;
  const status = axiosError.response?.status;
  const message = (axiosError.response?.data?.message ?? "").toLowerCase();

  if (
    message.includes("partner or affiliate") ||
    message.includes("channel points are not available") ||
    message.includes("doesn't have partner or affiliate")
  ) {
    return "not_affiliate";
  }

  if (status === 401 || message.includes("scope") || message.includes("authorization")) {
    return "missing_scope";
  }

  if (
    message.includes("title") &&
    (message.includes("already") || message.includes("unique") || message.includes("exist"))
  ) {
    return "title_taken";
  }

  if (
    message.includes("maximum") ||
    (message.includes("max") && message.includes("reward")) ||
    (message.includes("50") && message.includes("reward"))
  ) {
    return "max_rewards";
  }

  if (status === 403) {
    return "not_affiliate";
  }

  return "generic";
}

export function channelPointsErrorI18nKey(
  kind: ChannelPointsApiErrorKind
): string {
  switch (kind) {
    case "not_affiliate":
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AFFILIATE";
    case "missing_scope":
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AUTHENTICATED";
    case "title_taken":
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_TITLE_TAKEN";
    case "max_rewards":
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_MAX_REWARDS";
    default:
      return "CHANNEL_POINTS_GIVEAWAY_CREATE_REWARD_ERROR";
  }
}
