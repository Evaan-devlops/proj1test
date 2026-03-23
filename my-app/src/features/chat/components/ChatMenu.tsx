type ChatMenuProps = {
  onRename: () => void;
  onDelete: () => void;
};

export default function ChatMenu({ onRename, onDelete }: ChatMenuProps) {
  return (
    <div className="absolute right-0 top-full mt-3 w-48 rounded-3xl border border-white/10 bg-[#111628] p-2 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-black/30 z-50 flex flex-col gap-1">
      <button
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/90 transition hover:bg-white/5"
        onClick={onRename}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-white">
          <PencilIcon />
        </span>
        Rename
      </button>

      <button
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
        onClick={onDelete}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
          <TrashIcon />
        </span>
        Delete
      </button>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 17.5V20h2.5l11-11-2.5-2.5-11 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 6l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 8h12l-1 11H7L6 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6m4-6v6M9 5l1-1h4l1 1m-10 3h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
