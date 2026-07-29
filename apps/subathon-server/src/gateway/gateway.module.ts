import { Module } from "@nestjs/common";
import { EventSubModule } from "../eventsub/eventsub.module";
import { LedgerModule } from "../ledger/ledger.module";
import { TimerModule } from "../timer/timer.module";
import { SubathonGateway } from "./subathon.gateway";
import { SubathonGatewayService } from "./subathon-gateway.service";

@Module({
  imports: [TimerModule, LedgerModule, EventSubModule],
  providers: [SubathonGatewayService, SubathonGateway],
  exports: [SubathonGatewayService],
})
export class GatewayModule {}
