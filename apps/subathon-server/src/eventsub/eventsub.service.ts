import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { ApiClient } from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import {
  giftUnitForTier,
  parseTwitchSubTier,
  SUB_CREDIT_DEDUP_WINDOW_MS,
  subUnitForTier,
  type ConversionUnit,
  type LedgerEntry,
} from "@stream-drops/subathon-protocol";
import { BroadcastService } from "../gateway/broadcast.service";
import { LedgerService } from "../ledger/ledger.service";
import { TimerService } from "../timer/timer.service";

function isNonGiftSubUnit(unit: ConversionUnit): boolean {
  return unit === "sub_1000" || unit === "sub_2000" || unit === "sub_3000";
}

@Injectable()
export class EventSubService implements OnModuleDestroy {
  private readonly logger = new Logger(EventSubService.name);
  private listener: EventSubWsListener | null = null;
  private apiClient: ApiClient | null = null;
  private enabled = false;

  constructor(
    private readonly ledger: LedgerService,
    private readonly timer: TimerService,
    private readonly broadcast: BroadcastService,
  ) {}

  isConnected(): boolean {
    return this.enabled && this.listener !== null;
  }

  async configure(
    accessToken: string,
    broadcasterUserId: string,
    enabled: boolean,
    clientId: string,
  ) {
    await this.disconnect();

    this.enabled = enabled;

    if (!enabled || !clientId) {
      if (!clientId) {
        this.logger.warn("TWITCH client id missing for EventSub");
      }
      return;
    }

    const authProvider = new StaticAuthProvider(clientId, accessToken);
    this.apiClient = new ApiClient({ authProvider });
    this.listener = new EventSubWsListener({ apiClient: this.apiClient });

    this.listener.onChannelSubscription(
      broadcasterUserId,
      async (event) => {
        if (event.isGift) {
          return;
        }

        const tier = parseTwitchSubTier(event.tier);
        await this.handleSub(
          `es:subscribe:${event.userId}:${tier}:${Date.now()}`,
          event.userId,
          event.userDisplayName,
          1,
          subUnitForTier(tier),
        );
      },
    );

    this.listener.onChannelSubscriptionMessage(
      broadcasterUserId,
      async (event) => {
        const tier = parseTwitchSubTier(event.tier);
        await this.handleSub(
          `es:resub:${event.userId}:${event.cumulativeMonths}:${tier}`,
          event.userId,
          event.userDisplayName,
          1,
          subUnitForTier(tier),
        );
      },
    );

    this.listener.onChannelSubscriptionGift(
      broadcasterUserId,
      async (event) => {
        const tier = parseTwitchSubTier(event.tier);
        await this.handleSub(
          `es:gift:${event.gifterId ?? "anon"}:${event.amount}:${tier}:${Date.now()}`,
          event.gifterId ?? "anon",
          event.gifterDisplayName,
          event.amount,
          giftUnitForTier(tier),
          { skipSubDedup: true },
        );
      },
    );

    this.listener.onChannelCheer(
      broadcasterUserId,
      async (event) => {
        await this.handleBits(
          `es:bits:${event.userId ?? "anon"}:${event.bits}:${Date.now()}`,
          event.userDisplayName ?? event.userName ?? "anonymous",
          event.bits,
        );
      },
    );

    await this.listener.start();
    this.logger.log("EventSub WebSocket connected");
  }

  async disconnect() {
    if (this.listener) {
      await this.listener.stop();
      this.listener = null;
    }

    this.apiClient = null;
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
    twitchUserId: string,
    actor: string,
    amount: number,
    unit: ConversionUnit,
    options?: { skipSubDedup?: boolean },
  ) {
    const sessionId = this.timer.getActiveSessionId();
    if (!sessionId) {
      return;
    }

    if (
      !options?.skipSubDedup &&
      isNonGiftSubUnit(unit) &&
      this.ledger.hasRecentNonGiftSubCredit(
        sessionId,
        twitchUserId,
        SUB_CREDIT_DEDUP_WINDOW_MS,
      )
    ) {
      this.logger.debug(
        `Skipping duplicate sub credit for user ${twitchUserId} (${eventId})`,
      );
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
        source: "eventsub",
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

      this.logger.warn(`EventSub sub handler failed: ${String(error)}`);
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
        source: "eventsub",
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

      this.logger.warn(`EventSub bits handler failed: ${String(error)}`);
    }
  }
}
