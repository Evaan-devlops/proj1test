import { useState } from "react";
import { useChatStore } from "src/store/chat.store";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["h-4 w-4 transition-transform duration-300", open ? "rotate-0" : "rotate-180"].join(" ")}
      aria-hidden="true"
    >
      <path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" />
    </svg>
  );
}

export default function AccountsSidebar() {
  const [open, setOpen] = useState(true);
  const availableAccountKeys = useChatStore((s) => s.availableAccountKeys);
  const selectedAccountKeys = useChatStore((s) => s.selectedAccountKeys);
  const toggleAccountSelection = useChatStore((s) => s.toggleAccountSelection);
  const toggleAllAccounts = useChatStore((s) => s.toggleAllAccounts);

  const allSelected =
    availableAccountKeys.length > 0 && availableAccountKeys.every((accountKey) => selectedAccountKeys.includes(accountKey));

  return (
    <div className="pointer-events-auto fixed right-6 top-1/2 z-[160] -translate-y-1/2">
      <div className="flex items-center justify-end">
        {open ? (
          <div
            className={[
              "w-max min-w-[220px] rounded-[28px] border border-white/12",
              "bg-[linear-gradient(180deg,rgba(23,31,55,0.96),rgba(10,17,35,0.96))]",
              "px-5 py-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl",
              "transition-all duration-300 ease-out motion-reduce:transition-none",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold tracking-[0.18em] text-white/55 uppercase">Accounts</div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/12 bg-white/6 text-white/70 transition hover:bg-white/12 hover:text-white"
                aria-label="Collapse accounts panel"
              >
                <ChevronIcon open />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-white/6">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAllAccounts(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-transparent text-white accent-white"
                />
                <span className="text-sm text-white/90">Select all</span>
              </label>

              {availableAccountKeys.length === 0 ? (
                <div className="rounded-2xl px-3 py-2 text-sm text-white/60">No accounts loaded</div>
              ) : (
                availableAccountKeys.map((accountKey) => (
                  <label
                    key={accountKey}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-white/6"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccountKeys.includes(accountKey)}
                      onChange={() => toggleAccountSelection(accountKey)}
                      className="h-4 w-4 rounded border-white/30 bg-transparent text-white accent-white"
                    />
                    <span className="text-sm text-white/90">{accountKey.toUpperCase()}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={[
            "ml-3 grid h-12 w-12 place-items-center rounded-full border border-white/12",
            "bg-[linear-gradient(180deg,rgba(23,31,55,0.96),rgba(10,17,35,0.96))]",
            "text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/10",
          ].join(" ")}
          aria-label={open ? "Collapse accounts panel" : "Expand accounts panel"}
          title={open ? "Collapse accounts" : "Expand accounts"}
        >
          <ChevronIcon open={open} />
        </button>
      </div>
    </div>
  );
}
