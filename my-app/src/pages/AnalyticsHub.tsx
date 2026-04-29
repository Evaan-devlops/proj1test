import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { chatApi } from "src/features/chat/api/chatApi";
import type {
  AnalyticsCertificateItem,
  AnalyticsEcsClusterItem,
  AnalyticsEcsServiceItem,
  AnalyticsEcsTaskItem,
  AnalyticsHubAccountError,
  AnalyticsHubAccountSnapshot,
  AnalyticsHubSnapshot,
} from "src/features/chat/api/types";
import { useChatStore } from "src/store/chat.store";
import { useUiStore } from "src/store/ui.store";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-4.9 6.03H5.02A7 7 0 1 0 17.65 6.35z"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H11l-4.75 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M5 5h6v2H8.4l3.1 3.1-1.4 1.4L7 8.4V11H5V5zm8 0h6v6h-2V8.4l-3.1 3.1-1.4-1.4L15.6 7H13V5zM7 15.6l3.1-3.1 1.4 1.4L8.4 17H11v2H5v-6h2v2.6zm10 0V13h2v6h-6v-2h2.6l-3.1-3.1 1.4-1.4 3.1 3.1z" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M5 19V9h3v10H5zm5 0V5h3v14h-3zm5 0v-7h3v7h-3z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M4 5h16v14H4V5zm2 2v3h5V7H6zm7 0v3h5V7h-5zm-7 5v5h5v-5H6zm7 0v5h5v-5h-5z" />
    </svg>
  );
}

function FeatureIcon({
  type,
}: {
  type: "idle" | "certificate" | "utilization" | "recommendation" | "chat" | "plan" | "priority";
}) {
  const paths = {
    idle: "M7 18a4 4 0 0 1-.72-7.94A6 6 0 0 1 17.78 8.7 4.5 4.5 0 0 1 18 18H7z",
    certificate:
      "M12 3l7 3v5.2c0 4.1-2.7 7.9-7 9.8-4.3-1.9-7-5.7-7-9.8V6l7-3zm0 3.1-4 1.7v3.4c0 2.8 1.5 5.5 4 7 2.5-1.5 4-4.2 4-7V7.8l-4-1.7z",
    utilization: "M5 19V9h3v10H5zm5 0V5h3v14h-3zm5 0v-7h3v7h-3z",
    recommendation:
      "M12 3a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.2-1.1 2V16h-5v-.2c0-.8-.4-1.5-1.1-2A6 6 0 0 1 12 3zm-2.5 15h5v2h-5v-2z",
    chat: "M5 5h14v9H9l-4 4V5zm4 3v2h6V8H9zm0 3v2h4v-2H9z",
    plan: "M8 5h11v2H8V5zm0 6h11v2H8v-2zm0 6h11v2H8v-2zM4 5h2v2H4V5zm0 6h2v2H4v-2zm0 6h2v2H4v-2z",
    priority: "M5 4l2 1h10v9H8l-3-1v7H3V4h2z",
  };

  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path fill="currentColor" d={paths[type]} />
    </svg>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAccountLabel(accountKey: string) {
  return accountKey.charAt(0).toUpperCase() + accountKey.slice(1);
}

function formatRelativeTime(timestamp: string | null | undefined) {
  if (!timestamp) return "Updated just now";
  const diffMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `Updated ${diffHours}h ago`;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const glassPanelClass =
  "relative overflow-hidden rounded-[34px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),rgba(214,230,255,0.18))] shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-[24px]";

const glassButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-white/55 text-slate-700 shadow-[0_10px_22px_rgba(148,163,184,0.14)] transition hover:bg-white/68 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500";

const featureTabs = [
  {
    title: "Detect Idle Resources",
    description: "Stop cloud waste before it impacts your budget.",
    icon: "idle",
  },
  {
    title: "Certificate Expiry Watch",
    description: "Track expiring certificates and act before service disruption.",
    icon: "certificate",
  },
  {
    title: "Utilization Insights",
    description: "Spot underused and overused resources for better capacity planning.",
    icon: "utilization",
  },
  {
    title: "Proactive Recommendations",
    description: "Get early suggestions to prevent upcoming issues.",
    icon: "recommendation",
  },
  {
    title: "Unified Troubleshooting Chat",
    description: "Ask questions, review logs, and get answers in one place.",
    icon: "chat",
  },
  {
    title: "Action Plan Generator",
    description: "Convert issues into clear owners, next steps, and team notifications.",
    icon: "plan",
  },
  {
    title: "Priority Issue Tracker",
    description: "View active issues ranked by urgency and business impact.",
    icon: "priority",
  },
] as const;

function FeatureTab({
  title,
  description,
  icon,
  hasAlert = false,
  onClick,
}: {
  title: string;
  description: string;
  icon: (typeof featureTabs)[number]["icon"];
  hasAlert?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[9.5rem] flex-col items-start justify-between rounded-[26px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.5),rgba(219,234,254,0.24))] px-5 py-5 text-left text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_18px_42px_rgba(30,64,175,0.08)] transition hover:-translate-y-1 hover:border-white/80 hover:bg-white/60 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_54px_rgba(30,64,175,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      aria-label={`${title}: ${description}`}
    >
      <span className="flex w-full items-start justify-between gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/60 bg-sky-100/72 text-sky-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <FeatureIcon type={icon} />
        </span>
        <span
          className={classNames(
            "mt-1 h-2.5 w-2.5 rounded-full",
            hasAlert
              ? "animate-pulse bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.82)]"
              : "bg-sky-300/80 shadow-[0_0_16px_rgba(56,189,248,0.42)]",
          )}
          aria-hidden="true"
        />
      </span>
      <span className="mt-5 block">
        <span className="block text-base font-semibold leading-6 text-slate-900 group-hover:text-sky-800">
          {title}
        </span>
        <span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span>
      </span>
    </button>
  );
}

