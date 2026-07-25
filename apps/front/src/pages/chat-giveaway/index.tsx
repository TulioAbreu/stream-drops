import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogDescription, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useChatGiveawayDb } from "@/database/ChatGiveaway";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { ChatGiveawayFormData } from "@/database/ChatGiveaway";
import { useNavigate } from "react-router";
import { ArrowRight, Copy, MessageSquare, Plus, TrashIcon, MoreHorizontal, FilePlus, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { v7 } from "uuid";
import { DialogTitle } from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChatGiveawayTemplateDb, type ChatGiveawayTemplate } from "@/database/ChatGiveawayTemplate";
import { TemplateCard, TemplateCardOverlay } from "./components/template-card";

export function ChatGiveaway() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { getChatGiveaways, deleteChatGiveaway, addChatGiveaway } = useChatGiveawayDb();
  const { getTemplates, addTemplate, deleteTemplate, updateTemplatesOrder } = useChatGiveawayTemplateDb();

  const [giveaways, setGiveaways] = useState<ChatGiveawayFormData[]>([]);
  const [templates, setTemplates] = useState<ChatGiveawayTemplate[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const [isDeletingGiveaway, startIsDeletingGiveawayTransition] = useTransition();
  const [, startIsDuplicatingGiveawayTransition] = useTransition();
  const [, setDuplicatingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const templateIds = useMemo(() => templates.map((t) => t.id), [templates]);
  const activeDragTemplate = useMemo(
    () => templates.find((t) => t.id === activeDragId) ?? null,
    [templates, activeDragId],
  );

  // Template creation state
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [selectedGiveawayForTemplate, setSelectedGiveawayForTemplate] = useState<ChatGiveawayFormData | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [isCreatingTemplate, startIsCreatingTemplateTransition] = useTransition();
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [isDeleteTemplateDialogOpen, setIsDeleteTemplateDialogOpen] = useState(false);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(giveaways.length / ITEMS_PER_PAGE);
  const currentGiveaways = giveaways.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={i === currentPage}
              onClick={() => setCurrentPage(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={1 === currentPage}
            onClick={() => setCurrentPage(1)}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Ellipsis after first page
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Middle pages
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={i === currentPage}
              onClick={() => setCurrentPage(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Ellipsis before last page
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Always show last page
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            isActive={totalPages === currentPage}
            onClick={() => setCurrentPage(totalPages)}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  const onClickView = (id: string) => {
    navigate(`/dashboard/chat-giveaway/${id}`);
  };

  const onClickCreate = () => {
    navigate("/dashboard/chat-giveaway/create");
  };

  const fetchGiveaways = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    const [giveawaysData, templatesData] = await Promise.all([
      getChatGiveaways(),
      getTemplates()
    ]);
    giveawaysData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setGiveaways(giveawaysData);
    setTemplates(templatesData);
    if (showLoading) setIsLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onClickCreateTemplate = (giveaway: ChatGiveawayFormData) => {
    setSelectedGiveawayForTemplate(giveaway);
    setTemplateName(`${giveaway.title} Template`);
    setIsCreateTemplateOpen(true);
  };

  const onConfirmCreateTemplate = () => {
    if (!selectedGiveawayForTemplate || !templateName.trim()) return;

    startIsCreatingTemplateTransition(async () => {
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, winners, participants, createdAt, updatedAt, ...settings } = selectedGiveawayForTemplate;
      const nextSortOrder =
        templates.length === 0
          ? 0
          : Math.max(...templates.map((t) => t.sortOrder)) + 1;

      const newTemplate: ChatGiveawayTemplate = {
        id: v7(),
        name: templateName,
        settings: settings,
        createdAt: now,
        sortOrder: nextSortOrder,
      };

      await addTemplate(newTemplate);
      await fetchGiveaways(false);
      setIsCreateTemplateOpen(false);
      setSelectedGiveawayForTemplate(null);
      setTemplateName("");
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(templates, oldIndex, newIndex).map((t, index) => ({
      ...t,
      sortOrder: index,
    }));

    setTemplates(reordered);
    await updateTemplatesOrder(reordered.map((t) => t.id));
  };

  const onDragCancel = () => {
    setActiveDragId(null);
  };

  const onClickUseTemplate = async (template: ChatGiveawayTemplate) => {
    startIsCreatingTemplateTransition(async () => {
      const now = new Date().toISOString();
      const newGiveaway: ChatGiveawayFormData = {
        ...template.settings,
        id: v7(),
        title: template.settings.title, // Or maybe prompt for a title? For now use template's stored title
        winners: [],
        participants: [],
        createdAt: now,
        updatedAt: now,
      };
      await addChatGiveaway(newGiveaway);
      await fetchGiveaways(false);
    });
  };

  const onClickDeleteTemplate = (id: string) => {
    setTemplateToDelete(id);
    setIsDeleteTemplateDialogOpen(true);
  };

  const onClickConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    startIsCreatingTemplateTransition(async () => {
      await deleteTemplate(templateToDelete);
      await fetchGiveaways(false);
      setIsDeleteTemplateDialogOpen(false);
      setTemplateToDelete(null);
    });
  };

  const onClickConfirmDeleteGiveaway = async (giveawayId: string) => {
    startIsDeletingGiveawayTransition(async () => {
      await deleteChatGiveaway(giveawayId);
      fetchGiveaways(false);
    });
  };

  const onClickDuplicateGiveaway = async (giveaway: ChatGiveawayFormData) => {
    setDuplicatingId(giveaway.id);
    startIsDuplicatingGiveawayTransition(async () => {
      try {
        const now = new Date();
        const formattedDate = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(now);

        const timestampRegex = /\s\(\d{2}\/\d{2}\/\d{2},?\s\d{2}:\d{2}:\d{2}\)$/;
        let baseTitle = giveaway.title;
        if (timestampRegex.test(baseTitle)) {
          baseTitle = baseTitle.replace(timestampRegex, "");
        }

        const newTitle = `${baseTitle} (${formattedDate})`;

        const nowIso = now.toISOString();
        const duplicatedGiveaway: ChatGiveawayFormData = {
          ...giveaway,
          id: v7(),
          title: newTitle,
          winners: [],
          participants: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await addChatGiveaway(duplicatedGiveaway);
        await fetchGiveaways(false);
      } finally {
        setDuplicatingId(null);
      }
    });
  };

  useEffect(() => {
    fetchGiveaways();
  }, [fetchGiveaways]);

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

      {templates.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Templates</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <SortableContext items={templateIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={onClickUseTemplate}
                    onDelete={onClickDeleteTemplate}
                    disabled={isCreatingTemplate}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeDragTemplate ? (
                <TemplateCardOverlay template={activeDragTemplate} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

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
                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_DRAW_DATE", "Data do Sorteio")}</TableHead>
                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_WINNERS", "Vencedores")}</TableHead>
                <TableHead>{t("CHAT_GIVEAWAY_TABLE_HEADER_ACTIONS", "Ações")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentGiveaways.map((giveaway) => {
                const firstWinnerDate = giveaway.winners.length > 0
                  ? new Date(giveaway.winners[0].drawnAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                  : '-';

                return (
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
                      {giveaway.keyword ? (
                        <Badge variant="outline">{giveaway.keyword}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {firstWinnerDate}
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

                        <Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => onClickDuplicateGiveaway(giveaway)}>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>{t("CHAT_GIVEAWAY_TABLE_ACTIONS_DUPLICATE", "Duplicar")}</span>
                              </DropdownMenuItem>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/dashboard/chat-giveaway/${giveaway.id}/edit`)}
                                        disabled={giveaway.winners.length > 0}
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Editar</span>
                                      </DropdownMenuItem>
                                    </span>
                                  </TooltipTrigger>
                                  {giveaway.winners.length > 0 && (
                                    <TooltipContent side="left">
                                      <p>Este sorteio já ocorreu e não pode mais ser editado.</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => onClickCreateTemplate(giveaway)}>
                                <FilePlus className="mr-2 h-4 w-4" />
                                <span>Criar Template</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DialogTrigger asChild>
                                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                  <TrashIcon className="mr-2 h-4 w-4" />
                                  <span>{t("CHAT_GIVEAWAY_TABLE_ACTIONS_DELETE", "Excluir")}</span>
                                </DropdownMenuItem>
                              </DialogTrigger>
                            </DropdownMenuContent>
                          </DropdownMenu>

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
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>

                {renderPaginationItems()}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
      <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Template</DialogTitle>
            <DialogDescription>
              Crie um template a partir deste sorteio para reutilizar suas configurações.
            </DialogDescription>
          </DialogHeader>

          {selectedGiveawayForTemplate && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="template-name">Nome do Template</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Sorteio Padrão"
                />
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Configurações que serão salvas:</strong></p>
                <ul className="list-disc list-inside">
                  <li>Título: {selectedGiveawayForTemplate.title}</li>
                  <li>Palavra-chave: {selectedGiveawayForTemplate.keyword}</li>
                  <li>Descrição: {selectedGiveawayForTemplate.description || "Nenhuma"}</li>
                  <li>Tempo mín. de inscrição: {selectedGiveawayForTemplate.minimumSuscriptionTimeInMonths} meses</li>
                  <li>Multiplicador de sorte: {selectedGiveawayForTemplate.subscriberMultiplier}x</li>
                  <li>Apenas para inscritos: {selectedGiveawayForTemplate.subscribersOnly ? "Sim" : "Não"}</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onConfirmCreateTemplate} disabled={!templateName.trim() || isCreatingTemplate}>
              {isCreatingTemplate ? "Salvando..." : "Salvar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteTemplateDialogOpen} onOpenChange={setIsDeleteTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Template</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={onClickConfirmDeleteTemplate}
              disabled={isCreatingTemplate}
            >
              {isCreatingTemplate ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
