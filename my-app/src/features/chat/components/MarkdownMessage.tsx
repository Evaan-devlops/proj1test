import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7zm2 0v11h9V7h-9zM4 4a2 2 0 0 1 2-2h9v2H6v11H4V4z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
    </svg>
  );
}

function tableToTsv(table: HTMLTableElement | null) {
  if (!table) return "";
  const rows = Array.from(table.querySelectorAll("tr"));
  return rows
    .map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => cell.textContent?.trim().replace(/\s+/g, " ") ?? "")
        .join("\t")
    )
    .join("\n");
}

function MarkdownTable({ children }: { children: React.ReactNode }) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyTable() {
    const tableText = tableToTsv(tableRef.current);
    if (!tableText) return;
    try {
      await navigator.clipboard.writeText(tableText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-[#08111f]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">Table</div>
        <button
          type="button"
          onClick={copyTable}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? "Copied" : "Copy table"}</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table ref={tableRef} className="min-w-full border-collapse text-sm text-slate-100">
          {children}
        </table>
      </div>
    </div>
  );
}

function MarkdownTd(props: ComponentPropsWithoutRef<"td">) {
  return <td {...props} className="border-t border-white/10 px-4 py-3 align-top text-slate-200" />;
}

function MarkdownTh(props: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      {...props}
      className="border-b border-white/10 bg-white/[0.03] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300"
    />
  );
}

export default function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-100 prose-strong:text-white prose-li:text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
          thead: (props) => <thead {...props} className="bg-transparent" />,
          tbody: (props) => <tbody {...props} />,
          th: MarkdownTh,
          td: MarkdownTd,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
