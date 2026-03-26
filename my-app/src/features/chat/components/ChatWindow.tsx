import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useChatStore, type Message } from "../../../store/chat.store";
import { useUiStore } from "../../../store/ui.store";
import TypingDots from "./TypingDots";

const MarkdownMessage = lazy(() => import("./MarkdownMessage"));

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7zm2 0v11h9V7h-9zM4 4a2 2 0 0 1 2-2h9v2H6v11H4V4z"
      />
    </svg>
  );
}
//apf_j3sj8h6ri7qy2n7zsfftjfsn
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
    </svg>
  );
}

function RephraseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 7h10v2H7V7zm0 4h7v2H7v-2zm0 4h10v2H7v-2zM19 4h2v6h-6V8h3.2A7.99 7.99 0 0 0 4 12H2c0-5.52 4.48-10 10-10 2.21 0 4.25.72 5.9 1.94V4z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3 1.4 1.4-4.7 4.7-4.7-4.7 1.4-1.4 2.3 2.3V4a1 1 0 0 1 1-1zm-7 14h14v2H5v-2z"
      />
    </svg>
  );
}

type Turn = { user: Message; assistant?: Message };

type TurnRowProps = {
  turn: Turn;
  isFocused: boolean;
  canRephrase: boolean;
  copiedId: string | null;
  setCopiedId: Dispatch<SetStateAction<string | null>>;
  editingUserId: string | null;
  setEditingUserId: Dispatch<SetStateAction<string | null>>;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  resendEditedPrompt: (userMessageId: string, newText: string) => void;
};

