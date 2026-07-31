import { hasSubathonTwitchScopes } from "@/lib/twitch-oauth";

export type SubathonTwitchAccessBlockReason = "missing_scope";

export function getSubathonTwitchAccessBlock(params: {
  scopes?: string[] | null;
}): SubathonTwitchAccessBlockReason | null {
  if (!hasSubathonTwitchScopes(params.scopes)) {
    return "missing_scope";
  }
  return null;
}
