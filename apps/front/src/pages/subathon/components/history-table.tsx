import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useTranslation } from "@/i18n";
import type { LedgerEntry } from "@stream-drops/subathon-protocol";
import { Loader2, Undo2 } from "lucide-react";
import {
  canUndoLedgerEntry,
  formatLedgerAmount,
  formatSessionDate,
  formatSignedDuration,
  getLedgerSourceLabelKey,
} from "../utils";

interface HistoryTableProps {
  entries: LedgerEntry[];
  undoingEntryId: string | null;
  connected: boolean;
  onUndo: (entryId: string) => void;
}

export function HistoryTable({
  entries,
  undoingEntryId,
  connected,
  onUndo,
}: HistoryTableProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("SUBATHON_ZONE_HISTORY")}</CardTitle>
        <CardDescription>{t("SUBATHON_AUDIT_TITLE")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("SUBATHON_AUDIT_WHEN")}</TableHead>
              <TableHead>{t("SUBATHON_AUDIT_RESPONSIBLE")}</TableHead>
              <TableHead>{t("SUBATHON_AUDIT_AMOUNT")}</TableHead>
              <TableHead>{t("SUBATHON_AUDIT_DELTA")}</TableHead>
              <TableHead>{t("SUBATHON_AUDIT_SOURCE")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  {t("SUBATHON_AUDIT_EMPTY")}
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatSessionDate(entry.createdAt)}</TableCell>
                  <TableCell>{entry.actor}</TableCell>
                  <TableCell>{formatLedgerAmount(entry)}</TableCell>
                  <TableCell>{formatSignedDuration(entry.deltaMs)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t(getLedgerSourceLabelKey(entry))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canUndoLedgerEntry(entry) ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("SUBATHON_UNDO")}
                              disabled={
                                !connected || undoingEntryId === entry.id
                              }
                              onClick={() => onUndo(entry.id)}
                            >
                              {undoingEntryId === entry.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Undo2 className="size-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("SUBATHON_UNDO")}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
