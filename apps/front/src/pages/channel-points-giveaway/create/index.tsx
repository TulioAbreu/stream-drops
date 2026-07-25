import { type ChannelPointsGiveawayForm } from "../types";
import { v7 } from "uuid";
import { useChannelPointsGiveawayDb } from "@/database/ChannelPointsGiveaway";
import { Layout } from "@/components/layout";
import { useNavigate } from "react-router";
import { ChannelPointsGiveawayFormComponent } from "../components/channel-points-giveaway-form";
import { ChannelPointsAccessBanner } from "../components/channel-points-access-banner";
import { useState } from "react";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  channelPointsErrorI18nKey,
  classifyChannelPointsApiError,
  hasChannelPointsAccess,
} from "@/lib/channel-points-access";

export function ChannelPointsGiveawayCreate() {
  const { addChannelPointsGiveaway } = useChannelPointsGiveawayDb();
  const { twitchApiClient, userData } = useTwitchApi();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const canUseChannelPoints = hasChannelPointsAccess(userData?.broadcasterType);

  const onClickSubmit = async (data: ChannelPointsGiveawayForm) => {
    if (!twitchApiClient || !userData?.id) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AUTHENTICATED"));
      return;
    }

    if (!canUseChannelPoints) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AFFILIATE"));
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

      await addChannelPointsGiveaway({
        id,
        title: data.title.slice(0, 45),
        description: data.description,
        cost: data.cost,
        rewardId: reward.id,
        subscribersOnly: data.subscribersOnly,
        subscriptionRequirement: data.subscriptionRequirement,
        refundIneligible: data.refundIneligible,
        allowMultipleWins: data.allowMultipleWins,
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
      <h1 className="text-2xl font-bold mb-6">
        {t("CHANNEL_POINTS_GIVEAWAY_CREATE_TITLE")}
      </h1>
      {!canUseChannelPoints && (
        <ChannelPointsAccessBanner className="mb-6" />
      )}
      <ChannelPointsGiveawayFormComponent
        onSubmit={onClickSubmit}
        submitLabel={t("CHANNEL_POINTS_GIVEAWAY_FORM_SUBMIT")}
        isLoading={isLoading}
        disabled={!canUseChannelPoints}
      />
    </Layout>
  );
}
