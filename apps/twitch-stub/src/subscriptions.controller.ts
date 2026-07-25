import { Controller, Get, Query } from "@nestjs/common";
import { TwitchStubStore } from "./twitch-stub.store";

function asArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

@Controller("helix/subscriptions")
export class SubscriptionsController {
  constructor(private readonly store: TwitchStubStore) {}

  @Get()
  getSubscriptions(
    @Query("broadcaster_id") _broadcasterId: string,
    @Query("user_id") userId?: string | string[],
    @Query("first") first?: string,
    @Query("after") after?: string
  ) {
    const userIds = asArray(userId);
    const pageSize = Number(first ?? 100) || 100;

    if (userIds.length > 0) {
      const broadcaster = this.store.getBroadcaster();
      const tiers = this.store.getSubscriptionTier(userIds);
      const data = userIds
        .map((id) => {
          const tier = tiers.get(id);
          if (!tier) return null;
          const user = this.store.ensureUser(id);
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
        })
        .filter(Boolean);

      return {
        data,
        pagination: {},
        total: data.length,
        points: data.length,
      };
    }

    return this.store.listSubscriptionsPage(after, pageSize);
  }
}
