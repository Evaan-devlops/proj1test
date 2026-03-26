type BottomErrorBannerProps = {
  message: string;
  onDismiss: () => void;
};

export default function BottomErrorBanner({ message, onDismiss }: BottomErrorBannerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[260] flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-start justify-between gap-4 rounded-2xl border border-rose-400/30 bg-rose-950/90 px-4 py-3 text-sm text-rose-100 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
        <p className="min-w-0 flex-1 break-words">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg border border-rose-200/20 bg-white/5 px-3 py-1 text-xs font-medium text-rose-50 transition hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
