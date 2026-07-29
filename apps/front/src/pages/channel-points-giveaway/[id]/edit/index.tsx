import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
} from "@/database/ChannelPointsGiveaway";
import { Layout } from "@/components/layout";
import { ChannelPointsGiveawayFormComponent } from "../../components/channel-points-giveaway-form";
import { type ChannelPointsGiveawayForm } from "../../types";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  channelPointsAccessBlockI18nKeys,
  channelPointsErrorI18nKey,
  classifyChannelPointsApiError,
  getChannelPointsAccessBlock,
} from "@/lib/channel-points-access";
import { ChannelPointsAccessBanner } from "../../components/channel-points-access-banner";

export function ChannelPointsGiveawayEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getChannelPointsGiveaway, updateChannelPointsGiveaway } =
    useChannelPointsGiveawayDb();
  const { twitchApiClient, userData } = useTwitchApi();
  const accessBlock = getChannelPointsAccessBlock({
    broadcasterType: userData?.broadcasterType,
    scopes: userData?.scopes,
  });
  const canUseChannelPoints = accessBlock === null;
  const [giveaway, setGiveaway] = useState<ChannelPointsGiveawayFormData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchGiveaway = async () => {
      try {
        const data = await getChannelPointsGiveaway(id);
        if (!data) {
          navigate("/dashboard/channel-points-giveaway");
          return;
        }

        if (data.status !== "open" || data.winners.length > 0) {
          toast.error(t("CHANNEL_POINTS_GIVEAWAY_EDIT_BLOCKED"));
          navigate(`/dashboard/channel-points-giveaway/${id}`);
          return;
        }

        setGiveaway(data);
      } catch (error) {
        console.error("Error fetching giveaway:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGiveaway();
  }, [id, getChannelPointsGiveaway, navigate, t]);

  const onClickSubmit = async (data: ChannelPointsGiveawayForm) => {
    if (!giveaway || !twitchApiClient || !userData?.id || !giveaway.rewardId) {
      return;
    }

    if (accessBlock) {
      toast.error(t(channelPointsAccessBlockI18nKeys(accessBlock).toast));
      return;
    }

    try {
      setIsSaving(true);

      const maxPerStream =
        data.maxPerStream != null && data.maxPerStream >= 1
          ? Math.floor(data.maxPerStream)
          : null;

      const updateResult = await twitchApiClient.updateCustomReward({
        broadcaster_id: userData.id,
        id: giveaway.rewardId,
        title: data.title.slice(0, 45),
        prompt: data.description.slice(0, 200),
        cost: data.cost,
        is_max_per_stream_enabled: maxPerStream != null,
        ...(maxPerStream != null ? { max_per_stream: maxPerStream } : {}),
      });

      if (updateResult.isErr()) {
        const kind = classifyChannelPointsApiError(updateResult.error);
        toast.error(t(channelPointsErrorI18nKey(kind)));
        return;
      }

      const updatedGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        title: data.title.slice(0, 45),
        description: data.description,
        cost: data.cost,
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
        updatedAt: new Date().toISOString(),
      };

      await updateChannelPointsGiveaway(updatedGiveaway);
      toast.success(t("CHANNEL_POINTS_GIVEAWAY_EDIT_SUCCESS"));
      navigate(`/dashboard/channel-points-giveaway/${giveaway.id}`);
    } catch (error) {
      console.error("Error updating giveaway:", error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_EDIT_ERROR"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!giveaway) {
    return null;
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">
        {t("CHANNEL_POINTS_GIVEAWAY_EDIT_TITLE")}
      </h1>
      {!canUseChannelPoints && accessBlock && (
        <ChannelPointsAccessBanner reason={accessBlock} className="mb-6" />
      )}
      <ChannelPointsGiveawayFormComponent
        defaultValues={{
          title: giveaway.title,
          description: giveaway.description,
          cost: giveaway.cost,
          maxPerStream: giveaway.maxPerStream ?? null,
          subscribersOnly: giveaway.subscribersOnly,
          subscriptionRequirement: giveaway.subscriptionRequirement,
          refundIneligible: giveaway.refundIneligible,
          allowMultipleWins: giveaway.allowMultipleWins,
          subscriberMultiplier: {
            "1000": giveaway.subscriberMultiplier?.["1000"] ?? 1,
            "2000": giveaway.subscriberMultiplier?.["2000"] ?? 1,
            "3000": giveaway.subscriberMultiplier?.["3000"] ?? 1,
          },
        }}
        onSubmit={onClickSubmit}
        submitLabel={t("CHANNEL_POINTS_GIVEAWAY_FORM_SAVE")}
        isLoading={isSaving}
        disabled={!canUseChannelPoints}
      />
    </Layout>
  );
}
