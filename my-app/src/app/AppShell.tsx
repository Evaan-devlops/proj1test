import { Suspense, lazy, useEffect } from "react";
import ChatWindow from "@/features/chat/components/ChatWindow";
import PromptBox from "@/features/chat/components/PromptBox";
import InstallAppButton from "@/components/InstallAppButton";
import AccountsSidebar from "@/features/chat/components/AccountsSidebar";
import { useChatStore } from "@/store/chat.store";
import { useUiStore } from "@/store/ui.store";

const Sidebar = lazy(() => import("@/features/chat/components/Sidebar"));

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

export default function AppShell() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const sidebarEverOpened = useUiStore((s) => s.sidebarEverOpened);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const hydrateChats = useChatStore((s) => s.hydrateChats);
  const loadAccounts = useChatStore((s) => s.loadAccounts);

  useEffect(() => {
    void hydrateChats();
    void loadAccounts();
  }, [hydrateChats, loadAccounts]);

  return (
    <div className="h-screen bg-[#0b1220] text-white overflow-hidden">
      <button
        onClick={toggleSidebar}
        className={[
          "group fixed top-3 z-[200] h-9 w-9 grid place-items-center rounded-lg",
          "border border-white/10 bg-white/5 hover:bg-white/10",
          "transition-all duration-300 ease-out motion-reduce:transition-none",
          sidebarOpen ? "left-[292px]" : "left-3",
        ].join(" ")}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <CloseSidebarIcon /> : <OpenSidebarIcon />}
      </button>

      <div className="fixed top-3 right-3 z-[200]">
        <InstallAppButton />
      </div>

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
              <Suspense fallback={<div className="h-full w-full bg-[#0f172a] border-r border-white/10" />}>
                <Sidebar />
              </Suspense>
            ) : null}
          </div>
        </div>

        <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full">
          <ChatWindow />
          <PromptBox />
        </main>
      </div>

      <AccountsSidebar />
    </div>
  );
}
