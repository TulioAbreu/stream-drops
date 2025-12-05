import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrashIcon, Star, Play, MoreHorizontal } from "lucide-react";
import type { ChatGiveawayTemplate } from "@/database/ChatGiveawayTemplate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TemplateCardProps {
  template: ChatGiveawayTemplate;
  onUse: (template: ChatGiveawayTemplate) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function TemplateCard({ template, onUse, onDelete, disabled }: TemplateCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
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
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onUse(template)}
          disabled={disabled}
        >
          <Play className="w-4 h-4 mr-2" />
          Usar Template
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={disabled} className="shrink-0">
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
      </CardFooter>
    </Card>
  );
}
