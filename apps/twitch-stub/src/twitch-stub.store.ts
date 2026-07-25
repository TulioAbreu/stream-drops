import { Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import {
  getStubConfig,
  type RedemptionStatus,
  type StubRedemption,
  type StubReward,
  type StubUser,
  type SubscriptionTier,
} from "./stub.types";

const FIRST_NAMES = [
  "Luna",
  "Kai",
  "Mira",
  "Rex",
  "Nova",
  "Ash",
  "Zoe",
  "Finn",
  "Ivy",
  "Leo",
  "Nina",
  "Omar",
  "Pia",
  "Quin",
  "Rae",
  "Sam",
  "Tess",
  "Uri",
  "Vee",
  "Wes",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function tierForUserId(userId: string): SubscriptionTier | null {
  const bucket = hashString(userId) % 100;
  if (bucket < 20) return null;
  if (bucket < 55) return "1000";
  if (bucket < 80) return "2000";
  return "3000";
}

function makeAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

@Injectable()
export class TwitchStubStore {
  private readonly config = getStubConfig();
  private readonly users = new Map<string, StubUser>();
  private readonly rewards = new Map<string, StubReward>();
  private readonly redemptionsByReward = new Map<string, StubRedemption[]>();
  private readonly seededRewards = new Set<string>();
  private readonly followerPool: StubUser[] = [];

  constructor() {
    this.ensureBroadcaster();
    this.seedFollowerPool(250);
  }

  getBroadcaster(): StubUser {
    return this.ensureBroadcaster();
  }

  ensureUser(userId: string, login?: string, displayName?: string): StubUser {
    const existing = this.users.get(userId);
    if (existing) return existing;

    const resolvedLogin =
      login ?? `viewer_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;
    const resolvedDisplay =
      displayName ??
      FIRST_NAMES[hashString(userId) % FIRST_NAMES.length] +
        String(hashString(userId) % 1000);

    const user: StubUser = {
      id: userId,
      login: resolvedLogin.toLowerCase(),
      display_name: resolvedDisplay,
      type: "",
      broadcaster_type: "",
      description: "Stub viewer",
      profile_image_url: makeAvatar(resolvedLogin),
      offline_image_url: "",
      view_count: 0,
      email: `${resolvedLogin}@stub.local`,
      created_at: new Date().toISOString(),
    };

    this.users.set(userId, user);
    this.users.set(`login:${user.login}`, user);
    return user;
  }

  getUsersByIds(ids: string[]): StubUser[] {
    return ids.map((id) => {
      if (id === this.config.broadcasterId) {
        return this.getBroadcaster();
      }
      return this.ensureUser(id);
    });
  }

  getUsersByLogins(logins: string[]): StubUser[] {
    return logins.map((login) => {
      const key = login.toLowerCase();
      if (key === this.config.broadcasterLogin) {
        return this.getBroadcaster();
      }
      const existing = this.users.get(`login:${key}`);
      if (existing) return existing;
      return this.ensureUser(`stub-user-${key}`, key, key);
    });
  }

  getSubscriptionTier(userIds: string[]): Map<string, SubscriptionTier | null> {
    const map = new Map<string, SubscriptionTier | null>();
    for (const userId of userIds) {
      map.set(userId, tierForUserId(userId));
    }
    return map;
  }

  listSubscriptionsPage(after?: string, first = 100) {
    const start = after ? Number(Buffer.from(after, "base64").toString()) || 0 : 0;
    const slice = this.followerPool.slice(start, start + first);
    const next = start + first;
    const cursor =
      next < this.followerPool.length
        ? Buffer.from(String(next)).toString("base64")
        : undefined;

    const broadcaster = this.getBroadcaster();
    const data = slice.map((user) => {
      const tier = tierForUserId(user.id) ?? "1000";
      return {
        broadcaster_id: broadcaster.id,
        broadcaster_login: broadcaster.login,
        broadcaster_name: broadcaster.display_name,
        gifter_id: "",
        gifter_login: "",
        is_gift: false,
        plan_name: `Channel Subscription (Tier ${Number(tier) / 1000})`,
        tier,
        user_id: user.id,
        user_name: user.display_name,
        user_login: user.login,
      };
    });

    return {
      data,
      pagination: cursor ? { cursor } : {},
      total: this.followerPool.length,
      points: this.followerPool.length,
    };
  }

  createReward(input: {
    title: string;
    cost: number;
    prompt?: string;
    is_enabled?: boolean;
    is_user_input_required?: boolean;
  }): StubReward {
    const broadcaster = this.getBroadcaster();
    const reward: StubReward = {
      broadcaster_id: broadcaster.id,
      broadcaster_login: broadcaster.login,
      broadcaster_name: broadcaster.display_name,
      id: uuidv7(),
      title: input.title,
      prompt: input.prompt ?? "",
      cost: input.cost,
      image: null,
      default_image: {
        url_1x: makeAvatar(input.title),
        url_2x: makeAvatar(input.title),
        url_4x: makeAvatar(input.title),
      },
      background_color: "#9146FF",
      is_enabled: input.is_enabled ?? true,
      is_user_input_required: input.is_user_input_required ?? false,
      max_per_stream_setting: { is_enabled: false, max_per_stream: 0 },
      max_per_user_per_stream_setting: {
        is_enabled: false,
        max_per_user_per_stream: 0,
      },
      global_cooldown_setting: {
        is_enabled: false,
        global_cooldown_seconds: 0,
      },
      is_paused: false,
      is_in_stock: true,
      redemptions_redeemed_current_stream: null,
      cooldown_expires_at: null,
    };

    this.rewards.set(reward.id, reward);
    this.redemptionsByReward.set(reward.id, []);
    return reward;
  }

  updateReward(
    id: string,
    patch: Partial<{
      title: string;
      cost: number;
      prompt: string;
      is_paused: boolean;
      is_enabled: boolean;
    }>
  ): StubReward | null {
    const reward = this.rewards.get(id);
    if (!reward) return null;
    Object.assign(reward, patch);
    return reward;
  }

  deleteReward(id: string): boolean {
    const existed = this.rewards.delete(id);
    this.redemptionsByReward.delete(id);
    this.seededRewards.delete(id);
    return existed;
  }

  getReward(id: string): StubReward | undefined {
    return this.rewards.get(id);
  }

  getRedemptions(
    rewardId: string,
    status: RedemptionStatus,
    first = 50,
    after?: string
  ) {
    this.ensureRedemptionsSeeded(rewardId);

    const all = (this.redemptionsByReward.get(rewardId) ?? []).filter(
      (r) => r.status === status
    );
    const pageSize = Math.min(Math.max(first, 1), 50);
    const start = after
      ? Number(Buffer.from(after, "base64").toString()) || 0
      : 0;
    const slice = all.slice(start, start + pageSize);
    const next = start + pageSize;
    const cursor =
      next < all.length ? Buffer.from(String(next)).toString("base64") : undefined;

    return {
      data: slice,
      pagination: cursor ? { cursor } : {},
    };
  }

  updateRedemptionsStatus(
    rewardId: string,
    ids: string[],
    status: "FULFILLED" | "CANCELED"
  ): StubRedemption[] {
    const list = this.redemptionsByReward.get(rewardId) ?? [];
    const updated: StubRedemption[] = [];

    for (const redemption of list) {
      if (ids.includes(redemption.id) && redemption.status === "UNFULFILLED") {
        redemption.status = status;
        updated.push(redemption);
      }
    }

    return updated;
  }

  private ensureBroadcaster(): StubUser {
    const existing = this.users.get(this.config.broadcasterId);
    if (existing) return existing;

    const broadcaster: StubUser = {
      id: this.config.broadcasterId,
      login: this.config.broadcasterLogin,
      display_name: this.config.broadcasterDisplayName,
      type: "",
      broadcaster_type: "partner",
      description: "Local Twitch API stub broadcaster",
      profile_image_url: makeAvatar(this.config.broadcasterLogin),
      offline_image_url: "",
      view_count: 12345,
      email: `${this.config.broadcasterLogin}@stub.local`,
      created_at: new Date().toISOString(),
    };

    this.users.set(broadcaster.id, broadcaster);
    this.users.set(`login:${broadcaster.login}`, broadcaster);
    return broadcaster;
  }

  private seedFollowerPool(count: number) {
    for (let i = 0; i < count; i++) {
      const id = `stub-follower-${i + 1}`;
      const login = `follower${i + 1}`;
      const user = this.ensureUser(
        id,
        login,
        `${FIRST_NAMES[i % FIRST_NAMES.length]}${i + 1}`
      );
      this.followerPool.push(user);
    }
  }

  private ensureRedemptionsSeeded(rewardId: string) {
    if (this.seededRewards.has(rewardId)) return;

    const reward = this.rewards.get(rewardId);
    if (!reward) return;

    const existing = this.redemptionsByReward.get(rewardId) ?? [];
    if (existing.length > 0) {
      this.seededRewards.add(rewardId);
      return;
    }

    const count = 80 + Math.floor(Math.random() * 121); // 80–200
    const broadcaster = this.getBroadcaster();
    const redemptions: StubRedemption[] = [];

    for (let i = 0; i < count; i++) {
      const userId = `stub-redeemer-${rewardId.slice(-8)}-${i + 1}`;
      const login = `redeemer${hashString(userId) % 100000}`;
      const display = `${FIRST_NAMES[i % FIRST_NAMES.length]}${i + 1}`;
      const user = this.ensureUser(userId, login, display);

      redemptions.push({
        broadcaster_id: broadcaster.id,
        broadcaster_login: broadcaster.login,
        broadcaster_name: broadcaster.display_name,
        id: uuidv7(),
        user_id: user.id,
        user_login: user.login,
        user_name: user.display_name,
        user_input: "",
        status: "UNFULFILLED",
        redeemed_at: new Date(Date.now() - (count - i) * 1000).toISOString(),
        reward: {
          id: reward.id,
          title: reward.title,
          prompt: reward.prompt,
          cost: reward.cost,
        },
      });
    }

    this.redemptionsByReward.set(rewardId, redemptions);
    this.seededRewards.add(rewardId);
  }
}
