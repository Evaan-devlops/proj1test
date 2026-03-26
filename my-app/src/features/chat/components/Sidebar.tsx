import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useChatStore } from "../../../store/chat.store";

const DeleteChatDialog = lazy(() => import("./DeleteChatDialog"));
const RenameInlineForm = lazy(() => import("./RenameInlineForm"));
const ChatMenu = lazy(() => import("./ChatMenu"));

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M11 5h2v14h-2zM5 11h14v2H5z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 12a2 2 0 1 1-4 0a2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0a2 2 0 0 1 4 0zm8 0a2 2 0 1 1-4 0a2 2 0 0 1 4 0z"
      />
    </svg>
  );
}


export default function Sidebar() {
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const newChat = useChatStore((s) => s.newChat);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const chatToDelete = deleteId ? chats.find((x) => x.id === deleteId) : null;

  const deleteChat = useChatStore((s) => s.deleteChat);

  // menu state
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // rename inline state (ChatGPT-like)
  const renameChat = useChatStore((s) => s.renameChat);
  const [editingId, setEditingId] = useState<string | null>(null);

  // close menu on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenuFor(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <aside className="relative flex w-72 min-h-screen flex-col rounded-r-[32px] border border-white/10 bg-[#0b1222] p-4 text-white shadow-[24px_0_60px_rgba(0,0,0,0.6)]">
      <div
        className="pointer-events-none absolute inset-y-6 -right-12 w-16 rounded-full bg-gradient-to-r from-black/30 via-black/80 to-transparent blur-2xl"
        aria-hidden="true"
      />

      <button
        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/10"
        onClick={newChat}
      >
        <div className="flex items-center justify-center gap-2">
          <PlusIcon />
          <span>New chat</span>
        </div>
      </button>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {chats.length === 0 && (
          <div className="text-sm text-white/50">No chats yet</div>
        )}

        {chats.map((c) => {
          const isActive = c.id === activeChatId;
          const isEditing = editingId === c.id;
          const showMenu = openMenuFor === c.id;

          return (
            <div
              key={c.id}
              className={[
                "relative rounded-2xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-white/70 hover:bg-white/5",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  {!isEditing ? (
                    <button
                      onClick={() => setActiveChat(c.id)}
                      className="w-full text-left"
                      title="Open chat"
                    >
                      <div className="truncate text-sm font-medium">
                        {c.title}
                      </div>
                      <div className="text-xs text-white/50">
                        {new Date(c.updatedAt).toLocaleString()}
                      </div>
                    </button>
                  ) : (
                    <Suspense
                      fallback={
                        <div className="h-16 rounded-lg border border-white/10 bg-white/5" />
                      }
                    >
                      <RenameInlineForm
                        initialTitle={c.title}
                        onSave={(title) => {
                          renameChat(c.id, title);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </Suspense>
                  )}
                </div>

                {!isEditing && (
                  <div className="relative" ref={showMenu ? menuRef : null}>
                    <button
                      className="inline-flex h-8 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-white/40 hover:bg-white/20"
                      onClick={() =>
                        setOpenMenuFor((prev) => (prev === c.id ? null : c.id))
                      }
                      aria-label="Chat menu"
                      title="Menu"
                    >
                      <DotsIcon />
                    </button>

                    {showMenu && (
                      <Suspense fallback={null}>
                        <ChatMenu
                          onRename={() => {
                            setOpenMenuFor(null);
                            setEditingId(c.id);
                          }}
                          onDelete={() => {
                            setOpenMenuFor(null);
                            setDeleteId(c.id);
                          }}
                        />
                      </Suspense>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {chatToDelete && (
        <Suspense fallback={null}>
          <DeleteChatDialog
            chatTitle={chatToDelete.title}
            onCancel={() => setDeleteId(null)}
            onConfirm={() => {
              deleteChat(chatToDelete.id);
              setDeleteId(null);
            }}
          />
        </Suspense>
      )}
    </aside>
  );
}
