import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  matchDonationMessage,
  normalizeBotUsername,
  type LedgerEntry,
} from "@stream-drops/subathon-protocol";
import tmi, { type Client as TmiClient } from "tmi.js";
import { BroadcastService } from "../gateway/broadcast.service";
import { LedgerService } from "../ledger/ledger.service";
import { TimerService } from "../timer/timer.service";

const isDev = process.env.NODE_ENV === "development";

/**
 * IRC listener for BRL donation-bot templates only.
 * Subscriptions, gifts, and bits are credited exclusively via EventSub.
 */
@Injectable()
export class ChatListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatListenerService.name);
  private client: TmiClient | null = null;
  private channelLogin = "";
  private connected = false;

  constructor(
    private readonly ledger: LedgerService,
    private readonly timer: TimerService,
    private readonly broadcast: BroadcastService,
  ) {}

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

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
      this.connected = true;
      this.logger.log(`Chat IRC connected on #${channelLogin}`);
    } catch (error) {
      this.client = null;
      this.connected = false;
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
    this.connected = false;
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
    kind: "message",
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
}
