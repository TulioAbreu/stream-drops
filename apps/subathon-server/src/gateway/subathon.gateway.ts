import {
  OnGatewayConnection,
  WebSocketGateway,
} from "@nestjs/websockets";
import { WebSocket } from "ws";
import { SubathonGatewayService } from "./subathon-gateway.service";

@WebSocketGateway({ path: "/ws" })
export class SubathonGateway implements OnGatewayConnection {
  constructor(private readonly gatewayService: SubathonGatewayService) {}

  handleConnection(client: WebSocket) {
    this.gatewayService.registerClient(client);

    client.on("message", (data) => {
      this.gatewayService.handleMessage(client, data.toString());
    });
  }
}
