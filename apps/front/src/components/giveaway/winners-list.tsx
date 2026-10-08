import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const PIN_WINDOW_MS = 500;

interface WinnersListProps {
  className?: string;
  /**
   * Muda quando surge um novo sorteado (novo pendente / re-sorteio).
   * null = sem pendente.
   */
  triggerKey: string | null;
  pending?: ReactNode;
  pendingRank?: number;
  children: ReactNode;
}

/**
 * Lista cronológica com auto-scroll instantâneo até o fim.
 * - Abre já no fim (S1)
 * - A cada novo triggerKey (não-nulo) rola para o fim e mantém fixado
 *   por ~500ms (ResizeObserver)
 * - Ficar null (confirmar/cancelar) não dispara scroll
 */
export function WinnersList({
  className,
  triggerKey,
  pending,
  pendingRank,
  children,
}: WinnersListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastKeyRef = useRef<string | null>(null);

  if (triggerKey) lastKeyRef.current = triggerKey;
  const effectiveKey = triggerKey ?? lastKeyRef.current;

  const [scrolledFromTop, setScrolledFromTop] = useState(false);
  const [hiddenAbove, setHiddenAbove] = useState(0);

  const updateIndicators = useCallback(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;

    setScrolledFromTop(vp.scrollTop > 2);

    const items = Array.from(
      content.querySelectorAll<HTMLElement>("[data-winner-item]")
    );
    const top = vp.scrollTop;
    setHiddenAbove(
      items.filter((el) => el.offsetTop + el.offsetHeight * 0.5 <= top).length
    );
  }, []);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const toEnd = () => {
      if (vp.scrollHeight > vp.clientHeight) {
        vp.scrollTop = vp.scrollHeight;
      }
      updateIndicators();
    };

    toEnd();
    const raf = requestAnimationFrame(toEnd);

    const ro = new ResizeObserver(toEnd);
    if (contentRef.current) ro.observe(contentRef.current);
    const timeout = window.setTimeout(() => ro.disconnect(), PIN_WINDOW_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      ro.disconnect();
    };
  }, [effectiveKey, updateIndicators]);

  const showFade = scrolledFromTop;

  return (
    <div className="relative">
      <ScrollArea
        className={className}
        viewportRef={viewportRef}
        onScrollCapture={updateIndicators}
      >
        <div ref={contentRef} className="space-y-3">
          {children}
          {pending && (
            <div
              className="flex items-center gap-2 pt-1 text-xs text-muted-foreground"
              data-pending-separator
            >
              <div className="flex-1 border-t border-dashed border-border" />
              <span className="font-medium">
                <span className="font-mono text-foreground">
                  #{pendingRank}
                </span>{" "}
                · aguardando confirmação
              </span>
              <div className="flex-1 border-t border-dashed border-border" />
            </div>
          )}
          {pending}
        </div>
      </ScrollArea>
      {showFade && (
        <div className="pointer-events-none absolute inset-x-0 right-4 top-0 z-20 h-10 bg-gradient-to-b from-card via-card/70 to-transparent" />
      )}
      {hiddenAbove > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1.5 z-30 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border bg-secondary/95 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
          <ArrowUp className="size-3" />
          {hiddenAbove} {hiddenAbove === 1 ? "anterior" : "anteriores"}
        </div>
      )}
    </div>
  );
}
