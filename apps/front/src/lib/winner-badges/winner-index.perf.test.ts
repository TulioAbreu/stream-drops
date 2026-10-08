import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { clearDatabase, openDb } from "@/database";
import { normalizeWinnerHistory } from "./normalize";
import {
  createPerformanceFixture,
  performanceFixtureRecords,
  PERFORMANCE_FIXTURE_SCALE,
} from "./performance-fixture";
import {
  buildWinnerIndexFromDatabase,
  readCardBadges,
  type DisplaySelection,
  type WinEvent,
} from "./index";

const M1_LIMIT_MS = 300;
const M2_LIMIT_MS = 50;
const FAIL_FACTOR = 2;

function percentile95(samples: readonly number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const rank = Math.ceil(0.95 * sorted.length);
  return sorted[Math.max(0, rank - 1)] ?? 0;
}

async function emit(line: string): Promise<void> {
  console.log(line);
  await commands.emitCiLog(line);
}

async function report(
  name: string,
  samples: readonly number[],
  limit: number,
): Promise<number> {
  const value = percentile95(samples);
  const rendered = samples.map((sample) => sample.toFixed(1)).join(",");
  await emit(
    `WINNER_INDEX_PERF ${name} p95=${value.toFixed(1)}ms limite=${limit}ms falha=${limit * FAIL_FACTOR}ms amostras=${rendered}`,
  );
  if (value > limit) {
    await emit(
      `::warning::CA18 ${name}: p95 ${value.toFixed(1)} ms acima de ${limit} ms (falha só acima de ${limit * FAIL_FACTOR} ms)`,
    );
  }
  expect(
    value,
    `${name} p95 ${value.toFixed(1)} ms acima de 2x (${limit * FAIL_FACTOR} ms). Amostras: ${rendered}`,
  ).toBeLessThanOrEqual(limit * FAIL_FACTOR);
  return value;
}

async function writeStore(name: string, records: unknown[]): Promise<void> {
  const db = await openDb();
  const chunkSize = name === "chat-participants" ? 2_000 : 100;
  if (records.length === 0) return;
  for (let offset = 0; offset < records.length; offset += chunkSize) {
    const slice = records.slice(offset, offset + chunkSize);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(name, "readwrite");
      const store = tx.objectStore(name);
      if (offset === 0) store.clear();
      for (const record of slice) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error(`abort ao gravar ${name}`));
    });
  }
}

describe("CA18 gate de performance", () => {
  beforeAll(async () => {
    const fixture = createPerformanceFixture();
    await emit(`WINNER_INDEX_PERF fixture ${JSON.stringify(fixture.counts)}`);
    const { counts } = fixture;
    expect(counts.giveaways).toBe(PERFORMANCE_FIXTURE_SCALE.giveaways);
    expect(counts.wins).toBe(PERFORMANCE_FIXTURE_SCALE.wins);
    expect(counts.distinctWinners).toBe(PERFORMANCE_FIXTURE_SCALE.viewers);
    expect(counts.peoplePerGiveaway).toBe(
      PERFORMANCE_FIXTURE_SCALE.peoplePerGiveaway,
    );
    expect(counts.softDeleted).toBeGreaterThan(0);
    expect(counts.softDeletedWithSummary).toBeGreaterThan(0);
    expect(counts.chatParticipantRows).toBeGreaterThan(0);
    expect(counts.giveawaysWithoutWinners).toBe(100);
    expect(counts.undatedSubscriberWins).toBeGreaterThan(0);
    expect(counts.datedSubscriberWins).toBeGreaterThan(0);
    expect(counts.lateChatEntries).toBeGreaterThan(0);
    expect(counts.chat).toBeGreaterThan(0);
    expect(counts.channelPoints).toBeGreaterThan(0);
    expect(counts.subscribers).toBeGreaterThan(0);

    const normalized = normalizeWinnerHistory({
      chat: fixture.chatGiveaways,
      channelPoints: fixture.channelPointsGiveaways,
      subscribers: fixture.subscriberGiveaways,
    });
    expect(normalized).toHaveLength(PERFORMANCE_FIXTURE_SCALE.wins);
    expect(new Set(normalized.map((win) => win.userKey)).size).toBe(
      PERFORMANCE_FIXTURE_SCALE.viewers,
    );

    await clearDatabase();
    const records = performanceFixtureRecords(fixture);
    for (const [name, rows] of Object.entries(records)) {
      await writeStore(name, rows);
    }
    const db = await openDb();
    expect(db.version).toBe(12);
    expect(db.name).toBe("stream-drops-db");
  }, 180_000);

  afterAll(async () => {
    await clearDatabase();
  }, 60_000);

  it("M1 monta o índice e M2 calcula os selos do card", async () => {
    const m1: number[] = [];
    let index = await Promise.resolve<Awaited<
      ReturnType<typeof buildWinnerIndexFromDatabase>
    > | null>(null);
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      index = await buildWinnerIndexFromDatabase();
      m1.push(performance.now() - started);
    }
    await report("M1", m1, M1_LIMIT_MS);
    expect(index?.getWins()).toHaveLength(PERFORMANCE_FIXTURE_SCALE.wins);
    expect(index?.byUser.size).toBe(PERFORMANCE_FIXTURE_SCALE.viewers);
    if (!index) throw new Error("índice ausente");

    const pending: WinEvent = {
      userKey: "twitch:v0000",
      platform: "twitch",
      userId: "v0000",
      giveawayType: "chat",
      giveawayId: "preview-m2",
      index: 0,
      wonAt: "2026-10-08T18:00:00.000Z",
      name: "Viewer 0",
      preview: true,
    };
    const clock = {
      now: "2026-10-08T18:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    };
    const m2: number[] = [];
    let last: DisplaySelection | null = null;
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      last = readCardBadges("ready", index, pending, clock);
      m2.push(performance.now() - started);
    }
    await report("M2", m2, M2_LIMIT_MS);
    expect(Array.isArray(last?.card)).toBe(true);
    expect(Array.isArray(last?.tooltip)).toBe(true);
  }, 180_000);
});
