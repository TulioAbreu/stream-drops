import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";
import { TableVirtuoso, type TableVirtuosoHandle } from "react-virtuoso";
import { ArrowUp, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
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
import { Button } from "@/components/ui/button";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import { cn } from "@/lib/utils";

interface Props {
  /** Ordem salva (prepend: mais novo primeiro). Só a exibição é invertida. */
  winners: BroadcasterSubscriber[];
  onRemove: (userId: string) => void;
}

const VirtuosoTable = forwardRef<
  HTMLTableElement,
  ComponentPropsWithRef<"table">
>(function VirtuosoTable({ className, ...props }, ref) {
  return (
    <table
      ref={ref}
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  );
});

export function SubscriberWinnersTable({ winners, onRemove }: Props) {
  const { t } = useTranslation();
  const display = useMemo(() => [...winners].reverse(), [winners]);
  const ref = useRef<TableVirtuosoHandle>(null);
  const prevLen = useRef(winners.length);
  const [atTop, setAtTop] = useState(true);
  const [firstVisible, setFirstVisible] = useState(0);

  useEffect(() => {
    if (winners.length > prevLen.current) {
      requestAnimationFrame(() =>
        ref.current?.scrollToIndex({ index: "LAST", behavior: "auto" })
      );
    }
    prevLen.current = winners.length;
  }, [winners.length]);

  return (
    <div className="relative">
      <TableVirtuoso
        ref={ref}
        style={{ height: "300px" }}
        data={display}
        initialTopMostItemIndex={display.length - 1}
        computeItemKey={(_i, user) => user.user_id}
        atTopStateChange={setAtTop}
        rangeChanged={(r) => setFirstVisible(r.startIndex)}
        components={{ Table: VirtuosoTable, TableBody, TableHead: TableHeader }}
        fixedHeaderContent={() => (
          <TableRow className="bg-card">
            <TableHead className="w-12 text-muted-foreground">#</TableHead>
            <TableHead>
              {t("FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_TABLE_HEADER")}
            </TableHead>
            <TableHead>
              {t(
                "FOLLOWER_GIVEAWAY_FORM_PARTICIPANTS_SUBSCRIPTION_TIER_TABLE_HEADER"
              )}
            </TableHead>
            <TableHead></TableHead>
          </TableRow>
        )}
        itemContent={(index, user) => [
          <TableCell key="rank" className="w-12 font-mono text-xs text-muted-foreground">
            #{index + 1}
          </TableCell>,
          <TableCell key="name">{user.user_name}</TableCell>,
          <TableCell key="tier">{t(`TIER_${user.tier}`)}</TableCell>,
          <TableCell key="actions">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(user.user_id)}
                  >
                    <XIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remover</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>,
        ]}
      />
      {!atTop && (
        <div className="pointer-events-none absolute inset-x-0 top-[41px] z-20 h-9 bg-gradient-to-b from-card via-card/70 to-transparent" />
      )}
      {firstVisible > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[46px] z-30 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border bg-secondary/95 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
          <ArrowUp className="size-3" />
          {firstVisible} {firstVisible === 1 ? "anterior" : "anteriores"}
        </div>
      )}
    </div>
  );
}
