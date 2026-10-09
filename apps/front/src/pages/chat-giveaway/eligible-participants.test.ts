import { describe, expect, it, vi } from "vitest";
import type { ChatParticipant } from "./types";
import {
  buildChatGiveawayPools,
  unionChatParticipants,
} from "./eligible-participants";
import {
  drawWinner,
  summarizeChatDrawChance,
} from "@/service/chat-giveaway";

function person(
  id: string,
  displayName: string,
  extras: Partial<ChatParticipant> = {},
): ChatParticipant {
  return {
    id,
    name: id,
    displayName,
    avatar: "https://example.com/a.png",
    subscriber: false,
    joinedAt: 1,
    ...extras,
  };
}

describe("pools do sorteio de chat", () => {
  it("CA-C1 e CA-C2: o filtro só muda a exibição; a união gravada fica inteira", () => {
    const saved = [
      person("ana-1", "Ana Um"),
      person("bruno", "Bruno"),
      person("carla", "Carla"),
    ];
    const live = [
      person("ana-1", "Ana Um Live", { joinedAt: 5 }),
      person("edu", "Edu"),
    ];

    const pools = buildChatGiveawayPools({
      saved,
      live,
      excludedUserIds: [],
      broadcasterId: "broadcaster-1",
      nameFilter: "ana",
    });

    expect(pools.eligible.map((item) => item.id)).toEqual([
      "ana-1",
      "bruno",
      "carla",
      "edu",
    ]);
    expect(pools.displayed.map((item) => item.id)).toEqual(["ana-1"]);
    expect(pools.persisted.map((item) => item.id)).toEqual([
      "ana-1",
      "bruno",
      "carla",
      "edu",
    ]);
    expect(pools.persisted.find((item) => item.id === "ana-1")?.displayName).toBe(
      "Ana Um Live",
    );
    expect(pools.persisted.find((item) => item.id === "bruno")?.displayName).toBe(
      "Bruno",
    );
  });

  it("CA-C4: filtro sem resultado esvazia a lista e mantém os elegíveis", () => {
    const people = Array.from({ length: 10 }, (_, index) =>
      person(`user-${index}`, `Pessoa ${index}`),
    );
    const pools = buildChatGiveawayPools({
      saved: people,
      live: [],
      excludedUserIds: [],
      broadcasterId: "broadcaster-1",
      nameFilter: "zzzz",
    });

    expect(pools.displayed).toEqual([]);
    expect(pools.eligible).toHaveLength(10);
  });

  it("CA-C9 e CA-C10: broadcaster e excluído saem do sorteio e continuam salvos", () => {
    const pools = buildChatGiveawayPools({
      saved: [
        person("broadcaster-1", "Canal"),
        person("mod", "Mod"),
        person("viewer", "Viewer"),
      ],
      live: [person("novo", "Novo")],
      excludedUserIds: ["mod"],
      broadcasterId: "broadcaster-1",
      nameFilter: "",
    });

    expect(pools.persisted.map((item) => item.id)).toEqual([
      "broadcaster-1",
      "mod",
      "viewer",
      "novo",
    ]);
    expect(pools.eligible.map((item) => item.id)).toEqual(["viewer", "novo"]);
    expect(pools.displayed.map((item) => item.id)).toEqual(["viewer", "novo"]);
  });

  it("CA-C12: sem filtro, sem exclusão e sem o broadcaster, tickets e vencedor seguem o algoritmo atual", () => {
    const saved = [
      person("sub", "Sub", { subscriber: true }),
      person("viewer-1", "Viewer 1"),
    ];
    const live = [person("viewer-2", "Viewer 2")];
    const multiplier = 4;
    const pools = buildChatGiveawayPools({
      saved,
      live,
      excludedUserIds: [],
      broadcasterId: "broadcaster-1",
      nameFilter: "",
    });
    const legacy = unionChatParticipants(saved, live);

    expect(pools.eligible).toEqual(legacy);
    expect(pools.displayed).toEqual(legacy);

    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0);
    const fromEligible = drawWinner({
      participants: pools.eligible,
      subscriberMultiplier: multiplier,
    });
    random.mockReturnValue(0);
    const fromLegacy = drawWinner({
      participants: legacy,
      subscriberMultiplier: multiplier,
    });

    expect(fromEligible).toEqual(fromLegacy);
    expect(fromEligible?.id).toBe("sub");

    const subChance = summarizeChatDrawChance({
      participants: pools.eligible,
      winner: fromEligible!,
      subscriberMultiplier: multiplier,
    });
    expect(subChance.winnerTickets).toBe(4);
    expect(subChance.totalTickets).toBe(6);
    expect(subChance.winChance).toBeCloseTo((4 / 6) * 100);

    random.mockReturnValue(0.99);
    const late = drawWinner({
      participants: pools.eligible,
      subscriberMultiplier: multiplier,
      excludeIds: ["sub"],
    });
    expect(late?.id).toBe("viewer-2");
    const lateChance = summarizeChatDrawChance({
      participants: pools.eligible,
      winner: late!,
      subscriberMultiplier: multiplier,
      excludeIds: ["sub"],
    });
    expect(lateChance.winnerTickets).toBe(1);
    expect(lateChance.totalTickets).toBe(2);
    expect(lateChance.winChance).toBeCloseTo(50);

    random.mockRestore();
  });
});
