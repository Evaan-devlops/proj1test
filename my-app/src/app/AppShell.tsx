import { Suspense, lazy, useEffect, useRef, type ReactNode } from "react";
import ChatWindow from "src/features/chat/components/ChatWindow";
import PromptBox from "src/features/chat/components/PromptBox";
import AccountsSidebar from "src/features/chat/components/AccountsSidebar";
import BottomErrorBanner from "src/components/BottomErrorBanner";
import AnalyticsHub from "src/pages/AnalyticsHub";
import { chatApi } from "src/features/chat/api/chatApi";
import { useChatStore } from "src/store/chat.store";
import { useUiStore, type AppView } from "src/store/ui.store";

const Sidebar = lazy(() => import("src/features/chat/components/Sidebar"));

function OpenSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4V5zm2 2v10h4V7H6zm6 0v10h8V7h-8z" />
    </svg>
  );
}

function CloseSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm2 2v10h4V7H6zm6 0v10h8V7h-8z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4.75A1.75 1.75 0 0 1 5.75 3h4.5A1.75 1.75 0 0 1 12 4.75v4.5A1.75 1.75 0 0 1 10.25 11h-4.5A1.75 1.75 0 0 1 4 9.25v-4.5zm8 0A1.75 1.75 0 0 1 13.75 3h4.5A1.75 1.75 0 0 1 20 4.75v4.5A1.75 1.75 0 0 1 18.25 11h-4.5A1.75 1.75 0 0 1 12 9.25v-4.5zm-8 10A1.75 1.75 0 0 1 5.75 13h4.5A1.75 1.75 0 0 1 12 14.75v4.5A1.75 1.75 0 0 1 10.25 21h-4.5A1.75 1.75 0 0 1 4 19.25v-4.5zm8 0A1.75 1.75 0 0 1 13.75 13h4.5A1.75 1.75 0 0 1 20 14.75v4.5A1.75 1.75 0 0 1 18.25 21h-4.5A1.75 1.75 0 0 1 12 19.25v-4.5z"
      />
    </svg>
  );
}

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

function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 5.5A2.5 2.5 0 0 1 5.5 3h4A2.5 2.5 0 0 1 12 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 3 18.5v-13zm9 0A2.5 2.5 0 0 1 14.5 3h4A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 12 18.5v-13z"
      />
    </svg>
  );
}

function FloatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm2 0v10h8V6H6zm10-2h2a2 2 0 0 1 2 2v8h-2V6h-2V4zm0 14h2v2a2 2 0 0 1-2 2h-8v-2h8z"
      />
    </svg>
  );
}

function otherView(view: AppView): AppView {
  return view === "chat" ? "analytics" : "chat";
}

function viewLabel(view: AppView) {
  return view === "chat" ? "Discuss" : "Analytics Hub";
}

function viewIcon(view: AppView) {
  return view === "chat" ? <ChatIcon /> : <DashboardIcon />;
}

function LayoutOptionButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left text-slate-100 transition hover:bg-white/10"
    >
      <div className="mt-0.5 rounded-xl border border-white/10 bg-white/8 p-2 text-white">{icon}</div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
      </div>
    </button>
  );
}

function PageSwitchButton({
  currentView,
  onSingle,
  onSplit,
  onFloat,
}: {
  currentView: AppView;
  onSingle: (view: AppView) => void;
  onSplit: (view: AppView) => void;
  onFloat: (view: AppView) => void;
}) {
  const targetView = otherView(currentView);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSingle(targetView)}
        className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/88 px-4 py-2 text-sm font-medium text-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-300 hover:bg-white hover:text-slate-900"
      >
        {viewIcon(targetView)}
        <span>{viewLabel(targetView)}</span>
      </button>

      <div className="pointer-events-none absolute right-0 top-full z-[260] mt-3 w-64 translate-y-2 rounded-[24px] border border-white/10 bg-slate-950/94 p-2 opacity-0 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <LayoutOptionButton
          icon={<SplitIcon />}
          title="Split View"
          description="See both pages side by side and resize the divider."
          onClick={() => onSplit(currentView)}
        />
        <LayoutOptionButton
          icon={<FloatIcon />}
          title="Floating Window"
          description="Keep this page floating over the other page and resize it from the edge."
          onClick={() => onFloat(currentView)}
        />
      </div>
    </div>
  );
}

function ChatWorkspace({ actionButton }: { actionButton: ReactNode }) {
  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pt-4">
        <div className="flex w-full justify-end pr-2">{actionButton}</div>
      </header>
      <ChatWindow />
      <PromptBox />
    </main>
  );
}

