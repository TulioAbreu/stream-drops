import { Layout } from "@/components/layout";
import { useParams, useNavigate } from "react-router";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
  type ChannelPointsParticipant,
  type ChannelPointsWinner,
} from "@/database/ChannelPointsGiveaway";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Trophy,
  Sparkles,
  ArrowLeftIcon,
  Edit,
  Pause,
  Lock,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { composeTwitchChatEmbedUrl, formatChancePercentage } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { v7 } from "uuid";
import { useExclusionListDb } from "@/database/ExclusionListItem";
import {
  collectChannelPointsRedemptions,
  type CollectionProgress,
} from "@/usecase/collect-channel-points-redemptions";
import { settleChannelPointsOnClose } from "@/usecase/settle-channel-points-on-close";
import {
  drawChannelPointsWinner,
  getAvailableTicketCount,
  getWeightedEntryCount,
  normalizeChannelPointsMultiplier,
  resolveChannelPointsMultiplier,
} from "@/service/channel-points-giveaway";
import { SubscriberTierLabels } from "@/domain/SubscriberTier";
import type { SubscriberTier } from "@/domain/SubscriberTier";
import {
  channelPointsAccessBlockI18nKeys,
  channelPointsErrorI18nKey,
  classifyChannelPointsApiError,
  getChannelPointsAccessBlock,
} from "@/lib/channel-points-access";
import { GiveawayWinnerRow } from "@/components/giveaway/giveaway-winner-row";
import { WinnerConfirmationInline } from "@/components/giveaway/winner-confirmation-inline";
import { ParticipantTag } from "@/pages/chat-giveaway/[id]/components/participant-tag";
import { ChannelPointsAccessBanner } from "../components/channel-points-access-banner";
import { useChatMessages } from "../hooks/use-chat-messages";

interface PendingChannelPointsWinner {
  participant: ChannelPointsParticipant;
  redemptionId: string;
  weight: number;
}

