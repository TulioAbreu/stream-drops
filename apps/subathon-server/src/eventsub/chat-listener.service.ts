import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { LedgerEntry } from "@stream-drops/subathon-protocol";
import tmi, { type Client as TmiClient } from "tmi.js";
import { BroadcastService } from "../gateway/broadcast.service";
import { LedgerService } from "../ledger/ledger.service";
import { TimerService } from "../timer/timer.service";

@Injectable()
export class ChatListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatListenerService.name);
  private client: TmiClient | null = null;

  constructor(
    private readonly ledger: LedgerService,
    private readonly timer: TimerService,
    private readonly broadcast: BroadcastService,
  ) {}

  async configure(
    accessToken: string,
    channelLogin: string,
    enabled: boolean,
  ) {
    await this.disconnect();

    if (!enabled) {
      return;
    }

    this.client = new tmi.Client({
      channels: [channelLogin],
      identity: {
        username: channelLogin,
        password: `oauth:${accessToken}`,
      },
    });

    this.client.on("subscription", (...args: unknown[]) => {
      const username = String(args[1] ?? "unknown");
      const userstate = (args[4] ?? {}) as Record<string, string>;
      const eventId = `chat-sub-${userstate["msg-id"] ?? username}-${Date.now()}`;
      void this.handleSub(eventId, username, 1, "sub");
    });

    this.client.on("cheer", (...args: unknown[]) => {
      const userstate = (args[1] ?? {}) as Record<string, string | number>;
      const bits = Number(userstate.bits ?? 0);
      if (bits <= 0) {
        return;
      }

      const eventId = `chat-bits-${userstate.id ?? userstate["user-id"]}-${bits}-${Date.now()}`;
      void this.handleBits(
        eventId,
        String(userstate["display-name"] ?? "unknown"),
        bits,
      );
    });

    await this.client.connect();
    this.logger.log(`Chat IRC connected on #${channelLogin}`);
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  onModuleDestroy() {
    void this.disconnect();
  }

  private publishCredit(entry: LedgerEntry) {
    this.broadcast.broadcast({ type: "ledger.entry", entry });
    this.broadcast.broadcast({
      type: "timer.snapshot",
      snapshot: this.timer.buildSnapshot(this.timer.getActiveSessionId()),
    });
    const session = this.timer.getSession(entry.sessionId);
    if (session) {
      this.broadcast.broadcast({ type: "session.updated", session });
    }
  }

  private async handleSub(
    eventId: string,
    actor: string,
    amount: number,
    unit: "sub" | "sub_gift",
  ) {
    const sessionId = this.timer.getActiveSessionId();
    if (!sessionId) {
      return;
    }

    try {
      const deltaMs = this.timer.msForUnit(sessionId, unit, amount);
      const session = this.timer.getSession(sessionId);
      if (!session || deltaMs <= 0) {
        return;
      }

      const entry = this.ledger.addCredit({
        sessionId,
        deltaMs,
        source: "chat",
        actor,
        amount,
        unit,
        conversionSnapshot: session.conversionRules,
        externalEventId: eventId,
      });
      this.publishCredit(entry);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_EVENT") {
        return;
      }
      this.logger.warn(`Chat sub handler failed: ${String(error)}`);
    }
  }

  private async handleBits(
    eventId: string,
    actor: string,
    bits: number,
  ) {
    const sessionId = this.timer.getActiveSessionId();
    if (!sessionId) {
      return;
    }

    try {
      const deltaMs = this.timer.msForUnit(sessionId, "bits", bits);
      const session = this.timer.getSession(sessionId);
      if (!session || deltaMs <= 0) {
        return;
      }

      const entry = this.ledger.addCredit({
        sessionId,
        deltaMs,
        source: "chat",
        actor,
        amount: bits,
        unit: "bits",
        conversionSnapshot: session.conversionRules,
        externalEventId: eventId,
      });
      this.publishCredit(entry);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_EVENT") {
        return;
      }
      this.logger.warn(`Chat bits handler failed: ${String(error)}`);
    }
  }
}
