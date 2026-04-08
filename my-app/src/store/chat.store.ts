// src/store/chat.store.ts
import { chatApi } from "src/features/chat/api/chatApi";
import type { ChatMessageDto, StreamEvent } from "src/features/chat/api/types";
import type { ApiStreamResult } from "src/lib/http";
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
type StreamSuccessResult = Extract<ApiStreamResult, { ok: true }>;
type StartStreamEvent = Extract<StreamEvent, { type: "start" }>;
type StreamCopy = {
  invalidStartMessage: string;
  errorPrefix: string;
  unexpectedEndMessage: string;
  unexpectedEndFallbackText: string;
  requestFailedMessage: string;
  requestFailedFallbackText: string;
};

const EMPTY_MESSAGES: Message[] = [];

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function makeTitleFromText(text: string) {
  const lowered = text.toLowerCase();
  if (/(open ?search|search cluster)/.test(lowered)) return "OpenSearch Cost Review";
  if (/(certificate|acm|ssl|tls)/.test(lowered)) return "Certificate Expiry Review";
  if (/(dynamodb|table)/.test(lowered)) return "DynamoDB Spend Review";
  if (/(ebs|volume|snapshot)/.test(lowered)) return "EBS Cost Review";
  if (/(budget)/.test(lowered)) return "Budget Utilization Review";
  if (/(forecast|trend|month)/.test(lowered)) return "AWS Spend Trend Review";
  if (/(resource|instance cost|resource id)/.test(lowered)) return "Resource Cost Analysis";
  if (/(idle|underused|unused instance|ec2)/.test(lowered)) return "EC2 Utilization Check";
  if (/(account|environment)/.test(lowered)) return "AWS Account Overview";
  if (/(cost|spend|pricing|service)/.test(lowered)) return "AWS Cost Review";
  if (/(hello|hi|hey|help)/.test(lowered)) return "AWS Insights Chat";
  return text.trim().split(/\s+/).slice(0, 4).join(" ");
}

function sortChatsDescending(chats: Chat[]) {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
}

function defaultSelectedAccounts(accountKeys: string[]) {
  return accountKeys.length > 0 ? [accountKeys[0]] : [];
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

function createIdleStreamState(): Pick<ChatStore, "isStreaming" | "activeStreamChatId" | "streamCancel" | "streamTimerId"> {
  return {
    isStreaming: false,
    activeStreamChatId: null,
    streamCancel: null,
    streamTimerId: null,
  };
}

function getChatMessages(state: Pick<ChatStore, "messagesByChatId">, chatId: string): Message[] {
  return state.messagesByChatId[chatId] ?? EMPTY_MESSAGES;
}

function replaceChatMessages(
  state: Pick<ChatStore, "messagesByChatId">,
  chatId: string,
  messages: Message[],
): Pick<ChatStore, "messagesByChatId"> {
  return {
    messagesByChatId: { ...state.messagesByChatId, [chatId]: messages },
  };
}

function findAssistantMessageIndex(messages: Message[], messageId?: string): number {
  if (messageId) {
    return messages.findIndex((message) => message.id === messageId && message.role === "assistant");
  }
  return messages.findIndex((message) => message.role === "assistant" && message.status === "streaming");
}

function updateAssistantMessage(
  state: ChatStore,
  chatId: string,
  options: {
    messageId?: string;
    updater: (message: Message) => Message;
  },
): Pick<ChatStore, "messagesByChatId"> | null {
  const messages = getChatMessages(state, chatId);
  const assistantIndex = findAssistantMessageIndex(messages, options.messageId);
  if (assistantIndex === -1) {
    return null;
  }

  const nextMessages = [...messages];
  nextMessages[assistantIndex] = options.updater(nextMessages[assistantIndex]);
  return replaceChatMessages(state, chatId, nextMessages);
}

function touchChat(chats: Chat[], chatId: string, updatedAt: number, titleHint?: string): Chat[] {
  return sortChatsDescending(
    chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            updatedAt,
            title: titleHint && chat.title === "New chat" ? titleHint : chat.title,
          }
        : chat,
    ),
  );
}

