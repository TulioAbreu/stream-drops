import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouletteDb, type RouletteData } from "@/database/Roulette";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Copy,
  Disc3,
  MoreHorizontal,
  Plus,
  TrashIcon,
} from "lucide-react";
import { v7 } from "uuid";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

const ITEMS_PER_PAGE = 10;

export function RoulettePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getRoulettes, deleteRoulette, addRoulette } = useRouletteDb();

  const [isLoading, setIsLoading] = useState(false);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [, startDuplicateTransition] = useTransition();

  const totalPages = Math.ceil(roulettes.length / ITEMS_PER_PAGE);
  const currentRoulettes = roulettes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const fetchRoulettes = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    const data = await getRoulettes();
    data.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    setRoulettes(data);
    if (showLoading) setIsLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRoulettes();
  }, [fetchRoulettes]);

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

      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

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

      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

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

  const onClickDuplicate = (roulette: RouletteData) => {
    startDuplicateTransition(async () => {
      const now = new Date();
      const formattedDate = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now);

      const timestampRegex = /\s\(\d{2}\/\d{2}\/\d{2},?\s\d{2}:\d{2}:\d{2}\)$/;
      let baseTitle = roulette.title;
      if (timestampRegex.test(baseTitle)) {
        baseTitle = baseTitle.replace(timestampRegex, "");
      }

      const nowIso = now.toISOString();
      await addRoulette({
        id: v7(),
        title: `${baseTitle} (${formattedDate})`,
        options: [...roulette.options],
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      await fetchRoulettes(false);
    });
  };

  const onClickConfirmDelete = (id: string) => {
    startDeleteTransition(async () => {
      await deleteRoulette(id);
      await fetchRoulettes(false);
    });
  };

  return (
    <Layout>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-6">
          {t("ROULETTE_TITLE", "Roleta")}
        </h1>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/roulette/new")}
          size="lg"
        >
          <Plus />
          <span>{t("ROULETTE_CREATE_BUTTON", "Nova Roleta")}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : roulettes.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Disc3 />
            </EmptyMedia>
            <EmptyTitle>
              {t("ROULETTE_EMPTY_TITLE", "Nenhuma roleta salva ainda")}
            </EmptyTitle>
            <EmptyDescription>
              {t(
                "ROULETTE_EMPTY_DESCRIPTION",
                "Crie uma roleta, adicione opções e salve para encontrá-la aqui depois."
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate("/dashboard/roulette/new")}>
              <Plus />
              {t("ROULETTE_CREATE_BUTTON", "Nova Roleta")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("ROULETTE_TABLE_HEADER_TITLE", "Título")}
                </TableHead>
                <TableHead>
                  {t("ROULETTE_TABLE_HEADER_OPTIONS", "Opções")}
                </TableHead>
                <TableHead>
                  {t("ROULETTE_TABLE_HEADER_UPDATED", "Atualizada em")}
                </TableHead>
                <TableHead>
                  {t("ROULETTE_TABLE_HEADER_ACTIONS", "Ações")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRoulettes.map((roulette) => {
                const updatedAt = new Date(roulette.updatedAt).toLocaleString(
                  "pt-BR",
                  {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                );

                return (
                  <TableRow key={roulette.id}>
                    <TableCell>
                      <a
                        href={`/dashboard/roulette/${roulette.id}`}
                        className="text-blue-500 hover:underline w-full"
                      >
                        {roulette.title}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono tabular-nums">
                        {roulette.options.length}
                      </Badge>
                    </TableCell>
                    <TableCell>{updatedAt}</TableCell>
                    <TableCell>
                      <div className="flex flex-row gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  navigate(`/dashboard/roulette/${roulette.id}`)
                                }
                              >
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("ROULETTE_TABLE_ACTIONS_OPEN", "Abrir")}
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
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => onClickDuplicate(roulette)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                <span>
                                  {t(
                                    "ROULETTE_TABLE_ACTIONS_DUPLICATE",
                                    "Duplicar"
                                  )}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DialogTrigger asChild>
                                <DropdownMenuItem
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <TrashIcon className="mr-2 h-4 w-4" />
                                  <span>
                                    {t(
                                      "ROULETTE_TABLE_ACTIONS_DELETE",
                                      "Excluir"
                                    )}
                                  </span>
                                </DropdownMenuItem>
                              </DialogTrigger>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                {t(
                                  "ROULETTE_DELETE_DIALOG_TITLE",
                                  "Confirmar exclusão"
                                )}
                              </DialogTitle>
                              <DialogDescription>
                                {t(
                                  "ROULETTE_DELETE_DIALOG_DESCRIPTION",
                                  "Tem certeza que deseja excluir esta roleta? Esta ação não pode ser desfeita."
                                )}
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline" disabled={isDeleting}>
                                  {t("CANCEL", "Cancelar")}
                                </Button>
                              </DialogClose>
                              <Button
                                variant="destructive"
                                loading={isDeleting}
                                onClick={() =>
                                  onClickConfirmDelete(roulette.id)
                                }
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
                    onClick={() =>
                      setCurrentPage((p) => Math.max(1, p - 1))
                    }
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}
    </Layout>
  );
}
