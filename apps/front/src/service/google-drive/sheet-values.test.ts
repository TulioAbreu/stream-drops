import { describe, expect, it } from "vitest";
import type { BroadcasterSubscriber } from "@/service/twitch/types";
import {
  buildGiveawaySheetValues,
  GIVEAWAY_SHEET_WINNER_HEADERS,
} from "./index";

function subscriber(
  name: string,
  extra: { drawnAt?: string } = {},
): BroadcasterSubscriber & { drawnAt?: string } {
  return {
    broadcaster_id: "b1",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: "",
    gifter_login: "",
    is_gift: false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: name,
    user_name: name,
    user_login: name.toLowerCase(),
    ...extra,
  };
}

describe("colunas da planilha de Subscribers", () => {
  it("CA-SD2: drawnAt não vira coluna", () => {
    const values = buildGiveawaySheetValues({
      title: "Outubro",
      description: "Sorteio",
      requiredSubscriber: 1000,
      subscriberMultiplier: { "1000": 2, "2000": 3, "3000": 4 },
      participants: [subscriber("Ana")],
      winners: [subscriber("Ana", { drawnAt: "2026-10-08T15:00:00.000Z" })],
    });

    expect(GIVEAWAY_SHEET_WINNER_HEADERS).toEqual([
      "Nome",
      "Tier",
      "Multiplicador",
    ]);
    expect(values.winners[0]).toEqual(["Nome", "Tier", "Multiplicador"]);
    expect(values.winners[1]).toEqual(["Ana", "Tier 1", "2"]);
    expect(values.winners[1]).toHaveLength(3);
    expect(values.participants[1]).toEqual(["Ana", "Tier 1", "2"]);
    expect(values.details.map((row) => row[0])).toEqual([
      "Título",
      "Descrição",
      "Critério de Participação",
      "Ganhadores",
      "Multiplicadores de Sub",
      "Tier 1",
      "Tier 2",
      "Tier 3",
    ]);

    const serialized = JSON.stringify(values);
    expect(serialized).not.toContain("drawnAt");
    expect(serialized).not.toContain("2026-10-08");
    expect(serialized).not.toContain("createdAt");
  });
});
