import {
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentPropsWithRef,
  type RefObject,
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
import { reverseWinnersForDisplay } from "@/lib/giveaway-winner-rank";
import { cn } from "@/lib/utils";

interface Props {
  /** Ordem salva (prepend: mais novo primeiro). Só a exibição é invertida. */
  winners: BroadcasterSubscriber[];
  onRemove: (userId: string) => void;
}

function scrollerOf(root: HTMLElement | null): HTMLElement | null {
  const node = root?.querySelector("[data-virtuoso-scroller]");
  return node instanceof HTMLElement ? node : null;
}

function lastRowInside(node: HTMLElement, name: string | undefined): boolean {
  if (!name) return false;
  const row = [...node.querySelectorAll("tbody tr")].find((element) =>
    element.textContent?.includes(name)
  );
  if (!(row instanceof HTMLElement)) return false;
  const rowRect = row.getBoundingClientRect();
  const viewRect = node.getBoundingClientRect();
  return rowRect.bottom <= viewRect.bottom + 2 && rowRect.top >= viewRect.top;
}

function pinScrollerToEnd(
  rootRef: RefObject<HTMLDivElement | null>,
  handleRef: RefObject<TableVirtuosoHandle | null>,
  newestName: string | undefined
) {
  let attempts = 0;
  let frame = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const node = scrollerOf(rootRef.current);
    handleRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "auto",
    });
    if (node) node.scrollTop = node.scrollHeight;
    const atEnd =
      !!node &&
      node.scrollHeight > node.clientHeight + 1 &&
      node.scrollHeight - node.scrollTop - node.clientHeight <= 2 &&
      lastRowInside(node, newestName);
    attempts += 1;
    if (!atEnd && attempts < 60) frame = requestAnimationFrame(tick);
  };

  tick();
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

function holdScroll(
  rootRef: RefObject<HTMLDivElement | null>,
  top: number
) {
  const until = performance.now() + 400;
  let frame = 0;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const node = scrollerOf(rootRef.current);
    if (node && Math.abs(node.scrollTop - top) > 1) node.scrollTop = top;
    if (performance.now() < until) frame = requestAnimationFrame(tick);
  };

  tick();
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
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
  const display = useMemo(() => reverseWinnersForDisplay(winners), [winners]);
  const ref = useRef<TableVirtuosoHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(-1);
  const restoreTopRef = useRef<number | null>(null);
  const actionRef = useRef<"open" | "grow" | "shrink" | "none">("open");
  const pinCancelRef = useRef<() => void>(() => {});
  const [atTop, setAtTop] = useState(true);
  const [firstVisible, setFirstVisible] = useState(0);
  const [flashUserId, setFlashUserId] = useState<string | null>(null);
  const displayRef = useRef(display);
  const flashUserIdRef = useRef(flashUserId);
  displayRef.current = display;
  flashUserIdRef.current = flashUserId;

  if (prevLen.current === -1) {
    actionRef.current = "open";
  } else if (winners.length > prevLen.current) {
    actionRef.current = "grow";
  } else if (winners.length < prevLen.current) {
    actionRef.current = "shrink";
    const node = rootRef.current?.querySelector("[data-virtuoso-scroller]");
    if (node instanceof HTMLElement) restoreTopRef.current = node.scrollTop;
  } else {
    actionRef.current = "none";
  }

  const grew =
    prevLen.current !== -1 && winners.length > prevLen.current;
  if (grew) {
    flashUserIdRef.current = winners[0]?.user_id ?? null;
  }

  useLayoutEffect(() => {
    const action = actionRef.current;
    prevLen.current = winners.length;

    if (action === "shrink") {
      pinCancelRef.current();
      pinCancelRef.current = holdScroll(rootRef, restoreTopRef.current ?? 0);
      return;
    }

    if (action !== "open" && action !== "grow") return;

    pinCancelRef.current();
    if (action === "grow") {
      setFlashUserId(winners[0]?.user_id ?? null);
    }
    const newestName = displayRef.current.at(-1)?.user_name;
    pinCancelRef.current = pinScrollerToEnd(rootRef, ref, newestName);
    if (action !== "grow") return;

    const timer = window.setTimeout(() => setFlashUserId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [winners]);

  useLayoutEffect(() => {
    return () => pinCancelRef.current();
  }, []);

  const Row = useMemo(
    () =>
      forwardRef<
        HTMLTableRowElement,
        ComponentProps<"tr"> & { "data-index"?: number }
      >(function Row(props, rowRef) {
        const idx = props["data-index"];
        const user =
          typeof idx === "number" ? displayRef.current[idx] : undefined;
        const flashing = !!user && user.user_id === flashUserIdRef.current;
        const accent =
          user?.tier === "3000"
            ? "var(--rarity-legendary)"
            : user?.tier === "2000"
              ? "var(--rarity-epic)"
              : user?.tier === "1000"
                ? "var(--rarity-rare)"
                : "var(--border)";
        return (
          <TableRow
            {...props}
            ref={rowRef}
            className={cn(props.className, flashing && "winner-flash")}
            style={{
              ...(typeof props.style === "object" ? props.style : undefined),
              boxShadow: `inset 3px 0 0 ${accent}`,
            }}
          />
        );
      }),
    []
  );

  const components = useMemo(
    () => ({
      Table: VirtuosoTable,
      TableBody,
      TableRow: Row,
      TableHead: TableHeader,
    }),
    [Row]
  );

  return (
    <div className="relative" ref={rootRef}>
      <TableVirtuoso
        ref={ref}
        style={{ height: "300px" }}
        data={display}
        computeItemKey={(_i, user) => user.user_id}
        atTopStateChange={setAtTop}
        rangeChanged={(r) => setFirstVisible(r.startIndex)}
        components={components}
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
          <TableCell key="name" className="font-semibold">
            {user.user_name}
          </TableCell>,
          <TableCell key="tier">{t(`TIER_${user.tier}`)}</TableCell>,
          <TableCell key="actions">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[46px] z-30 -translate-x-1/2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
        >
          <ArrowUp className="size-3" />
          {firstVisible} {firstVisible === 1 ? "anterior" : "anteriores"}
        </div>
      )}
    </div>
  );
}
