type DeleteChatDialogProps = {
  chatTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function DeleteChatDialog({
  chatTitle,
  onConfirm,
  onCancel,
}: DeleteChatDialogProps) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
        aria-label="Close delete dialog"
      />

      <div className="relative w-[520px] max-w-[90vw] rounded-2xl border border-white/10 bg-zinc-900 text-white shadow-2xl p-6">
        <h2 className="text-xl font-semibold">Delete chat?</h2>

        <p className="mt-4 text-base text-white/90">
          This will delete <span className="font-semibold">{chatTitle}</span>.
        </p>

        <p className="mt-2 text-sm text-white/60">You can't undo this action.</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            className="rounded-xl bg-red-600 px-4 py-2 font-semibold hover:bg-red-700"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
