import { Layout } from "@/components/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubscriptionGiveawayDb, type FollowerGiveawayFormData } from "@/database";
import { Delete, DeleteIcon, Edit2Icon, EditIcon, Trash2Icon, TrashIcon,  } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

export function FollowerGiveaway() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const { getGiveaways } = useSubscriptionGiveawayDb();
    const [giveaways, setGiveaways] = useState<FollowerGiveawayFormData[]>([]);

    const onClickEdit = (id: string) => {
        navigate(`/dashboard/follower-giveaway/${id}`);
    };

    useEffect(() => {
        const fetchGiveaways = async () => {
            setIsLoading(true);
            const giveawaysData = await getGiveaways();
            setGiveaways(giveawaysData);
            setIsLoading(false);
        };
        fetchGiveaways();
    }, [getGiveaways]);

    return (
        <Layout>
            
            <h1 className="text-2xl font-bold mb-6">{t("FOLLOWER_GIVEAWAY_TITLE")}</h1>
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
                                        <Edit2Icon
                                            className="cursor-pointer"
                                            onClick={() => onClickEdit(giveaway.id)}
                                        />
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