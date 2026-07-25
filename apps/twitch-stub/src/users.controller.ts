import { Controller, Get, Query } from "@nestjs/common";
import { TwitchStubStore } from "./twitch-stub.store";

function asArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

@Controller("helix/users")
export class UsersController {
  constructor(private readonly store: TwitchStubStore) {}

  @Get()
  getUsers(
    @Query("id") id?: string | string[],
    @Query("login") login?: string | string[]
  ) {
    const ids = asArray(id);
    const logins = asArray(login);

    if (ids.length > 0) {
      return { data: this.store.getUsersByIds(ids) };
    }

    if (logins.length > 0) {
      return { data: this.store.getUsersByLogins(logins) };
    }

    return { data: [this.store.getBroadcaster()] };
  }
}
