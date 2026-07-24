import { useCallback, useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type Ref } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrashIcon, Star, Play, MoreHorizontal, GripVertical } from "lucide-react";
import type { ChatGiveawayTemplate } from "@/database/ChatGiveawayTemplate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TemplateCardContentProps {
  template: ChatGiveawayTemplate;
  onUse?: (template: ChatGiveawayTemplate) => void;
  onDelete?: (id: string) => void;
  disabled?: boolean;
  showGrip?: boolean;
  gripProps?: HTMLAttributes<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
  cardRef?: Ref<HTMLDivElement>;
}

const MARQUEE_SPEED_PX_PER_SEC = 50;

function TemplateCardContent({
  template,
  onUse,
  onDelete,
  disabled,
  showGrip = true,
  gripProps,
  className,
  style,
  cardRef,
}: TemplateCardContentProps) {
  const nameRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [marqueeDistance, setMarqueeDistance] = useState(0);
  const [marqueeDuration, setMarqueeDuration] = useState(0);

  const measureOverflow = useCallback(() => {
    const el = nameRef.current;
    if (!el) return;

    const distance = Math.max(0, el.scrollWidth - el.clientWidth);
    setIsOverflowing(distance > 0);
    setMarqueeDistance(distance);
    setMarqueeDuration(distance > 0 ? distance / MARQUEE_SPEED_PX_PER_SEC : 0);
  }, []);

  useEffect(() => {
    measureOverflow();

    const el = nameRef.current;
    if (!el) return;

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureOverflow, template.name]);

  const showMarquee = isOverflowing && isHovering;

  return (
    <Card
      ref={cardRef}
      style={style}
      className={cn(
        "flex flex-row items-center justify-between p-2 pl-2 gap-1 w-full min-w-0",
        className,
      )}
    >
      {showGrip && (
        <button
          type="button"
          className={cn(
            "shrink-0 touch-none p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label="Reordenar template"
          {...gripProps}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div
              className="min-w-0 flex-1 overflow-hidden cursor-default py-2"
              onMouseEnter={() => {
                measureOverflow();
                setIsHovering(true);
              }}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div
                ref={nameRef}
                className={cn(
                  "font-medium whitespace-nowrap",
                  showMarquee ? "template-name-marquee" : "truncate",
                )}
                style={
                  showMarquee
                    ? ({
                        "--marquee-distance": `${marqueeDistance}px`,
                        "--marquee-duration": `${marqueeDuration}s`,
                      } as CSSProperties)
                    : undefined
                }
              >
                {template.name}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" sideOffset={10} className="max-w-[300px] p-3 bg-popover text-popover-foreground border [&_.tooltip-arrow]:bg-popover [&_.tooltip-arrow]:fill-popover">
            <div className="flex flex-wrap gap-2">
              {template.settings.keyword && (
                <Badge variant="secondary">{template.settings.keyword}</Badge>
              )}
              {template.settings.subscribersOnly && (
                <Badge variant="outline" className="border-[#9146FF] text-[#9146FF] gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Sub Only
                </Badge>
              )}
              {template.settings.minimumSuscriptionTimeInMonths > 0 && (
                <Badge variant="outline">
                  Min. {template.settings.minimumSuscriptionTimeInMonths} meses
                </Badge>
              )}
              {template.settings.subscriberMultiplier > 1 && (
                <Badge variant="outline">
                  {template.settings.subscriberMultiplier}x Sorte Sub
                </Badge>
              )}
              {!template.settings.keyword && !template.settings.subscribersOnly && template.settings.minimumSuscriptionTimeInMonths === 0 && template.settings.subscriberMultiplier <= 1 && (
                <span className="text-sm text-muted-foreground">Sem configurações adicionais</span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onUse?.(template)}
                disabled={disabled || !onUse}
              >
                <Play className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Usar Template</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={disabled || !onDelete} className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => onDelete?.(template.id)}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>Excluir</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipProvider>
    </Card>
  );
}

interface TemplateCardProps {
  template: ChatGiveawayTemplate;
  onUse: (template: ChatGiveawayTemplate) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function TemplateCard({
  template,
  onUse,
  onDelete,
  disabled,
}: TemplateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: template.id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="w-full">
        <TemplateCardPlaceholder />
      </div>
    );
  }

  return (
    <TemplateCardContent
      template={template}
      onUse={onUse}
      onDelete={onDelete}
      disabled={disabled}
      showGrip
      gripProps={{ ...attributes, ...listeners }}
      cardRef={setNodeRef}
      style={style}
    />
  );
}

/** Floating card shown under the cursor while dragging */
export function TemplateCardOverlay({ template }: { template: ChatGiveawayTemplate }) {
  return (
    <TemplateCardContent
      template={template}
      showGrip
      className="shadow-lg cursor-grabbing"
      disabled
    />
  );
}

/** Empty slot shown at the drop target while dragging */
export function TemplateCardPlaceholder() {
  return (
    <div
      className="w-full min-h-[52px] rounded-xl border border-dashed border-muted-foreground/40 bg-transparent"
      aria-hidden
    />
  );
}