export function ChannelPointsGiveawayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    getChannelPointsGiveaway,
    updateChannelPointsGiveaway,
  } = useChannelPointsGiveawayDb();
  const { getExclusions } = useExclusionListDb();
  const { userData, twitchApiClient } = useTwitchApi();
  const accessBlock = getChannelPointsAccessBlock({
    broadcasterType: userData?.broadcasterType,
    scopes: userData?.scopes,
  });
  const canUseChannelPoints = accessBlock === null;

  const [giveaway, setGiveaway] =
    useState<ChannelPointsGiveawayFormData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [collectionProgress, setCollectionProgress] =
    useState<CollectionProgress | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [pendingWinner, setPendingWinner] =
    useState<PendingChannelPointsWinner | null>(null);
  const [redrawExcludedRedemptionIds, setRedrawExcludedRedemptionIds] =
    useState<string[]>([]);
  const [isRedrawing, setIsRedrawing] = useState(false);

  const chatEnabled =
    !!userData?.login &&
    (giveaway?.status === "ready" || giveaway?.status === "closed");

  const { messages } = useChatMessages({
    channel: userData?.login || "",
    enabled: chatEnabled,
  });

  useEffect(() => {
    if (!id) return;

    const loadGiveaway = async () => {
      const data = await getChannelPointsGiveaway(id);
      if (!data) {
        navigate("/dashboard/channel-points-giveaway");
        return;
      }
      setGiveaway({
        ...data,
        maxPerStream: data.maxPerStream ?? null,
      });
    };

    loadGiveaway();
  }, [id, getChannelPointsGiveaway, navigate]);

  useEffect(() => {
    if (!pendingWinner) {
      setRedrawExcludedRedemptionIds([]);
    }
  }, [pendingWinner]);

  const availableTickets = useMemo(() => {
    if (!giveaway) return 0;
    return getAvailableTicketCount(
      giveaway.participants,
      giveaway.winners,
      giveaway.allowMultipleWins,
      redrawExcludedRedemptionIds
    );
  }, [giveaway, redrawExcludedRedemptionIds]);

  const subscriberMultiplier = useMemo(
    () => normalizeChannelPointsMultiplier(giveaway?.subscriberMultiplier),
    [giveaway?.subscriberMultiplier]
  );

  const weightedEntries = useMemo(() => {
    if (!giveaway) return 0;
    return getWeightedEntryCount({
      participants: giveaway.participants,
      winners: giveaway.winners,
      allowMultipleWins: giveaway.allowMultipleWins,
      subscriberMultiplier,
      excludeRedemptionIds: redrawExcludedRedemptionIds,
    });
  }, [giveaway, subscriberMultiplier, redrawExcludedRedemptionIds]);

  const participantTicketTags = useMemo(
    () =>
      [...(giveaway?.participants ?? [])]
        .sort((a, b) => b.tickets.length - a.tickets.length)
        .flatMap((participant) => {
          const weight = resolveChannelPointsMultiplier(
            participant,
            subscriberMultiplier
          );
          return participant.tickets.flatMap((ticket) =>
            Array.from({ length: weight }, (_, index) => ({
              key: `${ticket.redemptionId}-${index}`,
              displayName: participant.displayName,
              subscriber: participant.subscriber,
              tier: participant.tier,
            }))
          );
        }),
    [giveaway?.participants, subscriberMultiplier]
  );

  const sortedWinners = useMemo(
    () =>
      [...(giveaway?.winners ?? [])].sort(
        (a, b) =>
          new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime()
      ),
    [giveaway?.winners]
  );

  const progressValue = useMemo(() => {
    if (!collectionProgress) return 0;
    if (collectionProgress.phase === "fetching") {
      return Math.min(60, 10 + collectionProgress.page * 5);
    }
    if (collectionProgress.phase === "enriching") return 75;
    if (collectionProgress.phase === "settling") return 90;
    return 100;
  }, [collectionProgress]);

  const onClickBack = () => {
    navigate("/dashboard/channel-points-giveaway");
  };

  const canEdit =
    giveaway?.status === "open" && (giveaway?.winners.length ?? 0) === 0;

  const handleCollect = async () => {
    if (!giveaway || !twitchApiClient || !userData?.id || !giveaway.rewardId) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_ERROR_NOT_AUTHENTICATED"));
      return;
    }

    if (accessBlock) {
      toast.error(t(channelPointsAccessBlockI18nKeys(accessBlock).toast));
      return;
    }

    setIsCollecting(true);
    setCollectionProgress({ loaded: 0, page: 0, phase: "fetching" });

    try {
      const collectingGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        status: "collecting",
        updatedAt: new Date().toISOString(),
      };
      await updateChannelPointsGiveaway(collectingGiveaway);
      setGiveaway(collectingGiveaway);

      const pauseResult = await twitchApiClient.updateCustomReward({
        broadcaster_id: userData.id,
        id: giveaway.rewardId,
        is_paused: true,
      });

      if (pauseResult.isErr()) {
        const kind = classifyChannelPointsApiError(pauseResult.error);
        toast.error(
          kind === "generic"
            ? t("CHANNEL_POINTS_GIVEAWAY_PAUSE_ERROR")
            : t(channelPointsErrorI18nKey(kind))
        );
        const reverted: ChannelPointsGiveawayFormData = {
          ...giveaway,
          status: "open",
          updatedAt: new Date().toISOString(),
        };
        await updateChannelPointsGiveaway(reverted);
        setGiveaway(reverted);
        return;
      }

      const exclusions = await getExclusions();
      const excludedUserIds = new Set(exclusions.map((e) => e.twitchUserId));

      const collectResult = await collectChannelPointsRedemptions({
        twitchApiClient,
        broadcasterId: userData.id,
        rewardId: giveaway.rewardId,
        subscribersOnly: giveaway.subscribersOnly,
        subscriptionRequirement: giveaway.subscriptionRequirement,
        refundIneligible: giveaway.refundIneligible,
        excludedUserIds,
        onProgress: setCollectionProgress,
      });

      if (collectResult.isErr()) {
        console.error(collectResult.error);
        const kind = classifyChannelPointsApiError(collectResult.error);
        toast.error(
          kind === "generic"
            ? t("CHANNEL_POINTS_GIVEAWAY_COLLECT_ERROR")
            : t(channelPointsErrorI18nKey(kind))
        );
        const reverted: ChannelPointsGiveawayFormData = {
          ...giveaway,
          status: "open",
          updatedAt: new Date().toISOString(),
        };
        await twitchApiClient.updateCustomReward({
          broadcaster_id: userData.id,
          id: giveaway.rewardId,
          is_paused: false,
        });
        await updateChannelPointsGiveaway(reverted);
        setGiveaway(reverted);
        return;
      }

      const readyGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        status: "ready",
        participants: collectResult.value.participants,
        collectionProgress: {
          loaded: collectResult.value.totalRedemptions,
          page: collectionProgress?.page ?? 0,
        },
        updatedAt: new Date().toISOString(),
      };

      await updateChannelPointsGiveaway(readyGiveaway);
      setGiveaway(readyGiveaway);

      toast.success(
        t("CHANNEL_POINTS_GIVEAWAY_COLLECT_SUCCESS", {
          eligible: collectResult.value.eligibleCount,
          ineligible: collectResult.value.ineligibleCount,
        })
      );
    } catch (error) {
      console.error(error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_COLLECT_ERROR"));
    } finally {
      setIsCollecting(false);
      setCollectionProgress(null);
    }
  };

  const executeDraw = async (excludeRedemptionIds: string[]) => {
    if (!giveaway) return;

    const result = drawChannelPointsWinner({
      participants: giveaway.participants,
      winners: giveaway.winners,
      allowMultipleWins: giveaway.allowMultipleWins,
      subscriberMultiplier: giveaway.subscriberMultiplier,
      excludeRedemptionIds,
    });

    if (!result) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_NO_TICKETS"));
      setIsDrawing(false);
      setIsRedrawing(false);
      return;
    }

    const poolSize = getWeightedEntryCount({
      participants: giveaway.participants,
      winners: giveaway.winners,
      allowMultipleWins: giveaway.allowMultipleWins,
      subscriberMultiplier: giveaway.subscriberMultiplier,
      excludeRedemptionIds,
    });
    const chance = poolSize > 0 ? (result.weight / poolSize) * 100 : 0;

    if (userData?.id && twitchApiClient) {
      await twitchApiClient.sendChatMessage({
        broadcaster_id: userData.id,
        sender_id: userData.id,
        message: t("CHANNEL_POINTS_GIVEAWAY_CHAT_WINNER", {
          name: result.participant.displayName,
          chance: formatChancePercentage(chance),
        }),
      });
    }

    setPendingWinner({
      participant: result.participant,
      redemptionId: result.redemptionId,
      weight: result.weight,
    });
    setIsDrawing(false);
    setIsRedrawing(false);
  };

  const handleDraw = async () => {
    if (!giveaway) return;

    if (availableTickets === 0) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_NO_TICKETS"));
      return;
    }

    setIsDrawing(true);

    setTimeout(async () => {
      await executeDraw([]);
    }, 500);
  };

  const handleRedraw = async () => {
    if (!giveaway || !pendingWinner) return;

    setIsRedrawing(true);

    const sessionExcludes = giveaway.allowMultipleWins
      ? [pendingWinner.redemptionId]
      : pendingWinner.participant.tickets.map((ticket) => ticket.redemptionId);

    const newExcluded = [
      ...redrawExcludedRedemptionIds,
      ...sessionExcludes.filter(
        (redemptionId) => !redrawExcludedRedemptionIds.includes(redemptionId)
      ),
    ];
    setRedrawExcludedRedemptionIds(newExcluded);

    setTimeout(async () => {
      await executeDraw(newExcluded);
    }, 500);
  };

  const handleConfirmWinner = async () => {
    if (!giveaway || !pendingWinner) return;

    const newWinner: ChannelPointsWinner = {
      id: v7(),
      userId: pendingWinner.participant.userId,
      name: pendingWinner.participant.displayName,
      avatar: pendingWinner.participant.avatar,
      redemptionId: pendingWinner.redemptionId,
      drawnAt: new Date().toISOString(),
    };

    const updatedGiveaway: ChannelPointsGiveawayFormData = {
      ...giveaway,
      winners: [...giveaway.winners, newWinner],
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateChannelPointsGiveaway(updatedGiveaway);
      setGiveaway(updatedGiveaway);
      toast.success(
        t("CHANNEL_POINTS_GIVEAWAY_DRAW_SUCCESS", {
          name: pendingWinner.participant.displayName,
        })
      );
    } catch (error) {
      console.error(error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_DRAW_ERROR"));
      throw error;
    }
  };

  const onClickRemoveWinner = async (winnerId: string) => {
    if (!giveaway) return;

    const updatedGiveaway: ChannelPointsGiveawayFormData = {
      ...giveaway,
      winners: giveaway.winners.filter((w) => w.id !== winnerId),
      updatedAt: new Date().toISOString(),
    };

    await updateChannelPointsGiveaway(updatedGiveaway);
    setGiveaway(updatedGiveaway);
    toast.success(t("CHANNEL_POINTS_GIVEAWAY_WINNER_REMOVED"));
  };

  const handleClose = async () => {
    if (!giveaway || !twitchApiClient || !userData?.id) return;

    if (accessBlock) {
      toast.error(t(channelPointsAccessBlockI18nKeys(accessBlock).toast));
      return;
    }

    setIsClosing(true);
    try {
      if (giveaway.rewardId) {
        const settleResult = await settleChannelPointsOnClose({
          twitchApiClient,
          broadcasterId: userData.id,
          rewardId: giveaway.rewardId,
          participants: giveaway.participants,
          hasWinners: giveaway.winners.length > 0,
        });

        if (settleResult.isErr()) {
          console.error(settleResult.error);
          const kind = classifyChannelPointsApiError(settleResult.error);
          toast.error(
            kind === "generic"
              ? t("CHANNEL_POINTS_GIVEAWAY_CLOSE_SETTLE_ERROR")
              : t(channelPointsErrorI18nKey(kind))
          );
          return;
        }

        const deleteResult = await twitchApiClient.deleteCustomReward({
          broadcaster_id: userData.id,
          id: giveaway.rewardId,
        });
        if (deleteResult.isErr()) {
          const kind = classifyChannelPointsApiError(deleteResult.error);
          toast.error(
            kind === "generic"
              ? t("CHANNEL_POINTS_GIVEAWAY_CLOSE_REWARD_ERROR")
              : t(channelPointsErrorI18nKey(kind))
          );
          return;
        }
      }

      const closedGiveaway: ChannelPointsGiveawayFormData = {
        ...giveaway,
        status: "closed",
        rewardId: null,
        updatedAt: new Date().toISOString(),
      };

      await updateChannelPointsGiveaway(closedGiveaway);
      setGiveaway(closedGiveaway);
      setPendingWinner(null);
      setCloseDialogOpen(false);
      toast.success(t("CHANNEL_POINTS_GIVEAWAY_CLOSE_SUCCESS"));
    } catch (error) {
      console.error(error);
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_CLOSE_ERROR"));
    } finally {
      setIsClosing(false);
    }
  };

  if (!giveaway) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const totalParticipantTickets = giveaway.participants.reduce(
    (sum, p) => sum + p.tickets.length,
    0
  );

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{giveaway.title}</h1>
            {giveaway.description && (
              <p className="text-muted-foreground">{giveaway.description}</p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Badge variant="outline">
                {t(
                  "CHANNEL_POINTS_GIVEAWAY_STATUS_" +
                    giveaway.status.toUpperCase()
                )}
              </Badge>
              <Badge variant="secondary">
                {t("CHANNEL_POINTS_GIVEAWAY_COST_BADGE", {
                  cost: giveaway.cost,
                })}
              </Badge>
              {giveaway.maxPerStream != null && giveaway.maxPerStream >= 1 && (
                <Badge variant="outline">
                  {t("CHANNEL_POINTS_GIVEAWAY_MAX_PER_STREAM_BADGE", {
                    count: giveaway.maxPerStream,
                  })}
                </Badge>
              )}
              {giveaway.subscribersOnly && (
                <Badge variant="secondary">
                  {t("CHANNEL_POINTS_GIVEAWAY_SUBS_ONLY_BADGE", {
                    tier:
                      SubscriberTierLabels[
                        giveaway.subscriptionRequirement as SubscriberTier
                      ] ?? giveaway.subscriptionRequirement,
                  })}
                </Badge>
              )}
              {giveaway.allowMultipleWins && (
                <Badge variant="outline">
                  {t("CHANNEL_POINTS_GIVEAWAY_MULTI_WINS_BADGE")}
                </Badge>
              )}
              {Object.entries(subscriberMultiplier)
                .filter(([, multiplier]) => multiplier > 1)
                .map(([tier, multiplier]) => (
                  <Badge key={tier} variant="secondary">
                    {t("CHANNEL_POINTS_GIVEAWAY_MULTIPLIER_BADGE", {
                      tier:
                        SubscriberTierLabels[Number(tier) as SubscriberTier] ??
                        tier,
                      multiplier,
                    })}
                  </Badge>
                ))}
              {giveaway.refundIneligible && (
                <Badge variant="outline">
                  {t("CHANNEL_POINTS_GIVEAWAY_REFUND_BADGE")}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-row gap-2 flex-wrap">
            <Button variant="ghost" size="lg" onClick={onClickBack}>
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {t("NAVIGATE_BACK")}
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        navigate(
                          `/dashboard/channel-points-giveaway/${giveaway.id}/edit`
                        )
                      }
                      disabled={!canEdit}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {t("CHANNEL_POINTS_GIVEAWAY_EDIT_BUTTON")}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p>{t("CHANNEL_POINTS_GIVEAWAY_EDIT_BLOCKED")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            {giveaway.status === "open" && (
              <Button
                size="lg"
                onClick={handleCollect}
                disabled={isCollecting || !canUseChannelPoints}
              >
                <Pause className="w-4 h-4 mr-2" />
                {t("CHANNEL_POINTS_GIVEAWAY_PAUSE_COLLECT")}
              </Button>
            )}

            {giveaway.status === "ready" && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleDraw}
                disabled={
                  isDrawing ||
                  !!pendingWinner ||
                  availableTickets === 0
                }
              >
                {isDrawing ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    {t("CHANNEL_POINTS_GIVEAWAY_DRAWING")}
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4 mr-2" />
                    {t("CHANNEL_POINTS_GIVEAWAY_DRAW")}
                  </>
                )}
              </Button>
            )}

            {giveaway.status === "ready" && (
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setCloseDialogOpen(true)}
                disabled={!canUseChannelPoints || !!pendingWinner}
              >
                <Lock className="w-4 h-4 mr-2" />
                {t("CHANNEL_POINTS_GIVEAWAY_CLOSE")}
              </Button>
            )}
          </div>
        </div>

        {giveaway.status === "open" && (
          <Card>
            <CardHeader>
              <CardTitle>{t("CHANNEL_POINTS_GIVEAWAY_OPEN_TITLE")}</CardTitle>
              <CardDescription>
                {t("CHANNEL_POINTS_GIVEAWAY_OPEN_DESCRIPTION")}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {accessBlock && giveaway.status !== "closed" && (
          <ChannelPointsAccessBanner reason={accessBlock} />
        )}

        {(giveaway.status === "ready" || giveaway.status === "closed") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t("CHANNEL_POINTS_GIVEAWAY_PARTICIPANTS")}
                  <Badge variant="secondary">
                    {giveaway.participants.length}
                  </Badge>
                  <Badge variant="outline">
                    {t("CHANNEL_POINTS_GIVEAWAY_TICKETS_COUNT", {
                      count: totalParticipantTickets,
                    })}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {t("CHANNEL_POINTS_GIVEAWAY_AVAILABLE_TICKETS", {
                    count: availableTickets,
                  })}
                  {weightedEntries !== availableTickets && (
                    <>
                      {" · "}
                      {t("CHANNEL_POINTS_GIVEAWAY_WEIGHTED_ENTRIES", {
                        count: weightedEntries,
                      })}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {participantTicketTags.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Coins />
                      </EmptyMedia>
                      <EmptyTitle>
                        {t("CHANNEL_POINTS_GIVEAWAY_NO_PARTICIPANTS")}
                      </EmptyTitle>
                      <EmptyDescription>
                        {t("CHANNEL_POINTS_GIVEAWAY_NO_PARTICIPANTS_HINT")}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ScrollArea className="h-[420px] pr-4">
                    <div className="flex flex-wrap gap-2 p-1 content-start">
                      {participantTicketTags.map((tag) => (
                        <ParticipantTag
                          key={tag.key}
                          participant={{
                            displayName: tag.displayName,
                            subscriber: tag.subscriber,
                            tier: tag.tier,
                          }}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {t("CHANNEL_POINTS_GIVEAWAY_WINNERS")}
                    <Badge variant="secondary">{giveaway.winners.length}</Badge>
                    {pendingWinner && (
                      <span className="text-sm font-normal text-muted-foreground">
                        · {t("CHANNEL_POINTS_GIVEAWAY_AWAITING_CONFIRMATION")}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col">
                  <ScrollArea className="h-[280px] pr-4">
                    <div className="space-y-3">
                      {pendingWinner && (
                        <WinnerConfirmationInline
                          key={pendingWinner.redemptionId}
                          pendingWinner={{
                            id: pendingWinner.participant.userId,
                            displayName: pendingWinner.participant.displayName,
                            avatar: pendingWinner.participant.avatar,
                            subscriber: pendingWinner.participant.subscriber,
                            tier: pendingWinner.participant.tier,
                          }}
                          messages={messages}
                          rank={1}
                          onConfirm={handleConfirmWinner}
                          onDismiss={() => setPendingWinner(null)}
                          onCancel={() => setPendingWinner(null)}
                          onRedraw={handleRedraw}
                          isRedrawing={isRedrawing}
                        />
                      )}

                      {sortedWinners.length === 0 && !pendingWinner ? (
                        <div className="flex items-center justify-center min-h-[200px]">
                          <Empty>
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Trophy />
                              </EmptyMedia>
                              <EmptyTitle>
                                {t("CHANNEL_POINTS_GIVEAWAY_NO_WINNERS")}
                              </EmptyTitle>
                            </EmptyHeader>
                          </Empty>
                        </div>
                      ) : (
                        sortedWinners.map((winner, index) => {
                          const participant = giveaway.participants.find(
                            (p) => p.userId === winner.userId
                          );
                          const rank = pendingWinner ? index + 2 : index + 1;

                          return (
                            <GiveawayWinnerRow
                              key={winner.id}
                              rank={rank}
                              name={winner.name}
                              avatar={winner.avatar}
                              drawnAt={winner.drawnAt}
                              tier={participant?.tier}
                              onRemove={
                                giveaway.status !== "closed"
                                  ? () => onClickRemoveWinner(winner.id)
                                  : undefined
                              }
                            />
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {userData?.login && (
                <Card className="flex flex-col overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle>{t("CHANNEL_POINTS_GIVEAWAY_CHAT")}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <iframe
                      title="Twitch Chat"
                      src={composeTwitchChatEmbedUrl(userData.login)}
                      className="h-[320px] w-full border-0"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCollecting} onOpenChange={() => {}}>
        <DialogContent
          hideCloseButton
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_TITLE")}
            </DialogTitle>
            <DialogDescription>
              {collectionProgress?.phase === "fetching" &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_FETCHING", {
                  loaded: collectionProgress.loaded,
                  page: collectionProgress.page,
                })}
              {collectionProgress?.phase === "enriching" &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_ENRICHING", {
                  loaded: collectionProgress.loaded,
                })}
              {collectionProgress?.phase === "settling" &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_SETTLING")}
              {!collectionProgress &&
                t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_STARTING")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Progress value={progressValue} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {collectionProgress
                ? t("CHANNEL_POINTS_GIVEAWAY_COLLECTING_LOADED", {
                    loaded: collectionProgress.loaded,
                    page: collectionProgress.page,
                  })
                : "..."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_TITLE")}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_DESCRIPTION")}</p>
                <p>
                  {giveaway.winners.length > 0
                    ? t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_FULFILL")
                    : t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_REFUND")}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseDialogOpen(false)}
              disabled={isClosing}
            >
              {t("CANCEL")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={isClosing}
              loading={isClosing}
            >
              {t("CHANNEL_POINTS_GIVEAWAY_CLOSE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
