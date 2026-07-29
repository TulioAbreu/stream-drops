import type { AxiosError } from "axios";
import { err, ok, type Result } from "neverthrow";
import type { ChannelPointsParticipant } from "@/database/ChannelPointsGiveaway";
import type { TwitchApiClient } from "@/hooks/use-twitch-api";

export interface SettleChannelPointsOnCloseParams {
  twitchApiClient: TwitchApiClient;
  broadcasterId: string;
  rewardId: string;
  participants: ChannelPointsParticipant[];
  /** When true, FULFILL remaining eligible UNFULFILLED; otherwise CANCELED. */
  hasWinners: boolean;
}

const PAGE_SIZE = 50;
const BATCH_SIZE = 50;

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

/**
 * Settles remaining UNFULFILLED eligible redemptions on Encerrar:
 * - no winners → CANCELED (refund)
 * - ≥1 winner → FULFILLED for all eligible (consume)
 *
 * Refetches UNFULFILLED and intersects with known participant ticket IDs so
 * already-settled redemptions (legacy collects) are skipped safely.
 */
export async function settleChannelPointsOnClose(
  params: SettleChannelPointsOnCloseParams
): Promise<Result<{ settledCount: number }, AxiosError | Error>> {
  const {
    twitchApiClient,
    broadcasterId,
    rewardId,
    participants,
    hasWinners,
  } = params;

  const knownEligibleIds = new Set(
    participants.flatMap((p) => p.tickets.map((t) => t.redemptionId))
  );

  const unfulfilledIds: string[] = [];
  let cursor: string | undefined;

  do {
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

    for (const redemption of pageResult.value.data) {
      if (
        knownEligibleIds.size === 0 ||
        knownEligibleIds.has(redemption.id)
      ) {
        unfulfilledIds.push(redemption.id);
      }
    }

    cursor = pageResult.value.pagination?.cursor;
  } while (cursor);

  if (unfulfilledIds.length === 0) {
    return ok({ settledCount: 0 });
  }

  const status = hasWinners ? "FULFILLED" : "CANCELED";
  const settleResult = await updateRedemptionsInBatches(
    twitchApiClient,
    broadcasterId,
    rewardId,
    unfulfilledIds,
    status
  );

  if (settleResult.isErr()) {
    return err(settleResult.error);
  }

  return ok({ settledCount: unfulfilledIds.length });
}
