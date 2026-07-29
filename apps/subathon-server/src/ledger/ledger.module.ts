import { Module } from "@nestjs/common";
import { TimerModule } from "../timer/timer.module";
import { LedgerService } from "./ledger.service";

@Module({
  imports: [TimerModule],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
