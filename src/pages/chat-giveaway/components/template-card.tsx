import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrashIcon, Star, Play, MoreHorizontal } from "lucide-react";
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

interface TemplateCardProps {
  template: ChatGiveawayTemplate;
  onUse: (template: ChatGiveawayTemplate) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function TemplateCard({ template, onUse, onDelete, disabled }: TemplateCardProps) {
  return (
    <Card className="flex flex-row items-center justify-between p-2 pl-4 gap-2 w-fit max-w-full">
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="font-medium flex-grow cursor-default py-2 whitespace-nowrap">
              {template.name}
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
                onClick={() => onUse(template)}
                disabled={disabled}
              >
                <Play className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Usar Template</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={disabled} className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => onDelete(template.id)}
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
