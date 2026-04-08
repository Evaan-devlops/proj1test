import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import ChatWindow from "src/features/chat/components/ChatWindow";
import PromptBox from "src/features/chat/components/PromptBox";
import AccountsSidebar from "src/features/chat/components/AccountsSidebar";
import BottomErrorBanner from "src/components/BottomErrorBanner";
import AnalyticsHub from "src/pages/AnalyticsHub";
import { chatApi } from "src/features/chat/api/chatApi";
import { useChatStore } from "src/store/chat.store";
import { useUiStore, type AppView, type DiscussionTableContext } from "src/store/ui.store";

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

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 4h5v2H8.41L13 10.59 11.59 12 7 7.41V11H5V6a2 2 0 0 1 2-2zm10 9h2v5a2 2 0 0 1-2 2h-5v-2h3.59L11 13.41 12.41 12 17 16.59V13z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.41 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3l6.3 6.29 6.29-6.3z" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M16.2 3.8a2.4 2.4 0 0 1 3.4 3.4l-9.7 9.7L6 18l1.1-3.9 9.1-10.3zM4 20h16v2H4z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M13 3a9 9 0 1 0 8.95 10H20a7 7 0 1 1-2.05-4.95L15 11h7V4l-2.64 2.64A8.96 8.96 0 0 0 13 3zm-1 5h2v5h-5v-2h3V8z" />
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

