import { Layout } from "@/components/layout";
import { useParams, useNavigate } from "react-router";
import {
  useChannelPointsGiveawayDb,
  type ChannelPointsGiveawayFormData,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  XIcon,
  Edit,
  Pause,
  Lock,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { formatChancePercentage } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { v7 } from "uuid";
import { useExclusionListDb } from "@/database/ExclusionListItem";
import {
  collectChannelPointsRedemptions,
  type CollectionProgress,
} from "@/usecase/collect-channel-points-redemptions";
import {
  drawChannelPointsWinner,
  getAvailableTicketCount,
} from "@/service/channel-points-giveaway";
import { SubscriberTierLabels } from "@/domain/SubscriberTier";
import type { SubscriberTier } from "@/domain/SubscriberTier";
import confetti from "canvas-confetti";
import {
  channelPointsAccessBlockI18nKeys,
  channelPointsErrorI18nKey,
  classifyChannelPointsApiError,
  getChannelPointsAccessBlock,
} from "@/lib/channel-points-access";
import { ParticipantTag } from "@/pages/chat-giveaway/[id]/components/participant-tag";
import { ChannelPointsAccessBanner } from "../components/channel-points-access-banner";

const winnerDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

  useEffect(() => {
    if (!id) return;

    const loadGiveaway = async () => {
      const data = await getChannelPointsGiveaway(id);
      if (!data) {
        navigate("/dashboard/channel-points-giveaway");
        return;
      }
      setGiveaway(data);
    };

    loadGiveaway();
  }, [id, getChannelPointsGiveaway, navigate]);

  const availableTickets = useMemo(() => {
    if (!giveaway) return 0;
    return getAvailableTicketCount(
      giveaway.participants,
      giveaway.winners,
      giveaway.allowMultipleWins
    );
  }, [giveaway]);

  const participantTicketTags = useMemo(
    () =>
      [...(giveaway?.participants ?? [])]
        .sort((a, b) => b.tickets.length - a.tickets.length)
        .flatMap((participant) =>
          participant.tickets.map((ticket) => ({
            key: ticket.redemptionId,
            displayName: participant.displayName,
            subscriber: participant.subscriber,
            tier: participant.tier,
          }))
        ),
    [giveaway?.participants]
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

  const handleDraw = async () => {
    if (!giveaway) return;

    if (availableTickets === 0) {
      toast.error(t("CHANNEL_POINTS_GIVEAWAY_NO_TICKETS"));
      return;
    }

    setIsDrawing(true);

    setTimeout(async () => {
      const result = drawChannelPointsWinner({
        participants: giveaway.participants,
        winners: giveaway.winners,
        allowMultipleWins: giveaway.allowMultipleWins,
      });

      if (!result) {
        toast.error(t("CHANNEL_POINTS_GIVEAWAY_NO_TICKETS"));
        setIsDrawing(false);
        return;
      }

      const newWinner: ChannelPointsWinner = {
        id: v7(),
        userId: result.participant.userId,
        name: result.participant.displayName,
        avatar: result.participant.avatar,
        redemptionId: result.redemptionId,
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

        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });

        const chance =
          (1 /
            getAvailableTicketCount(
              giveaway.participants,
              giveaway.winners,
              giveaway.allowMultipleWins
            )) *
          100;

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

        toast.success(
          t("CHANNEL_POINTS_GIVEAWAY_DRAW_SUCCESS", {
            name: result.participant.displayName,
          })
        );
      } catch (error) {
        console.error(error);
        toast.error(t("CHANNEL_POINTS_GIVEAWAY_DRAW_ERROR"));
      } finally {
        setIsDrawing(false);
      }
    }, 500);
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
                {t("CHANNEL_POINTS_GIVEAWAY_STATUS_" + giveaway.status.toUpperCase())}
              </Badge>
              <Badge variant="secondary">
                {t("CHANNEL_POINTS_GIVEAWAY_COST_BADGE", { cost: giveaway.cost })}
              </Badge>
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
                disabled={isDrawing || availableTickets === 0}
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
                disabled={!canUseChannelPoints}
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

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t("CHANNEL_POINTS_GIVEAWAY_WINNERS")}
                  <Badge variant="secondary">{giveaway.winners.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {sortedWinners.length === 0 ? (
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
                ) : (
                  <ScrollArea className="h-[420px] pr-4">
                    <div className="flex flex-col gap-2">
                      {sortedWinners.map((winner) => (
                        <div
                          key={winner.id}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar>
                              <AvatarImage src={winner.avatar} />
                              <AvatarFallback>
                                {winner.name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {winner.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {winnerDateFormatter.format(
                                  new Date(winner.drawnAt)
                                )}
                              </p>
                            </div>
                          </div>
                          {giveaway.status !== "closed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onClickRemoveWinner(winner.id)}
                            >
                              <XIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
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
            <DialogDescription>
              {t("CHANNEL_POINTS_GIVEAWAY_CLOSE_DIALOG_DESCRIPTION")}
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
            >
              {t("CHANNEL_POINTS_GIVEAWAY_CLOSE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
