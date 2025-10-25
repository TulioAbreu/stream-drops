import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogDescription, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { useNavigate } from "react-router";
import { ArrowRight, Edit2Icon, MessageSquare, Plus, TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DialogTitle } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";

export function ChatGiveaway() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const { getChatGiveaways, deleteChatGiveaway } = useChatGiveawayDb();
    const [giveaways, setGiveaways] = useState<ChatGiveawayFormData[]>([]);
    const [isDeletingGiveaway, startIsDeletingGiveawayTransition] = useTransition();

    const tierLabels: Record<string, string> = {
        "free": "Free",
        "1000": "Tier 1",
        "2000": "Tier 2",
        "3000": "Tier 3",
    };

    const onClickEdit = (id: string) => {
        navigate(`/dashboard/chat-giveaway/${id}/edit`);
    };

    const onClickView = (id: string) => {
        navigate(`/dashboard/chat-giveaway/${id}`);
    };

    const onClickCreate = () => {
        navigate("/dashboard/chat-giveaway/create");
    };

    const fetchGiveaways = useCallback(async () => {
        setIsLoading(true);
        const giveawaysData = await getChatGiveaways();
        setGiveaways(giveawaysData);
        setIsLoading(false);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const onClickConfirmDeleteGiveaway = async (giveawayId: string) => {
        startIsDeletingGiveawayTransition(async () => {
            await deleteChatGiveaway(giveawayId);
            fetchGiveaways();
        });
    };

    useEffect(() => {
        const loadGiveaways = async () => {
            const data = await getChatGiveaways();
            setGiveaways(data);
        };
        loadGiveaways();
    }, [getChatGiveaways]);

    return (
        <Layout>
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold mb-6">
                    {t("CHAT_GIVEAWAY_TITLE", "Chat Giveaways")}
                </h1>
                <Button variant="outline" onClick={onClickCreate} size="lg">
                    <Plus />
                    <span>{t("CHAT_GIVEAWAY_CREATE_BUTTON", "Novo Sorteio")}</span>
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
                            <MessageSquare />
                        </EmptyMedia>
                        <EmptyTitle>
                            {t("CHAT_GIVEAWAY_EMPTY_TITLE", "Nenhum sorteio de chat criado ainda")}
                        </EmptyTitle>
                        <EmptyDescription>
                            {t("CHAT_GIVEAWAY_EMPTY_DESCRIPTION", "Comece criando seu primeiro sorteio baseado em mensagens do chat para engajar sua comunidade.")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={onClickCreate}>
                            <Plus />
                            {t("CHAT_GIVEAWAY_CREATE_BUTTON", "Criar Sorteio")}
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <div className="flex flex-col gap-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_TITLE", "Título")}</TableHead>
                                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_KEYWORD", "Palavra-chave")}</TableHead>
                                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_TIER", "Tier Mínima")}</TableHead>
                                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_WINNERS", "Vencedores")}</TableHead>
                                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_ACTIONS", "Ações")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {giveaways.map((giveaway) => (
                                <TableRow key={giveaway.id}>
                                    <TableCell>
                                        <a 
                                            href={`/dashboard/chat-giveaway/${giveaway.id}`} 
                                            className="text-blue-500 hover:underline w-full"
                                        >
                                            {giveaway.title}
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{giveaway.keyword}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {tierLabels[giveaway.minimumTier] || giveaway.minimumTier}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {giveaway.winners.length}
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
                                                        {t("CHAT_GIVEAWAY_TABLE_ACTIONS_OPEN", "Abrir")}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => onClickEdit(giveaway.id)}
                                                        >
                                                            <Edit2Icon />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {t("CHAT_GIVEAWAY_TABLE_ACTIONS_EDIT", "Editar")}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <TooltipProvider>
                                                <Dialog>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <DialogTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    disabled={isDeletingGiveaway}
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {t("CHAT_GIVEAWAY_TABLE_ACTIONS_DELETE", "Excluir")}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>
                                                                {t("CHAT_GIVEAWAY_DELETE_DIALOG_TITLE", "Confirmar exclusão")}
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                {t("CHAT_GIVEAWAY_DELETE_DIALOG_DESCRIPTION", "Tem certeza que deseja excluir este sorteio? Esta ação não pode ser desfeita.")}
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
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Layout>
    );
}