function SmallIconButton({
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
      className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/6 text-white transition hover:bg-white/12"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

function LayoutOptionButton({
  icon,
  title,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-100 transition hover:bg-white/10"
    >
      <div className="rounded-xl border border-white/10 bg-white/8 p-2 text-white">{icon}</div>
      <div className="text-sm font-medium text-white">{title}</div>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  function clearHideTimer() {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function openMenu() {
    clearHideTimer();
    setMenuOpen(true);
  }

  function closeMenuWithDelay() {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setMenuOpen(false), 220);
  }

  function handleLayoutSelection(action: () => void) {
    clearHideTimer();
    setMenuOpen(false);
    action();
  }

  useEffect(() => () => clearHideTimer(), []);

  return (
    <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenuWithDelay}>
      <button
        type="button"
        onClick={() => onSingle(targetView)}
        onFocus={openMenu}
        className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/88 px-4 py-2 text-sm font-medium text-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-300 hover:bg-white hover:text-slate-900"
      >
        {viewIcon(targetView)}
        <span>{viewLabel(targetView)}</span>
      </button>

      <div
        className={[
          "absolute right-0 top-full z-[260] mt-3 w-56 rounded-[24px] border border-white/10 bg-slate-950/94 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl transition-all duration-200",
          menuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        ].join(" ")}
        onMouseEnter={openMenu}
        onMouseLeave={closeMenuWithDelay}
      >
        <LayoutOptionButton
          icon={<SplitIcon />}
          title="Split View"
          onClick={() => handleLayoutSelection(() => onSplit(currentView))}
        />
        <LayoutOptionButton
          icon={<FloatIcon />}
          title="Floating Window"
          onClick={() => handleLayoutSelection(() => onFloat(currentView))}
        />
      </div>
    </div>
  );
}

function PaneControls({
  view,
  onExpand,
  onClose,
}: {
  view: AppView;
  onExpand: (view: AppView) => void;
  onClose: (view: AppView) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <SmallIconButton icon={<ExpandIcon />} label={`Expand ${viewLabel(view)}`} onClick={() => onExpand(view)} />
      <SmallIconButton icon={<CloseIcon />} label={`Close ${viewLabel(view)}`} onClick={() => onClose(view)} />
    </div>
  );
}

function CompactChatRail() {
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const newChat = useChatStore((s) => s.newChat);
  const setActiveChat = useChatStore((s) => s.setActiveChat);

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-3 border-r border-white/10 bg-[#09111d]/88 px-2 py-4">
      <SmallIconButton icon={<NewChatIcon />} label="New chat" onClick={() => void newChat()} />
      <SmallIconButton icon={<HistoryIcon />} label="Chat history" onClick={() => {}} />
      <div className="mt-2 flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto pb-2">
        {chats.slice(0, 8).map((chat) => {
          const isActive = chat.id === activeChatId;
          const token = chat.title.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "CH";
          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => setActiveChat(chat.id)}
              title={chat.title}
              className={[
                "flex h-11 w-11 items-center justify-center rounded-2xl border text-[11px] font-semibold tracking-[0.12em] transition",
                isActive
                  ? "border-white/60 bg-white text-slate-950"
                  : "border-white/12 bg-white/5 text-white/75 hover:bg-white/10",
              ].join(" ")}
            >
              {token}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function FloatingDiscussionTable({
  table,
  onClose,
  onResizeStart,
}: {
  table: DiscussionTableContext;
  onClose: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="pointer-events-auto relative h-full overflow-hidden rounded-[34px] border border-white/14 bg-[#08111b]/92 shadow-[0_40px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onResizeStart}
        className="absolute inset-y-0 left-0 z-[210] w-4 cursor-col-resize"
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/16" />
        <div className="absolute left-1/2 top-1/2 h-16 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/12 shadow-[0_0_20px_rgba(0,0,0,0.25)]" />
      </div>

      <div className="h-full overflow-y-auto p-6 pl-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Discussion Context</div>
            <div className="mt-2 text-xl font-semibold text-white">{table.title}</div>
          </div>
          <SmallIconButton icon={<CloseIcon />} label="Close table context" onClick={onClose} />
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {table.updatedAtMs ? `Updated ${new Date(table.updatedAtMs).toLocaleString()}` : "Snapshot time unavailable"}
        </div>
        <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/10 bg-white/[0.04]">
          <table className="min-w-full border-collapse text-sm text-slate-100">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                {table.headers.map((header) => (
                  <th key={header} className="px-4 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`${table.title}-${rowIndex}`} className="border-b border-white/5">
                  {row.map((cell, cellIndex) => (
                    <td key={`${table.title}-${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top text-slate-200">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChatWorkspace({
  actionButton,
  paneActions,
  compactHistory,
}: {
  actionButton: ReactNode;
  paneActions: ReactNode;
  compactHistory: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      {compactHistory ? <CompactChatRail /> : null}
      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 px-4 pt-4">
          <div className="flex w-full items-center justify-end gap-2 pr-2">
            {paneActions}
            {actionButton}
          </div>
        </header>
        <ChatWindow />
        <PromptBox />
      </main>
    </div>
  );
}

export default function AppShell() {
  const activeView = useUiStore((s) => s.activeView);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const primaryView = useUiStore((s) => s.primaryView);
  const splitRatio = useUiStore((s) => s.splitRatio);
  const floatRatio = useUiStore((s) => s.floatRatio);
  const discussionTable = useUiStore((s) => s.discussionTable);
  const discussionTableWidthRatio = useUiStore((s) => s.discussionTableWidthRatio);
  const openSingleView = useUiStore((s) => s.openSingleView);
  const openSplitView = useUiStore((s) => s.openSplitView);
  const openFloatView = useUiStore((s) => s.openFloatView);
  const setSplitRatio = useUiStore((s) => s.setSplitRatio);
  const setFloatRatio = useUiStore((s) => s.setFloatRatio);
  const closeDiscussionTable = useUiStore((s) => s.closeDiscussionTable);
  const setDiscussionTableWidthRatio = useUiStore((s) => s.setDiscussionTableWidthRatio);
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

  function startDiscussionTableResize(event: React.PointerEvent<HTMLDivElement>) {
    const shell = shellRef.current;
    if (!shell) return;
    event.preventDefault();

    const bounds = shell.getBoundingClientRect();
    const update = (clientX: number) => setDiscussionTableWidthRatio((bounds.right - clientX) / bounds.width);

    update(event.clientX);

    const onMove = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleExpand(view: AppView) {
    openSingleView(view);
  }

  function handleClose(view: AppView) {
    openSingleView(otherView(view));
  }

  function renderView(
    view: AppView,
    options: { compactHistory?: boolean; showPaneControls?: boolean } = {},
  ) {
    const { compactHistory = false, showPaneControls = false } = options;
    const actionButton = (
      <PageSwitchButton
        currentView={view}
        onSingle={openSingleView}
        onSplit={openSplitView}
        onFloat={openFloatView}
      />
    );
    const paneActions = showPaneControls ? (
      <PaneControls view={view} onExpand={handleExpand} onClose={handleClose} />
    ) : null;

    if (view === "chat") {
      return <ChatWorkspace actionButton={actionButton} paneActions={paneActions} compactHistory={compactHistory} />;
    }

    return <AnalyticsHub actionButton={actionButton} paneActions={paneActions} />;
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
              {renderView(primaryView, { compactHistory: primaryView === "chat", showPaneControls: true })}
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

            <div className="min-w-0 flex-1">
              {renderView(secondaryView, { compactHistory: secondaryView === "chat", showPaneControls: true })}
            </div>
          </section>
        ) : null}

        {layoutMode === "float" ? (
          <section className="absolute inset-0">
            <div className="absolute inset-0">
              {renderView(secondaryView, { compactHistory: secondaryView === "chat", showPaneControls: true })}
            </div>

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

                <div className="h-full">
                  {renderView(primaryView, { compactHistory: primaryView === "chat", showPaneControls: true })}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {discussionTable && layoutMode === "single" && activeView === "chat" ? (
          <div
            className="pointer-events-none absolute inset-y-4 right-4 z-[230]"
            style={{ width: `${discussionTableWidthRatio * 100}%` }}
          >
            <FloatingDiscussionTable
              table={discussionTable}
              onClose={closeDiscussionTable}
              onResizeStart={startDiscussionTableResize}
            />
          </div>
        ) : null}
      </div>

      {isSingleChatView ? <AccountsSidebar /> : null}
      {lastError ? <BottomErrorBanner message={lastError} onDismiss={clearError} /> : null}
    </div>
  );
}
