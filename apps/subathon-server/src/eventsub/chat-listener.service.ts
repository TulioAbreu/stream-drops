import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  matchDonationMessage,
  normalizeBotUsername,
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

const isDev = process.env.NODE_ENV === "development";

@Injectable()
export class ChatListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatListenerService.name);
  private client: TmiClient | null = null;
  private channelLogin = "";

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

    this.channelLogin = channelLogin;

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

      this.logChannelEvent("subscription", {
        channel: this.channelLogin,
        username,
        userId: userstate["user-id"],
        displayName: userstate["display-name"],
        tier,
        msgId: userstate["msg-id"],
        eventId,
      });

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
      const actor = String(userstate["display-name"] ?? "unknown");

      this.logChannelEvent("cheer", {
        channel: this.channelLogin,
        username: String(userstate.username ?? userstate.login ?? ""),
        userId: userstate["user-id"],
        displayName: actor,
        bits,
        content: String(args[2] ?? ""),
        msgId: userstate.id ?? userstate["msg-id"],
        eventId,
      });

      void this.handleBits(eventId, actor, bits);
    });

    this.client.on("message", (...args: unknown[]) => {
      const channel = String(args[0] ?? this.channelLogin);
      const userstate = (args[1] ?? {}) as Record<string, string>;
      const message = String(args[2] ?? "").trim();
      const username = normalizeBotUsername(
        String(userstate.username ?? userstate.login ?? ""),
      );

      this.logChannelEvent("message", {
        channel,
        username,
        userId: userstate["user-id"],
        displayName: userstate["display-name"],
        content: message,
        msgId: userstate.id ?? userstate["msg-id"],
        badges: userstate.badges,
        mod: userstate.mod,
        subscriber: userstate.subscriber,
        color: userstate.color,
      });

      void this.handleDonationMessage(username, message, userstate);
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
    this.channelLogin = "";
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

  private logChannelEvent(
    kind: "message" | "subscription" | "cheer",
    data: Record<string, unknown>,
  ) {
    if (!isDev) {
      return;
    }

    this.logger.log(
      `Chat ${kind} processed: ${JSON.stringify(data)}`,
    );
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

  private async handleDonationMessage(
    username: string,
    message: string,
    userstate: Record<string, string>,
  ) {
    const trimmedMessage = message.trim();
    if (!username || !trimmedMessage) {
      return;
    }

    const sessionId = this.timer.getActiveSessionId();
    if (!sessionId) {
      return;
    }

    const session = this.timer.getSession(sessionId);
    if (!session) {
      return;
    }

    const config = session.donationBot;
    const configuredBot = normalizeBotUsername(config.botUsername);
    if (!config.enabled || !configuredBot) {
      return;
    }

    if (username !== configuredBot) {
      return;
    }

    const matched = matchDonationMessage(config.templates, trimmedMessage);
    if (!matched) {
      return;
    }

    try {
      const deltaMs = this.timer.msForUnit(
        sessionId,
        "brl",
        matched.amount,
      );
      if (deltaMs <= 0) {
        return;
      }

      const msgId =
        userstate.id ??
        userstate["msg-id"] ??
        `${username}-${Date.now()}`;
      const eventId = `chat-donate-${msgId}`;

      const entry = this.ledger.addCredit({
        sessionId,
        deltaMs,
        source: "chat",
        actor: matched.user,
        amount: matched.amount,
        unit: "brl",
        conversionSnapshot: session.conversionRules,
        externalEventId: eventId,
      });
      this.publishCredit(entry);
    } catch (error) {
      if (error instanceof Error && error.message === "DUPLICATE_EVENT") {
        return;
      }
      this.logger.warn(`Chat donation handler failed: ${String(error)}`);
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
