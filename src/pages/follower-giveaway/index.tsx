import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
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

    const onClickEdit = (id: string) => {
        navigate(`/dashboard/follower-giveaway/${id}`);
    };

    const onClickCreate = () => {
        navigate("/dashboard/follower-giveaway/create");
    };

    const onClickDelete = async (id: string) => {
        await deleteGiveaway(id);
        await fetchGiveaways();
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
                            <TableRow>
                                <TableCell>{giveaway.title}</TableCell>
                                <TableCell>
                                    <div className="flex flex-row gap-4">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <SquareArrowOutUpRight
                                                        className="cursor-pointer hover:filter hover:brightness-75 transition-all"
                                                        onClick={() => onClickEdit(giveaway.id)}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {t("FOLLOWER_GIVEAWAY_TABLE_ACTIONS_OPEN")}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <TrashIcon
                                                        className="cursor-pointer hover:filter hover:brightness-75 transition-all"
                                                        onClick={() => onClickDelete(giveaway.id)}
                                                    />
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
        </Layout>
    )
}