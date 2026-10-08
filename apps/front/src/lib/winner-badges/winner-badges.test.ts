import { describe, expect, it } from "vitest";
import {
  BADGE_CATALOG,
  collectWinAwards,
  computeAchievements,
  computeMomentBadges,
  computeStats,
  createMemoryHistoryProvider,
  localDateTimeToIso,
  normalizeWinnerHistory,
  selectForDisplay,
  type EngineClock,
  type WinEvent,
} from "./index";

const ZONES = ["America/Sao_Paulo", "UTC", "America/New_York"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function at(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
  millisecond = 0,
): string {
  const iso = localDateTimeToIso(
    { year, month, day, hour, minute, second, millisecond },
    timeZone,
  );
  if (!iso) throw new Error(`fuso inválido: ${timeZone}`);
  return iso;
}

function clock(timeZone: string, now: string): EngineClock {
  return { now, timeZone };
}

function event(partial: Partial<WinEvent> = {}): WinEvent {
  const platform = partial.platform ?? "twitch";
  const userId = partial.userId ?? "u";
  return {
    userKey: partial.userKey ?? `${platform}:${userId}`,
    platform,
    userId,
    giveawayType: partial.giveawayType ?? "chat",
    giveawayId: partial.giveawayId ?? "g",
    index: partial.index ?? 0,
    wonAt: partial.wonAt,
    name: partial.name ?? "Ana",
    avatar: partial.avatar,
    context: partial.context,
    preview: partial.preview,
  };
}

function ids(awards: { id: string }[]): string[] {
  return awards.map((award) => award.id);
}

function memory(wins: WinEvent[]) {
  return createMemoryHistoryProvider(wins);
}

describe("CA1–CA17", () => {
  it("CA1: primeira vitória confirmada ganha Primeiro Drop", () => {
    for (const zone of ZONES) {
      const wonAt = at(zone, 2026, 10, 7, 15);
      const win = event({ wonAt, giveawayId: "primeiro" });
      const badges = computeMomentBadges(
        memory([win]),
        win,
        clock(zone, wonAt),
      );
      const drop = badges.find((badge) => badge.id === "first_drop");
      expect(drop?.rarity).toBe("common");
      expect(drop?.preview).toBe(false);
    }
  });

  it("CA2: prévia descartada não altera estatística nem selo", () => {
    for (const zone of ZONES) {
      const existing = event({
        wonAt: at(zone, 2026, 10, 6, 23),
        giveawayId: "confirmada",
      });
      const provider = memory([existing]);
      const now = at(zone, 2026, 10, 7, 23, 59, 50);
      const clk = clock(zone, now);
      const statsBefore = computeStats(provider, clk);
      const badgesBefore = computeMomentBadges(provider, existing, clk);

      const pending = event({
        giveawayId: "pendente",
        preview: true,
      });
      const previewBadges = computeMomentBadges(provider, pending, clk, {
        preview: pending,
      });
      expect(previewBadges.length).toBeGreaterThan(0);
      expect(previewBadges.every((badge) => badge.preview)).toBe(true);
      expect(
        previewBadges.find((badge) => badge.id === "streak_daily")?.count,
      ).toBe(2);

      const previewStats = computeStats(provider, clk, { preview: pending });
      expect(previewStats.includesPreview).toBe(true);
      expect(previewStats.viewers[0]?.totals.all).toBe(2);

      expect(provider.getWins()).toEqual([existing]);
      expect(computeStats(provider, clk)).toEqual(statsBefore);
      expect(computeMomentBadges(provider, existing, clk)).toEqual(
        badgesBefore,
      );
      expect(
        computeMomentBadges(
          provider,
          { ...pending, preview: false },
          clk,
        ),
      ).toEqual([]);
      expect(
        computeAchievements(provider, clk).some((badge) => badge.preview),
      ).toBe(false);
    }
  });

  it("CA3: a confirmação usa o drawnAt, não o horário da prévia", () => {
    for (const zone of ZONES) {
      const previous = event({
        wonAt: at(zone, 2026, 10, 6, 22),
        giveawayId: "dia-6",
      });
      const previewNow = at(zone, 2026, 10, 7, 23, 59, 50);
      const pending = event({ giveawayId: "pendente", preview: true });
      const preview = computeMomentBadges(
        memory([previous]),
        pending,
        clock(zone, previewNow),
        { preview: pending },
      );
      const streak = preview.find((badge) => badge.id === "streak_daily");
      expect(streak?.count).toBe(2);
      expect(streak?.rarity).toBe("uncommon");
      expect(streak?.preview).toBe(true);

      const confirmedAt = at(zone, 2026, 10, 8, 0, 0, 10);
      const confirmed = {
        ...pending,
        preview: false as const,
        wonAt: confirmedAt,
      };
      const finalBadges = computeMomentBadges(
        memory([previous, confirmed]),
        confirmed,
        clock(zone, confirmedAt),
      );
      expect(
        finalBadges.find((badge) => badge.id === "streak_daily"),
      ).toBeUndefined();
    }
  });

  it("CA4: três dias seguidos são Em chamas 3; um buraco zera", () => {
    for (const zone of ZONES) {
      const wins = [5, 6, 7].map((day) =>
        event({
          wonAt: at(zone, 2026, 10, day, 12),
          giveawayId: `out-${day}`,
        }),
      );
      const target = wins[2];
      if (!target?.wonAt) throw new Error("vitória sem data");
      const streak = computeMomentBadges(
        memory(wins),
        target,
        clock(zone, target.wonAt),
      ).find((badge) => badge.id === "streak_daily");
      expect(streak?.count).toBe(3);
      expect(streak?.rarity).toBe("rare");

      const first = wins[0];
      if (!first) throw new Error("vitória ausente");
      const gapped = computeMomentBadges(
        memory([first, target]),
        target,
        clock(zone, target.wonAt),
      );
      expect(
        gapped.find((badge) => badge.id === "streak_daily"),
      ).toBeUndefined();
    }
  });

  it("CA5: 23:30 e 00:30 são dias diferentes em São Paulo", () => {
    const first = event({
      wonAt: "2026-10-07T02:30:00.000Z",
      giveawayId: "noite",
    });
    const second = event({
      wonAt: "2026-10-07T03:30:00.000Z",
      giveawayId: "madrugada",
    });
    const wins = [first, second];

    const saoPaulo = computeMomentBadges(
      memory(wins),
      second,
      clock("America/Sao_Paulo", second.wonAt ?? ""),
    );
    expect(
      saoPaulo.find((badge) => badge.id === "streak_daily")?.count,
    ).toBe(2);

    const utc = computeMomentBadges(
      memory(wins),
      second,
      clock("UTC", second.wonAt ?? ""),
    );
    expect(utc.find((badge) => badge.id === "streak_daily")).toBeUndefined();
    expect(utc.find((badge) => badge.id === "double_day")).toBeDefined();

    const newYork = computeMomentBadges(
      memory(wins),
      second,
      clock("America/New_York", second.wonAt ?? ""),
    );
    expect(
      newYork.find((badge) => badge.id === "streak_daily"),
    ).toBeUndefined();
    expect(newYork.find((badge) => badge.id === "double_day")).toBeDefined();
  });

  it("CA6: streak atravessa o DST e a janela de 24h usa ms reais", () => {
    const zone = "America/New_York";
    const spring = [
      event({
        wonAt: at(zone, 2026, 3, 7, 18),
        giveawayId: "mar-7",
      }),
      event({
        wonAt: at(zone, 2026, 3, 8, 18),
        giveawayId: "mar-8",
      }),
    ];
    const springTarget = spring[1];
    if (!springTarget?.wonAt) throw new Error("sem data");
    expect(
      computeMomentBadges(
        memory(spring),
        springTarget,
        clock(zone, springTarget.wonAt),
      ).find((badge) => badge.id === "streak_daily")?.count,
    ).toBe(2);

    const fall = [
      event({
        wonAt: at(zone, 2026, 10, 31, 18),
        giveawayId: "out-31",
      }),
      event({
        wonAt: at(zone, 2026, 11, 1, 18),
        giveawayId: "nov-1",
      }),
    ];
    const fallTarget = fall[1];
    if (!fallTarget?.wonAt) throw new Error("sem data");
    expect(
      computeMomentBadges(
        memory(fall),
        fallTarget,
        clock(zone, fallTarget.wonAt),
      ).find((badge) => badge.id === "streak_daily")?.count,
    ).toBe(2);

    const springW = at(zone, 2026, 3, 8, 12);
    const springWins = [
      event({ wonAt: at(zone, 2026, 3, 7, 12), giveawayId: "s1" }),
      event({ wonAt: at(zone, 2026, 3, 8, 11), giveawayId: "s2" }),
      event({ wonAt: springW, giveawayId: "s3" }),
    ];
    const springLast = springWins[2];
    if (!springLast) throw new Error("sem vitória");
    expect(
      ids(
        computeMomentBadges(
          memory(springWins),
          springLast,
          clock(zone, springW),
        ),
      ),
    ).toContain("hat_trick_24h");

    const fallW = at(zone, 2026, 11, 1, 12);
    const fallWins = [
      event({ wonAt: at(zone, 2026, 10, 31, 12), giveawayId: "f1" }),
      event({ wonAt: at(zone, 2026, 11, 1, 11), giveawayId: "f2" }),
      event({ wonAt: fallW, giveawayId: "f3" }),
    ];
    const fallLast = fallWins[2];
    if (!fallLast) throw new Error("sem vitória");
    expect(
      ids(
        computeMomentBadges(memory(fallWins), fallLast, clock(zone, fallW)),
      ),
    ).not.toContain("hat_trick_24h");

    const end = Date.parse(springW);
    const justInside = new Date(end - DAY_MS + 1).toISOString();
    const justOutside = new Date(end - DAY_MS - 1).toISOString();
    const inside = [
      event({ wonAt: justInside, giveawayId: "in" }),
      event({ wonAt: at(zone, 2026, 3, 8, 11), giveawayId: "mid" }),
      event({ wonAt: springW, giveawayId: "w" }),
    ];
    const insideLast = inside[2];
    if (!insideLast) throw new Error("sem vitória");
    expect(
      ids(
        computeMomentBadges(memory(inside), insideLast, clock(zone, springW)),
      ),
    ).toContain("hat_trick_24h");
    const outside = [
      event({ wonAt: justOutside, giveawayId: "out" }),
      event({ wonAt: at(zone, 2026, 3, 8, 11), giveawayId: "mid" }),
      event({ wonAt: springW, giveawayId: "w" }),
    ];
    const outsideLast = outside[2];
    if (!outsideLast) throw new Error("sem vitória");
    expect(
      ids(
        computeMomentBadges(
          memory(outside),
          outsideLast,
          clock(zone, springW),
        ),
      ),
    ).not.toContain("hat_trick_24h");
  });

  it("CA7: três vitórias em 20h são Hat-trick, sem Dobradinha", () => {
    for (const zone of ZONES) {
      const wins = [8, 14, 20].map((hour, index) =>
        event({
          wonAt: at(zone, 2026, 10, 7, hour),
          giveawayId: `h${index}`,
        }),
      );
      const target = wins[2];
      if (!target?.wonAt) throw new Error("sem data");
      const badges = computeMomentBadges(
        memory(wins),
        target,
        clock(zone, target.wonAt),
      );
      expect(ids(badges)).toContain("hat_trick_24h");
      expect(ids(badges)).not.toContain("double_day");

      const end = Date.parse(at(zone, 2026, 10, 8, 12));
      const tooEarly = new Date(end - DAY_MS - 1).toISOString();
      const boundary = [
        event({ wonAt: tooEarly, giveawayId: "cedo" }),
        event({ wonAt: at(zone, 2026, 10, 8, 11), giveawayId: "meio" }),
        event({
          wonAt: new Date(end).toISOString(),
          giveawayId: "fim",
        }),
      ];
      const last = boundary[2];
      if (!last?.wonAt) throw new Error("sem data");
      expect(
        ids(computeMomentBadges(memory(boundary), last, clock(zone, last.wonAt))),
      ).not.toContain("hat_trick_24h");
    }
  });

  it("CA8: 31/01 + 1 mês com clamp cai em 28/02", () => {
    for (const zone of ZONES) {
      const previous = event({
        wonAt: at(zone, 2026, 1, 31, 12),
        giveawayId: "jan",
      });
      const on28 = event({
        wonAt: at(zone, 2026, 2, 28, 12),
        giveawayId: "fev-28",
      });
      const yes = computeMomentBadges(
        memory([previous, on28]),
        on28,
        clock(zone, on28.wonAt ?? ""),
      );
      expect(ids(yes)).toContain("comeback");
      expect(ids(yes)).not.toContain("comeback6");

      const on27 = event({
        wonAt: at(zone, 2026, 2, 27, 12),
        giveawayId: "fev-27",
      });
      const no = computeMomentBadges(
        memory([previous, on27]),
        on27,
        clock(zone, on27.wonAt ?? ""),
      );
      expect(ids(no)).not.toContain("comeback");
      expect(ids(no)).not.toContain("comeback6");
    }
  });

  it("CA9: Rei do mês só no mês fechado, empate dividido, sem destaque", () => {
    const closes: Record<(typeof ZONES)[number], string> = {
      "America/Sao_Paulo": "2026-10-01T03:00:00.000Z",
      UTC: "2026-10-01T00:00:00.000Z",
      "America/New_York": "2026-10-01T04:00:00.000Z",
    };
    for (const zone of ZONES) {
      const make = (userId: string, day: number, giveawayId: string) =>
        event({
          userId,
          name: userId,
          wonAt: at(zone, 2026, 9, day, 12),
          giveawayId,
        });
      const wins = [
        make("a", 1, "a1"),
        make("a", 10, "a2"),
        make("a", 20, "a3"),
        make("b", 2, "b1"),
        make("b", 11, "b2"),
        make("b", 21, "b3"),
        make("c", 5, "c1"),
      ];
      const closed = computeAchievements(
        memory(wins),
        clock(zone, at(zone, 2026, 10, 15, 12)),
      ).filter((badge) => badge.id === "month_king");
      const kingA = closed.find((badge) => badge.userKey === "twitch:a");
      const kingB = closed.find((badge) => badge.userKey === "twitch:b");
      expect(kingA?.shared).toBe(true);
      expect(kingB?.shared).toBe(true);
      expect(kingA?.sharedWith).toBe(1);
      expect(kingA?.month).toEqual({ year: 2026, month: 9 });
      expect(kingA?.newlyUnlocked).toBe(false);
      expect(kingA?.highlightEligible).toBe(false);
      expect(kingA?.unlockedAt).toBe(closes[zone]);
      expect(closed.some((badge) => badge.userKey === "twitch:c")).toBe(false);

      const open = computeAchievements(
        memory(wins),
        clock(zone, at(zone, 2026, 9, 30, 23, 59, 59)),
      );
      expect(open.some((badge) => badge.id === "month_king")).toBe(false);

      const atBoundary = computeAchievements(
        memory(wins),
        clock(zone, closes[zone]),
      );
      expect(
        atBoundary.filter((badge) => badge.id === "month_king"),
      ).toHaveLength(2);

      const next = event({
        userId: "a",
        name: "a",
        wonAt: at(zone, 2026, 10, 2, 15),
        giveawayId: "a4",
      });
      const awards = collectWinAwards(
        memory([...wins, next]),
        next,
        clock(zone, next.wonAt ?? ""),
      );
      const display = selectForDisplay(awards);
      expect(awards.some((badge) => badge.id === "month_king")).toBe(false);
      expect(display.highlight?.id).not.toBe("month_king");
      expect(
        display.tooltip.some(
          (badge) => badge.id === "month_king" && badge.newlyUnlocked,
        ),
      ).toBe(false);
      expect(
        display.log.some(
          (badge) => badge.id === "month_king" && badge.newlyUnlocked,
        ),
      ).toBe(false);
    }
  });

  it("CA10: o mesmo userKey soma vitórias e mostra o nome mais recente", () => {
    const older = event({
      userId: "123",
      name: "NomeAntigo",
      avatar: "old.png",
      wonAt: "2026-10-01T15:00:00.000Z",
      giveawayId: "antes",
    });
    const newer = event({
      userId: "123",
      name: "NomeNovo",
      avatar: "new.png",
      wonAt: "2026-10-02T15:00:00.000Z",
      giveawayId: "depois",
    });
    for (const zone of ZONES) {
      const stats = computeStats(
        memory([newer, older]),
        clock(zone, "2026-10-03T15:00:00.000Z"),
      );
      const viewer = stats.viewers.find(
        (item) => item.userKey === "twitch:123",
      );
      expect(viewer?.totals.all).toBe(2);
      expect(viewer?.name).toBe("NomeNovo");
      expect(viewer?.avatar).toBe("new.png");
    }
  });

  it("CA11: remover a primeira vitória passa o Primeiro Drop adiante", () => {
    const first = event({
      wonAt: "2026-10-01T15:00:00.000Z",
      giveawayId: "v1",
    });
    const second = event({
      wonAt: "2026-10-02T15:00:00.000Z",
      giveawayId: "v2",
    });
    for (const zone of ZONES) {
      const clk = clock(zone, "2026-10-03T15:00:00.000Z");
      const both = memory([first, second]);
      expect(ids(computeMomentBadges(both, first, clk))).toContain(
        "first_drop",
      );
      expect(ids(computeMomentBadges(both, second, clk))).not.toContain(
        "first_drop",
      );
      expect(computeStats(both, clk).viewers[0]?.totals.all).toBe(2);

      const kept = memory([second]);
      expect(ids(computeMomentBadges(kept, second, clk))).toContain(
        "first_drop",
      );
      expect(computeStats(kept, clk).viewers[0]?.totals.all).toBe(1);
    }
  });

  it("CA12: Sortudo com 3 some quando uma vitória é removida", () => {
    const wins = [1, 2, 3].map((day) =>
      event({
        wonAt: `2026-10-0${day}T15:00:00.000Z`,
        giveawayId: `s${day}`,
      }),
    );
    for (const zone of ZONES) {
      const clk = clock(zone, "2026-10-10T15:00:00.000Z");
      const lucky = computeAchievements(memory(wins), clk).find(
        (badge) => badge.family === "lucky",
      );
      expect(lucky?.id).toBe("lucky_3");
      expect(lucky?.rarity).toBe("uncommon");
      const removed = wins.filter((win) => win.giveawayId !== "s2");
      expect(
        computeAchievements(memory(removed), clk).some(
          (badge) => badge.family === "lucky",
        ),
      ).toBe(false);
    }
  });

  it("CA13: Subscribers sem drawnAt entram no total, sem selo temporal", () => {
    const source = {
      subscribers: [
        {
          id: "sub-legado",
          title: "Legado",
          winners: [
            subscriber("42", { is_gift: true }),
            subscriber("42", { is_gift: false }),
          ],
        },
        {
          id: "sub-novo",
          winners: [
            subscriber("99", {
              drawnAt: "2026-10-07T15:00:00.000Z",
              is_gift: false,
            }),
          ],
        },
      ],
      chat: [
        {
          id: "chat-1",
          winners: [
            {
              id: "42",
              name: "Ana",
              twitchId: "42",
              avatar: "ana.png",
              drawnAt: "2026-10-08T15:00:00.000Z",
            },
          ],
        },
      ],
      channelPoints: [
        {
          id: "cp-1",
          allowMultipleWins: false,
          winners: [
            {
              id: "w-42",
              userId: "42",
              name: "Ana",
              avatar: "ana.png",
              redemptionId: "r1",
              drawnAt: "2026-10-09T15:00:00.000Z",
            },
          ],
        },
      ],
    };
    const wins = normalizeWinnerHistory(source);
    const legacy = wins.filter(
      (win) => win.userId === "42" && win.giveawayType === "subscribers",
    );
    expect(legacy).toHaveLength(2);
    expect(legacy.every((win) => win.wonAt === undefined)).toBe(true);
    const datedSub = wins.find((win) => win.userId === "99");
    expect(datedSub?.wonAt).toBe("2026-10-07T15:00:00.000Z");

    for (const zone of ZONES) {
      const clk = clock(zone, "2026-10-10T15:00:00.000Z");
      const provider = memory(wins);
      const viewer = computeStats(provider, clk).viewers.find(
        (item) => item.userKey === "twitch:42",
      );
      expect(viewer?.totals.all).toBe(4);
      expect(viewer?.totals.subscribers).toBe(2);
      expect(viewer?.undatedWins).toBe(2);
      expect(
        computeAchievements(provider, clk).find(
          (badge) => badge.userKey === "twitch:42" && badge.id === "lucky_3",
        ),
      ).toBeDefined();
      expect(
        computeAchievements(provider, clk).find(
          (badge) =>
            badge.userKey === "twitch:42" && badge.id === "collector",
        ),
      ).toBeDefined();

      const undated = legacy[0];
      if (!undated) throw new Error("sem legado");
      const onLegacy = ids(computeMomentBadges(provider, undated, clk));
      expect(onLegacy).toContain("gifted_sub");
      expect(onLegacy).not.toContain("first_drop");
      expect(onLegacy).not.toContain("streak_daily");
      expect(onLegacy).not.toContain("double_day");
      expect(onLegacy).not.toContain("hat_trick_24h");
      expect(onLegacy).not.toContain("month_regular");
      expect(onLegacy).not.toContain("month_lead");
      expect(onLegacy).not.toContain("comeback");

      const chat = wins.find((win) => win.giveawayType === "chat");
      if (!chat) throw new Error("sem chat");
      expect(ids(computeMomentBadges(provider, chat, clk))).not.toContain(
        "first_drop",
      );
      expect(ids(computeMomentBadges(provider, datedSub ?? chat, clk))).toContain(
        "first_drop",
      );
    }
  });

  it("CA14: legado sem meses ou com tier nulo não quebra nem dá Fiel", () => {
    const drawnAt = "2026-10-04T15:00:00.000Z";
    const source = {
      chat: [
        {
          id: "sem-participants",
          winners: [
            {
              id: "1",
              name: "SemLista",
              twitchId: "1",
              avatar: "a.png",
              drawnAt,
            },
          ],
        },
        {
          id: "sem-meses",
          winners: [
            {
              name: "SemMeses",
              twitchId: "2",
              avatar: null,
              drawnAt,
            },
          ],
          participants: [{ id: "2", tier: null, subscriptionMonths: null }],
        },
        {
          id: "context-nulo",
          winners: [
            {
              name: "ComContext",
              twitchId: "3",
              drawnAt,
              context: { subscriptionMonths: null, tier: null },
            },
          ],
          participants: [
            { id: "3", subscriptionMonths: 24, tier: 1000, joinedAt: 1 },
          ],
        },
        {
          id: "fiel-legado",
          winners: [
            {
              id: "4",
              name: "Fiel",
              twitchId: "4",
              avatar: "f.png",
              drawnAt,
            },
          ],
          participants: [
            {
              id: "4",
              name: "fiel",
              displayName: "Fiel",
              avatar: "f.png",
              subscriber: true,
              subscriptionMonths: 24,
              tier: 3000,
              joinedAt: 1_700_000_000_000,
            },
          ],
        },
      ],
    };
    expect(() => normalizeWinnerHistory(source)).not.toThrow();
    const wins = normalizeWinnerHistory(source);
    for (const zone of ZONES) {
      const clk = clock(zone, "2026-10-05T15:00:00.000Z");
      const provider = memory(wins);
      for (const userId of ["1", "2", "3"]) {
        const win = wins.find((item) => item.userId === userId);
        expect(win).toBeDefined();
        if (!win) continue;
        expect(
          computeMomentBadges(provider, win, clk).some(
            (badge) => badge.id === "loyal_sub",
          ),
        ).toBe(false);
      }
      const loyalWin = wins.find((item) => item.userId === "4");
      if (!loyalWin) throw new Error("sem fiel");
      expect(loyalWin.context).toEqual({
        subscriptionMonths: 24,
        tier: "3000",
      });
      const loyal = computeMomentBadges(provider, loyalWin, clk).find(
        (badge) => badge.id === "loyal_sub",
      );
      expect(loyal?.rarity).toBe("epic");
      expect(loyal?.count).toBe(24);
    }
  });

  it("CA15: twitchId ou userId unknown fica fora de tudo", () => {
    const drawnAt = "2026-10-03T15:00:00.000Z";
    const wins = normalizeWinnerHistory({
      chat: [
        {
          id: "chat-unknown",
          winners: [
            { twitchId: "unknown", name: "???", avatar: "x", drawnAt },
            {
              twitchId: "77",
              name: "Valido",
              avatar: "v.png",
              drawnAt,
            },
          ],
        },
      ],
      channelPoints: [
        {
          id: "cp-unknown",
          allowMultipleWins: true,
          winners: [
            {
              id: "u",
              userId: "unknown",
              name: "???",
              avatar: "x",
              redemptionId: "r",
              drawnAt,
            },
          ],
        },
      ],
      subscribers: [
        {
          id: "sub-unknown",
          winners: [subscriber("unknown"), subscriber("77")],
        },
      ],
    });
    expect(wins.some((win) => win.userId === "unknown")).toBe(false);
    expect(wins.some((win) => win.userKey.endsWith(":unknown"))).toBe(false);
    const kept = wins.filter((win) => win.userId === "77");
    expect(kept.map((win) => win.index)).toEqual([1, 1]);
    for (const zone of ZONES) {
      const stats = computeStats(
        memory(wins),
        clock(zone, "2026-10-04T15:00:00.000Z"),
      );
      expect(
        stats.viewers.some((viewer) => viewer.userKey.includes("unknown")),
      ).toBe(false);
      expect(stats.channel.distinctWinners).toBe(1);
    }
  });

  it("CA16: a segunda vitória no mesmo sorteio de Pontos é Double Kill", () => {
    const wins = normalizeWinnerHistory({
      channelPoints: [
        {
          id: "cp-multi",
          title: "Pontos",
          allowMultipleWins: true,
          winners: [
            {
              id: "w1",
              userId: "55",
              name: "Ana",
              avatar: "a.png",
              redemptionId: "r1",
              drawnAt: "2026-10-07T18:00:00.000Z",
            },
            {
              id: "w2",
              userId: "55",
              name: "Ana",
              avatar: "a.png",
              redemptionId: "r2",
              drawnAt: "2026-10-07T18:05:00.000Z",
            },
          ],
        },
      ],
    });
    expect(wins).toHaveLength(2);
    const first = wins[0];
    const second = wins[1];
    if (!first || !second) throw new Error("sem vitórias");
    for (const zone of ZONES) {
      const clk = clock(zone, "2026-10-07T19:00:00.000Z");
      const provider = memory(wins);
      expect(
        ids(computeMomentBadges(provider, first, clk)),
      ).not.toContain("double_kill");
      const kill = computeMomentBadges(provider, second, clk).find(
        (badge) => badge.id === "double_kill",
      );
      expect(kill?.rarity).toBe("epic");
      expect(kill?.count).toBe(2);
    }
  });

  it("CA17: card 3 + 2, log 2, tooltip com os 5 na ordem", () => {
    for (const zone of ZONES) {
      const wins: WinEvent[] = [];
      for (let day = 3; day <= 6; day += 1) {
        wins.push(
          event({
            wonAt: at(zone, 2026, 10, day, 12),
            giveawayId: `dia-${day}`,
          }),
        );
      }
      wins.push(
        event({
          wonAt: at(zone, 2026, 10, 7, 10),
          giveawayId: "t10",
        }),
        event({
          wonAt: at(zone, 2026, 10, 7, 11),
          giveawayId: "t11",
        }),
        event({
          wonAt: at(zone, 2026, 10, 7, 12),
          giveawayId: "t12",
          context: { subscriptionMonths: 24, tier: "3000" },
        }),
      );
      const target = wins[wins.length - 1];
      if (!target?.wonAt) throw new Error("sem alvo");
      const badges = computeMomentBadges(
        memory(wins),
        target,
        clock(zone, target.wonAt),
      );
      const display = selectForDisplay(badges);
      expect(ids(display.tooltip)).toEqual([
        "streak_daily",
        "hat_trick_24h",
        "loyal_sub",
        "month_regular",
        "month_lead",
      ]);
      expect(display.tooltip[0]?.rarity).toBe("epic");
      expect(display.tooltip[0]?.count).toBe(5);
      expect(display.card.map((badge) => badge.id)).toEqual([
        "streak_daily",
        "hat_trick_24h",
        "loyal_sub",
      ]);
      expect(display.cardOverflow).toBe(2);
      expect(display.log.map((badge) => badge.id)).toEqual([
        "streak_daily",
        "hat_trick_24h",
      ]);
      expect(display.log).toHaveLength(2);
      expect(display.tooltip).toHaveLength(5);
      expect(ids(badges)).not.toContain("double_day");
    }
  });
});

describe("normalização v12", () => {
  it("lê Chat, Pontos e Subscribers sem mutar a entrada", () => {
    const source = {
      chat: [
        {
          id: "chat-legado",
          title: "Chat",
          keyword: "!drop",
          winners: [
            {
              id: "42",
              name: "Ana",
              twitchId: "42",
              avatar: "https://example/ana.png",
              drawnAt: "2026-08-01T18:00:00.000Z",
            },
          ],
          participants: [
            {
              id: "42",
              name: "ana",
              displayName: "Ana",
              avatar: "https://example/ana.png",
              subscriber: true,
              subscriptionMonths: 12,
              tier: 2000,
              joinedAt: 1_720_000_000_000,
            },
          ],
        },
      ],
      channelPoints: [
        {
          id: "cp-1",
          allowMultipleWins: true,
          status: "closed",
          winners: [
            {
              id: "w1",
              userId: "42",
              name: "Ana",
              avatar: "https://example/ana.png",
              redemptionId: "red-1",
              drawnAt: "2026-08-02T18:00:00.000Z",
            },
          ],
        },
      ],
      subscribers: [
        {
          id: "sub-1",
          title: "Subs",
          winners: [
            {
              broadcaster_id: "9",
              broadcaster_login: "canal",
              broadcaster_name: "Canal",
              gifter_id: "8",
              gifter_login: "gifter",
              is_gift: true,
              plan_name: "Tier 1",
              tier: "1000",
              user_id: "42",
              user_name: "Ana",
              user_login: "ana",
            },
          ],
        },
      ],
    };
    const snapshot = JSON.stringify(source);
    const wins = normalizeWinnerHistory(source);
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(wins.map((win) => win.giveawayType).sort()).toEqual([
      "channel-points",
      "chat",
      "subscribers",
    ]);
    const chat = wins.find((win) => win.giveawayType === "chat");
    expect(chat?.context).toEqual({
      subscriptionMonths: 12,
      tier: "2000",
    });
    expect(chat?.userKey).toBe("twitch:42");
    const sub = wins.find((win) => win.giveawayType === "subscribers");
    expect(sub?.wonAt).toBeUndefined();
    expect(sub?.context?.isGift).toBe(true);
    expect(sub?.context?.tier).toBe("1000");
    expect(sub?.name).toBe("Ana");
  });

  it("campos ausentes, nulos ou lixo não lançam", () => {
    expect(() =>
      normalizeWinnerHistory({
        chat: null,
        channelPoints: { id: "não-é-array" },
        subscribers: [
          null,
          { id: "vazio", winners: null },
          {
            id: "buracos",
            winners: [null, { user_id: "", user_name: null }, { tier: null }],
          },
        ],
      }),
    ).not.toThrow();
    expect(
      normalizeWinnerHistory({
        chat: [{ winners: [{ twitchId: "1" }] }],
        subscribers: [{ id: "", winners: [{ user_id: "1" }] }],
      }),
    ).toEqual([]);
  });

  it("platform ausente vira twitch e outra plataforma não se mistura", () => {
    const wins = normalizeWinnerHistory({
      chat: [
        {
          id: "mix",
          winners: [
            {
              twitchId: "9",
              name: "Twitch",
              drawnAt: "2026-10-01T00:00:00.000Z",
            },
            {
              twitchId: "9",
              name: "Kick",
              platform: "kick",
              drawnAt: "2026-10-02T00:00:00.000Z",
            },
          ],
        },
      ],
    });
    expect(wins.map((win) => win.userKey)).toEqual(["twitch:9", "kick:9"]);
    const stats = computeStats(
      memory(wins),
      clock("UTC", "2026-10-03T00:00:00.000Z"),
    );
    expect(stats.channel.distinctWinners).toBe(2);
  });
});

describe("regras derivadas e extensão", () => {
  it("Fênix, Chama eterna e a ordem da recém-desbloqueada", () => {
    const zone = "America/Sao_Paulo";
    const wins: WinEvent[] = [
      event({
        wonAt: at(zone, 2026, 1, 1, 12),
        giveawayId: "origem",
      }),
    ];
    for (let day = 1; day <= 7; day += 1) {
      wins.push(
        event({
          wonAt: at(zone, 2026, 8, day, 12),
          giveawayId: `ago-${day}`,
          context: day === 7 ? { subscriptionMonths: 6 } : undefined,
        }),
      );
    }
    const target = wins[wins.length - 1];
    if (!target?.wonAt) throw new Error("sem alvo");
    const clk = clock(zone, target.wonAt);
    const provider = memory(wins);
    const phoenix = computeAchievements(provider, clk).find(
      (badge) => badge.id === "phoenix",
    );
    const flame = computeAchievements(provider, clk).find(
      (badge) => badge.id === "eternal_flame",
    );
    expect(phoenix?.rarity).toBe("epic");
    expect(phoenix?.win).toEqual({
      giveawayType: "chat",
      giveawayId: "ago-1",
      index: 0,
    });
    const ago1 = wins.find((win) => win.giveawayId === "ago-1");
    if (!ago1) throw new Error("sem volta");
    const comeback = ids(computeMomentBadges(provider, ago1, clk));
    expect(comeback).toContain("comeback6");
    expect(comeback).not.toContain("comeback");
    expect(flame?.rarity).toBe("legendary");
    expect(flame?.win?.giveawayId).toBe("ago-7");

    const display = selectForDisplay(
      collectWinAwards(provider, target, clk),
    );
    expect(display.highlight?.id).toBe("eternal_flame");
    expect(display.tooltip[0]?.id).toBe("eternal_flame");
    expect(display.tooltip[0]?.newlyUnlocked).toBe(true);

    const september = [1, 10, 20].map((day) =>
      event({
        userId: "rei",
        wonAt: at(zone, 2026, 9, day, 12),
        giveawayId: `set-${day}`,
      }),
    );
    const october = [1, 10, 20].map((day) =>
      event({
        userId: "rei",
        wonAt: at(zone, 2026, 10, day, 12),
        giveawayId: `out-${day}`,
      }),
    );
    const titles = computeAchievements(
      memory([...september, ...october]),
      clock(zone, at(zone, 2026, 11, 2, 12)),
    )
      .filter((badge) => badge.id === "month_king")
      .sort((a, b) => (a.titleIndex ?? 0) - (b.titleIndex ?? 0));
    expect(titles.map((badge) => badge.titleIndex)).toEqual([1, 2]);
    expect(titles.map((badge) => badge.month?.month)).toEqual([9, 10]);
  });

  it("estatísticas do viewer e do canal usam o relógio injetado", () => {
    const zone = "America/Sao_Paulo";
    const now = at(zone, 2026, 10, 8, 12);
    const older = at(zone, 2026, 10, 7, 12);
    expect(Date.parse(now) - Date.parse(older)).toBe(DAY_MS);
    const wins = [
      event({
        userId: "a",
        name: "Ana",
        wonAt: at(zone, 2026, 10, 8, 11),
        giveawayId: "g1",
      }),
      event({
        userId: "a",
        name: "Ana",
        wonAt: older,
        giveawayId: "g2",
      }),
      event({
        userId: "b",
        name: "Bia",
        wonAt: at(zone, 2026, 10, 8, 10),
        giveawayId: "g3",
      }),
    ];
    const stats = computeStats(memory(wins), clock(zone, now));
    const ana = stats.viewers.find((viewer) => viewer.userKey === "twitch:a");
    expect(ana?.wins24h).toBe(1);
    expect(ana?.winsThisMonth).toBe(2);
    expect(ana?.daysSinceLastWin).toBe(0);
    expect(ana?.currentStreak).toBe(2);
    expect(ana?.bestStreak).toBe(2);
    expect(ana?.distinctGiveaways).toBe(2);
    expect(ana?.monthPosition).toBe(1);
    const bia = stats.viewers.find((viewer) => viewer.userKey === "twitch:b");
    expect(bia?.wins24h).toBe(1);
    expect(bia?.monthPosition).toBe(2);
    expect(stats.channel.topWinnersMonth[0]?.userKey).toBe("twitch:a");
    expect(stats.channel.firstDropThisMonth.firstDrops).toBe(2);
    expect(stats.channel.busiestDays).toEqual([
      { date: "2026-10-08", giveaways: 2 },
    ]);
    expect(stats.includesPreview).toBe(false);
  });

  it("catálogo later não dispara sem regra injetada", () => {
    const later = ["underdog", "drought_end", "last_second", "roulette_exec"];
    for (const id of later) {
      expect(BADGE_CATALOG.find((item) => item.id === id)?.phase).toBe(
        "later",
      );
    }
    const win = event({ wonAt: "2026-10-08T15:00:00.000Z" });
    const clk = clock("UTC", win.wonAt ?? "");
    expect(
      computeMomentBadges(memory([win]), win, clk).some((badge) =>
        later.includes(badge.id),
      ),
    ).toBe(false);

    const withRule = computeMomentBadges(memory([win]), win, clk, {
      rules: {
        moment: {
          drought_end: () => ({
            id: "drought_end",
            count: 12,
            rarity: "epic",
            level: 10,
          }),
        },
      },
    });
    const drought = withRule.find((badge) => badge.id === "drought_end");
    expect(drought?.rarity).toBe("epic");
    expect(drought?.count).toBe(12);
    expect(drought?.family).toBe("drought_end");
  });
});

function subscriber(
  userId: string,
  extra: { is_gift?: boolean; drawnAt?: string } = {},
) {
  return {
    broadcaster_id: "9",
    broadcaster_login: "canal",
    broadcaster_name: "Canal",
    gifter_id: extra.is_gift ? "8" : "",
    gifter_login: extra.is_gift ? "gifter" : "",
    is_gift: extra.is_gift ?? false,
    plan_name: "Tier 1",
    tier: "1000",
    user_id: userId,
    user_name: "Ana",
    user_login: "ana",
    drawnAt: extra.drawnAt,
  };
}
