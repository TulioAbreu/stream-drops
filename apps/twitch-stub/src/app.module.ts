import { Module } from "@nestjs/common";
import { OAuthController } from "./oauth.controller";
import { UsersController } from "./users.controller";
import { SubscriptionsController } from "./subscriptions.controller";
import { ChatController } from "./chat.controller";
import { ChannelPointsController } from "./channel-points.controller";
import { TwitchStubStore } from "./twitch-stub.store";

@Module({
  controllers: [
    OAuthController,
    UsersController,
    SubscriptionsController,
    ChatController,
    ChannelPointsController,
  ],
  providers: [TwitchStubStore],
})
export class AppModule {}