function DataCard({
  title,
  headers,
  rows,
  emptyText,
  updatedLabel,
  onRefresh,
  onDiscuss,
  controls,
  children,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
  updatedLabel: string;
  onRefresh: () => void;
  onDiscuss: () => void;
  controls?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={classNames(glassPanelClass, "p-6 text-slate-900")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">{title}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>{updatedLabel}</span>
            <button type="button" onClick={onRefresh} className={glassButtonClass} aria-label={`Refresh ${title}`} title="Refresh">
              <RefreshIcon />
            </button>
            {controls}
          </div>
        </div>

        <button
          type="button"
          onClick={onDiscuss}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(231,239,255,0.44))] text-slate-700 shadow-[0_16px_30px_rgba(148,163,184,0.12)] transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(231,239,255,0.54))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          aria-label={`Discuss ${title}`}
          title="Discuss"
        >
          <ChatIcon />
        </button>
      </div>

      {children ?? (
        <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/55 bg-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <table className="min-w-full border-collapse text-sm text-slate-800">
            <thead>
              <tr className="border-b border-slate-300/35 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {headers.map((header) => (
                  <th key={header} className="px-4 py-4 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, rowIndex) => (
                  <tr
                    key={`${title}-${rowIndex}`}
                    className="border-b border-slate-200/45 transition hover:bg-white/18 last:border-b-0"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${title}-${rowIndex}-${cellIndex}`}
                        className="px-4 py-4 align-top text-[14px] leading-6 text-slate-800"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-7 text-slate-500">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FinancialImpactBarChart({
  items,
  total,
}: {
  items: Array<{ service: string; cost: number; share: string }>;
  total: number;
}) {
  const chartItems = items.slice(0, 8);
  const maxCost = Math.max(...chartItems.map((item) => item.cost), 0);
  const rankPalette = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#64748b"];

  return (
    <div className="mt-5 rounded-[28px] border border-white/55 bg-white/36 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">Selected spend</div>
        <div className="text-sm font-semibold text-slate-950">{formatCurrency(total)}</div>
      </div>
      <div className="space-y-3">
        {chartItems.length > 0 ? (
          chartItems.map((item, index) => (
            <div key={item.service} className="grid gap-2 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(12rem,1.3fr)_6rem] sm:items-center">
              <div className="truncate text-sm font-medium text-slate-800">{item.service}</div>
              <div
                className="group relative h-8 overflow-visible rounded-full border border-white/55 bg-white/48"
                title={`${item.service}: ${formatCurrency(item.cost)} (${item.share}% of selected spend)`}
              >
                <div
                  className="flex h-full items-center justify-end rounded-full px-3 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] transition-[width,filter] group-hover:brightness-110"
                  style={{
                    width: `${maxCost > 0 ? Math.max((item.cost / maxCost) * 100, 5) : 0}%`,
                    backgroundColor: rankPalette[index % rankPalette.length],
                  }}
                >
                  {item.share}%
                </div>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden min-w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_16px_38px_rgba(15,23,42,0.18)] group-hover:block">
                  <div className="font-semibold text-slate-950">{item.service}</div>
                  <div className="mt-1">{formatCurrency(item.cost)}</div>
                  <div>{item.share}% of selected spend</div>
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-slate-900">{formatCurrency(item.cost)}</div>
            </div>
          ))
        ) : (
          <div className="py-6 text-sm text-slate-500">No spend data is available yet for the selected accounts.</div>
        )}
      </div>
    </div>
  );
}

function ActionBadge() {
  return (
    <button
      type="button"
      className="ml-3 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700 shadow-[0_8px_18px_rgba(239,68,68,0.12)] transition hover:bg-red-100"
    >
      Action
    </button>
  );
}

function DaysLeftCell({ days }: { days: number }) {
  const isUrgent = days < 30;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={classNames("font-semibold", isUrgent ? "text-red-600" : "text-slate-800")}>{days}</span>
      {isUrgent ? <ActionBadge /> : null}
    </div>
  );
}

function FinancialImpactCard({
  rows,
  items,
  total,
  updatedLabel,
  view,
  onViewChange,
  onRefresh,
  onDiscuss,
}: {
  rows: ReactNode[][];
  items: Array<{ service: string; cost: number; share: string }>;
  total: number;
  updatedLabel: string;
  view: "table" | "bar";
  onViewChange: (view: "table" | "bar") => void;
  onRefresh: () => void;
  onDiscuss: () => void;
}) {
  const controls = (
    <div className="inline-flex rounded-full border border-white/55 bg-white/42 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <button
        type="button"
        onClick={() => onViewChange("table")}
        className={classNames(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500",
          view === "table" ? "bg-white text-slate-900 shadow-[0_8px_18px_rgba(148,163,184,0.16)]" : "text-slate-600 hover:bg-white/48",
        )}
        aria-label="Show Financial Impact Table as table"
        title="Table"
      >
        <TableIcon />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("bar")}
        className={classNames(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500",
          view === "bar" ? "bg-white text-slate-900 shadow-[0_8px_18px_rgba(148,163,184,0.16)]" : "text-slate-600 hover:bg-white/48",
        )}
        aria-label="Show Financial Impact Table as bar chart"
        title="Bar chart"
      >
        <BarChartIcon />
      </button>
    </div>
  );

  return (
    <DataCard
      title="Financial Impact Table"
      headers={["Service", "Current Spend ($)", "Share of Selected Spend"]}
      rows={view === "table" ? rows : []}
      emptyText="No stored service spend rows are available for the selected accounts yet."
      updatedLabel={updatedLabel}
      onRefresh={onRefresh}
      onDiscuss={onDiscuss}
      controls={controls}
    >
      {view === "bar" ? <FinancialImpactBarChart items={items} total={total} /> : null}
    </DataCard>
  );
}

const MAX_CONTEXT_FILE_CHARS = 80_000;

function formatTroubleshootingPrompt(issueText: string, files: Array<{ name: string; content: string }>) {
  const fileContext = files.length
    ? files
        .map(
          (file) =>
            `File: ${file.name}\n---\n${file.content.slice(0, MAX_CONTEXT_FILE_CHARS)}${
              file.content.length > MAX_CONTEXT_FILE_CHARS ? "\n[File content truncated for analysis.]" : ""
            }\n---`,
        )
        .join("\n\n")
    : "No file context was uploaded.";

  return [
    "Use the RCA, log file, and issue trace context below to analyze the probable issue.",
    "Describe the most likely root cause, the evidence that supports it, and the immediate next troubleshooting steps.",
    "Do not call external tools yet; reason from the supplied context.",
    "",
    "Issue log/trace text:",
    issueText.trim() || "No issue log/trace text was entered.",
    "",
    "Uploaded RCA/log file context:",
    fileContext,
  ].join("\n");
}

async function readTroubleshootingFiles(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      try {
        return {
          name: file.name,
          content: await file.text(),
        };
      } catch {
        return {
          name: file.name,
          content: "[Unable to read this file as text.]",
        };
      }
    }),
  );
}

function TroubleshootingModal({
  issueText,
  files,
  isSubmitting,
  error,
  onIssueTextChange,
  onFilesChange,
  onRemoveFile,
  onClose,
  onSubmit,
}: {
  issueText: string;
  files: File[];
  isSubmitting: boolean;
  error: string | null;
  onIssueTextChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[30px] border border-white/55 bg-[linear-gradient(180deg,rgba(239,247,255,0.96),rgba(209,230,255,0.92))] p-6 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Unified Troubleshooting</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Add RCA, logs, or trace context</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/62 text-slate-700 transition hover:bg-white"
            aria-label="Close troubleshooting modal"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5">
          <label
            htmlFor="troubleshooting-file-upload"
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-sky-300/80 bg-white/42 px-4 py-5 text-center text-slate-700 transition hover:bg-white/58"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full border border-white/75 bg-white/76 text-sky-600 shadow-[0_10px_24px_rgba(56,189,248,0.14)]">
              <PlusIcon />
            </span>
            <span className="mt-3 text-sm font-semibold">Upload RCA or log file</span>
            <span className="mt-1 text-xs text-slate-500">Text-based files work best for analysis.</span>
          </label>
          <input
            id="troubleshooting-file-upload"
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => onFilesChange(Array.from(event.currentTarget.files ?? []))}
          />
        </div>

        {files.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span
                key={`${file.name}-${file.size}-${index}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/65 bg-white/58 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="text-slate-500 transition hover:text-slate-900"
                  aria-label={`Remove ${file.name}`}
                >
                  <CloseIcon />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <label className="mt-5 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Issue log/trace</span>
          <textarea
            value={issueText}
            onChange={(event) => onIssueTextChange(event.target.value)}
            className="mt-2 min-h-40 w-full resize-y rounded-[22px] border border-white/65 bg-white/58 px-4 py-3 text-sm leading-6 text-slate-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-200/70"
            placeholder="Paste the error, stack trace, incident notes, RCA details, or relevant log lines here."
          />
        </label>

        {error ? <div className="mt-3 text-sm font-medium text-red-600">{error}</div> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/65 bg-white/48 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/72"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-full border border-sky-300/60 bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(2,132,199,0.2)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

type EcsNodeDetail = {
  title: string;
  severity: "ok" | "warning" | "critical";
  insight: string;
  logs: string[];
};

function ecsSeverityClass(severity: "ok" | "warning" | "critical") {
  if (severity === "critical") return "border-red-300 bg-red-50 text-red-800 shadow-[0_0_0_3px_rgba(248,113,113,0.16)]";
  if (severity === "warning") return "border-yellow-300 bg-yellow-50 text-yellow-800 shadow-[0_0_0_3px_rgba(250,204,21,0.14)]";
  return "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]";
}

function ecsSeverityDotClass(severity: "ok" | "warning" | "critical") {
  if (severity === "critical") return "bg-red-500";
  if (severity === "warning") return "bg-yellow-400";
  return "bg-emerald-500";
}

function ecsServiceMatchesFilter(service: AnalyticsEcsServiceItem, filter: string) {
  const normalized = filter.trim().toLowerCase();
  if (!normalized) return true;
  return service.service_name.toLowerCase().includes(normalized);
}

function serviceDetail(service: AnalyticsEcsServiceItem): EcsNodeDetail {
  return {
    title: service.service_name,
    severity: service.severity,
    insight: service.insight,
    logs: [
      `Status: ${service.status}`,
      `Tasks: ${service.running_count}/${service.desired_count} running, ${service.pending_count} pending`,
      service.deployment_status ? `Deployment: ${service.deployment_status}` : "",
      ...service.events,
    ].filter(Boolean),
  };
}

function taskDetail(task: AnalyticsEcsTaskItem): EcsNodeDetail {
  return {
    title: task.task_id,
    severity: task.severity,
    insight: task.stopped_reason || `Task is ${task.last_status}; desired status is ${task.desired_status}.`,
    logs: [
      `Task ARN: ${task.task_arn}`,
      `Last status: ${task.last_status}`,
      `Desired status: ${task.desired_status}`,
      task.health_status ? `Health: ${task.health_status}` : "",
      task.launch_type ? `Launch type: ${task.launch_type}` : "",
      task.stopped_reason ? `Stopped reason: ${task.stopped_reason}` : "",
      ...task.container_reasons,
    ].filter(Boolean),
  };
}

function EcsNode({
  label,
  severity,
  insight,
  onClick,
}: {
  label: string;
  severity: "ok" | "warning" | "critical";
  insight: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={insight}
      className={classNames(
        "group relative inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
        ecsSeverityClass(severity),
        onClick ? "hover:-translate-y-0.5" : "cursor-default",
      )}
    >
      <span className={classNames("h-2 w-2 shrink-0 rounded-full", ecsSeverityDotClass(severity))} />
      <span className="truncate">{label}</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-700 shadow-[0_16px_38px_rgba(15,23,42,0.18)] group-hover:block">
        {insight}
      </span>
    </button>
  );
}

function EcsClusterTree({
  accountLabel,
  cluster,
  filter,
  onNodeDetail,
}: {
  accountLabel: string;
  cluster: AnalyticsEcsClusterItem;
  filter: string;
  onNodeDetail: (detail: EcsNodeDetail) => void;
}) {
  const services = cluster.services.filter((service) => ecsServiceMatchesFilter(service, filter));
  return (
    <div className="rounded-[24px] border border-white/55 bg-white/34 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="flex flex-col items-center">
        <EcsNode
          label={`${accountLabel} / ${cluster.cluster_name}`}
          severity={cluster.severity}
          insight={cluster.insight}
          onClick={
            cluster.severity === "ok"
              ? undefined
              : () =>
                  onNodeDetail({
                    title: cluster.cluster_name,
                    severity: cluster.severity,
                    insight: cluster.insight,
                    logs: [`Status: ${cluster.status ?? "unknown"}`, `Cluster ARN: ${cluster.cluster_arn ?? "-"}`],
                  })
          }
        />
        <div className="h-6 w-px bg-slate-300/70" aria-hidden="true" />
        {services.length > 0 ? (
          <div className="grid w-full gap-4 md:grid-cols-2">
            {services.map((service) => (
              <div key={service.service_arn} className="flex min-w-0 flex-col items-center">
                <EcsNode
                  label={service.service_name}
                  severity={service.severity}
                  insight={service.insight}
                  onClick={service.severity === "ok" ? undefined : () => onNodeDetail(serviceDetail(service))}
                />
                <div className="h-5 w-px bg-slate-300/70" aria-hidden="true" />
                <div className="grid w-full gap-2">
                  {(service.tasks.length > 0 ? service.tasks : []).slice(0, 8).map((task) => (
                    <EcsNode
                      key={task.task_arn}
                      label={task.task_id.slice(0, 12)}
                      severity={task.severity}
                      insight={task.stopped_reason || `${task.last_status} / ${task.health_status ?? "health unknown"}`}
                      onClick={task.severity === "ok" ? undefined : () => onNodeDetail(taskDetail(task))}
                    />
                  ))}
                  {service.tasks.length === 0 ? (
                    <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-2 text-center text-xs font-semibold text-yellow-800">
                      No tasks returned
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-full border border-white/60 bg-white/48 px-4 py-2 text-xs font-semibold text-slate-600">
            No services match "{filter}"
          </div>
        )}
      </div>
    </div>
  );
}

function EcsInsightTree({
  accounts,
  filter,
  onNodeDetail,
}: {
  accounts: AnalyticsHubAccountSnapshot[];
  filter: string;
  onNodeDetail: (detail: EcsNodeDetail) => void;
}) {
  const clusters = accounts.flatMap((account) =>
    (account.ecs_clusters ?? []).map((cluster) => ({
      accountLabel: formatAccountLabel(account.account_key),
      cluster,
    })),
  );

  return (
    <div className="mt-5 space-y-4">
      {clusters.length > 0 ? (
        clusters.map(({ accountLabel, cluster }) => (
          <EcsClusterTree
            key={`${accountLabel}-${cluster.cluster_name}`}
            accountLabel={accountLabel}
            cluster={cluster}
            filter={filter}
            onNodeDetail={onNodeDetail}
          />
        ))
      ) : (
        <div className="rounded-[24px] border border-white/55 bg-white/34 px-4 py-6 text-sm text-slate-500">
          No ECS insight data is available yet. Refresh the Analytics Hub after AWS credentials are configured.
        </div>
      )}
    </div>
  );
}

function EcsInsightCard({
  accounts,
  filter,
  onFilterChange,
  onExpand,
  onNodeDetail,
}: {
  accounts: AnalyticsHubAccountSnapshot[];
  filter: string;
  onFilterChange: (value: string) => void;
  onExpand: () => void;
  onNodeDetail: (detail: EcsNodeDetail) => void;
}) {
  return (
    <div className={classNames(glassPanelClass, "p-6 text-slate-900")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">ECS Insight</div>
          <div className="mt-3 text-xs text-slate-600">Monitoring test-vsl-ecs-cluster and dev-vsl-ecs-cluster</div>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/58 text-slate-700 transition hover:bg-white/76"
          aria-label="Expand ECS Insight"
          title="Expand"
        >
          <ExpandIcon />
        </button>
      </div>
      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Service filter</span>
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          className="mt-2 w-full rounded-full border border-white/60 bg-white/54 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200/70"
          placeholder="Filter service name"
        />
      </label>
      <EcsInsightTree accounts={accounts} filter={filter} onNodeDetail={onNodeDetail} />
    </div>
  );
}

function EcsExpandedModal({
  accounts,
  filter,
  onFilterChange,
  onClose,
  onNodeDetail,
}: {
  accounts: AnalyticsHubAccountSnapshot[];
  filter: string;
  onFilterChange: (value: string) => void;
  onClose: () => void;
  onNodeDetail: (detail: EcsNodeDetail) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-white/55 bg-[linear-gradient(180deg,rgba(239,247,255,0.97),rgba(209,230,255,0.94))] p-6 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">ECS Insight</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Cluster service health tree</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/62 text-slate-700 transition hover:bg-white"
            aria-label="Close ECS Insight"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Service filter</span>
          <input
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="mt-2 w-full rounded-full border border-white/60 bg-white/64 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200/70"
            placeholder="Filter service name"
          />
        </label>
        <EcsInsightTree accounts={accounts} filter={filter} onNodeDetail={onNodeDetail} />
      </div>
    </div>
  );
}

function EcsNodeDetailModal({ detail, onClose }: { detail: EcsNodeDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-white p-6 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.26)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={classNames("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase", ecsSeverityClass(detail.severity))}>
              {detail.severity}
            </div>
            <div className="mt-3 text-xl font-semibold">{detail.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{detail.insight}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
            aria-label="Close ECS detail"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="mt-5 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
          {detail.logs.length > 0 ? detail.logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : "No ECS event or task error details were returned."}
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={classNames(glassPanelClass, "p-6 text-slate-900")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">{title}</div>
      <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">{children}</div>
    </div>
  );
}

function aggregateServiceSpend(accounts: AnalyticsHubAccountSnapshot[]) {
  const totals = new Map<string, number>();
  let overall = 0;
  for (const account of accounts) {
    for (const item of account.service_spend_30d) {
      totals.set(item.service, (totals.get(item.service) ?? 0) + item.cost);
      overall += item.cost;
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([service, cost]) => ({
      service,
      cost,
      share: overall > 0 ? ((cost / overall) * 100).toFixed(2) : "0.00",
    }));
}

function flattenCertificates(accounts: AnalyticsHubAccountSnapshot[]) {
  const rows: Array<AnalyticsCertificateItem & { account_key: string }> = [];
  for (const account of accounts) {
    for (const item of account.expiring_certificates) {
      rows.push({ ...item, account_key: account.account_key });
    }
  }
  return rows.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
}

const EMPTY_SNAPSHOT: AnalyticsHubSnapshot = {
  generated_at_utc: null,
  account_count: 0,
  accounts: [],
  errors: [],
};

export default function AnalyticsHub({
  actionButton,
  paneActions,
}: {
  actionButton: ReactNode;
  paneActions: ReactNode;
}) {
  const chats = useChatStore((s) => s.chats);
  const availableAccountKeys = useChatStore((s) => s.availableAccountKeys);
  const selectedAccountKeys = useChatStore((s) => s.selectedAccountKeys);
  const toggleAccountSelection = useChatStore((s) => s.toggleAccountSelection);
  const newChat = useChatStore((s) => s.newChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const openSingleView = useUiStore((s) => s.openSingleView);
  const openDiscussionTable = useUiStore((s) => s.openDiscussionTable);
  const closeDiscussionTable = useUiStore((s) => s.closeDiscussionTable);
  const [snapshot, setSnapshot] = useState<AnalyticsHubSnapshot>(EMPTY_SNAPSHOT);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [financialImpactView, setFinancialImpactView] = useState<"table" | "bar">("bar");
  const [ecsFilter, setEcsFilter] = useState("genai");
  const [ecsExpanded, setEcsExpanded] = useState(false);
  const [ecsNodeDetail, setEcsNodeDetail] = useState<EcsNodeDetail | null>(null);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);
  const [troubleshootingText, setTroubleshootingText] = useState("");
  const [troubleshootingFiles, setTroubleshootingFiles] = useState<File[]>([]);
  const [troubleshootingSubmitting, setTroubleshootingSubmitting] = useState(false);
  const [troubleshootingError, setTroubleshootingError] = useState<string | null>(null);
  const certificatesSectionRef = useRef<HTMLElement | null>(null);

  async function loadSnapshot() {
    const result = await chatApi.getAnalyticsHubSnapshot();
    if (!result.ok) {
      setRefreshInProgress(false);
      return;
    }
    setSnapshot(result.data.snapshot);
    setRefreshInProgress(Boolean(result.data.refresh_in_progress));
  }

  async function queueRefresh() {
    setRefreshInProgress(true);
    const result = await chatApi.refreshAnalyticsHubSnapshot();
    if (!result.ok) {
      setRefreshInProgress(false);
      return;
    }
    window.setTimeout(() => {
      void loadSnapshot();
    }, 1200);
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadSnapshot();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!refreshInProgress) return;
    const timerId = window.setTimeout(() => {
      void loadSnapshot();
    }, 4000);
    return () => window.clearTimeout(timerId);
  }, [refreshInProgress]);

  const filteredAccounts = useMemo(() => {
    const selectedSet = new Set(selectedAccountKeys);
    return snapshot.accounts.filter((account) => selectedSet.has(account.account_key));
  }, [selectedAccountKeys, snapshot.accounts]);

  const serviceSpendRows = useMemo(
    () =>
      aggregateServiceSpend(filteredAccounts).map((item) => [
        item.service,
        formatCurrency(item.cost),
        `${item.share}%`,
      ]),
    [filteredAccounts],
  );

  const accountSummaryRows = useMemo(
    () =>
      filteredAccounts.map((account) => [
        formatAccountLabel(account.account_key),
        account.region,
        account.project_name?.trim() || "Un tagged",
        account.project_owner?.trim() || "Un tagged",
        formatCurrency(account.total_cost_30d),
        account.service_spend_30d[0]?.service ?? "NA",
      ]),
    [filteredAccounts],
  );

  const certificateItems = useMemo(() => flattenCertificates(filteredAccounts), [filteredAccounts]);

  const certificateRows = useMemo(
    () =>
      certificateItems.map((item) => [
        formatAccountLabel(item.account_key),
        item.domain_name,
        item.expiry_date,
        <DaysLeftCell key={`${item.certificate_arn}-days`} days={item.days_to_expiry} />,
      ]),
    [certificateItems],
  );

  const certificateDiscussionRows = useMemo(
    () =>
      certificateItems.map((item) => [
        formatAccountLabel(item.account_key),
        item.domain_name,
        item.expiry_date,
        String(item.days_to_expiry),
      ]),
    [certificateItems],
  );

  const hasUrgentCertificate = useMemo(
    () => certificateItems.some((item) => item.days_to_expiry < 30),
    [certificateItems],
  );

  const totalSelectedSpend = useMemo(
    () => filteredAccounts.reduce((sum, account) => sum + account.total_cost_30d, 0),
    [filteredAccounts],
  );
  const aggregatedServiceSpend = useMemo(() => aggregateServiceSpend(filteredAccounts), [filteredAccounts]);

  const updatedLabel = refreshInProgress
    ? "Updated moments ago - Refreshing"
    : formatRelativeTime(snapshot.generated_at_utc);

  async function openTableDiscussion(title: string, headers: string[], rows: string[][]) {
    closeDiscussionTable();
    await newChat();
    openDiscussionTable({
      title,
      headers,
      rows,
      updatedAtMs: snapshot.generated_at_utc ? new Date(snapshot.generated_at_utc).getTime() : null,
    });
    openSingleView("chat");
  }

  function scrollToCertificates() {
    certificatesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeTroubleshootingModal() {
    if (troubleshootingSubmitting) return;
    setTroubleshootingOpen(false);
    setTroubleshootingError(null);
  }

  async function submitTroubleshootingContext() {
    if (troubleshootingSubmitting) return;
    if (!troubleshootingText.trim() && troubleshootingFiles.length === 0) {
      setTroubleshootingError("Enter an issue log/trace or upload an RCA/log file.");
      return;
    }

    setTroubleshootingSubmitting(true);
    setTroubleshootingError(null);
    const fileContext = await readTroubleshootingFiles(troubleshootingFiles);
    const prompt = formatTroubleshootingPrompt(troubleshootingText, fileContext);
    const chatId = await newChat();
    if (!chatId) {
      setTroubleshootingSubmitting(false);
      setTroubleshootingError("Unable to start a new chat for troubleshooting.");
      return;
    }

    setTroubleshootingOpen(false);
    setTroubleshootingText("");
    setTroubleshootingFiles([]);
    setTroubleshootingSubmitting(false);
    openSingleView("chat");
    void sendMessage(prompt);
  }

  return (
    <div className="relative h-full overflow-y-auto bg-[linear-gradient(180deg,#b6d8ff_0%,#8dbef5_34%,#79afea_65%,#8fc4fb_100%)] px-5 pb-12 pt-2 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.72),transparent_18%),radial-gradient(circle_at_22%_18%,rgba(191,219,254,0.48),transparent_22%),radial-gradient(circle_at_82%_14%,rgba(125,211,252,0.32),transparent_18%),radial-gradient(circle_at_74%_60%,rgba(255,255,255,0.2),transparent_22%),linear-gradient(180deg,#b6d8ff_0%,#8dbef5_34%,#79afea_65%,#8fc4fb_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.3),transparent_24%,rgba(255,255,255,0.12)_48%,transparent_72%,rgba(255,255,255,0.28))]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-[12%] top-[-18%] h-[32rem] rounded-full bg-white/28 blur-[120px]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-20 shrink-0 px-4 pt-4">
        <div className="flex w-full items-center justify-end gap-2 pr-2">
          {paneActions}
          {actionButton}
        </div>
      </header>

      <div className="relative mx-auto mt-2 flex min-h-full w-full max-w-7xl flex-col">
        <section className="rounded-[30px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(214,230,255,0.18))] p-5 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/60 bg-white/52 px-4 py-2 text-[11px] uppercase tracking-[0.34em] text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.55)]" />
              Analytics Hub
            </div>
            <button
              type="button"
              onClick={() => setAccountsOpen((open) => !open)}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/65 bg-white/82 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_14px_28px_rgba(148,163,184,0.18)] transition hover:bg-white sm:ml-auto"
              aria-expanded={accountsOpen}
            >
              <span>Accounts</span>
              <span className={classNames("text-slate-500 transition", accountsOpen ? "rotate-180" : "")}>v</span>
            </button>
          </div>

          {accountsOpen ? (
            <div className="mt-4 rounded-[24px] border border-white/55 bg-white/38 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Selected Accounts</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedAccountKeys.length > 0
                      ? selectedAccountKeys.map(formatAccountLabel).join(", ")
                      : "No account selected"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {availableAccountKeys.length > 0 ? (
                    availableAccountKeys.map((accountKey) => {
                      const isSelected = selectedAccountKeys.includes(accountKey);
                      return (
                        <button
                          key={accountKey}
                          type="button"
                          onClick={() => toggleAccountSelection(accountKey)}
                          className={classNames(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                            isSelected
                              ? "border-white/75 bg-white/92 text-slate-900 shadow-[0_14px_28px_rgba(255,255,255,0.3)]"
                              : "border-white/45 bg-white/30 text-slate-700 hover:bg-white/48",
                          )}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? <CheckIcon /> : null}
                          <span>{formatAccountLabel(accountKey)}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-slate-600">No accounts loaded.</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAccountsOpen(false)}
                  className="w-fit rounded-full border border-white/55 bg-white/58 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-white/76 lg:ml-2"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 max-w-4xl">
            <p className="text-balance text-2xl font-semibold leading-9 tracking-tight text-slate-950 sm:text-3xl sm:leading-10">
              Cloud optimization meets operational intelligence.
              <span className="mt-2 block text-base font-medium leading-7 text-sky-700 sm:text-lg">
                One command center for cleaner spend, faster triage, and better decisions.
              </span>
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureTabs.slice(0, 4).map((feature) => {
              const isCertificateFeature = feature.title === "Certificate Expiry Watch";
              return (
                <FeatureTab
                  key={feature.title}
                  {...feature}
                  hasAlert={isCertificateFeature && hasUrgentCertificate}
                  onClick={isCertificateFeature ? scrollToCertificates : undefined}
                />
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureTabs.slice(4).map((feature) => {
              const isTroubleshootingFeature = feature.title === "Unified Troubleshooting Chat";
              return (
                <FeatureTab
                  key={feature.title}
                  {...feature}
                  onClick={isTroubleshootingFeature ? () => setTroubleshootingOpen(true) : undefined}
                />
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <FinancialImpactCard
            rows={serviceSpendRows}
            items={aggregatedServiceSpend}
            total={totalSelectedSpend}
            updatedLabel={updatedLabel}
            view={financialImpactView}
            onViewChange={setFinancialImpactView}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Financial Impact Table",
                ["Service", "Current Spend ($)", "Share of Selected Spend"],
                serviceSpendRows,
              )
            }
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <DataCard
            title="Account Summary"
            headers={["Account", "Region", "Project Name", "Project Owner", "30d Spend", "Top Service"]}
            rows={accountSummaryRows}
            emptyText="No account summary rows are available yet."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Account Summary",
                ["Account", "Region", "Project Name", "Project Owner", "30d Spend", "Top Service"],
                accountSummaryRows,
              )
            }
          />
          <EcsInsightCard
            accounts={filteredAccounts}
            filter={ecsFilter}
            onFilterChange={setEcsFilter}
            onExpand={() => setEcsExpanded(true)}
            onNodeDetail={setEcsNodeDetail}
          />
        </section>

        <section ref={certificatesSectionRef} className="mt-6 grid scroll-mt-24 gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <DataCard
            title="ACM Certificates Expiring Soon"
            headers={["Account", "Domain", "Expiry Date", "Days Left"]}
            rows={certificateRows}
            emptyText="No ACM certificates expiring within the current snapshot window were found."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "ACM Certificates Expiring Soon",
                ["Account", "Domain", "Expiry Date", "Days Left"],
                certificateDiscussionRows,
              )
            }
          />

          <NoteCard title="Refresh Notes">
            <p>
              Chats available: <span className="font-semibold text-slate-900">{chats.length}</span>
            </p>
            <p>
              Selected accounts:{" "}
              <span className="font-semibold text-slate-900">
                {selectedAccountKeys.map(formatAccountLabel).join(", ") || "None"}
              </span>
            </p>
            <p>The Analytics Hub uses stored backend data so the page opens immediately with the latest available tables.</p>
            <p>Chat remains the default entry point, which gives the background AWS refresh time to update these modules.</p>
            <p>Every table can still be sent into a dedicated discussion flow if deeper analysis is needed.</p>
          </NoteCard>
        </section>

        {snapshot.errors.length > 0 ? (
          <section className="mt-6 rounded-[30px] border border-rose-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(254,226,226,0.24))] p-5 text-slate-900 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-[22px]">
            <div className="text-[11px] uppercase tracking-[0.28em] text-rose-600">Account Refresh Errors</div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {snapshot.errors.map((error: AnalyticsHubAccountError) => (
                <div
                  key={`${error.account_key}-${error.error}`}
                  className="rounded-[24px] border border-white/45 bg-white/42 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                >
                  <div className="font-semibold text-slate-900">{formatAccountLabel(error.account_key)}</div>
                  <div className="mt-1 text-slate-700">{error.error}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {troubleshootingOpen ? (
        <TroubleshootingModal
          issueText={troubleshootingText}
          files={troubleshootingFiles}
          isSubmitting={troubleshootingSubmitting}
          error={troubleshootingError}
          onIssueTextChange={(value) => {
            setTroubleshootingText(value);
            setTroubleshootingError(null);
          }}
          onFilesChange={(files) => {
            setTroubleshootingFiles((current) => [...current, ...files]);
            setTroubleshootingError(null);
          }}
          onRemoveFile={(index) =>
            setTroubleshootingFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
          }
          onClose={closeTroubleshootingModal}
          onSubmit={() => void submitTroubleshootingContext()}
        />
      ) : null}

      {ecsExpanded ? (
        <EcsExpandedModal
          accounts={filteredAccounts}
          filter={ecsFilter}
          onFilterChange={setEcsFilter}
          onClose={() => setEcsExpanded(false)}
          onNodeDetail={setEcsNodeDetail}
        />
      ) : null}

      {ecsNodeDetail ? <EcsNodeDetailModal detail={ecsNodeDetail} onClose={() => setEcsNodeDetail(null)} /> : null}
    </div>
  );
}
