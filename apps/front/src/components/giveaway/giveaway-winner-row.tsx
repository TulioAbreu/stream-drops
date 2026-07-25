import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { XIcon } from "lucide-react";
import { SubscriptionTierBadge } from "./subscription-tier-badge";

export interface GiveawayWinnerRowProps {
  rank: number;
  name: string;
  avatar: string;
  drawnAt: string;
  tier?: null | 1000 | 2000 | 3000;
  onRemove?: () => void;
  removeLabel?: string;
}

export function GiveawayWinnerRow({
  rank,
  name,
  avatar,
  drawnAt,
  tier,
  onRemove,
  removeLabel = "Remover vencedor",
}: GiveawayWinnerRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
        {rank}
      </div>
      <Avatar>
        <AvatarImage src={avatar} />
        <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm truncate">{name}</p>
          <SubscriptionTierBadge tier={tier} />
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(drawnAt).toLocaleTimeString("pt-BR")}
        </p>
      </div>
      {onRemove && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <XIcon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{removeLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