const TurnRow = memo(function TurnRow({
  turn,
  isFocused,
  canRephrase,
  copiedId,
  setCopiedId,
  editingUserId,
  setEditingUserId,
  draft,
  setDraft,
  resendEditedPrompt,
}: TurnRowProps) {
  const user = turn.user;
  const assistant = turn.assistant;
  const isEditing = editingUserId === user.id;

  async function copyPrompt(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 900);
    } catch {
      // ignore clipboard errors
    }
  }

  function downloadResponse(text: string, id: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `response-${id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={["space-y-3 scroll-mt-12", isFocused ? "" : "opacity-90"].join(" ")}>
      <div className="flex justify-end">
        <div className="relative group max-w-[85%]">
          <div className="rounded-2xl px-4 py-3 border border-white/10 bg-[#1f2937] text-white whitespace-pre-wrap break-words">
            {user.text}
          </div>

          <div className="absolute -bottom-10 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => copyPrompt(user.text, user.id)}
              className="relative group/action h-8 w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
              aria-label="Copy prompt"
            >
              {copiedId === user.id ? <CheckIcon /> : <CopyIcon />}
              <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover/action:opacity-100 transition">
                Copy
              </span>
            </button>

            <button
              disabled={!canRephrase}
              onClick={() => {
                if (!canRephrase) return;
                setEditingUserId(user.id);
                setDraft(user.text);
              }}
              className="relative group/action h-8 w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Re-phrase prompt"
            >
              <RephraseIcon />
              <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover/action:opacity-100 transition">
                Re-phrase prompt
              </span>
            </button>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="flex justify-end">
          <div className="w-full max-w-[85%] rounded-2xl border border-white/10 bg-white/5 p-3">
            <textarea
              className="w-full bg-transparent outline-none resize-none text-white placeholder:text-white/40 max-h-36"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Edit prompt..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const trimmed = draft.trim();
                  if (!trimmed) return;
                  setEditingUserId(null);
                  resendEditedPrompt(user.id, trimmed);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingUserId(null);
                }
              }}
            />

            <div className="mt-3 flex justify-end gap-3">
              <button
                className="rounded-full px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10"
                onClick={() => setEditingUserId(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full px-4 py-2 bg-white text-black hover:bg-white/90"
                onClick={() => {
                  const trimmed = draft.trim();
                  if (!trimmed) return;
                  setEditingUserId(null);
                  resendEditedPrompt(user.id, trimmed);
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-start pt-2">
        <div className="relative group max-w-[85%]">
          <div className="rounded-2xl px-4 py-3 border border-white/10 bg-[#0f172a] text-white whitespace-pre-wrap break-words">
            {!assistant ? (
              <TypingDots />
            ) : assistant.status === "streaming" ? (
              assistant.text ? assistant.text : <TypingDots />
            ) : (
              <Suspense fallback={<div className="text-white/80">{assistant.text}</div>}>
                <MarkdownMessage text={assistant.text} />
              </Suspense>
            )}
          </div>

          {assistant?.text ? (
            <div className="absolute -bottom-10 left-0 flex gap-2 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => copyPrompt(assistant.text, `assistant-${assistant.id}`)}
                className="relative group/action h-8 w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                aria-label="Copy response"
              >
                {copiedId === `assistant-${assistant.id}` ? <CheckIcon /> : <CopyIcon />}
                <span className="pointer-events-none absolute -top-8 left-0 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover/action:opacity-100 transition">
                  Copy
                </span>
              </button>

              <button
                onClick={() => downloadResponse(assistant.text, assistant.id)}
                className="relative group/action h-8 w-8 grid place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                aria-label="Download response"
              >
                <DownloadIcon />
                <span className="pointer-events-none absolute -top-8 left-0 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover/action:opacity-100 transition">
                  Download
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export default function ChatWindow() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const messagesByChatId = useChatStore((s) => s.messagesByChatId);
  const latestUserMessageIdByChatId = useChatStore((s) => s.latestUserMessageIdByChatId);
  const focusedUserMessageIdByChatId = useChatStore((s) => s.focusedUserMessageIdByChatId);
  const resendEditedPrompt = useChatStore((s) => s.resendEditedPrompt);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  const messages = useMemo(
    () => (activeChatId ? messagesByChatId[activeChatId] ?? [] : []),
    [activeChatId, messagesByChatId],
  );

  const turns: Turn[] = useMemo(() => {
    const out: Turn[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== "user") continue;
      const next = messages[i + 1];
      if (next && next.role === "assistant") {
        out.push({ user: m, assistant: next });
        i++;
      } else {
        out.push({ user: m });
      }
    }
    return out;
  }, [messages]);

  const storedFocusedUserId = activeChatId ? focusedUserMessageIdByChatId[activeChatId] : undefined;
  const resolvedFocusedUserId = storedFocusedUserId ?? turns[turns.length - 1]?.user.id;

  const latestUserId = activeChatId ? latestUserMessageIdByChatId[activeChatId] : undefined;

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: turns.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => 220,
    overscan: 6,
  });

  useEffect(() => {
    if (!resolvedFocusedUserId) return;
    const idx = turns.findIndex((t) => t.user.id === resolvedFocusedUserId);
    if (idx >= 0) {
      rowVirtualizer.scrollToIndex(idx, { align: "start" });
    }
  }, [resolvedFocusedUserId, turns, rowVirtualizer]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (!activeChatId) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto px-4 pb-6">
        <div className="mx-auto w-full pt-10 text-white/60 max-w-3xl">Create a new chat to start.</div>
      </div>
    );
  }

  if (turns.length === 0) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto px-4 pb-6">
        <div className="mx-auto w-full pt-10 text-white/60 max-w-3xl">No messages yet. Say hi!</div>
      </div>
    );
  }

  return (
    <div ref={scrollerRef} className="flex-1 min-w-0 overflow-y-auto px-4 pb-6">
      <div className={["mx-auto w-full pt-10", sidebarOpen ? "max-w-3xl" : "max-w-5xl"].join(" ")}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((v) => {
            const turn = turns[v.index];
            const user = turn.user;
            const assistant = turn.assistant;

            const isFocused = resolvedFocusedUserId === user.id;
            const assistantFinal = !!assistant && assistant.status === "final";
            const canRephrase = assistantFinal && user.id === latestUserId && !isStreaming;

            return (
              <div
                key={user.id}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
                className="pb-10"
              >
                <TurnRow
                  turn={turn}
                  isFocused={isFocused}
                  canRephrase={canRephrase}
                  copiedId={copiedId}
                  setCopiedId={setCopiedId}
                  editingUserId={editingUserId}
                  setEditingUserId={setEditingUserId}
                  draft={draft}
                  setDraft={setDraft}
                  resendEditedPrompt={resendEditedPrompt}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
