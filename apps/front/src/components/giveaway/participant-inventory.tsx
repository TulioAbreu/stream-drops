import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InventoryPanel } from "@/components/shell/inventory-panel";

export interface ParticipantInventoryItem {
  id: string;
  displayName: string;
  avatar?: string;
  subscriber?: boolean;
  tier?: null | 1000 | 2000 | 3000;
  subscriptionMonths?: number;
}

interface ParticipantInventoryProps {
  title: string;
  status?: React.ReactNode;
  summary?: React.ReactNode;
  filter: string;
  onFilterChange: (value: string) => void;
  filterLabel: string;
  participants: ParticipantInventoryItem[];
  empty?: React.ReactNode;
}

function tierAccent(tier: ParticipantInventoryItem["tier"]): string | undefined {
  if (tier === 3000) return "var(--rarity-legendary)";
  if (tier === 2000) return "var(--rarity-epic)";
  if (tier === 1000) return "var(--rarity-rare)";
  return undefined;
}

function tierInk(tier: ParticipantInventoryItem["tier"]): string | undefined {
  if (tier === 3000) return "var(--rarity-legendary-foreground)";
  if (tier === 2000) return "var(--rarity-epic-foreground)";
  if (tier === 1000) return "var(--rarity-rare-foreground)";
  return undefined;
}

export function ParticipantInventory({
  title,
  status,
  summary,
  filter,
  onFilterChange,
  filterLabel,
  participants,
  empty,
}: ParticipantInventoryProps) {
  return (
    <InventoryPanel
      title={title}
      meta={status}
      className="min-h-0"
      bodyClassName="flex min-h-[420px] flex-col"
    >
      {summary ? (
        <div className="mb-3 space-y-1 text-sm text-muted-foreground">
          {summary}
        </div>
      ) : null}
      <Input
        placeholder={filterLabel}
        aria-label={filterLabel}
        value={filter}
        onChange={(event) => onFilterChange(event.target.value)}
        className="h-8"
      />
      {participants.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10">
          {empty}
        </div>
      ) : (
        <ul className="mt-3 grid flex-1 grid-cols-3 content-start gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {participants.map((participant) => {
            const accent = tierAccent(participant.tier);
            const ink = tierInk(participant.tier);
            const months =
              participant.subscriptionMonths && participant.subscriptionMonths > 0
                ? participant.subscriptionMonths
                : null;
            return (
              <li
                key={participant.id}
                data-participant-id={participant.id}
                data-tier={participant.tier ?? undefined}
                className="relative flex aspect-[1/1.12] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] border border-border bg-[var(--sd-surface-2)] px-1 py-1.5"
                style={
                  accent
                    ? {
                        borderColor: `color-mix(in srgb, ${accent} 70%, transparent)`,
                        background: `radial-gradient(circle at 50% 0%, color-mix(in srgb, ${accent} 22%, transparent), transparent 70%), var(--sd-surface-2)`,
                      }
                    : undefined
                }
              >
                {months ? (
                  <span
                    className="absolute top-1 left-1.5 font-mono text-[9px] font-bold"
                    style={{ color: ink ?? "var(--muted-foreground)" }}
                  >
                    {months}M
                  </span>
                ) : null}
                <Avatar className="size-[30px]">
                  {participant.avatar ? (
                    <AvatarImage src={participant.avatar} alt="" />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {participant.displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-center text-[10.5px] font-semibold text-foreground/85">
                  {participant.displayName}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </InventoryPanel>
  );
}
