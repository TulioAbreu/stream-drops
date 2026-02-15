import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionGiveawayDb, type FollowerGiveawayFormData } from "@/database/SubscriptionGiveaway";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { getGiveawayResult } from "@/service/giveaway";
import { exportGiveawayResultToSheets, overrideGiveawayResultToSheets } from "@/service/google-drive";
import { ArrowLeftIcon, BanIcon, CrownIcon, Edit3Icon, EllipsisIcon, FileSpreadsheetIcon, PartyPopperIcon, SaveIcon, SearchIcon, TrophyIcon, UserIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { TableVirtuoso } from "react-virtuoso";
import { GiveawayInfoCard } from "./components/giveaway-info-card";
import { fetchSubscribers } from "@/usecase/fetch-subscribers";
import { filterElegibleSubscribers } from "@/usecase/filter-eligible-subscribers";
import { toast } from "sonner";
import { useExclusionListDb } from "@/database/ExclusionListItem";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BroadcasterSubscriber } from "@/service/twitch/types";

export function FollowerGiveawayId() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { getGiveaway, updateGiveaway } = useSubscriptionGiveawayDb();
    const { getExclusions, addExclusion } = useExclusionListDb();
    const { twitchApiClient, userData } = useTwitchApi();
    const [giveaway, setGiveaway] = useState<FollowerGiveawayFormData | null>(null);
    const [fetchUsersProgress, setFetchUsersProgress] = useState<number>(0);
    const [isFetchingParticipants, startFetchParticipantsTransition] = useTransition();
    const [isExportingResultSheets, startExportingResultSheetsTransition] = useTransition();

    const fetchGiveaway = async () => {
        if (!id) {
            return;
        }

        const giveawayData = await getGiveaway(id);
        if (giveawayData) {
            setGiveaway(giveawayData);
        }
    };

    useEffect(() => {
        fetchGiveaway();
    }, [id]);

    const onClickBack = () => {
        navigate("/dashboard/follower-giveaway");
    };

    const onClickEdit = () => {
        navigate(`/dashboard/follower-giveaway/${id}/edit`);
    };

    const onClickSearchParticipants = async () => {
        if (!twitchApiClient || !userData || !giveaway) {
            return;
        }
        startFetchParticipantsTransition(async () => {
            setFetchUsersProgress(0);

            const exclusions = await getExclusions();

            let subscribers = await fetchSubscribers(twitchApiClient, userData.id, (progress) => {
                setFetchUsersProgress(progress);
            });
            subscribers = subscribers.filter((subscriber) => {
                // Filter out excluded users
                return !exclusions.some((exclusion) => exclusion.twitchUserId === subscriber.user_id);
            });

            if (subscribers.length === 0) {
                toast.error(t("FOLLOWER_GIVEAWAY_FORM_NO_SUBSCRIBERS"));
                return;
            }

            const eligibleSubscribers = filterElegibleSubscribers(subscribers, giveaway.subscriptionRequirement);
            await updateGiveaway({
                ...giveaway,
                participants: eligibleSubscribers
            });

            if (eligibleSubscribers.length === 0) {
                toast.warning(t("FOLLOWER_GIVEAWAY_FORM_NO_ELIGIBLE_SUBSCRIBERS"));
                return;
            }

            await fetchGiveaway();
        });
    };

    const onClickDrawWinners = async () => {
        if (!giveaway || !twitchApiClient || !userData) {
            return;
        }
        const newWinners = getGiveawayResult({
            participants: giveaway.participants ?? [],
            winners: giveaway.winners ?? [],
            repeatWinners: false,
            requiredSubscriber: giveaway?.subscriptionRequirement ?? 0,
            subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                "1000": 1,
                "2000": 1,
                "3000": 1,
            },
            totalWinners: 1,
        });
        const winners = [...newWinners, ...giveaway.winners];
        await updateGiveaway({
            ...giveaway,
            winners,
        });

        // Send chat message for new winners
        if (twitchApiClient && userData) {
            for (const winner of newWinners) {
                // Calculate chance
                // Re-create the pool of eligible participants at the time of drawing
                const currentWinnersIds = giveaway.winners.map(w => w.user_id);
                // Participants excluding already winners
                let eligibleParticipants = (giveaway.participants ?? []).filter(p => !currentWinnersIds.includes(p.user_id));

                // Filter by requirement
                const requiredTier = giveaway.subscriptionRequirement ?? 0;
                if (requiredTier > 0) {
                    eligibleParticipants = eligibleParticipants.filter(p => Number(p.tier) >= requiredTier);
                }

                // Calculate total tickets
                const multipliers = giveaway.subscriberMultiplier ?? { "1000": 1, "2000": 1, "3000": 1 };
                const totalTickets = eligibleParticipants.reduce((sum, p) => {
                    const multiplier = multipliers[p.tier] || 1;
                    return sum + multiplier;
                }, 0);

                const winnerTickets = multipliers[winner.tier] || 1;
                const winChance = totalTickets > 0 ? ((winnerTickets / totalTickets) * 100).toFixed(2) : "0.00";

                try {
                    await twitchApiClient.sendChatMessage({
                        broadcaster_id: userData.id,
                        sender_id: userData.id,
                        message: `Parabéns @${winner.user_name}! Você ganhou o sorteio! (Chance: ${winChance}%, Tickets: ${winnerTickets})`
                    });
                } catch (error) {
                    console.error("Failed to send chat message for winner", winner.user_name, error);
                }
            }
        }

        await fetchGiveaway();
    };

    const onClickExportWinners = async () => {
        if (!giveaway) {
            return;
        }

        startExportingResultSheetsTransition(async () => {
            let url: string;
            if (giveaway.spreadsheetUrl) {
                url = await overrideGiveawayResultToSheets({
                    participants: giveaway.participants ?? [],
                    winners: giveaway.winners ?? [],
                    requiredSubscriber: giveaway?.subscriptionRequirement ?? 0,
                    subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                        "1000": 1,
                        "2000": 1,
                        "3000": 1,
                    },
                    title: giveaway?.title ?? "",
                    description: giveaway?.description ?? "",
                    spreadsheetId: giveaway.spreadsheetUrl.split("/")[5],
                });
                return;
            } else {
                url = await exportGiveawayResultToSheets({
                    participants: giveaway.participants ?? [],
                    winners: giveaway.winners ?? [],
                    requiredSubscriber: giveaway?.subscriptionRequirement ?? 0,
                    subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                        "1000": 1,
                        "2000": 1,
                        "3000": 1,
                    },
                    title: giveaway?.title ?? "",
                    description: giveaway?.description ?? "",
                });
            }

            await updateGiveaway({
                ...giveaway,
                spreadsheetUrl: url,
            });
            await fetchGiveaway();
        });
    };

    const onClickViewSpreadsheet = () => {
        if (!giveaway?.spreadsheetUrl) {
            return;
        }
        const newTab = window.open("about:blank", "_blank");
        if (newTab) {
            newTab.location.href = giveaway.spreadsheetUrl;
        }
    };

    const onClickRemoveParticipant = async (userId: string) => {
        if (!giveaway) {
            return;
        }
        const newParticipants = giveaway.participants.filter((user) => user.user_id !== userId);
        await updateGiveaway({
            ...giveaway,
            participants: newParticipants,
        });
        await fetchGiveaway();
    };

    const onClickRemoveWinner = async (userId: string) => {
        if (!giveaway) {
            return;
        }
        const newWinners = giveaway.winners.filter((user) => user.user_id !== userId);
        await updateGiveaway({
            ...giveaway,
            winners: newWinners,
        });
        await fetchGiveaway();
    };

    const onClickExcludeUser = async (user: BroadcasterSubscriber) => {
        if (!giveaway || !twitchApiClient) {
            return;
        }

        try {
            const twitchUser = await twitchApiClient.getUsers({
                id: user.user_id,
            });
            if (twitchUser.isErr()) {
                return;
            }

            for (const exclusion of twitchUser.value.data) {
                await addExclusion({
                    twitchUserId: exclusion.id,
                    displayName: exclusion.display_name,
                    profileImageUrl: exclusion.profile_image_url,
                    username: exclusion.login,
                    updatedAt: new Date().toISOString(),
                });
            }

            await onClickSearchParticipants();
        } catch (error) {
            console.error("Error excluding user:", error);
        }
    };

    return (
        <Layout>
            <div className="flex flex-col gap-4">
                <div className="flex flex-row justify-between items-center flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">{giveaway === null ? <Skeleton className="w-1/2 h-8 rounded-md" /> : giveaway.title}</h1>
                        <p className="text-muted-foreground">{giveaway?.description}</p>
                    </div>
                    <div className="flex flex-row gap-4 flex-wrap">
                        <Button variant="ghost" size="lg" onClick={onClickBack}>
                            <ArrowLeftIcon className="w-4 h-4 mr-2" />
                            <span>{t("NAVIGATE_BACK")}</span>
                        </Button>
                        <Button variant="outline" size="lg" onClick={onClickEdit}>
                            <Edit3Icon className="w-4 h-4 mr-2" />
                            <span>{t("FOLLOWER_GIVEAWAY_FORM_EDIT")}</span>
                        </Button>
                        <Button variant="outline" onClick={onClickSearchParticipants} size="lg">
                            <SearchIcon className="w-4 h-4 mr-2" />
                            <span>{t("FOLLOWER_GIVEAWAY_FORM_SEARCH_PARTICIPANTS")}</span>
                        </Button>
                        <Button variant="outline" size="lg" onClick={onClickDrawWinners} disabled={giveaway?.participants === null || giveaway?.participants.length === 0}>
                            <PartyPopperIcon className="w-4 h-4 mr-2" />
                            <span>{t("FOLLOWER_GIVEAWAY_FORM_DRAW_WINNERS")}</span>
                        </Button>
                    </div>
                </div>
                <div className="flex flex-row gap-4 flex-wrap">
                    <GiveawayInfoCard
                        className="w-[200px]"
                        title="Total de Participantes"
                        icon={UserIcon}
                    >
                        {giveaway?.participants.length ?? 0}
                    </GiveawayInfoCard>
                    <GiveawayInfoCard
                        className="w-[260px]"
                        title="Critério Minimo de Participação"
                        icon={CrownIcon}
                    >
                        {t(`TIER_${giveaway?.subscriptionRequirement ?? 0}`)}
                    </GiveawayInfoCard>
                    <GiveawayInfoCard
                        className="w-[180px]"
                        title="Total de Vencedores"
                        icon={TrophyIcon}
                    >
                        {giveaway?.winners.length ?? 0}
                    </GiveawayInfoCard>
                    <Card>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {giveaway?.subscriberMultiplier &&
                                            Object.entries(giveaway.subscriberMultiplier)
                                                .filter(([tier]) => Number(tier) >= (giveaway?.subscriptionRequirement ?? 0))
                                                .map(([tier, _multiplier]) => (
                                                    <TableHead key={tier} className="text-center">
                                                        {t(`TIER_${tier}`)}
                                                    </TableHead>
                                                ))
                                        }
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        {giveaway?.subscriberMultiplier &&
                                            Object.entries(giveaway.subscriberMultiplier)
                                                .filter(([tier]) => Number(tier) >= (giveaway?.subscriptionRequirement ?? 0))
                                                .map(([tier, multiplier]) => (
                                                    <TableCell key={tier} className="text-center">
                                                        {multiplier}
                                                    </TableCell>
                                                ))
                                        }
                                    </TableRow>
                                </TableBody>
                            </Table>
                            <CardDescription>Multiplicadores por Tier</CardDescription>
                        </CardContent>
                    </Card>
                </div>
                <div className="flex flex-col xl:flex-row flex-wrap xl:flex-nowrap w-full gap-4">
                    <Card className="w-full">
                        <CardHeader className="relative">
                            <CardTitle className="text-2xl font-semibold">Lista de Participantes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(giveaway?.participants === null || giveaway?.participants.length === 0) ? (
                                <div className="flex flex-col h-full">
                                    <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_PARTICIPANTS")}</p>
                                </div>
                            ) : (
                                <TableVirtuoso
                                    style={{ height: "300px" }}
                                    data={giveaway?.participants}
                                    components={{
                                        Table,
                                        TableBody,
                                        TableRow,
                                        TableHead: TableHeader,
                                    }}
                                    fixedHeaderContent={() => (
                                        <TableRow>
                                            <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER")}</TableHead>
                                            <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    )}
                                    itemContent={(_index, user) => [
                                        <TableCell>{user.user_name}</TableCell>,
                                        <TableCell>{t(`TIER_${user.tier}`)}</TableCell>,
                                        <TableCell>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Button variant="ghost" size="icon" onClick={() => onClickRemoveParticipant(user.user_id)}>
                                                            <XIcon />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Remover</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger>
                                                    <Button variant="ghost" size="icon">
                                                        <EllipsisIcon className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => onClickExcludeUser(user)}>
                                                        <BanIcon className="w-4 h-4 mr-2" />
                                                        {t("FOLLOWER_GIVEAWAY_FORM_EXCLUDE_USER")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    ]}
                                />
                            )}
                        </CardContent>
                    </Card>
                    <Card className="w-full">
                        <CardHeader className="relative">
                            <div className="flex flex-row items-center justify-between flex-wrap gap-4">
                                <CardTitle className="text-2xl font-semibold">Lista de Vencedores</CardTitle>
                                <div className="flex flex-row flex-wrap justify-end gap-2">
                                    {giveaway?.spreadsheetUrl && (
                                        <Button variant="outline" size="lg" disabled={giveaway.winners === null || giveaway.winners.length === 0} onClick={onClickViewSpreadsheet}>
                                            <FileSpreadsheetIcon className="w-4 h-4 mr-2" />
                                            Visualizar Planilha
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        disabled={giveaway?.participants === null || giveaway?.participants.length === 0}
                                        onClick={onClickExportWinners}
                                        loading={isExportingResultSheets}
                                    >
                                        <SaveIcon className="w-4 h-4 mr-2" />
                                        Exportar
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {(giveaway?.winners === null || giveaway?.winners.length === 0) ? (
                                <div className="flex flex-col h-full">
                                    <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_WINNERS")}</p>
                                </div>
                            ) : (
                                <TableVirtuoso
                                    style={{ height: "300px" }}
                                    data={giveaway?.winners}
                                    components={{
                                        Table,
                                        TableBody,
                                        TableRow,
                                        TableHead: TableHeader,
                                    }}
                                    fixedHeaderContent={() => (
                                        <TableRow>
                                            <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER")}</TableHead>
                                            <TableHead>{t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER")}</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    )}
                                    itemContent={(_index, user) => [
                                        <TableCell>{user.user_name}</TableCell>,
                                        <TableCell>{t(`TIER_${user.tier}`)}</TableCell>,
                                        <TableCell>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Button variant="ghost" size="icon" onClick={() => onClickRemoveWinner(user.user_id)}>
                                                            <XIcon />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Remover</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                    ]}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            <Dialog open={isFetchingParticipants}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aguarde...</DialogTitle>
                        <DialogDescription>
                            <p className="mb-4">Buscando participantes do sorteio.</p>
                            <Progress value={fetchUsersProgress} />
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
