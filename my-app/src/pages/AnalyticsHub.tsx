import { useMemo } from "react";
import { useChatStore } from "src/store/chat.store";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H11l-4.75 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8z"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{label}</div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{note}</div>
    </div>
  );
}

export default function AnalyticsHub({ onOpenChat }: { onOpenChat: () => void }) {
  const chats = useChatStore((s) => s.chats);
  const availableAccountKeys = useChatStore((s) => s.availableAccountKeys);
  const selectedAccountKeys = useChatStore((s) => s.selectedAccountKeys);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const messagesByChatId = useChatStore((s) => s.messagesByChatId);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const activeMessageCount = useMemo(() => {
    if (!activeChatId) return 0;
    return messagesByChatId[activeChatId]?.length ?? 0;
  }, [activeChatId, messagesByChatId]);

  return (
    <div className="relative h-full overflow-y-auto px-5 pb-8 pt-5 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_24%),linear-gradient(180deg,#0b1220_0%,#0f172a_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-50 transition-all duration-300 hover:border-cyan-200/40 hover:bg-cyan-300/16 hover:text-white"
          >
            <ChatIcon />
            <span>Discuss</span>
          </button>
        </div>

        <section className="mt-10 rounded-[36px] border border-white/10 bg-slate-950/35 px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10 sm:py-10">
          <div className="max-w-3xl">
            <div className="text-sm uppercase tracking-[0.36em] text-cyan-200/70">Analytics Hub</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Shift from chat threads to the metrics surface in one click.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              This view keeps the application context intact while giving you a cleaner landing space for account
              coverage, active discussion state, and quick operational signals before jumping back into chat.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Configured Accounts"
              value={String(availableAccountKeys.length)}
              note={
                availableAccountKeys.length
                  ? `${availableAccountKeys.join(", ")} ready for analytics queries.`
                  : "No AWS accounts are loaded yet."
              }
            />
            <MetricCard
              label="Selected Scope"
              value={String(selectedAccountKeys.length || availableAccountKeys.length)}
              note={
                selectedAccountKeys.length
                  ? `Current chat scope targets ${selectedAccountKeys.join(", ")}.`
                  : "Current scope falls back to all configured accounts."
              }
            />
            <MetricCard
              label="Active Discussion"
              value={isStreaming ? "Live" : "Idle"}
              note={
                activeChatId
                  ? `${activeMessageCount} messages in the active chat session.`
                  : "Open a chat to begin discussing analytics."
              }
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="text-sm font-medium uppercase tracking-[0.28em] text-white/55">How To Use</div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <p>Use Analytics Hub as the landing layer when you want a quick read on your current coverage and chat scope.</p>
              <p>Use Discuss when you want to turn those observations into a specific AWS question, follow-up, or investigation.</p>
              <p>The switch keeps your chat session alive, so moving between views does not interrupt the current conversation.</p>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-cyan-400/12 via-slate-900/55 to-blue-400/12 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="text-sm font-medium uppercase tracking-[0.28em] text-white/55">Quick Snapshot</div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <p>Chats available: <span className="font-semibold text-white">{chats.length}</span></p>
              <p>Current mode: <span className="font-semibold text-white">{isStreaming ? "Streaming response" : "Ready for a new question"}</span></p>
              <p>Next action: <span className="font-semibold text-white">Use Discuss to continue the AWS conversation.</span></p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
