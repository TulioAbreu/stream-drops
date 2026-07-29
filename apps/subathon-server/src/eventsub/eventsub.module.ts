import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { TimerModule } from "../timer/timer.module";
import { ChatListenerService } from "./chat-listener.service";
import { EventSubService } from "./eventsub.service";

@Module({
  imports: [LedgerModule, TimerModule],
  providers: [EventSubService, ChatListenerService],
  exports: [EventSubService, ChatListenerService],
})
export class EventSubModule {}
