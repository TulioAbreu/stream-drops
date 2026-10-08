import { type ChannelPointsGiveawayForm } from "../types";
import { v7 } from "uuid";
import { useChannelPointsGiveawayDb } from "@/database/ChannelPointsGiveaway";
import { Layout } from "@/components/layout";
import { InventoryPanel } from "@/components/shell/inventory-panel";
import { ShellHeader } from "@/components/shell/shell-header";
import { useNavigate } from "react-router";
import { ChannelPointsGiveawayFormComponent } from "../components/channel-points-giveaway-form";
import { ChannelPointsAccessBanner } from "../components/channel-points-access-banner";
import { useState } from "react";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  channelPointsAccessBlockI18nKeys,
  channelPointsErrorI18nKey,
  classifyChannelPointsApiError,
  getChannelPointsAccessBlock,
} from "@/lib/channel-points-access";

export function ChannelPointsGiveawayCreate() {
  const { addChannelPointsGiveaway } = useChannelPointsGiveawayDb();
  const { twitchApiClient, userData } = useTwitchApi();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const accessBlock = getChannelPointsAccessBlock({
    broadcasterType: userData?.broadcasterType,
    scopes: userData?.scopes,
  });
  const canUseChannelPoints = accessBlock === null;

  const onClickSubmit = async (data: ChannelPointsGiveawayForm) => {
    if (!twitchApiClient || !userData?.id) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AUTHENTICATED"));
      return;
    }

    if (accessBlock) {
      toast.error(t(channelPointsAccessBlockI18nKeys(accessBlock).toast));
      return;
    }

    try {
      setIsLoading(true);

      const rewardResult = await twitchApiClient.createCustomReward({
        broadcaster_id: userData.id,
        title: data.title.slice(0, 45),
        cost: data.cost,
        prompt: data.description.slice(0, 200) || undefined,
        is_enabled: true,
        is_user_input_required: false,
        should_redemptions_skip_request_queue: false,
        is_max_per_stream_enabled:
          data.maxPerStream != null && data.maxPerStream >= 1,
        ...(data.maxPerStream != null && data.maxPerStream >= 1
          ? { max_per_stream: Math.floor(data.maxPerStream) }
          : {}),
      });

      if (rewardResult.isErr()) {
        const kind = classifyChannelPointsApiError(rewardResult.error);
        toast.error(t(channelPointsErrorI18nKey(kind)));
        return;
      }

      const reward = rewardResult.value.data[0];
      if (!reward) {
        toast.error(t("CHANNEL_POINTS_GIVEAWAY_CREATE_REWARD_ERROR"));
        return;
      }

      const id = v7();
      const now = new Date().toISOString();
      const maxPerStream =
        data.maxPerStream != null && data.maxPerStream >= 1
          ? Math.floor(data.maxPerStream)
          : null;

      await addChannelPointsGiveaway({
        id,
        title: data.title.slice(0, 45),
        description: data.description,
        cost: data.cost,
        rewardId: reward.id,
        rewardEnabled: true,
        maxPerStream,
        subscribersOnly: data.subscribersOnly,
        subscriptionRequirement: data.subscriptionRequirement,
        refundIneligible: data.refundIneligible,
        allowMultipleWins: data.allowMultipleWins,
        subscriberMultiplier: {
          "1000": Math.max(1, Math.floor(data.subscriberMultiplier["1000"] || 1)),
          "2000": Math.max(1, Math.floor(data.subscriberMultiplier["2000"] || 1)),
          "3000": Math.max(1, Math.floor(data.subscriberMultiplier["3000"] || 1)),
        },
        status: "open",
        participants: [],
        winners: [],
        createdAt: now,
        updatedAt: now,
      });

      toast.success(t("CHANNEL_POINTS_GIVEAWAY_CREATE_SUCCESS"));
      navigate(`/dashboard/channel-points-giveaway/${id}`);
    } catch (error) {
      console.error("Error creating channel points giveaway:", error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_CREATE_ERROR"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <ShellHeader
        section={t("DASHBOARD_SIDEBAR_SECTION_GIVEAWAYS")}
        page={t("DASHBOARD_SIDEBAR_ITEM_CHANNEL_POINTS_GIVEAWAY")}
        title={t("CHANNEL_POINTS_GIVEAWAY_CREATE_TITLE")}
      />
      {!canUseChannelPoints && accessBlock && (
        <ChannelPointsAccessBanner reason={accessBlock} className="mb-6" />
      )}
      <InventoryPanel
        title={t("CHANNEL_POINTS_GIVEAWAY_FORM_PANEL")}
        className="max-w-3xl"
      >
        <ChannelPointsGiveawayFormComponent
          onSubmit={onClickSubmit}
          submitLabel={t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBMIT")}
          isLoading={isLoading}
          disabled={!canUseChannelPoints}
        />
      </InventoryPanel>
    </Layout>
  );
}
