import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { getStubConfig, STUB_SCOPES } from "./stub.types";
import { TwitchStubStore } from "./twitch-stub.store";

@Controller("oauth2")
export class OAuthController {
  constructor(private readonly store: TwitchStubStore) {}

  @Get("validate")
  validate(@Headers("authorization") authorization?: string) {
    if (!authorization?.toLowerCase().startsWith("bearer ")) {
      throw new UnauthorizedException({
        status: 401,
        message: "missing Authorization bearer token",
      });
    }

    const config = getStubConfig();
    const broadcaster = this.store.getBroadcaster();

    return {
      client_id: config.clientId,
      login: broadcaster.login,
      scopes: STUB_SCOPES,
      scope: STUB_SCOPES,
      token_type: "bearer",
      expires_in: 60 * 60 * 24,
      user_id: broadcaster.id,
      user_name: broadcaster.display_name,
    };
  }
}
