import { useEffect, useRef } from "react";
import { useChatStore } from "src/store/chat.store";
import { useUiStore } from "src/store/ui.store";

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M12 2l7 7h-4v9H9V9H5l7-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M7 7h10v10H7z" />
    </svg>
  );
}

export default function PromptBox() {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const text = useUiStore((s) => s.composerText);
  const composerFocusNonce = useUiStore((s) => s.composerFocusNonce);
  const setComposerText = useUiStore((s) => s.setComposerText);
  const clearComposerText = useUiStore((s) => s.clearComposerText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const constrainedLayout = layoutMode === "single" && sidebarOpen;

  const canSend = text.trim().length > 0;

  useEffect(() => {
    textareaRef.current?.focus();
  }, [composerFocusNonce]);

  async function onPrimaryAction() {
    if (isStreaming) {
      stopStreaming();
      return;
    }
    if (!canSend) return;

    const outgoingText = text;
    clearComposerText();
    const sent = await sendMessage(outgoingText);
    if (!sent) {
      setComposerText(outgoingText);
    }
  }

  return (
    <div className="px-4 pb-6 shrink-0">
      <div
        className={[
          "mx-auto w-full",
          constrainedLayout ? "max-w-3xl" : "max-w-5xl",
        ].join(" ")}
      >
        <div className="relative rounded-2xl border border-white/10 bg-[#0f172a]/80 backdrop-blur px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent outline-none resize-none pr-14 pl-2 py-2 text-white placeholder:text-white/40 overflow-y-auto max-h-32"
            rows={2}
            value={text}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder="Type a message "
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onPrimaryAction();
              }
            }}
          />

          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={!isStreaming && !canSend}
            className={[
              "absolute right-3 bottom-3 h-10 w-10 rounded-full grid place-items-center",
              "border border-white/15 bg-white/5 hover:bg-white/10",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label={isStreaming ? "Stop generating" : "Send message"}
            title={isStreaming ? "Stop" : "Send"}
          >
            {isStreaming ? <StopIcon /> : <SendIcon />}
          </button>
        </div>

        <div className="mt-2 text-xs text-white/40">
          Enter to send • Shift+Enter for newline
        </div>
      </div>
    </div>
  );
}
