import { localDateTimeToIso } from "@/lib/winner-badges/datetime";
import type { EngineClock } from "@/lib/winner-badges/types";
import { STORAGE_KEY_STREAM_DROPS_SETTINGS } from "@/storage";
import { useSettingsStore } from "@/storage/settings";
import { afterEach, describe, expect, it } from "vitest";
import { buildDashboardView, buildViewerProfile } from "./model";
import {
  readDashboardPreferences,
  writeDashboardPreference,
} from "./preferences";
import type { DashboardSource } from "./source";

const TZ = "America/Sao_Paulo";

function iso(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): string {
  const value = localDateTimeToIso(
    { year, month, day, hour, minute, second: 0 },
    TZ,
  );
  if (!value) throw new Error("data inválida");
  return value;
}

const CLOCK: EngineClock = {
  now: iso(2026, 10, 15),
  timeZone: TZ,
};

type ChatWinner = {
  id: string;
  name: string;
  twitchId?: string;
  drawnAt?: string;
  avatar?: string;
};

type ChatRow = {
  id: string;
  title: string;
  description: string;
  keyword: string;
  cost: number;
  minimumSuscriptionTimeInMonths: number;
  subscriberMultiplier: number;
  subscribersOnly: boolean;
  winners: ChatWinner[];
  participants: unknown[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

function chatRow(
  id: string,
  title: string,
  winners: ChatWinner[],
  extra: Partial<ChatRow> = {},
): ChatRow {
  return {
    id,
    title,
    description: "",
    keyword: "!join",
    cost: 0,
    minimumSuscriptionTimeInMonths: 0,
    subscriberMultiplier: 1,
    subscribersOnly: false,
    winners,
    participants: [],
    createdAt: iso(2026, 10, 1, 9),
    updatedAt: iso(2026, 10, 1, 9),
    ...extra,
  };
}

function chatWin(id: string, name: string, drawnAt?: string): ChatWinner {
  const winner: ChatWinner = { id, name, twitchId: id };
  if (drawnAt) winner.drawnAt = drawnAt;
  return winner;
}

function pointsRow(
  id: string,
  title: string,
  userId: string,
  name: string,
  drawnAt: string,
  createdAt?: string,
) {
  return {
    id,
    title,
    description: "",
    cost: 100,
    winners: [{ id: userId, userId, name, drawnAt }],
    participants: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function subWinner(
  userId: string,
  name: string,
  drawnAt?: string,
): Record<string, unknown> {
  const winner: Record<string, unknown> = {
    user_id: userId,
    user_name: name,
    user_login: name.toLowerCase(),
    tier: "1000",
  };
  if (drawnAt) winner.drawnAt = drawnAt;
  return winner;
}

function subRow(
  id: string,
  title: string,
  winners: Record<string, unknown>[],
  createdAt?: string,
) {
  const row: Record<string, unknown> = {
    id,
    title,
    description: "",
    subscriptionRequirement: 1000,
    subscriberMultiplier: { "1000": 1, "2000": 2, "3000": 3 },
    participants: [],
    winners,
  };
  if (createdAt) row.createdAt = createdAt;
  return row;
}

function source(partial: Partial<DashboardSource> = {}): DashboardSource {
  return {
    chat: partial.chat ?? [],
    channelPoints: partial.channelPoints ?? [],
    subscribers: partial.subscribers ?? [],
    excludedUserIds: partial.excludedUserIds ?? [],
  };
}

function view(
  data: DashboardSource,
  period: "month" | "all" = "month",
  type: "all" | "chat" | "channel-points" | "subscribers" = "all",
  options: { badgesEnabled?: boolean; broadcasterId?: string; clock?: EngineClock } = {},
) {
  return buildDashboardView(
    data,
    options.clock ?? CLOCK,
    { period, type },
    {
      badgesEnabled: options.badgesEnabled ?? true,
      broadcasterId: options.broadcasterId,
    },
  );
}

describe("modelo da Dashboard v1", () => {
  it("CA-D15: empate no topo desempata pela vitória datada mais recente", () => {
    const data = source({
      chat: [
        chatRow("a1", "A1", [chatWin("ana", "Ana", iso(2026, 10, 1))]),
        chatRow("a2", "A2", [chatWin("ana", "Ana", iso(2026, 10, 2))]),
        chatRow("a3", "A3", [chatWin("ana", "Ana", iso(2026, 10, 3))]),
        chatRow("b1", "B1", [chatWin("bia", "Bia", iso(2026, 10, 1))]),
        chatRow("b2", "B2", [chatWin("bia", "Bia", iso(2026, 10, 2))]),
        chatRow("b3", "B3", [chatWin("bia", "Bia", iso(2026, 10, 10))]),
      ],
    });
    const top = view(data).topWinners;
    expect(top[0]?.name).toBe("Bia");
    expect(top[0]?.wins).toBe(3);
    expect(top[1]?.name).toBe("Ana");
    expect(top[1]?.wins).toBe(3);
  });

  it("CA-D40: rei de setembro só existe no fechamento e não grava a entrada", () => {
    const data = source({
      chat: [
        chatRow("a1", "A1", [chatWin("ana", "Ana", iso(2026, 9, 10))], {
          createdAt: iso(2026, 9, 1),
        }),
        chatRow("a2", "A2", [chatWin("ana", "Ana", iso(2026, 9, 20))], {
          createdAt: iso(2026, 9, 2),
        }),
        chatRow("b1", "B1", [chatWin("bia", "Bia", iso(2026, 9, 11))], {
          createdAt: iso(2026, 9, 3),
        }),
        chatRow("b2", "B2", [chatWin("bia", "Bia", iso(2026, 9, 21))], {
          createdAt: iso(2026, 9, 4),
        }),
      ],
    });
    const before = JSON.stringify(data);
    const open = view(data, "month", "all", {
      clock: { now: iso(2026, 10, 1, 0, 0), timeZone: TZ },
    });
    const kings = open.recentAchievements.filter(
      (item) => item.achievementId === "month_king",
    );
    expect(kings).toHaveLength(2);
    expect(kings.every((item) => item.shared)).toBe(true);
    expect(kings.every((item) => item.month?.month === 9)).toBe(true);

    const closed = view(data, "all", "all", {
      clock: { now: iso(2026, 9, 30, 23, 59), timeZone: TZ },
    });
    expect(
      closed.recentAchievements.some((item) => item.achievementId === "month_king"),
    ).toBe(false);
    const withWins = view(data, "all", "all", {
      clock: { now: iso(2026, 10, 1, 0, 0), timeZone: TZ },
    });
    for (const row of withWins.recentWinners) {
      expect(row.badges.some((badge) => badge.id === "month_king")).toBe(false);
    }
    expect(JSON.stringify(data)).toBe(before);
  });

  it("CA-D49: período, apagado, sem data e exclusão batem no resumo", () => {
    const data = source({
      chat: [
        chatRow("out-1", "Outubro 1", [
          chatWin("ana", "Ana", iso(2026, 10, 5)),
          chatWin("bia", "Bia", iso(2026, 10, 6)),
          chatWin("mod", "Mod", iso(2026, 10, 7)),
        ]),
        chatRow(
          "out-2",
          "Outubro apagado",
          [chatWin("cai", "Cai", iso(2026, 10, 8))],
          { deletedAt: iso(2026, 10, 9) },
        ),
      ],
      channelPoints: [
        pointsRow("out-3", "Pontos", "duda", "Duda", iso(2026, 10, 9), iso(2026, 10, 4)),
      ],
      subscribers: [
        subRow("legado", "Legado", [subWinner("edu", "Edu")]),
      ],
      excludedUserIds: ["mod"],
    });
    const month = view(data, "month");
    const all = view(data, "all");
    expect(month.summary.giveaways).toBe(3);
    expect(month.summary.wins).toBe(4);
    expect(all.summary.giveaways).toBe(4);
    expect(all.summary.wins).toBe(5);
    expect(month.recentWinners.some((row) => row.userId === "edu")).toBe(false);
    expect(all.topWinners.some((row) => row.userId === "edu")).toBe(true);
    expect(month.topWinners.some((row) => row.userId === "mod")).toBe(false);
    const deleted = month.recentWinners.find((row) => row.giveawayId === "out-2");
    expect(deleted?.deleted).toBe(true);
    expect(deleted?.giveawayTitle).toBe("Outubro apagado");
  });

  it("CA-D51: quatro conquistas no mês, três no Chat, zero com selos off", () => {
    const data = source({
      chat: [
        chatRow("s1", "S1", [chatWin("ana", "Ana", iso(2026, 9, 10))], {
          createdAt: iso(2026, 9, 1),
        }),
        chatRow("s2", "S2", [chatWin("ana", "Ana", iso(2026, 9, 20))], {
          createdAt: iso(2026, 9, 2),
        }),
        chatRow("s3", "S3", [chatWin("ana", "Ana", iso(2026, 10, 5))]),
        chatRow("b1", "B1", [chatWin("bia", "Bia", iso(2026, 10, 2))]),
        chatRow("b2", "B2", [chatWin("bia", "Bia", iso(2026, 10, 3))]),
        chatRow("b3", "B3", [chatWin("bia", "Bia", iso(2026, 10, 4))]),
        chatRow("c1", "C1", [chatWin("cai", "Cai", iso(2026, 10, 6))]),
        chatRow("c2", "C2", [chatWin("cai", "Cai", iso(2026, 10, 7))]),
        chatRow("c3", "C3", [chatWin("cai", "Cai", iso(2026, 10, 8))]),
      ],
    });
    const month = view(data, "month", "all");
    expect(month.summary.achievements).toBe(4);
    expect(month.recentAchievements).toHaveLength(4);
    expect(
      month.recentAchievements.filter((item) => item.achievementId === "month_king"),
    ).toHaveLength(1);

    const chat = view(data, "month", "chat");
    expect(chat.summary.achievements).toBe(3);
    expect(
      chat.recentAchievements.some((item) => item.achievementId === "month_king"),
    ).toBe(false);

    const off = view(data, "month", "all", { badgesEnabled: false });
    expect(off.summary.achievements).toBeNull();
    expect(off.recentAchievements).toEqual([]);
    expect(off.showAchievements).toBe(false);
    expect(off.summary.wins).toBe(month.summary.wins);
    expect(off.topWinners).toHaveLength(month.topWinners.length);
  });

  it("CA-D13, D18, D20 e D43: feed, subscribers, exclusão e filtro", () => {
    const data = source({
      chat: [
        chatRow("novo", "Chat novo", [chatWin("bia", "Bia", iso(2026, 10, 14))]),
        chatRow(
          "apagado",
          "Chat apagado",
          [chatWin("cai", "Cai", iso(2026, 10, 12))],
          { deletedAt: iso(2026, 10, 13) },
        ),
        chatRow("ana", "Chat Ana", [chatWin("ana", "Ana", iso(2026, 10, 10))]),
        chatRow("anon", "Chat anon", [
          { id: "x", name: "Anon", twitchId: "unknown", drawnAt: iso(2026, 10, 8) },
        ]),
        chatRow("mod", "Chat mod", [chatWin("mod", "NightMod", iso(2026, 10, 13))]),
        chatRow("caster", "Chat caster", [
          chatWin("caster", "OCaster", iso(2026, 10, 11)),
        ]),
      ],
      subscribers: [
        subRow(
          "sub-1",
          "Sorteio Sub",
          [subWinner("sub", "SubZero", iso(2026, 10, 6))],
          iso(2026, 10, 2),
        ),
      ],
      excludedUserIds: ["mod"],
    });
    const built = view(data, "month", "all", { broadcasterId: "caster" });
    expect(built.recentWinners.map((row) => row.name)).toEqual([
      "Bia",
      "Cai",
      "Ana",
      "Anon",
      "SubZero",
    ]);
    expect(built.recentWinners[1]?.deleted).toBe(true);
    expect(built.recentWinners[1]?.giveawayType).toBe("chat");
    const anon = built.recentWinners.find((row) => row.name === "Anon");
    expect(anon?.linked).toBe(false);
    expect(built.topWinners.some((row) => row.name === "Anon")).toBe(false);
    expect(built.topWinners.some((row) => row.userId === "mod")).toBe(false);
    expect(built.topWinners.some((row) => row.userId === "caster")).toBe(false);
    expect(built.summary.wins).toBe(4);
    expect(built.summary.giveaways).toBe(7);
    const sub = built.topWinners.find((row) => row.name === "SubZero");
    expect(sub?.byType.subscribers).toBe(1);

    const onlyChat = view(data, "month", "chat", { broadcasterId: "caster" });
    expect(onlyChat.recentWinners.some((row) => row.name === "SubZero")).toBe(false);
    expect(onlyChat.topWinners.some((row) => row.name === "SubZero")).toBe(false);
    expect(onlyChat.summary.wins).toBe(3);
    expect(onlyChat.summary.giveaways).toBe(6);

    const profile = buildViewerProfile(data, CLOCK, "twitch", "sub");
    expect(profile?.stats.totals.subscribers).toBe(1);
    expect(profile?.name).toBe("SubZero");
    expect(buildViewerProfile(data, CLOCK, "twitch", "unknown")).toBeNull();
  });
});

describe("preferências da Dashboard", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    useSettingsStore.setState({ badges: { enabled: true } });
  });

  it("valor desconhecido vira o padrão e não regrava sozinho", () => {
    const raw = JSON.stringify({
      state: {
        badges: { enabled: true },
        dashboard: { period: "year", type: "kick", dismissLocalHistory: "sim" },
      },
      version: 1,
    });
    expect(readDashboardPreferences(raw)).toEqual({
      period: "month",
      type: "all",
      dismissLocalHistory: false,
      dismissChatLegacy: false,
    });
  });

  it("gravar o tipo preserva chaves irmãs e o toggle de selos", () => {
    localStorage.setItem(
      STORAGE_KEY_STREAM_DROPS_SETTINGS,
      JSON.stringify({
        state: {
          badges: { enabled: true },
          theme: "dark",
          note: "nao-apagar",
        },
        version: 1,
      }),
    );
    expect(writeDashboardPreference({ type: "chat" })).toBe(true);
    useSettingsStore.getState().setBadgesEnabled(false);
    const stored = localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS);
    const parsed = JSON.parse(stored ?? "{}") as {
      version: number;
      state: {
        badges: { enabled: boolean };
        theme: string;
        note: string;
        dashboard: { type: string; period: string };
      };
    };
    expect(parsed.version).toBe(1);
    expect(parsed.state.theme).toBe("dark");
    expect(parsed.state.note).toBe("nao-apagar");
    expect(parsed.state.badges.enabled).toBe(false);
    expect(parsed.state.dashboard.type).toBe("chat");
    expect(parsed.state.dashboard.period).toBe("month");
  });

  it("versão diferente de 1 não é regravada", () => {
    const raw = JSON.stringify({
      state: { badges: { enabled: false }, dashboard: { type: "chat" } },
      version: 99,
    });
    localStorage.setItem(STORAGE_KEY_STREAM_DROPS_SETTINGS, raw);
    expect(writeDashboardPreference({ period: "all" })).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY_STREAM_DROPS_SETTINGS)).toBe(raw);
    expect(readDashboardPreferences(raw).period).toBe("month");
  });
});
