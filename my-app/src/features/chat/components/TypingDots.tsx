//while waiting (thinking indicator)
export default function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full bg-white/60 animate-bounce [animation-delay:-0.2s]" />
      <span className="h-2 w-2 rounded-full bg-white/60 animate-bounce [animation-delay:-0.1s]" />
      <span className="h-2 w-2 rounded-full bg-white/60 animate-bounce" />
    </div>
  );
}