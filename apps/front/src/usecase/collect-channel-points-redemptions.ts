import type { AxiosError } from "axios";
import { err, ok, type Result } from "neverthrow";
import type {
  ChannelPointsParticipant,
  ChannelPointsRedemptionTicket,
} from "@/database/ChannelPointsGiveaway";
import type { TwitchApiClient } from "@/hooks/use-twitch-api";
import type { TwitchCustomRewardRedemption } from "@/service/twitch/types";

export interface CollectionProgress {
  loaded: number;
  page: number;
  phase: "fetching" | "enriching" | "settling";
}

export interface CollectChannelPointsRedemptionsParams {
  twitchApiClient: TwitchApiClient;
  broadcasterId: string;
  rewardId: string;
  subscribersOnly: boolean;
  subscriptionRequirement: number;
  refundIneligible: boolean;
  excludedUserIds: Set<string>;
  onProgress?: (progress: CollectionProgress) => void;
}

export interface CollectChannelPointsRedemptionsResult {
  participants: ChannelPointsParticipant[];
  totalRedemptions: number;
  eligibleCount: number;
  ineligibleCount: number;
}

const PAGE_SIZE = 50;
const BATCH_SIZE = 50;
const USER_BATCH_SIZE = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<Result<T, AxiosError>>,
  maxAttempts = 3
): Promise<Result<T, AxiosError>> {
  let lastError: Result<T, AxiosError> | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await fn();
    if (result.isOk()) {
      return result;
    }

    lastError = result;
    const status = result.error.response?.status;
    if (status === 429 || (status !== undefined && status >= 500)) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    return result;
  }

  return lastError ?? err(new Error("Retry failed") as unknown as AxiosError);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isEligible(
  userId: string,
  tier: number | null | undefined,
  subscribersOnly: boolean,
  subscriptionRequirement: number,
  excludedUserIds: Set<string>
): boolean {
  if (excludedUserIds.has(userId)) {
    return false;
  }

  if (!subscribersOnly) {
    return true;
  }

  if (tier == null) {
    return false;
  }

  return Number(tier) >= subscriptionRequirement;
}

async function updateRedemptionsInBatches(
  twitchApiClient: TwitchApiClient,
  broadcasterId: string,
  rewardId: string,
  redemptionIds: string[],
  status: "FULFILLED" | "CANCELED"
): Promise<Result<void, AxiosError>> {
  const batches = chunkArray(redemptionIds, BATCH_SIZE);

  for (const batch of batches) {
    if (batch.length === 0) continue;

    const result = await withRetry(() =>
      twitchApiClient.updateRedemptionsStatus({
        broadcaster_id: broadcasterId,
        reward_id: rewardId,
        ids: batch,
        status,
      })
    );

    if (result.isErr()) {
      return err(result.error);
    }
  }

  return ok(undefined);
}

export async function collectChannelPointsRedemptions(
  params: CollectChannelPointsRedemptionsParams
): Promise<Result<CollectChannelPointsRedemptionsResult, AxiosError | Error>> {
  const {
    twitchApiClient,
    broadcasterId,
    rewardId,
    subscribersOnly,
    subscriptionRequirement,
    refundIneligible,
    excludedUserIds,
    onProgress,
  } = params;

  const allRedemptions: TwitchCustomRewardRedemption[] = [];
  let cursor: string | undefined;
  let page = 0;

  do {
    page += 1;
    const pageResult = await withRetry(() =>
      twitchApiClient.getCustomRewardRedemptions({
        broadcaster_id: broadcasterId,
        reward_id: rewardId,
        status: "UNFULFILLED",
        first: PAGE_SIZE,
        after: cursor,
        sort: "OLDEST",
      })
    );

    if (pageResult.isErr()) {
      return err(pageResult.error);
    }

    allRedemptions.push(...pageResult.value.data);
    cursor = pageResult.value.pagination?.cursor;

    onProgress?.({
      loaded: allRedemptions.length,
      page,
      phase: "fetching",
    });
  } while (cursor);

  if (allRedemptions.length === 0) {
    return ok({
      participants: [],
      totalRedemptions: 0,
      eligibleCount: 0,
      ineligibleCount: 0,
    });
  }

  onProgress?.({
    loaded: allRedemptions.length,
    page,
    phase: "enriching",
  });

  const uniqueUserIds = [...new Set(allRedemptions.map((r) => r.user_id))];
  const userMap = new Map<
    string,
    { login: string; displayName: string; avatar: string }
  >();
  const tierMap = new Map<string, number | null>();

  for (const userIds of chunkArray(uniqueUserIds, USER_BATCH_SIZE)) {
    const usersResult = await withRetry(() =>
      twitchApiClient.fetchUsersByIds(userIds)
    );
    if (usersResult.isErr()) {
      return err(usersResult.error);
    }

    usersResult.value.forEach((user, id) => {
      userMap.set(id, {
        login: user.login,
        displayName: user.display_name,
        avatar: user.profile_image_url,
      });
    });

    const subsResult = await withRetry(() =>
      twitchApiClient.fetchSubscriptionsByUserIds(broadcasterId, userIds)
    );
    if (subsResult.isErr()) {
      return err(subsResult.error);
    }

    subsResult.value.forEach((tier, id) => {
      tierMap.set(id, tier);
    });
  }

  const eligibleIds: string[] = [];
  const ineligibleIds: string[] = [];
  const participantsByUser = new Map<string, ChannelPointsParticipant>();

  for (const redemption of allRedemptions) {
    const tier = tierMap.get(redemption.user_id) ?? null;
    const eligible = isEligible(
      redemption.user_id,
      tier,
      subscribersOnly,
      subscriptionRequirement,
      excludedUserIds
    );

    if (eligible) {
      eligibleIds.push(redemption.id);

      const existing = participantsByUser.get(redemption.user_id);
      const ticket: ChannelPointsRedemptionTicket = {
        redemptionId: redemption.id,
        redeemedAt: redemption.redeemed_at,
      };

      if (existing) {
        existing.tickets.push(ticket);
      } else {
        const user = userMap.get(redemption.user_id);
        participantsByUser.set(redemption.user_id, {
          userId: redemption.user_id,
          name: user?.login ?? redemption.user_login,
          displayName: user?.displayName ?? redemption.user_name,
          avatar: user?.avatar ?? "",
          subscriber: tier != null,
          tier: (tier as 1000 | 2000 | 3000 | null) ?? null,
          tickets: [ticket],
        });
      }
    } else {
      ineligibleIds.push(redemption.id);
    }
  }

  onProgress?.({
    loaded: allRedemptions.length,
    page,
    phase: "settling",
  });

  // Eligible redemptions stay UNFULFILLED until Encerrar (CANCELED or FULFILLED).
  const ineligibleStatus = refundIneligible ? "CANCELED" : "FULFILLED";
  const settleIneligible = await updateRedemptionsInBatches(
    twitchApiClient,
    broadcasterId,
    rewardId,
    ineligibleIds,
    ineligibleStatus
  );
  if (settleIneligible.isErr()) {
    return err(settleIneligible.error);
  }

  const participants = [...participantsByUser.values()].sort(
    (a, b) => b.tickets.length - a.tickets.length
  );

  return ok({
    participants,
    totalRedemptions: allRedemptions.length,
    eligibleCount: eligibleIds.length,
    ineligibleCount: ineligibleIds.length,
  });
}
