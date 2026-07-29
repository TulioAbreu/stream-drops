import {
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
  type SubathonSession,
} from "@stream-drops/subathon-protocol";
import { v7 as uuidv7 } from "uuid";
import { WebSocket } from "ws";
import { DatabaseService } from "../persistence/database.service";
import { EventSubService } from "../eventsub/eventsub.service";
import { ChatListenerService } from "../eventsub/chat-listener.service";
import { LedgerService } from "../ledger/ledger.service";
import { TimerService } from "../timer/timer.service";
import { BroadcastService } from "./broadcast.service";

@Injectable()
export class SubathonGatewayService implements OnModuleInit {
  private readonly logger = new Logger(SubathonGatewayService.name);
  private serverPort = 8080;

  constructor(
    private readonly timer: TimerService,
    private readonly ledger: LedgerService,
    private readonly eventSub: EventSubService,
    private readonly chatListener: ChatListenerService,
    private readonly database: DatabaseService,
    private readonly broadcastService: BroadcastService,
  ) {}

  onModuleInit() {
    this.logger.log("Subathon gateway ready");
  }

  setPort(port: number) {
    this.serverPort = port;
  }

  registerClient(client: WebSocket) {
    this.broadcastService.register(client);
  }

  @Interval(1000)
  broadcastSnapshotTick() {
    const activeSessionId = this.timer.getActiveSessionId();
    if (!activeSessionId) {
      return;
    }

    const session = this.timer.getSession(activeSessionId);
    if (session?.snapshot.status !== "running") {
      return;
    }

    const snapshot = this.timer.buildSnapshot(activeSessionId);
    if (snapshot.status === "ended") {
      this.broadcast({
        type: "timer.snapshot",
        snapshot,
      });
    }
  }

  handleMessage(client: WebSocket, raw: string) {
    let message: ClientMessage;

    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(client, {
        type: "error",
        code: "INVALID_JSON",
        message: "Invalid JSON payload",
      });
      return;
    }

