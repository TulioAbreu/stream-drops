import { act, renderHook, waitFor } from "@testing-library/react";
import type tmi from "tmi.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setChatListenerTestOverrides,
  useChatListener,
  type ChatListenerClient,
} from "./index";

const bus: {
  emit: (
    userstate: tmi.ChatUserstate,
    message: string,
    self?: boolean,
  ) => void;
} = {
  emit: () => undefined,
};

function createFakeClient(): ChatListenerClient {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const client: ChatListenerClient = {
    async connect() {
      listeners.get("connected")?.forEach((listener) => listener());
    },
    async disconnect() {
      listeners.get("disconnected")?.forEach((listener) => listener());
    },
    on(event, listener) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
    },
  };

  bus.emit = (userstate, message, self = false) => {
    listeners.get("message")?.forEach((listener) => {
      listener("#streamer", userstate, message, self);
    });
  };

  return client;
}

function userstate(
  id: string,
  username: string,
  displayName = username,
): tmi.ChatUserstate {
  return {
    id: `msg-${id}`,
    "user-id": id,
    username,
    "display-name": displayName,
    subscriber: false,
  } as tmi.ChatUserstate;
}

describe("coleta do chat sem Twitch", () => {
  beforeEach(() => {
    setChatListenerTestOverrides({
      createClient: () => createFakeClient(),
      batchMaxWaitMs: 0,
    });
  });

  afterEach(() => {
    setChatListenerTestOverrides(null);
  });

  async function mount(
    excludedUserIds: ReadonlySet<string> = new Set(),
    keyword = "!join",
  ) {
    const hook = renderHook(
      (props: { excludedUserIds: ReadonlySet<string>; keyword: string }) =>
        useChatListener({
          channel: "streamer",
          keyword: props.keyword,
          broadcasterId: "broadcaster-1",
          excludedUserIds: props.excludedUserIds,
        }),
      { initialProps: { excludedUserIds, keyword } },
    );

    await waitFor(() => {
      expect(hook.result.current.connectionStatus).toBe("connected");
    });

    return hook;
  }

  async function say(id: string, username: string, text = "!join") {
    await act(async () => {
      bus.emit(userstate(id, username, username), text);
    });
  }

  it("CA-C6: quem está na exclusão não entra, e volta na próxima mensagem se sair", async () => {
    const excluded = new Set(["mod"]);
    const { result, rerender } = await mount(excluded);

    await say("mod", "modbot");
    await waitFor(() => {
      expect(result.current.messages.some((item) => item.userId === "mod")).toBe(
        true,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.allParticipants).toEqual([]);

    await say("viewer", "viewer");
    await waitFor(() => {
      expect(result.current.allParticipants.map((item) => item.id)).toEqual([
        "viewer",
      ]);
    });

    rerender({ excludedUserIds: new Set(), keyword: "!join" });
    await say("mod", "modbot");

    await waitFor(() => {
      expect(result.current.allParticipants.map((item) => item.id)).toContain(
        "mod",
      );
    });
  });

  it("CA-C9: a mensagem do broadcaster fica no painel e ele não vira participante", async () => {
    const { result } = await mount();

    await say("broadcaster-1", "outro-login");
    await waitFor(() => {
      expect(result.current.messages.map((item) => item.userId)).toEqual([
        "broadcaster-1",
      ]);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.allParticipants).toEqual([]);

    await say("not-the-id", "streamer");
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.allParticipants).toEqual([]);

    await say("viewer", "viewer");
    await waitFor(() => {
      expect(result.current.allParticipants.map((item) => item.id)).toEqual([
        "viewer",
      ]);
    });
    expect(result.current.messages.map((item) => item.userId)).toEqual([
      "broadcaster-1",
      "not-the-id",
      "viewer",
    ]);
  });

  it("CA-C11: mudar a exclusão não zera a coleta nem recompõe por critério", async () => {
    const { result, rerender } = await mount();
    const ids = Array.from({ length: 20 }, (_, index) => `user-${index}`);

    for (const id of ids) {
      await say(id, id);
      await waitFor(() => {
        expect(
          result.current.allParticipants.some((item) => item.id === id),
        ).toBe(true);
      });
    }

    const before = result.current.allParticipants.map((item) => ({
      id: item.id,
      joinedAt: item.joinedAt,
    }));

    rerender({
      excludedUserIds: new Set(["user-3"]),
      keyword: "!join",
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });

    expect(result.current.allParticipants).toHaveLength(20);
    expect(
      result.current.allParticipants.map((item) => ({
        id: item.id,
        joinedAt: item.joinedAt,
      })),
    ).toEqual(before);

    rerender({
      excludedUserIds: new Set(["user-3"]),
      keyword: "nao-entra",
    });

    await waitFor(() => {
      expect(result.current.allParticipants).toEqual([]);
    });
  });
});
