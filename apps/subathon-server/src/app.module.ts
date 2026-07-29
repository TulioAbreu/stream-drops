import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { EventSubModule } from "./eventsub/eventsub.module";
import { BroadcastModule } from "./gateway/broadcast.module";
import { GatewayModule } from "./gateway/gateway.module";
import { HealthController } from "./health.controller";
import { LedgerModule } from "./ledger/ledger.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { TimerModule } from "./timer/timer.module";
import { resolvePublicPath } from "./utils/db-path.util";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BroadcastModule,
    PersistenceModule,
    TimerModule,
    LedgerModule,
    EventSubModule,
    GatewayModule,
    ServeStaticModule.forRoot({
      rootPath: join(resolvePublicPath(), "overlay"),
      serveRoot: "/overlay",
      exclude: ["/ws", "/health"],
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