    try {
      this.dispatch(client, message);
    } catch (error) {
      this.send(client, {
        type: "error",
        code: "HANDLER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private dispatch(client: WebSocket, message: ClientMessage) {
    switch (message.type) {
      case "hello": {
        const activeSessionId = this.timer.getActiveSessionId();
        this.send(client, {
          type: "hello.ok",
          protocolVersion: PROTOCOL_VERSION,
          port: this.serverPort,
          activeSessionId,
          dbPath: this.database.dbPath,
        });
        this.send(client, {
          type: "connection.status",
          connected: true,
          eventsub: this.eventSub.isConnected(),
        });
        this.send(client, {
          type: "timer.snapshot",
          snapshot: this.timer.buildSnapshot(activeSessionId),
        });
        if (activeSessionId) {
          const session = this.timer.getSession(activeSessionId);
          if (session) {
            this.send(client, { type: "session.updated", session });
          }
          this.send(client, {
            type: "ledger.list",
            entries: this.ledger.listEntries(activeSessionId, 100),
          });
        }
        return;
      }

      case "configureTwitch": {
        const clientId =
          process.env.TWITCH_CLIENT_ID ??
          process.env.VITE_TWITCH_CLIENT_ID ??
          "";
        void this.eventSub
          .configure(
            message.accessToken,
            message.broadcasterUserId,
            message.enabled,
            clientId,
          )
          .then(() => {
            this.broadcast({
              type: "connection.status",
              connected: true,
              eventsub: this.eventSub.isConnected(),
            });
          })
          .catch((error) => {
            this.broadcast({
              type: "connection.status",
              connected: true,
              eventsub: false,
            });
            this.send(client, {
              type: "error",
              code: "EVENTSUB_FAILED",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to connect EventSub",
            });
          });
        if (message.chatEnabled) {
          void this.chatListener.configure(
            message.accessToken,
            message.channelLogin,
            message.enabled,
          );
        } else {
          void this.chatListener.disconnect();
        }
        return;
      }

      case "createSession": {
        const session = this.timer.createSession(
          uuidv7(),
          message.name,
          message.initialMs,
          message.rules,
        );
        this.ledger.recordSystemEntry(
          session.id,
          "init",
          message.initialMs,
          "system",
        );
        if (message.activate !== false) {
          this.timer.setActiveSessionId(session.id);
          this.broadcastSnapshot();
        }
        this.broadcast({ type: "session.created", session });
        this.broadcastSession(session);
        return;
      }

      case "listSessions":
        this.send(client, {
          type: "sessions.list",
          sessions: this.timer.listSessions(),
        });
        return;

      case "setActiveSession":
        this.timer.setActiveSessionId(message.sessionId);
        this.broadcastSnapshot();
        if (message.sessionId) {
          const session = this.timer.getSession(message.sessionId);
          if (session) {
            this.broadcastSession(session);
          }
          this.send(client, {
            type: "ledger.list",
            entries: this.ledger.listEntries(message.sessionId, 100),
          });
        } else {
          this.send(client, {
            type: "ledger.list",
            entries: [],
          });
        }
        return;

      case "renameSession": {
        const session = this.timer.renameSession(
          message.sessionId,
          message.name,
        );
        this.broadcastSession(session);
        return;
      }

      case "deleteSession": {
        this.timer.deleteSession(message.sessionId);
        this.broadcast({
          type: "session.deleted",
          sessionId: message.sessionId,
        });
        if (this.timer.getActiveSessionId() === null) {
          this.broadcastSnapshot();
        }
        return;
      }

      case "updateConversion": {
        const session = this.timer.updateConversion(
          message.sessionId,
          message.rules,
        );
        this.broadcastSession(session);
        return;
      }

      case "updateStyle": {
        const session = this.timer.updateStyle(
          message.sessionId,
          message.style,
        );
        this.broadcastSession(session);
        return;
      }

      case "timer.play": {
        const sessionId = this.requireActiveSession();
        const session = this.timer.play(sessionId);
        this.ledger.recordSystemEntry(sessionId, "resume", 0, "system");
        this.broadcastSession(session);
        this.broadcastSnapshot();
        return;
      }

      case "timer.pause": {
        const sessionId = this.requireActiveSession();
        const session = this.timer.pause(sessionId);
        this.ledger.recordSystemEntry(sessionId, "pause", 0, "system");
        this.broadcastSession(session);
        this.broadcastSnapshot();
        return;
      }

      case "timer.reset": {
        const sessionId = this.requireActiveSession();
        const session = this.timer.reset(sessionId, message.initialMs);
        this.ledger.recordSystemEntry(
          sessionId,
          "set",
          message.initialMs,
          "system",
        );
        this.broadcastSession(session);
        this.broadcastSnapshot();
        return;
      }

      case "timer.addMinutes": {
        const sessionId = this.requireActiveSession();
        const deltaMs = message.minutes * 60_000;
        const entry = this.ledger.addCredit({
          sessionId,
          deltaMs,
          source: "manual",
          actor: message.actor,
          amount: message.minutes,
          unit: null,
          conversionSnapshot: null,
          externalEventId: null,
        });
        this.broadcast({ type: "ledger.entry", entry });
        this.broadcastSnapshot();
        const session = this.timer.getSession(sessionId);
        if (session) {
          this.broadcastSession(session);
        }
        return;
      }

      case "timer.setRemaining": {
        const sessionId = this.requireActiveSession();
        const snapshot = this.timer.buildSnapshot(sessionId);

        if (snapshot.status !== "paused") {
          throw new Error("Pause o timer para editar o tempo");
        }

        const deltaMs = message.remainingMs - snapshot.remainingMs;
        const session = this.timer.setRemaining(sessionId, message.remainingMs);
        const entry = this.ledger.recordSystemEntry(
          sessionId,
          "set",
          deltaMs,
          message.actor,
        );
        this.broadcast({ type: "ledger.entry", entry });
        this.broadcastSnapshot();
        this.broadcastSession(session);
        return;
      }

      case "ledger.add": {
        const sessionId = this.requireActiveSession();
        const entry = this.ledger.addManualCredit(
          sessionId,
          message.unit,
          message.amount,
          message.actor,
        );
        this.broadcast({ type: "ledger.entry", entry });
        this.broadcastSnapshot();
        const session = this.timer.getSession(sessionId);
        if (session) {
          this.broadcastSession(session);
        }
        return;
      }

      case "ledger.undo": {
        const entry = this.ledger.undoEntry(message.entryId, message.actor);
        this.broadcast({ type: "ledger.entry", entry });
        this.broadcastSnapshot();
        const session = this.timer.getSession(entry.sessionId);
        if (session) {
          this.broadcastSession(session);
        }
        return;
      }

      case "ledger.list":
        this.send(client, {
          type: "ledger.list",
          entries: this.ledger.listEntries(message.sessionId, message.limit),
        });
        return;

      default:
        this.send(client, {
          type: "error",
          code: "UNKNOWN_MESSAGE",
          message: "Unknown message type",
        });
    }
  }

  private requireActiveSession(): string {
    const sessionId = this.timer.getActiveSessionId();
    if (!sessionId) {
      throw new Error("No active session");
    }

    return sessionId;
  }

  private broadcastSnapshot() {
    this.broadcast({
      type: "timer.snapshot",
      snapshot: this.timer.buildSnapshot(this.timer.getActiveSessionId()),
    });
  }

  private broadcastSession(session: SubathonSession) {
    this.broadcast({ type: "session.updated", session });
  }

  private send(client: WebSocket, message: ServerMessage) {
    this.broadcastService.send(client, message);
  }

  broadcast(message: ServerMessage) {
    this.broadcastService.broadcast(message);
  }
}
