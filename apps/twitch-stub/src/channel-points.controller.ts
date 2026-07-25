import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { TwitchStubStore } from "./twitch-stub.store";
import type { RedemptionStatus } from "./stub.types";

function asArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

@Controller("helix/channel_points/custom_rewards")
export class ChannelPointsController {
  constructor(private readonly store: TwitchStubStore) {}

  @Post()
  createReward(
    @Query("broadcaster_id") _broadcasterId: string,
    @Body()
    body: {
      title: string;
      cost: number;
      prompt?: string;
      is_enabled?: boolean;
      is_user_input_required?: boolean;
      should_redemptions_skip_request_queue?: boolean;
    }
  ) {
    const reward = this.store.createReward(body);
    return { data: [reward] };
  }

  @Patch()
  updateReward(
    @Query("broadcaster_id") _broadcasterId: string,
    @Query("id") id: string,
    @Body()
    body: Partial<{
      title: string;
      cost: number;
      prompt: string;
      is_paused: boolean;
      is_enabled: boolean;
    }>
  ) {
    const reward = this.store.updateReward(id, body);
    if (!reward) {
      throw new NotFoundException({
        error: "Not Found",
        status: 404,
        message: "Reward not found",
      });
    }
    return { data: [reward] };
  }

  @Delete()
  deleteReward(
    @Query("broadcaster_id") _broadcasterId: string,
    @Query("id") id: string
  ) {
    const deleted = this.store.deleteReward(id);
    if (!deleted) {
      throw new NotFoundException({
        error: "Not Found",
        status: 404,
        message: "Reward not found",
      });
    }
    return;
  }

  @Get("redemptions")
  getRedemptions(
    @Query("broadcaster_id") _broadcasterId: string,
    @Query("reward_id") rewardId: string,
    @Query("status") status: RedemptionStatus = "UNFULFILLED",
    @Query("first") first?: string,
    @Query("after") after?: string,
    @Query("sort") _sort?: string
  ) {
    if (!this.store.getReward(rewardId)) {
      throw new NotFoundException({
        error: "Not Found",
        status: 404,
        message: "Reward not found",
      });
    }

    return this.store.getRedemptions(
      rewardId,
      status,
      Number(first ?? 50) || 50,
      after
    );
  }

  @Patch("redemptions")
  updateRedemptions(
    @Query("broadcaster_id") _broadcasterId: string,
    @Query("reward_id") rewardId: string,
    @Query("id") id?: string | string[],
    @Body() body?: { status?: "FULFILLED" | "CANCELED" }
  ) {
    if (!this.store.getReward(rewardId)) {
      throw new NotFoundException({
        error: "Not Found",
        status: 404,
        message: "Reward not found",
      });
    }

    const ids = asArray(id);
    const status = body?.status ?? "FULFILLED";
    const data = this.store.updateRedemptionsStatus(rewardId, ids, status);
    return { data };
  }
}
