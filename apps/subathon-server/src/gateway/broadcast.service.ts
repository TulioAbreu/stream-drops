import { Injectable } from "@nestjs/common";
import type { ServerMessage } from "@stream-drops/subathon-protocol";
import { WebSocket } from "ws";

@Injectable()
export class BroadcastService {
  private readonly clients = new Set<WebSocket>();

  register(client: WebSocket) {
    this.clients.add(client);
    client.on("close", () => this.clients.delete(client));
    client.on("error", () => this.clients.delete(client));
  }

  broadcast(message: ServerMessage) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  send(client: WebSocket, message: ServerMessage) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
