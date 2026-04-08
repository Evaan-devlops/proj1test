import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useChatStore, type Message } from "src/store/chat.store";
import { useUiStore } from "src/store/ui.store";
import { buildFollowUpSuggestions } from "src/features/chat/lib/followUps";
import TypingDots from "./TypingDots";

const MarkdownMessage = lazy(() => import("./MarkdownMessage"));
const EMPTY_MESSAGES: Message[] = [];

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

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm14.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-1.79z"
      />
    </svg>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-slate-300">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Thinking</div>
      {lines.length > 0 ? (
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={`${line}-${index}`} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-slate-300">
              {line}
            </div>
          ))}
        </div>
      ) : null}
      <TypingDots />
    </div>
  );
}

function FollowUpActions({
  suggestions,
  disabled,
  onSend,
  onEdit,
}: {
  suggestions: string[];
  disabled: boolean;
  onSend: (question: string) => void;
  onEdit: (question: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Follow-up Questions</div>
      <div className="space-y-2">
        {suggestions.map((question) => (
          <div key={question} className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSend(question)}
              className="flex-1 rounded-2xl border border-cyan-300/15 bg-cyan-300/8 px-3 py-2 text-left text-sm text-cyan-50 transition hover:border-cyan-200/35 hover:bg-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {question}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEdit(question)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Edit follow-up question"
              title="Edit before sending"
            >
              <EditIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
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
  sendMessage: (text: string) => Promise<boolean>;
  setComposerText: (text: string) => void;
  requestComposerFocus: () => void;
  suggestionsDisabled: boolean;
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
  sendMessage,
  setComposerText,
  requestComposerFocus,
  suggestionsDisabled,
}: TurnRowProps) {
  const user = turn.user;
  const assistant = turn.assistant;
  const isEditing = editingUserId === user.id;
  const followUps = assistant?.status === "final" ? buildFollowUpSuggestions(user.text, assistant.text) : [];

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

  function editSuggestedPrompt(question: string) {
    setComposerText(question);
    requestComposerFocus();
  }

  function sendSuggestedPrompt(question: string) {
    if (suggestionsDisabled) return;
    setComposerText("");
    void sendMessage(question);
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
              <ThinkingBlock text={assistant.text} />
            ) : (
              <div>
                <Suspense fallback={<div className="text-white/80">{assistant.text}</div>}>
                  <MarkdownMessage text={assistant.text} />
                </Suspense>
                <FollowUpActions
                  suggestions={followUps}
                  disabled={suggestionsDisabled}
                  onSend={sendSuggestedPrompt}
                  onEdit={editSuggestedPrompt}
                />
              </div>
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
  const messages = useChatStore((s) => (activeChatId ? s.messagesByChatId[activeChatId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES));
  const latestUserId = useChatStore((s) => (activeChatId ? s.latestUserMessageIdByChatId[activeChatId] : undefined));
  const storedFocusedUserId = useChatStore((s) => (activeChatId ? s.focusedUserMessageIdByChatId[activeChatId] : undefined));
  const resendEditedPrompt = useChatStore((s) => s.resendEditedPrompt);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const setComposerText = useUiStore((s) => s.setComposerText);
  const requestComposerFocus = useUiStore((s) => s.requestComposerFocus);
  const constrainedLayout = layoutMode === "single" && sidebarOpen;

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

  const resolvedFocusedUserId = storedFocusedUserId ?? turns[turns.length - 1]?.user.id;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const turnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastMessage = messages[messages.length - 1];
  const lastMessageTextLength = lastMessage?.text.length ?? 0;

  useEffect(() => {
    if (!resolvedFocusedUserId) return;
    const target = turnRefs.current[resolvedFocusedUserId];
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [resolvedFocusedUserId, turns.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const shouldStickToBottom = isStreaming || lastMessage?.role === "assistant";
    if (!shouldStickToBottom) return;

    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTo({
        top: scroller.scrollHeight,
        behavior: isStreaming ? "auto" : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isStreaming, turns.length, lastMessage?.id, lastMessage?.role, lastMessage?.status, lastMessageTextLength]);

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
      <div className={["mx-auto flex w-full flex-col gap-10 pt-10", constrainedLayout ? "max-w-3xl" : "max-w-5xl"].join(" ")}>
        {turns.map((turn) => {
          const user = turn.user;
          const assistant = turn.assistant;

          const isFocused = resolvedFocusedUserId === user.id;
          const assistantFinal = !!assistant && assistant.status === "final";
          const canRephrase = assistantFinal && user.id === latestUserId && !isStreaming;

          return (
            <div
              key={user.id}
              ref={(node) => {
                turnRefs.current[user.id] = node;
              }}
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
                sendMessage={sendMessage}
                setComposerText={setComposerText}
                requestComposerFocus={requestComposerFocus}
                suggestionsDisabled={isStreaming}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
