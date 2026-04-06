import { Suspense, lazy, useEffect, type ReactNode } from "react";
import ChatWindow from "src/features/chat/components/ChatWindow";
import PromptBox from "src/features/chat/components/PromptBox";
import AccountsSidebar from "src/features/chat/components/AccountsSidebar";
import BottomErrorBanner from "src/components/BottomErrorBanner";
import AnalyticsHub from "src/pages/AnalyticsHub";
import { useChatStore } from "src/store/chat.store";
import { useUiStore } from "src/store/ui.store";

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

function TopActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-50 transition-all duration-300 hover:border-cyan-200/40 hover:bg-cyan-300/16 hover:text-white"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function AppShell() {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const sidebarEverOpened = useUiStore((s) => s.sidebarEverOpened);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const hydrateChats = useChatStore((s) => s.hydrateChats);
  const loadAccounts = useChatStore((s) => s.loadAccounts);
  const lastError = useChatStore((s) => s.lastError);
  const clearError = useChatStore((s) => s.clearError);
  const isChatView = activeView === "chat";

  useEffect(() => {
    void hydrateChats();
    void loadAccounts();
  }, [hydrateChats, loadAccounts]);

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
          isChatView ? "opacity-100" : "pointer-events-none -translate-x-4 opacity-0",
          sidebarOpen ? "left-[292px]" : "left-3",
        ].join(" ")}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <CloseSidebarIcon /> : <OpenSidebarIcon />}
      </button>

      <div className="relative h-full">
        <section
          aria-hidden={!isChatView}
          className={[
            "absolute inset-0 transition-all duration-500 ease-out motion-reduce:transition-none",
            isChatView ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0 pointer-events-none",
          ].join(" ")}
        >
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

            <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
              <header className="shrink-0 px-4 pt-4">
                <div className={["mx-auto flex w-full justify-end", sidebarOpen ? "max-w-3xl" : "max-w-5xl"].join(" ")}>
                  <TopActionButton
                    icon={<DashboardIcon />}
                    label="Analytics Hub"
                    onClick={() => setActiveView("analytics")}
                  />
                </div>
              </header>
              <ChatWindow />
              <PromptBox />
            </main>
          </div>
        </section>

        <section
          aria-hidden={isChatView}
          className={[
            "absolute inset-0 transition-all duration-500 ease-out motion-reduce:transition-none",
            isChatView ? "translate-x-8 opacity-0 pointer-events-none" : "translate-x-0 opacity-100",
          ].join(" ")}
        >
          <AnalyticsHub onOpenChat={() => setActiveView("chat")} />
        </section>
      </div>

      {isChatView ? <AccountsSidebar /> : null}
      {lastError ? <BottomErrorBanner message={lastError} onDismiss={clearError} /> : null}
    </div>
  );
}
