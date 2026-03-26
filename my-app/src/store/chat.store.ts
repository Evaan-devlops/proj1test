// src/store/chat.store.ts
import { chatApi } from "../features/chat/api/chatApi";
import type { ChatMessageDto, StreamEvent } from "../features/chat/api/types";
import { create } from "zustand";
import type { StateCreator } from "zustand";

const USE_FAKE = import.meta.env?.VITE_USE_FAKE_BACKEND === "true";

type Role = "user" | "assistant";
type MsgStatus = "final" | "streaming" | "error";

export type Message = {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
  status: MsgStatus;
};

export type Chat = {
  id: string;
  title: string;
  updatedAt: number;
};

export type ChatStore = {
  chats: Chat[];
  chatsLoaded: boolean;
  isLoadingChats: boolean;
  lastError: string | null;
  availableAccountKeys: string[];
  selectedAccountKeys: string[];
  accountsLoaded: boolean;
  activeChatId: string | null;
  messagesByChatId: Record<string, Message[]>;
  messagesLoadedByChatId: Record<string, boolean>;
  latestUserMessageIdByChatId: Record<string, string>;
  focusedUserMessageIdByChatId: Record<string, string>;
  isStreaming: boolean;
  activeStreamChatId: string | null;
  streamCancel: (() => void) | null;
  streamTimerId: number | null;

  hydrateChats: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  toggleAccountSelection: (accountKey: string) => void;
  toggleAllAccounts: (checked: boolean) => void;
  loadMessagesIfNeeded: (chatId: string) => Promise<void>;
  newChat: () => Promise<string | null>;
  setActiveChat: (chatId: string) => void;
  sendMessage: (text: string) => Promise<boolean>;
  resendEditedPrompt: (userMessageId: string, newText: string) => Promise<void>;
  stopStreaming: () => void;
  renameChat: (chatId: string, title: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearError: () => void;
};

type SetFn = Parameters<StateCreator<ChatStore>>[0];
type GetFn = Parameters<StateCreator<ChatStore>>[1];

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function makeTitleFromText(text: string) {
  return text.trim().split(/\s+/).slice(0, 4).join(" ");
}

function sortChatsDescending(chats: Chat[]) {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
}

function mapDtoToMessage(dto: ChatMessageDto, statusOverride?: MsgStatus): Message {
  return {
    id: dto.id,
    role: dto.role,
    text: dto.text,
    createdAt: dto.createdAtMs,
    status: (statusOverride ?? dto.status ?? "final") as MsgStatus,
  };
}

function parseStreamEvent(chunk: string): StreamEvent | null {
  const trimmed = chunk.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as StreamEvent;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function ensureActiveChatId(get: GetFn): Promise<string | null> {
  const existing = get().activeChatId;
  if (existing) return existing;
  const created = await get().newChat();
  return created ?? get().activeChatId;
}

function startFakeStreaming(chatId: string, get: GetFn, set: SetFn) {
  const fake =
    "Hello! This is a fake streaming response. Later we will replace this with backend streaming (SSE or fetch streaming).";
  const chunks = fake.match(/.{1,8}/g) ?? [fake];
  let i = 0;

  const finalize = () => {
    set((state) => {
      const msgs = state.messagesByChatId[chatId] ?? [];
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== "assistant") {
        return {
          isStreaming: false,
          activeStreamChatId: null,
          streamCancel: null,
          streamTimerId: null,
        };
      }
      const updated = { ...last, status: "final" as MsgStatus };
      return {
        messagesByChatId: { ...state.messagesByChatId, [chatId]: [...msgs.slice(0, -1), updated] },
        isStreaming: false,
        activeStreamChatId: null,
        streamCancel: null,
        streamTimerId: null,
      };
    });
  };

  const timerId = window.setInterval(() => {
    const state = get();
    if (!state.isStreaming || state.activeStreamChatId !== chatId) {
      window.clearInterval(timerId);
      return;
    }
    const chunk = chunks[i++];
    if (chunk) {
      set((s) => {
        const msgs = s.messagesByChatId[chatId] ?? [];
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return {};
        const updated = { ...last, text: last.text + chunk, status: "streaming" as MsgStatus };
        return {
          messagesByChatId: { ...s.messagesByChatId, [chatId]: [...msgs.slice(0, -1), updated] },
        };
      });
    }
    if (i >= chunks.length) {
      window.clearInterval(timerId);
      finalize();
    }
  }, 60);

  const cancel = () => {
    window.clearInterval(timerId);
  };

  set({ streamCancel: cancel, streamTimerId: timerId });
}

const creator: StateCreator<ChatStore> = (set, get) => ({
  chats: [],
  chatsLoaded: false,
  isLoadingChats: false,
  lastError: null,
  availableAccountKeys: [],
  selectedAccountKeys: [],
  accountsLoaded: false,
  activeChatId: null,
  messagesByChatId: {},
  messagesLoadedByChatId: {},
  latestUserMessageIdByChatId: {},
  focusedUserMessageIdByChatId: {},
  isStreaming: false,
  activeStreamChatId: null,
  streamCancel: null,
  streamTimerId: null,
  clearError: () => set({ lastError: null }),

  loadAccounts: async () => {
    if (get().accountsLoaded) return;

    if (USE_FAKE) {
      const fakeAccounts = ["dev", "prod"];
      set({
        lastError: null,
        availableAccountKeys: fakeAccounts,
        selectedAccountKeys: fakeAccounts,
        accountsLoaded: true,
      });
      return;
    }

    const result = await chatApi.listAccounts();
    if (!result.ok || !result.data) {
      set({
        lastError: result.ok
          ? "Accounts response was empty."
          : `Unable to load accounts. ${result.error.message}`,
      });
      return;
    }

    const accounts = Array.isArray(result.data.accounts) ? result.data.accounts : null;
    if (!accounts) {
      set({ lastError: "Accounts response had an unexpected format." });
      return;
    }

    const accountKeys = accounts
      .filter((account) => account && typeof account.account_key === "string")
      .map((account) => account.account_key);
    set({
      lastError: null,
      availableAccountKeys: accountKeys,
      selectedAccountKeys: accountKeys,
      accountsLoaded: true,
    });
  },

  toggleAccountSelection: (accountKey) => {
    set((state) => {
      const selectedAccountKeys = state.selectedAccountKeys.includes(accountKey)
        ? state.selectedAccountKeys.filter((key) => key !== accountKey)
        : [...state.selectedAccountKeys, accountKey];
      return { selectedAccountKeys };
    });
  },

  toggleAllAccounts: (checked) => {
    set((state) => ({
      selectedAccountKeys: checked ? [...state.availableAccountKeys] : [],
    }));
  },

  hydrateChats: async () => {
    if (get().isLoadingChats || get().chatsLoaded) return;

    if (USE_FAKE) {
      set({ lastError: null, chatsLoaded: true, isLoadingChats: false });
      if (!get().activeChatId) {
        await get().newChat();
      }
      return;
    }

    set({ isLoadingChats: true });
    const result = await chatApi.listChats({ limit: 50 });

    if (!result.ok || !result.data) {
      set({
        lastError: result.ok
          ? "Chats response was empty."
          : `Unable to load chats. ${result.error.message}`,
        isLoadingChats: false,
        chatsLoaded: false,
      });
      return;
    }

    const items = Array.isArray(result.data.items) ? result.data.items : null;
    if (!items) {
      set({
        lastError: "Chats response had an unexpected format.",
        isLoadingChats: false,
        chatsLoaded: false,
      });
      return;
    }

    set((state) => {
      const mapped = sortChatsDescending(
        items.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAtMs }))
      );
      const messagesByChatId = { ...state.messagesByChatId };
      const messagesLoaded = { ...state.messagesLoadedByChatId };
      for (const c of mapped) {
        if (!messagesByChatId[c.id]) messagesByChatId[c.id] = [];
        if (messagesLoaded[c.id] === undefined) messagesLoaded[c.id] = false;
      }
      return {
        chats: mapped,
        activeChatId: state.activeChatId ?? (mapped[0]?.id ?? null),
        lastError: null,
        messagesByChatId,
        messagesLoadedByChatId: messagesLoaded,
        chatsLoaded: true,
        isLoadingChats: false,
      };
    });

    const active = get().activeChatId;
    if (active) await get().loadMessagesIfNeeded(active);
  },

  loadMessagesIfNeeded: async (chatId) => {
    if (get().messagesLoadedByChatId[chatId]) return;
    const result = await chatApi.listMessages(chatId, { limit: 200 });
    if (!result.ok || !result.data) {
      set({
        lastError: result.ok
          ? "Messages response was empty."
          : `Unable to load messages. ${result.error.message}`,
      });
      return;
    }

    const items = Array.isArray(result.data.items) ? result.data.items : null;
    if (!items) {
      set({ lastError: "Messages response had an unexpected format." });
      return;
    }

    const mapped = items.map((m) => mapDtoToMessage(m));
    const lastUser = [...mapped].reverse().find((m) => m.role === "user");

    set((state) => ({
      lastError: null,
      messagesByChatId: { ...state.messagesByChatId, [chatId]: mapped },
      messagesLoadedByChatId: { ...state.messagesLoadedByChatId, [chatId]: true },
      latestUserMessageIdByChatId: lastUser
        ? { ...state.latestUserMessageIdByChatId, [chatId]: lastUser.id }
        : state.latestUserMessageIdByChatId,
      focusedUserMessageIdByChatId: lastUser
        ? { ...state.focusedUserMessageIdByChatId, [chatId]: lastUser.id }
        : state.focusedUserMessageIdByChatId,
    }));
  },

  newChat: async () => {
    if (USE_FAKE) {
      const now = Date.now();
      const id = genId("chat");
      set((state) => ({
        lastError: null,
        chats: sortChatsDescending([{ id, title: "New chat", updatedAt: now }, ...state.chats]),
        activeChatId: id,
        messagesByChatId: { ...state.messagesByChatId, [id]: [] },
        messagesLoadedByChatId: { ...state.messagesLoadedByChatId, [id]: true },
      }));
      return id;
    }

    const result = await chatApi.createChat({ title: "New chat" });
    if (!result.ok || !result.data) {
      set({
        lastError: result.ok
          ? "Create chat response was empty."
          : `Unable to create a new chat. ${result.error.message}`,
      });
      return null;
    }
    const chat = result.data.chat;
    if (!isRecord(chat) || typeof chat.id !== "string" || typeof chat.title !== "string") {
      set({ lastError: "Create chat response had an unexpected format." });
      return null;
    }
    set((state) => ({
      lastError: null,
      chats: sortChatsDescending([
        { id: chat.id, title: chat.title, updatedAt: chat.updatedAtMs },
        ...state.chats.filter((c) => c.id !== chat.id),
      ]),
      activeChatId: chat.id,
      messagesByChatId: { ...state.messagesByChatId, [chat.id]: [] },
      messagesLoadedByChatId: { ...state.messagesLoadedByChatId, [chat.id]: true },
    }));
    return chat.id;
  },

  renameChat: async (chatId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const result = await chatApi.renameChat(chatId, { title: trimmed });
    if (!result.ok || !result.data) {
      set({
        lastError: result.ok
          ? "Rename chat response was empty."
          : `Unable to rename the chat. ${result.error.message}`,
      });
      return;
    }
    const chat = result.data.chat;
    if (!isRecord(chat) || typeof chat.title !== "string") {
      set({ lastError: "Rename chat response had an unexpected format." });
      return;
    }
    set((state) => ({
      lastError: null,
      chats: sortChatsDescending(
        state.chats.map((c) => (c.id === chatId ? { ...c, title: chat.title, updatedAt: chat.updatedAtMs } : c))
      ),
    }));
  },

  deleteChat: async (chatId) => {
    if (get().activeStreamChatId === chatId) get().stopStreaming();
    const result = await chatApi.deleteChat(chatId);
    if (!result.ok) {
      set({ lastError: `Unable to delete the chat. ${result.error.message}` });
      return;
    }
    set((state) => {
      const nextChats = state.chats.filter((c) => c.id !== chatId);
      const restMessages = { ...state.messagesByChatId };
      delete restMessages[chatId];
      const restLoaded = { ...state.messagesLoadedByChatId };
      delete restLoaded[chatId];
      const restLatest = { ...state.latestUserMessageIdByChatId };
      delete restLatest[chatId];
      const restFocused = { ...state.focusedUserMessageIdByChatId };
      delete restFocused[chatId];
      let nextActive = state.activeChatId;
      if (nextActive === chatId) nextActive = nextChats[0]?.id ?? null;
      return {
        chats: nextChats,
        activeChatId: nextActive,
        lastError: null,
        messagesByChatId: restMessages,
        messagesLoadedByChatId: restLoaded,
        latestUserMessageIdByChatId: restLatest,
        focusedUserMessageIdByChatId: restFocused,
      };
    });
    if (get().chats.length === 0) await get().newChat();
  },

  setActiveChat: (chatId) => {
    set({ activeChatId: chatId });
    void get().loadMessagesIfNeeded(chatId);
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (get().isStreaming) return false;

    const chatId = await ensureActiveChatId(get);
    if (!chatId) {
      set({ lastError: "Unable to open a chat for sending the message." });
      return false;
    }

    const now = Date.now();
    const title = makeTitleFromText(trimmed);

    if (USE_FAKE) {
      const userMsg: Message = {
        id: genId("msg_user"),
        role: "user",
        text: trimmed,
        createdAt: now,
        status: "final" as MsgStatus,
      };
      const assistantMsg: Message = {
        id: genId("msg_asst"),
        role: "assistant",
        text: "",
        createdAt: now + 1,
        status: "streaming" as MsgStatus,
      };

      set((state) => ({
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: [...(state.messagesByChatId[chatId] ?? []), userMsg, assistantMsg],
        },
        latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: userMsg.id },
        focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: userMsg.id },
        chats: sortChatsDescending(
          state.chats.map((c) =>
            c.id === chatId
              ? { ...c, updatedAt: now, title: c.title === "New chat" ? title || c.title : c.title }
              : c
          )
        ),
        lastError: null,
        isStreaming: true,
        activeStreamChatId: chatId,
        streamCancel: null,
        streamTimerId: null,
      }));

      startFakeStreaming(chatId, get, set);
      return true;
    }

    const tempUserId = genId("msg_user");
    const tempAssistantId = genId("msg_asst");

    const pendingUser: Message = {
      id: tempUserId,
      role: "user",
      text: trimmed,
      createdAt: now,
      status: "final" as MsgStatus,
    };
    const pendingAssistant: Message = {
      id: tempAssistantId,
      role: "assistant",
      text: "",
      createdAt: now + 1,
      status: "streaming" as MsgStatus,
    };

    set((state) => ({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: [...(state.messagesByChatId[chatId] ?? []), pendingUser, pendingAssistant],
      },
      latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: tempUserId },
      focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: tempUserId },
      chats: sortChatsDescending(
        state.chats.map((c) =>
          c.id === chatId
            ? { ...c, updatedAt: now, title: c.title === "New chat" ? title || c.title : c.title }
            : c
        )
      ),
      lastError: null,
      isStreaming: true,
      activeStreamChatId: chatId,
      streamCancel: null,
      streamTimerId: null,
    }));

    const response = await chatApi.streamChat(chatId, {
      userText: trimmed,
      selectedAccountKeys: get().selectedAccountKeys.length ? get().selectedAccountKeys : undefined,
    });
    if (!response.ok) {
      set((state) => {
        const msgs = state.messagesByChatId[chatId] ?? [];
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") {
          return { isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null };
        }
        const updated = {
          ...last,
          status: "error" as MsgStatus,
          text: last.text || `[Error: ${response.error.message}]`,
        };
        return {
          lastError: `Unable to send the message. ${response.error.message}`,
          messagesByChatId: { ...state.messagesByChatId, [chatId]: [...msgs.slice(0, -1), updated] },
          isStreaming: false,
          activeStreamChatId: null,
          streamCancel: null,
          streamTimerId: null,
        };
      });
      return false;
    }

    set({ streamCancel: response.cancel });

    try {
      let completed = false;
      for await (const chunk of response.stream) {
        const evt = parseStreamEvent(chunk);
        if (!evt) continue;

        if (evt.type === "start") {
          if (!isRecord(evt.userMessage) || !isRecord(evt.assistantMessage)) {
            set({ lastError: "Chat stream started with an unexpected payload." });
            continue;
          }
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const base = msgs.slice(0, -2);
            const userMsg = mapDtoToMessage(evt.userMessage, "final");
            const assistantMsg = mapDtoToMessage(evt.assistantMessage, "streaming");
            return {
              lastError: null,
              messagesByChatId: {
                ...state.messagesByChatId,
                [chatId]: [...base, userMsg, assistantMsg],
              },
              latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: userMsg.id },
              focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: userMsg.id },
            };
          });
          continue;
        }

        if (evt.type === "delta") {
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.id === evt.messageId);
            if (idx === -1) return {};
            const m = msgs[idx];
            if (m.role !== "assistant") return {};
            const updated = { ...m, text: m.text + evt.text, status: "streaming" as MsgStatus };
            const next = [...msgs];
            next[idx] = updated;
            return { messagesByChatId: { ...state.messagesByChatId, [chatId]: next } };
          });
          continue;
        }

        if (evt.type === "final") {
          completed = true;
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.id === evt.messageId);
            if (idx === -1) {
              return { isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null };
            }
            const m = msgs[idx];
            if (m.role !== "assistant") {
              return { isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null };
            }
            const updated = { ...m, status: "final" as MsgStatus, text: evt.fullText ?? m.text };
            const next = [...msgs];
            next[idx] = updated;
            return {
              lastError: null,
              messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
              isStreaming: false,
              activeStreamChatId: null,
              streamCancel: null,
              streamTimerId: null,
            };
          });
          break;
        }

        if (evt.type === "error") {
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
            if (idx === -1) {
              return {
                lastError: `Chat failed. ${evt.message}`,
                isStreaming: false,
                activeStreamChatId: null,
                streamCancel: null,
                streamTimerId: null,
              };
            }
            const next = [...msgs];
            next[idx] = {
              ...next[idx],
              status: "error" as MsgStatus,
              text: next[idx].text || `[Error: ${evt.message}]`,
            };
            return {
              lastError: `Chat failed. ${evt.message}`,
              messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
              isStreaming: false,
              activeStreamChatId: null,
              streamCancel: null,
              streamTimerId: null,
            };
          });
          return false;
        }
      }
      if (!completed) {
        if (get().activeStreamChatId !== chatId || !get().isStreaming) {
          return true;
        }
        set((state) => {
          const msgs = state.messagesByChatId[chatId] ?? [];
          const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
          if (idx === -1) {
            return {
              lastError: "Chat response ended unexpectedly. Please try again.",
              isStreaming: false,
              activeStreamChatId: null,
              streamCancel: null,
              streamTimerId: null,
            };
          }
          const next = [...msgs];
          next[idx] = {
            ...next[idx],
            status: "error" as MsgStatus,
            text: next[idx].text || "[Error: Chat response ended unexpectedly.]",
          };
          return {
            lastError: "Chat response ended unexpectedly. Please try again.",
            messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
            isStreaming: false,
            activeStreamChatId: null,
            streamCancel: null,
            streamTimerId: null,
          };
        });
        return false;
      }
    } catch {
      if (get().activeStreamChatId !== chatId || !get().isStreaming) {
        return true;
      }
      set((state) => {
        const msgs = state.messagesByChatId[chatId] ?? [];
        const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
        if (idx === -1) {
          return {
            lastError: "Chat request failed unexpectedly. Please try again.",
            isStreaming: false,
            activeStreamChatId: null,
            streamCancel: null,
            streamTimerId: null,
          };
        }
        const next = [...msgs];
        next[idx] = {
          ...next[idx],
          status: "error" as MsgStatus,
          text: next[idx].text || "[Error: Chat request failed unexpectedly.]",
        };
        return {
          lastError: "Chat request failed unexpectedly. Please try again.",
          messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
          isStreaming: false,
          activeStreamChatId: null,
          streamCancel: null,
          streamTimerId: null,
        };
      });
      return false;
    }
    return true;
  },

  resendEditedPrompt: async (userMessageId, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    if (get().isStreaming) return;
    const chatId = get().activeChatId;
    if (!chatId) return;

    const now = Date.now();
    const placeholderAssistantId = genId("msg_asst");

    set((state) => {
      const msgs = state.messagesByChatId[chatId] ?? [];
      const idx = msgs.findIndex((m) => m.id === userMessageId && m.role === "user");
      if (idx === -1) return {};
      const updatedUser: Message = { ...msgs[idx], text: trimmed, createdAt: now };
      const next = [...msgs];
      next[idx] = updatedUser;
      if (next[idx + 1] && next[idx + 1].role === "assistant") next.splice(idx + 1, 1);
      const placeholderAssistant: Message = {
        id: placeholderAssistantId,
        role: "assistant",
        text: "",
        createdAt: now + 1,
        status: "streaming" as MsgStatus,
      };
      next.splice(idx + 1, 0, placeholderAssistant);
      return {
        messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
        latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: userMessageId },
        focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: userMessageId },
        chats: sortChatsDescending(
          state.chats.map((c) => (c.id === chatId ? { ...c, updatedAt: now } : c))
        ),
        isStreaming: true,
        activeStreamChatId: chatId,
        streamCancel: null,
      };
    });

    const response = await chatApi.rerunStream(chatId, userMessageId, {
      newUserText: trimmed,
      selectedAccountKeys: get().selectedAccountKeys.length ? get().selectedAccountKeys : undefined,
    });
    if (!response.ok) {
      set((state) => {
        const msgs = state.messagesByChatId[chatId] ?? [];
        const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
        if (idx === -1) {
          return { isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null };
        }
        const next = [...msgs];
        next[idx] = {
          ...next[idx],
          status: "error" as MsgStatus,
          text: next[idx].text || `[Error: ${response.error.message}]`,
        };
        return {
          lastError: `Unable to regenerate the response. ${response.error.message}`,
          messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
          isStreaming: false,
          activeStreamChatId: null,
          streamCancel: null,
          streamTimerId: null,
        };
      });
      return;
    }

    set({ streamCancel: response.cancel });

    try {
      let completed = false;
      for await (const chunk of response.stream) {
        const evt = parseStreamEvent(chunk);
        if (!evt) continue;

        if (evt.type === "start") {
          if (!isRecord(evt.userMessage) || !isRecord(evt.assistantMessage)) {
            set({ lastError: "Regenerated chat stream started with an unexpected payload." });
            continue;
          }
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.id === userMessageId && m.role === "user");
            if (idx === -1) return {};
            const userMsg = mapDtoToMessage(evt.userMessage, "final");
            const assistantMsg = mapDtoToMessage(evt.assistantMessage, "streaming");
            const next = [...msgs];
            next[idx] = userMsg;
            if (next[idx + 1] && next[idx + 1].role === "assistant") next.splice(idx + 1, 1);
            next.splice(idx + 1, 0, assistantMsg);
            return {
              lastError: null,
              messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
              latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: userMsg.id },
              focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: userMsg.id },
            };
          });
          continue;
        }

        if (evt.type === "delta") {
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.id === evt.messageId);
            if (idx === -1) return {};
            const m = msgs[idx];
            if (m.role !== "assistant") return {};
            const updated = { ...m, text: m.text + evt.text, status: "streaming" as MsgStatus };
            const next = [...msgs];
            next[idx] = updated;
            return { messagesByChatId: { ...state.messagesByChatId, [chatId]: next } };
          });
          continue;
        }

        if (evt.type === "final") {
          completed = true;
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.id === evt.messageId);
            if (idx === -1) {
              return { isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null };
            }
            const m = msgs[idx];
            if (m.role !== "assistant") {
              return { isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null };
            }
            const updated = { ...m, status: "final" as MsgStatus, text: evt.fullText ?? m.text };
            const next = [...msgs];
            next[idx] = updated;
            return {
              lastError: null,
              messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
              isStreaming: false,
              activeStreamChatId: null,
              streamCancel: null,
              streamTimerId: null,
            };
          });
          break;
        }

        if (evt.type === "error") {
          set((state) => {
            const msgs = state.messagesByChatId[chatId] ?? [];
            const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
            if (idx === -1) {
              return {
                lastError: `Regenerate failed. ${evt.message}`,
                isStreaming: false,
                activeStreamChatId: null,
                streamCancel: null,
                streamTimerId: null,
              };
            }
            const next = [...msgs];
            next[idx] = {
              ...next[idx],
              status: "error" as MsgStatus,
              text: next[idx].text || `[Error: ${evt.message}]`,
            };
            return {
              lastError: `Regenerate failed. ${evt.message}`,
              messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
              isStreaming: false,
              activeStreamChatId: null,
              streamCancel: null,
              streamTimerId: null,
            };
          });
          return;
        }
      }
      if (!completed) {
        if (get().activeStreamChatId !== chatId || !get().isStreaming) {
          return;
        }
        set((state) => {
          const msgs = state.messagesByChatId[chatId] ?? [];
          const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
          if (idx === -1) {
            return {
              lastError: "Regenerated response ended unexpectedly. Please try again.",
              isStreaming: false,
              activeStreamChatId: null,
              streamCancel: null,
              streamTimerId: null,
            };
          }
          const next = [...msgs];
          next[idx] = {
            ...next[idx],
            status: "error" as MsgStatus,
            text: next[idx].text || "[Error: Regenerated response ended unexpectedly.]",
          };
          return {
            lastError: "Regenerated response ended unexpectedly. Please try again.",
            messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
            isStreaming: false,
            activeStreamChatId: null,
            streamCancel: null,
            streamTimerId: null,
          };
        });
      }
    } catch {
      if (get().activeStreamChatId !== chatId || !get().isStreaming) {
        return;
      }
      set((state) => {
        const msgs = state.messagesByChatId[chatId] ?? [];
        const idx = msgs.findIndex((m) => m.role === "assistant" && m.status === "streaming");
        if (idx === -1) {
          return {
            lastError: "Regenerate request failed unexpectedly. Please try again.",
            isStreaming: false,
            activeStreamChatId: null,
            streamCancel: null,
            streamTimerId: null,
          };
        }
        const next = [...msgs];
        next[idx] = {
          ...next[idx],
          status: "error" as MsgStatus,
          text: next[idx].text || "[Error: Regenerate request failed unexpectedly.]",
        };
        return {
          lastError: "Regenerate request failed unexpectedly. Please try again.",
          messagesByChatId: { ...state.messagesByChatId, [chatId]: next },
          isStreaming: false,
          activeStreamChatId: null,
          streamCancel: null,
          streamTimerId: null,
        };
      });
    }
  },

  stopStreaming: () => {
    const cancel = get().streamCancel;
    if (cancel) cancel();
    const timerId = get().streamTimerId;
    if (timerId) window.clearInterval(timerId);
    const chatId = get().activeStreamChatId;
    if (!chatId) {
      set({ isStreaming: false, activeStreamChatId: null, streamCancel: null, streamTimerId: null });
      return;
    }

    set((state) => {
      const msgs = state.messagesByChatId[chatId] ?? [];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant" && last.status === "streaming") {
        const updated = { ...last, status: "final" as MsgStatus };
        return {
          messagesByChatId: {
            ...state.messagesByChatId,
            [chatId]: [...msgs.slice(0, -1), updated],
          },
          isStreaming: false,
          activeStreamChatId: null,
          streamCancel: null,
          streamTimerId: null,
        };
      }
      return {
        isStreaming: false,
        activeStreamChatId: null,
        streamCancel: null,
        streamTimerId: null,
      };
    });
  },
});

export const useChatStore = create<ChatStore>()(creator);