function buildStreamFailureState(
  state: ChatStore,
  chatId: string,
  details: {
    lastError: string;
    fallbackText: string;
  },
): Partial<ChatStore> {
  const assistantUpdate = updateAssistantMessage(state, chatId, {
    updater: (message) => ({
      ...message,
      status: "error" as MsgStatus,
      text: message.text || details.fallbackText,
    }),
  });

  return assistantUpdate
    ? { lastError: details.lastError, ...assistantUpdate, ...createIdleStreamState() }
    : { lastError: details.lastError, ...createIdleStreamState() };
}

async function consumeAssistantStream(args: {
  chatId: string;
  response: StreamSuccessResult;
  set: SetFn;
  get: GetFn;
  copy: StreamCopy;
  onStart: (state: ChatStore, event: StartStreamEvent) => Partial<ChatStore>;
}): Promise<boolean> {
  const { chatId, response, set, get, copy, onStart } = args;
  set({ streamCancel: response.cancel });

  try {
    let completed = false;

    for await (const chunk of response.stream) {
      const evt = parseStreamEvent(chunk);
      if (!evt) continue;

      if (evt.type === "start") {
        if (!isRecord(evt.userMessage) || !isRecord(evt.assistantMessage)) {
          set({ lastError: copy.invalidStartMessage });
          continue;
        }
        set((state) => ({
          lastError: null,
          ...onStart(state, evt),
        }));
        continue;
      }

      if (evt.type === "delta") {
        set((state) => {
          const assistantUpdate = updateAssistantMessage(state, chatId, {
            messageId: evt.messageId,
            updater: (message) => ({
              ...message,
              text: message.text + evt.text,
              status: "streaming" as MsgStatus,
            }),
          });
          return assistantUpdate ?? {};
        });
        continue;
      }

      if (evt.type === "final") {
        completed = true;
        set((state) => {
          const assistantUpdate = updateAssistantMessage(state, chatId, {
            messageId: evt.messageId,
            updater: (message) => ({
              ...message,
              status: "final" as MsgStatus,
              text: evt.fullText ?? message.text,
            }),
          });
          return assistantUpdate
            ? { lastError: null, ...assistantUpdate, ...createIdleStreamState() }
            : createIdleStreamState();
        });
        break;
      }

      if (evt.type === "error") {
        set((state) =>
          buildStreamFailureState(state, chatId, {
            lastError: `${copy.errorPrefix}${evt.message}`,
            fallbackText: `[Error: ${evt.message}]`,
          }),
        );
        return false;
      }
    }

    if (!completed) {
      if (get().activeStreamChatId !== chatId || !get().isStreaming) {
        return true;
      }
      set((state) =>
        buildStreamFailureState(state, chatId, {
          lastError: copy.unexpectedEndMessage,
          fallbackText: copy.unexpectedEndFallbackText,
        }),
      );
      return false;
    }
  } catch {
    if (get().activeStreamChatId !== chatId || !get().isStreaming) {
      return true;
    }
    set((state) =>
      buildStreamFailureState(state, chatId, {
        lastError: copy.requestFailedMessage,
        fallbackText: copy.requestFailedFallbackText,
      }),
    );
    return false;
  }

  return true;
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
        selectedAccountKeys: defaultSelectedAccounts(fakeAccounts),
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
      selectedAccountKeys: defaultSelectedAccounts(accountKeys),
      accountsLoaded: true,
    });
  },

  toggleAccountSelection: (accountKey) => {
    set((state) => {
      const isSelected = state.selectedAccountKeys.includes(accountKey);
      if (isSelected && state.selectedAccountKeys.length === 1) {
        return state;
      }
      const selectedAccountKeys = isSelected
        ? state.selectedAccountKeys.filter((key) => key !== accountKey)
        : [...state.selectedAccountKeys, accountKey];
      return { selectedAccountKeys };
    });
  },

  toggleAllAccounts: (checked) => {
    set((state) => ({
      selectedAccountKeys: checked
        ? [...state.availableAccountKeys]
        : defaultSelectedAccounts(state.availableAccountKeys),
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
        chats: touchChat(state.chats, chatId, now, title),
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
      chats: touchChat(state.chats, chatId, now, title),
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
        const failureState = buildStreamFailureState(state, chatId, {
          lastError: `Unable to send the message. ${response.error.message}`,
          fallbackText: `[Error: ${response.error.message}]`,
        });
        return failureState;
      });
      return false;
    }

    return consumeAssistantStream({
      chatId,
      response,
      set,
      get,
      copy: {
        invalidStartMessage: "Chat stream started with an unexpected payload.",
        errorPrefix: "Chat failed. ",
        unexpectedEndMessage: "Chat response ended unexpectedly. Please try again.",
        unexpectedEndFallbackText: "[Error: Chat response ended unexpectedly.]",
        requestFailedMessage: "Chat request failed unexpectedly. Please try again.",
        requestFailedFallbackText: "[Error: Chat request failed unexpectedly.]",
      },
      onStart: (state, event) => {
        const messages = getChatMessages(state, chatId);
        const baseMessages = messages.length >= 2 ? messages.slice(0, -2) : messages;
        const userMessage = mapDtoToMessage(event.userMessage, "final");
        const assistantMessage = mapDtoToMessage(event.assistantMessage, "streaming");

        return {
          ...replaceChatMessages(state, chatId, [...baseMessages, userMessage, assistantMessage]),
          latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: userMessage.id },
          focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: userMessage.id },
        };
      },
    });
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
        chats: touchChat(state.chats, chatId, now),
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
        const failureState = buildStreamFailureState(state, chatId, {
          lastError: `Unable to regenerate the response. ${response.error.message}`,
          fallbackText: `[Error: ${response.error.message}]`,
        });
        return failureState;
      });
      return;
    }

    await consumeAssistantStream({
      chatId,
      response,
      set,
      get,
      copy: {
        invalidStartMessage: "Regenerated chat stream started with an unexpected payload.",
        errorPrefix: "Regenerate failed. ",
        unexpectedEndMessage: "Regenerated response ended unexpectedly. Please try again.",
        unexpectedEndFallbackText: "[Error: Regenerated response ended unexpectedly.]",
        requestFailedMessage: "Regenerate request failed unexpectedly. Please try again.",
        requestFailedFallbackText: "[Error: Regenerate request failed unexpectedly.]",
      },
      onStart: (state, event) => {
        const messages = getChatMessages(state, chatId);
        const userIndex = messages.findIndex((message) => message.id === userMessageId && message.role === "user");
        if (userIndex === -1) {
          return {};
        }

        const nextMessages = [...messages];
        const userMessage = mapDtoToMessage(event.userMessage, "final");
        const assistantMessage = mapDtoToMessage(event.assistantMessage, "streaming");
        nextMessages[userIndex] = userMessage;
        if (nextMessages[userIndex + 1]?.role === "assistant") {
          nextMessages.splice(userIndex + 1, 1);
        }
        nextMessages.splice(userIndex + 1, 0, assistantMessage);

        return {
          ...replaceChatMessages(state, chatId, nextMessages),
          latestUserMessageIdByChatId: { ...state.latestUserMessageIdByChatId, [chatId]: userMessage.id },
          focusedUserMessageIdByChatId: { ...state.focusedUserMessageIdByChatId, [chatId]: userMessage.id },
        };
      },
    });
  },

  stopStreaming: () => {
    const cancel = get().streamCancel;
    if (cancel) cancel();
    const timerId = get().streamTimerId;
    if (timerId) window.clearInterval(timerId);
    const chatId = get().activeStreamChatId;
    if (!chatId) {
      set(createIdleStreamState());
      return;
    }

    set((state) => {
      const msgs = getChatMessages(state, chatId);
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant" && last.status === "streaming") {
        const updated = { ...last, status: "final" as MsgStatus };
        return {
          ...replaceChatMessages(state, chatId, [...msgs.slice(0, -1), updated]),
          ...createIdleStreamState(),
        };
      }
      return createIdleStreamState();
    });
  },
});

export const useChatStore = create<ChatStore>()(creator);
