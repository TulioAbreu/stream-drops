import type { AxiosError } from "axios";
import { CHANNEL_POINTS_MANAGE_SCOPE } from "@/lib/twitch-oauth";

export type TwitchBroadcasterType = "" | "affiliate" | "partner";

export type ChannelPointsAccessBlockReason =
  | "not_affiliate"
  | "missing_scope";

export function hasChannelPointsAccess(
  broadcasterType: string | null | undefined
): boolean {
  return broadcasterType === "affiliate" || broadcasterType === "partner";
}

export function hasChannelPointsManageScope(
  scopes: string[] | null | undefined
): boolean {
  return (scopes ?? []).includes(CHANNEL_POINTS_MANAGE_SCOPE);
}

export function getChannelPointsAccessBlock(params: {
  broadcasterType?: string | null;
  scopes?: string[] | null;
}): ChannelPointsAccessBlockReason | null {
  if (!hasChannelPointsManageScope(params.scopes)) {
    return "missing_scope";
  }

  if (!hasChannelPointsAccess(params.broadcasterType)) {
    return "not_affiliate";
  }

  return null;
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
  if (
    !error ||
    typeof error !== "object" ||
    !("isAxiosError" in error || "response" in error)
  ) {
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

  if (
    status === 401 ||
    message.includes("scope") ||
    message.includes("missing required scope") ||
    message.includes("authorization")
  ) {
    return "missing_scope";
  }

  if (
    message.includes("title") &&
    (message.includes("already") ||
      message.includes("unique") ||
      message.includes("exist"))
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
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_MISSING_SCOPE";
    case "title_taken":
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_TITLE_TAKEN";
    case "max_rewards":
      return "CHANNEL_POINTS_GIVEAWAY_ERROR_MAX_REWARDS";
    default:
      return "CHANNEL_POINTS_GIVEAWAY_CREATE_REWARD_ERROR";
  }
}

export function channelPointsAccessBlockI18nKeys(
  reason: ChannelPointsAccessBlockReason
): { title: string; description: string; toast: string } {
  if (reason === "missing_scope") {
    return {
      title: "CHANNEL_POINTS_GIVEAWAY_MISSING_SCOPE_TITLE",
      description: "CHANNEL_POINTS_GIVEAWAY_MISSING_SCOPE_DESCRIPTION",
      toast: "CHANNEL_POINTS_GIVEAWAY_ERROR_MISSING_SCOPE",
    };
  }

  return {
    title: "CHANNEL_POINTS_GIVEAWAY_ACCESS_DENIED_TITLE",
    description: "CHANNEL_POINTS_GIVEAWAY_ACCESS_DENIED_DESCRIPTION",
    toast: "CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AFFILIATE",
  };
}