export default function AppShell() {
  const activeView = useUiStore((s) => s.activeView);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const primaryView = useUiStore((s) => s.primaryView);
  const splitRatio = useUiStore((s) => s.splitRatio);
  const floatRatio = useUiStore((s) => s.floatRatio);
  const openSingleView = useUiStore((s) => s.openSingleView);
  const openSplitView = useUiStore((s) => s.openSplitView);
  const openFloatView = useUiStore((s) => s.openFloatView);
  const setSplitRatio = useUiStore((s) => s.setSplitRatio);
  const setFloatRatio = useUiStore((s) => s.setFloatRatio);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const sidebarEverOpened = useUiStore((s) => s.sidebarEverOpened);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const hydrateChats = useChatStore((s) => s.hydrateChats);
  const loadAccounts = useChatStore((s) => s.loadAccounts);
  const lastError = useChatStore((s) => s.lastError);
  const clearError = useChatStore((s) => s.clearError);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const isSingleChatView = layoutMode === "single" && activeView === "chat";
  const secondaryView = otherView(primaryView);

  useEffect(() => {
    void hydrateChats();
    void loadAccounts();
  }, [hydrateChats, loadAccounts]);

  useEffect(() => {
    void chatApi.refreshAnalyticsHubSnapshot();
  }, []);

  function startSplitResize(event: React.PointerEvent<HTMLDivElement>) {
    const shell = shellRef.current;
    if (!shell) return;
    event.preventDefault();

    const bounds = shell.getBoundingClientRect();
    const update = (clientX: number) => setSplitRatio((clientX - bounds.left) / bounds.width);

    update(event.clientX);

    const onMove = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startFloatResize(event: React.PointerEvent<HTMLDivElement>) {
    const shell = shellRef.current;
    if (!shell) return;
    event.preventDefault();

    const bounds = shell.getBoundingClientRect();
    const update = (clientX: number) => setFloatRatio((bounds.right - clientX) / bounds.width);

    update(event.clientX);

    const onMove = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function renderView(view: AppView) {
    const actionButton = (
      <PageSwitchButton
        currentView={view}
        onSingle={openSingleView}
        onSplit={openSplitView}
        onFloat={openFloatView}
      />
    );

    if (view === "chat") {
      return <ChatWorkspace actionButton={actionButton} />;
    }

    return <AnalyticsHub actionButton={actionButton} />;
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#0b1220] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#0b1220_0%,#0f172a_100%)]"
        aria-hidden="true"
      />

      <button
        onClick={toggleSidebar}
        className={[
          "group fixed top-3 z-[200] h-9 w-9 grid place-items-center rounded-lg",
          "border border-white/10 bg-white/5 hover:bg-white/10",
          "transition-all duration-300 ease-out motion-reduce:transition-none",
          isSingleChatView ? "opacity-100" : "pointer-events-none -translate-x-4 opacity-0",
          sidebarOpen ? "left-[292px]" : "left-3",
        ].join(" ")}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <CloseSidebarIcon /> : <OpenSidebarIcon />}
      </button>

      <div ref={shellRef} className="relative h-full">
        {layoutMode === "single" ? (
          activeView === "chat" ? (
            <section className="absolute inset-0">
              <div className="flex h-full">
                <div
                  className={[
                    "shrink-0 overflow-hidden",
                    "transition-[width] duration-300 ease-out motion-reduce:transition-none",
                    sidebarOpen ? "w-72" : "w-0",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-72 min-h-screen",
                      "transition-transform duration-300 ease-out motion-reduce:transition-none",
                      sidebarOpen ? "translate-x-0" : "-translate-x-full",
                    ].join(" ")}
                  >
                    {sidebarEverOpened ? (
                      <Suspense fallback={<div className="h-full w-full border-r border-white/10 bg-[#0f172a]" />}>
                        <Sidebar />
                      </Suspense>
                    ) : null}
                  </div>
                </div>

                {renderView("chat")}
              </div>
            </section>
          ) : (
            <section className="absolute inset-0">{renderView("analytics")}</section>
          )
        ) : null}

        {layoutMode === "split" ? (
          <section className="absolute inset-0 flex">
            <div className="min-w-0" style={{ width: `${splitRatio * 100}%` }}>
              {renderView(primaryView)}
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startSplitResize}
              className="relative z-[180] w-4 shrink-0 cursor-col-resize bg-transparent"
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" />
              <div className="absolute left-1/2 top-1/2 h-14 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/12 shadow-[0_0_20px_rgba(0,0,0,0.25)]" />
            </div>

            <div className="min-w-0 flex-1">{renderView(secondaryView)}</div>
          </section>
        ) : null}

        {layoutMode === "float" ? (
          <section className="absolute inset-0">
            <div className="absolute inset-0">{renderView(secondaryView)}</div>

            <div
              className="pointer-events-none absolute inset-y-4 right-4 z-[190]"
              style={{ width: `${floatRatio * 100}%` }}
            >
              <div className="pointer-events-auto relative h-full overflow-hidden rounded-[34px] border border-white/14 bg-[#08111b]/72 shadow-[0_40px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startFloatResize}
                  className="absolute inset-y-0 left-0 z-[210] w-4 cursor-col-resize"
                >
                  <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/16" />
                  <div className="absolute left-1/2 top-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/12 shadow-[0_0_20px_rgba(0,0,0,0.25)]" />
                </div>

                <div className="h-full">{renderView(primaryView)}</div>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {isSingleChatView ? <AccountsSidebar /> : null}
      {lastError ? <BottomErrorBanner message={lastError} onDismiss={clearError} /> : null}
    </div>
  );
}
