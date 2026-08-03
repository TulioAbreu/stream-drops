import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  parseTwitchSubTier,
  subUnitForTier,
  type ConversionUnit,
  type LedgerEntry,
} from "@stream-drops/subathon-protocol";
import tmi, { type Client as TmiClient } from "tmi.js";
import { BroadcastService } from "../gateway/broadcast.service";
import { LedgerService } from "../ledger/ledger.service";
import { TimerService } from "../timer/timer.service";

function isGiftRecipientUserstate(
  userstate: Record<string, string>,
): boolean {
  const msgId = userstate["msg-id"] ?? "";
  if (
    msgId === "subgift" ||
    msgId === "anonsubgift" ||
    msgId === "submysterygift" ||
    msgId === "giftpaidupgrade" ||
    msgId === "anongiftpaidupgrade"
  ) {
    return true;
  }

  const wasGifted = userstate["msg-param-was-gifted"];
  if (wasGifted === "true" || wasGifted === "1") {
    return true;
  }

  // Gift recipient notifications often include the gifter login.
  if (userstate["msg-param-sender-login"] || userstate["msg-param-sender-name"]) {
    return true;
  }

  return false;
}

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

      if (isGiftRecipientUserstate(userstate)) {
        return;
      }

      const tier = parseTwitchSubTier(userstate["msg-param-sub-plan"]);
      const eventId = `chat-sub-${userstate["msg-id"] ?? username}-${Date.now()}`;
      void this.handleSub(
        eventId,
        username,
        1,
        subUnitForTier(tier),
      );
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

    try {
      await this.client.connect();
      this.logger.log(`Chat IRC connected on #${channelLogin}`);
    } catch (error) {
      this.client = null;
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Chat IRC login failed: ${message}`);
      throw new Error(
        message.includes("Login unsuccessful")
          ? "Chat IRC login unsuccessful (missing chat:read/chat:edit scopes?)"
          : message,
      );
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // Ignore disconnect errors during teardown.
      }
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
    unit: ConversionUnit,
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
