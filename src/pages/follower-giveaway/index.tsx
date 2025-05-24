import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSubscriptionGiveawayDb, type FollowerGiveawayFormData } from "@/database";
import { PlusIcon, SquareArrowOutUpRight, TrashIcon  } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export function FollowerGiveaway() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [_isLoading, setIsLoading] = useState(false);
    const { getGiveaways, deleteGiveaway } = useSubscriptionGiveawayDb();
    const [giveaways, setGiveaways] = useState<FollowerGiveawayFormData[]>([]);
    const [giveawayIdToDelete, setGiveawayIdToDelete] = useState<string | null>(null);

    const onClickEdit = (id: string) => {
        navigate(`/dashboard/follower-giveaway/${id}`);
    };

    const onClickCreate = () => {
        navigate("/dashboard/follower-giveaway/create");
    };

    const onClickDelete = async (id: string) => {
        setGiveawayIdToDelete(id);
    };

    const fetchGiveaways = async () => {
        setIsLoading(true);
        const giveawaysData = await getGiveaways();
        setGiveaways(giveawaysData);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchGiveaways();
    }, [getGiveaways, fetchGiveaways]);

    return (
        <Layout>
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold mb-6">{t("FOLLOWER_GIVEAWAY_TITLE")}</h1>
                <Button variant="outline" onClick={onClickCreate} size="lg">
                    <PlusIcon/>
                    <span>{t("FOLLOWER_GIVEAWAY_CREATE_BUTTON")}</span>
                </Button>
            </div>
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
                                                <TooltipTrigger>
                                                    <Button
                                                        variant="ghost"
                                                        size="lg"
                                                        onClick={() => onClickEdit(giveaway.id)}
                                                    >
                                                        <SquareArrowOutUpRight className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t("FOLLOWER_GIVEAWAY_TABLE_ACTIONS_OPEN")}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Button
                                                        variant="ghost"
                                                        size="lg"
                                                        onClick={() => onClickDelete(giveaway.id)}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t("FOLLOWER_GIVEAWAY_TABLE_ACTIONS_DELETE")}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <Dialog open={!!giveawayIdToDelete} onOpenChange={() => setGiveawayIdToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <h2 className="text-lg font-semibold">{t("FOLLOWER_GIVEAWAY_DELETE_DIALOG_TITLE", "Confirmar exclusão")}</h2>
                    </DialogHeader>
                    <p>{t("FOLLOWER_GIVEAWAY_DELETE_DIALOG_DESCRIPTION", "Tem certeza que deseja excluir este sorteio? Esta ação não pode ser desfeita.")}</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGiveawayIdToDelete(null)}>
                            {t("CANCEL", "Cancelar")}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                if (giveawayIdToDelete) {
                                    await deleteGiveaway(giveawayIdToDelete);
                                    setGiveawayIdToDelete(null);
                                    fetchGiveaways();
                                }
                            }}
                        >
                            {t("DELETE", "Excluir")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    )
}