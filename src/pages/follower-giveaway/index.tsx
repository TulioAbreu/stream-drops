import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogDescription, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useSubscriptionGiveawayDb, type FollowerGiveawayFormData } from "@/database/SubscriptionGiveaway";
import { DialogTitle } from "@radix-ui/react-dialog";
import { ArrowRight, Edit2Icon, Gift, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export function FollowerGiveaway() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const { getGiveaways, deleteGiveaway } = useSubscriptionGiveawayDb();
    const [giveaways, setGiveaways] = useState<FollowerGiveawayFormData[]>([]);
    const [isDeletingGiveaway, startIsDeletingGiveawayTransition] = useTransition();

    const onClickEdit = (id: string) => {
        navigate(`/dashboard/follower-giveaway/${id}/edit`);
    };

    const onClickView = (id: string) => {
        navigate(`/dashboard/follower-giveaway/${id}`);
    };

    const onClickCreate = () => {
        navigate("/dashboard/follower-giveaway/create");
    };

    const fetchGiveaways = useCallback(async () => {
        setIsLoading(true);
        const giveawaysData = await getGiveaways();
        setGiveaways(giveawaysData);
        setIsLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onClickConfirmDeleteGiveaway = async (giveawayId: string) => {
        startIsDeletingGiveawayTransition(async () => {
            await deleteGiveaway(giveawayId);
            fetchGiveaways();
        });
    };

    useEffect(() => {
        fetchGiveaways();
    }, [fetchGiveaways]);

    return (
        <Layout>
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold mb-6">{t("FOLLOWER_GIVEAWAY_TITLE")}</h1>
                <Button variant="outline" onClick={onClickCreate} size="lg">
                    <PlusIcon />
                    <span>{t("FOLLOWER_GIVEAWAY_CREATE_BUTTON")}</span>
                </Button>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : giveaways.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Gift />
                        </EmptyMedia>
                        <EmptyTitle>
                            {t("FOLLOWER_GIVEAWAY_EMPTY_TITLE", "Nenhum sorteio criado ainda")}
                        </EmptyTitle>
                        <EmptyDescription>
                            {t("FOLLOWER_GIVEAWAY_EMPTY_DESCRIPTION", "Comece criando seu primeiro sorteio de inscritos para engajar sua comunidade.")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={onClickCreate}>
                            <PlusIcon />
                            {t("FOLLOWER_GIVEAWAY_CREATE_BUTTON")}
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <div className="flex flex-col gap-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("FOLLOWER_GIVEAWAY_TABLE_HEADER_TITLE")}</TableHead>
                                <TableHead>{t("FOLLOWER_GIVEAWAY_TABLE_HEADER_ACTIONS")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {giveaways.map((giveaway) => (
                                <TableRow key={giveaway.id}>
                                    <TableCell>
                                        <a href={`/dashboard/follower-giveaway/${giveaway.id}`} className="text-blue-500 hover:underline w-full">
                                            {giveaway.title}
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-row gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onClickView(giveaway.id)}
                                                        >
                                                            <ArrowRight className="w-4 h-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {t("FOLLOWER_GIVEAWAY_TABLE_ACTIONS_OPEN")}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onClickEdit(giveaway.id)}>
                                                            <Edit2Icon />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {t("FOLLOWER_GIVEAWAY_TABLE_ACTIONS_EDIT")}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Dialog>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <DialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" disabled={isDeletingGiveaway}>
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {t("FOLLOWER_GIVEAWAY_TABLE_ACTIONS_DELETE")}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>{t("FOLLOWER_GIVEAWAY_DELETE_DIALOG_TITLE", "Confirmar exclusão")}</DialogTitle>
                                                            <DialogDescription>
                                                                {t("FOLLOWER_GIVEAWAY_DELETE_DIALOG_DESCRIPTION", "Tem certeza que deseja excluir este sorteio? Esta ação não pode ser desfeita.")}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <DialogFooter>
                                                            <DialogClose asChild>
                                                                <Button variant="outline" disabled={isDeletingGiveaway}>
                                                                    {t("CANCEL", "Cancelar")}
                                                                </Button>
                                                            </DialogClose>
                                                            <Button
                                                                variant="destructive"
                                                                loading={isDeletingGiveaway}
                                                                onClick={() => onClickConfirmDeleteGiveaway(giveaway.id)}
                                                            >
                                                                {t("DELETE", "Excluir")}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                                            </TooltipProvider>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        }
                                    </TableBody>
                                </Table>
                            </div>
                        )}
        </Layout>
    )
}