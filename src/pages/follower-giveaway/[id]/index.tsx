import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionGiveawayDb, type FollowerGiveawayFormData } from "@/database";
import { useTwitchApi } from "@/hooks/use-twitch-api";
import { getGiveawayResult } from "@/service/giveaway";
import { exportGiveawayResultToSheets } from "@/service/google-drive";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { ArrowLeftIcon, CrownIcon, FileSpreadsheetIcon, PartyPopperIcon, SaveIcon, SearchIcon, UserIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { TableVirtuoso } from "react-virtuoso";

export function FollowerGiveawayId() {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { twitchApiClient, userData } = useTwitchApi();
    const [users, setUsers] = useState<BroadcasterSubscriber[] | null>(null);
    const [winners, setWinners] = useState<BroadcasterSubscriber[] | null>(null);
    const [_isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
    const { getGiveaway, updateGiveaway } = useSubscriptionGiveawayDb();
    const [giveaway, setGiveaway] = useState<FollowerGiveawayFormData | null>(null);
    const navigate = useNavigate();
    const [isFetchingParticipants, startFetchParticipantsTransition] = useTransition();
    const [fetchUsersProgress, setFetchUsersProgress] = useState<number>(0);

    const fetchGiveaway = async () => {
        if (!id) {
            return;
        }
        const giveawayData = await getGiveaway(id);
        if (giveawayData) {
            setGiveaway(giveawayData);
            if (giveawayData.participants) {
                setUsers(giveawayData.participants);
            }
            if (giveawayData.winners) {
                setWinners(giveawayData.winners);
            }
        }
    };

    useEffect(() => {
        fetchGiveaway();
    }, [id, getGiveaway]);

    const onClickBack = () => {
        navigate("/dashboard/follower-giveaway");
    };

    const onClickSearchParticipants = async () => {
        startFetchParticipantsTransition(async () => {
            if (!twitchApiClient || !userData) {
                return;
            }
            setFetchUsersProgress(0);
            const subscriptions: BroadcasterSubscriber[] = [];
            let nextPage = undefined;
            let totalPages = 0;
            do {
                const response = await twitchApiClient.getBroadcasterSubscriptions({
                    broadcaster_id: userData?.id,
                    first: "100",
                    after: nextPage,
                });
                if (response.isErr()) {
                    console.error("Error fetching subscriptions:", response.error);
                    return;
                } else {
                    totalPages = Math.ceil(response.value.total / 100);
                    subscriptions.push(...response.value.data);
                    nextPage = response.value.pagination.cursor;
                    setFetchUsersProgress((prev) => Math.min(prev + 100 / totalPages, 100));
                }
            } while (nextPage);
            setUsers(subscriptions);
        });
    };

    const onClickDrawWinners = async () => {
        if (!giveaway || !twitchApiClient || !userData) {
            return;
        }
        const winner = getGiveawayResult({
            participants: users ?? [],
            requiredSubscriber: giveaway?.requiredSubscriber ?? 0,
            subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                "1000": 1,
                "2000": 1,
                "3000": 1,
            },
            totalWinners: 1,
        });
        await updateGiveaway({
            ...giveaway,
            id: giveaway.id,
            winners: [...(winners ?? []), ...winner] as BroadcasterSubscriber[],
            participants: users ?? [] as BroadcasterSubscriber[],
        });
        setWinners((winners) => [...winner, ...(winners ?? [])]);
    };

    const onClickExportWinners = async () => {
        if (!giveaway) {
            return;
        }

        const newTab = window.open("about:blank", "_blank");
        const url = await exportGiveawayResultToSheets({
            participants: users ?? [],
            winners: winners ?? [],
            requiredSubscriber: giveaway?.requiredSubscriber ?? 0,
            subscriberMultiplier: giveaway?.subscriberMultiplier ?? {
                "1000": 1,
                "2000": 1,
                "3000": 1,
            },
            title: giveaway?.title ?? "",
            description: giveaway?.description ?? "",
        });
        await updateGiveaway({
            ...giveaway,
            spreadsheetUrl: url,
        });
        fetchGiveaway();

        if (newTab) {
            newTab.location.href = url;
        }
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

    return (
        <Layout>
            <div className="flex flex-row justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{giveaway === null ? <Skeleton className="w-1/2 h-8 rounded-md" /> : giveaway.title}</h1>
                    <p className="text-muted-foreground">{giveaway?.description}</p>
                </div>
                <div className="flex flex-row gap-4">
                    <Button variant="ghost" size="lg" onClick={onClickBack}>
                        <ArrowLeftIcon className="w-4 h-4 mr-2" />
                        <span>{t("NAVIGATE_BACK")}</span>
                    </Button>
                    <Button variant="outline" onClick={onClickSearchParticipants} size="lg">
                        <SearchIcon className="w-4 h-4 mr-2" />
                        <span>{t("FOLLOWER_GIVEAWAY_FORM_SEARCH_PARTICIPANTS")}</span>
                    </Button>
                    <Button variant="outline" size="lg" onClick={onClickDrawWinners} disabled={users === null || users.length === 0}>
                        <PartyPopperIcon className="w-4 h-4 mr-2" />
                        <span>{t("FOLLOWER_GIVEAWAY_FORM_DRAW_WINNERS")}</span>
                    </Button>
                </div>
            </div>
            <div className="flex flex-row gap-4 mb-4">
                <Card className="w-[200px]">
                    <CardHeader className="relative">
                        <CardDescription>Total de Participantes</CardDescription>
                        <CardTitle className="text-3xl font-semibold tabular-nums">
                            <div className="flex flex-row gap-2 items-center">
                                <UserIcon className="w-6 h-6" />
                                {users?.length ?? 0}
                            </div>
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="w-[200px]">
                    <CardHeader className="relative">
                        <CardDescription>Critério de Participação</CardDescription>
                        <CardTitle className="text-3xl font-semibold tabular-nums">
                            <div className="flex flex-row gap-2 items-center">
                                <CrownIcon className="w-6 h-6" />
                                {t(`TIER_${giveaway?.requiredSubscriber ?? 0}`)}
                            </div>
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>
            <div className="flex flex-row w-full gap-4 mb-4 nowrap">
                <Card className="w-full">
                    <CardHeader className="relative">
                        <CardTitle className="text-2xl font-semibold">Lista de Participantes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(users === null || users.length === 0) ? (
                            <div className="flex flex-col h-full">
                                <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_PARTICIPANTS")}</p>
                            </div>
                        ) : (
                            <TableVirtuoso
                                style={{ height: "300px" }}
                                data={users}
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
                                                    <Button variant="ghost" size="icon">
                                                        <XIcon />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Remover {user.user_name}</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                ]}
                            />
                        )}
                    </CardContent>
                </Card>
                <Card className="w-full">
                    <CardHeader className="relative">
                        <div className="flex flex-row items-center justify-between">
                            <CardTitle className="text-2xl font-semibold">Lista de Vencedores</CardTitle>
                            <div className="flex flex-row gap-2">
                                {giveaway?.spreadsheetUrl ? (
                                    <Button variant="outline" size="lg" disabled={winners === null || winners.length === 0} onClick={onClickViewSpreadsheet}>
                                        <FileSpreadsheetIcon className="w-4 h-4 mr-2" />
                                        Visualizar Planilha
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="lg" disabled={users === null || users.length === 0} onClick={onClickExportWinners}>
                                        <SaveIcon className="w-4 h-4 mr-2" />
                                        Exportar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(winners === null || winners.length === 0) ? (
                            <div className="flex flex-col h-full">
                                <p>{t("FOLLOWER_GIVEAWAY_FORM_NO_WINNERS")}</p>
                            </div>
                        ) : (
                            <TableVirtuoso
                                style={{ height: "300px" }}
                                data={winners}
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
                                                    <Button variant="ghost" size="icon">
                                                        <XIcon />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Remover {user.user_name}</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                ]}
                            />
                        )}
                    </CardContent>
                </Card>
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
            </div>
        </Layout>
    );
}
