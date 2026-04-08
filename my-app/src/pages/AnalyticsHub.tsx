import { useEffect, useMemo, useState, type ReactNode } from "react";
import { chatApi } from "src/features/chat/api/chatApi";
import type {
  AnalyticsCertificateItem,
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

function PulseOrb({ tone }: { tone: "blue" | "mint" | "violet" }) {
  const toneClass =
    tone === "blue"
      ? "from-sky-200/90 via-white/90 to-sky-100/75 shadow-[0_12px_32px_rgba(56,189,248,0.22)]"
      : tone === "mint"
        ? "from-emerald-200/90 via-white/90 to-cyan-100/70 shadow-[0_12px_32px_rgba(45,212,191,0.22)]"
        : "from-indigo-200/90 via-white/90 to-fuchsia-100/70 shadow-[0_12px_32px_rgba(129,140,248,0.24)]";

  return (
    <div
      className={[
        "relative h-12 w-12 rounded-full bg-gradient-to-br",
        toneClass,
        "ring-1 ring-white/70",
      ].join(" ")}
      aria-hidden="true"
    >
      <div className="absolute inset-1 rounded-full border border-white/65 bg-white/35 backdrop-blur-md" />
      <div className="absolute left-2 top-1.5 h-3 w-6 rounded-full bg-white/65 blur-[2px]" />
    </div>
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
  "inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-700 shadow-[0_10px_22px_rgba(148,163,184,0.14)] transition hover:bg-white/68";

function MetricCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "blue" | "mint" | "violet";
}) {
  return (
    <div className={classNames(glassPanelClass, "p-5 text-slate-900")}>
      <div className="absolute inset-x-5 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">{label}</div>
          <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">{value}</div>
          <div className="mt-3 max-w-[16rem] text-sm leading-6 text-slate-600">{note}</div>
        </div>
        <PulseOrb tone={tone} />
      </div>
    </div>
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
}: {
  title: string;
  headers: string[];
  rows: string[][];
  emptyText: string;
  updatedLabel: string;
  onRefresh: () => void;
  onDiscuss: () => void;
}) {
  return (
    <div className={classNames(glassPanelClass, "p-6 text-slate-900")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">{title}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>{updatedLabel}</span>
            <button type="button" onClick={onRefresh} className={glassButtonClass}>
              <RefreshIcon />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDiscuss}
          className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(231,239,255,0.44))] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_16px_30px_rgba(148,163,184,0.12)] transition hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(231,239,255,0.54))]"
        >
          <ChatIcon />
          <span>Discuss</span>
        </button>
      </div>

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
    </div>
  );
}

function FinancialImpactPieCard({
  items,
  total,
}: {
  items: Array<{ service: string; cost: number; share: string }>;
  total: number;
}) {
  const chartItems = items.slice(0, 6);
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const palette = [
    "#38bdf8",
    "#34d399",
    "#818cf8",
    "#f59e0b",
    "#fb7185",
    "#a78bfa",
  ];
  const chartSegments = chartItems.reduce<
    Array<{
      service: string;
      color: string;
      dashArray: string;
      dashOffset: number;
      endFraction: number;
    }>
  >((segments, item, index) => {
    const startFraction = segments.length > 0 ? segments[segments.length - 1].endFraction : 0;
    const fraction = total > 0 ? item.cost / total : 0;
    return [
      ...segments,
      {
        service: item.service,
        color: palette[index % palette.length],
        dashArray: `${circumference * fraction} ${circumference}`,
        dashOffset: circumference * (1 - startFraction),
        endFraction: startFraction + fraction,
      },
    ];
  }, []);

  return (
    <div className={classNames(glassPanelClass, "p-6 text-slate-900")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Spend Distribution</div>
      <div className="mt-5 flex flex-col items-center gap-6 lg:flex-row lg:items-center">
        <div className="relative flex h-[220px] w-[220px] items-center justify-center">
          <svg viewBox="0 0 220 220" className="h-[220px] w-[220px] -rotate-90" aria-hidden="true">
            <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="28" />
            {chartSegments.map((segment) => (
              <circle
                key={segment.service}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="28"
                strokeLinecap="round"
                strokeDasharray={segment.dashArray}
                strokeDashoffset={segment.dashOffset}
              />
            ))}
          </svg>

          <div className="absolute inset-[45px] rounded-full border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(219,234,254,0.34))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl" />
          <div className="absolute text-center">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Selected Spend</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {formatCurrency(total)}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {chartItems.length > 0 ? (
            chartItems.map((item, index) => (
              <div
                key={item.service}
                className="flex items-center justify-between gap-3 rounded-[22px] border border-white/55 bg-white/34 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/70"
                    style={{ backgroundColor: palette[index % palette.length] }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-slate-800">{item.service}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-slate-900">{item.share}%</div>
                  <div className="text-xs text-slate-500">{formatCurrency(item.cost)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-white/55 bg-white/34 px-4 py-6 text-sm text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              No spend data is available yet for the selected accounts.
            </div>
          )}
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

function aggregateMonthlyTrend(accounts: AnalyticsHubAccountSnapshot[]) {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    for (const item of account.monthly_cost_trend) {
      totals.set(item.month, (totals.get(item.month) ?? 0) + item.cost);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, cost]) => ({ month, cost }));
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
  const activeChatId = useChatStore((s) => s.activeChatId);
  const messagesByChatId = useChatStore((s) => s.messagesByChatId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const newChat = useChatStore((s) => s.newChat);
  const openSingleView = useUiStore((s) => s.openSingleView);
  const openDiscussionTable = useUiStore((s) => s.openDiscussionTable);
  const closeDiscussionTable = useUiStore((s) => s.closeDiscussionTable);
  const [snapshot, setSnapshot] = useState<AnalyticsHubSnapshot>(EMPTY_SNAPSHOT);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  const activeMessageCount = useMemo(() => {
    if (!activeChatId) return 0;
    return messagesByChatId[activeChatId]?.length ?? 0;
  }, [activeChatId, messagesByChatId]);

  async function loadSnapshot(showLoading = true) {
    if (showLoading) {
      setLoadingSnapshot(true);
    }
    const result = await chatApi.getAnalyticsHubSnapshot();
    if (!result.ok || !result.data) {
      setLoadingSnapshot(false);
      return;
    }
    setSnapshot(result.data.snapshot ?? EMPTY_SNAPSHOT);
    setRefreshInProgress(Boolean(result.data.refresh_in_progress));
    setLoadingSnapshot(false);
  }

  async function queueRefresh() {
    setRefreshInProgress(true);
    await chatApi.refreshAnalyticsHubSnapshot();
    window.setTimeout(() => {
      void loadSnapshot();
    }, 1200);
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadSnapshot(false);
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

  const monthlyTrendRows = useMemo(
    () =>
      aggregateMonthlyTrend(filteredAccounts).map((item) => [item.month, formatCurrency(item.cost)]),
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

  const certificateRows = useMemo(
    () =>
      flattenCertificates(filteredAccounts).map((item) => [
        formatAccountLabel(item.account_key),
        item.domain_name,
        item.expiry_date,
        String(item.days_to_expiry),
      ]),
    [filteredAccounts],
  );

  const totalSelectedSpend = useMemo(
    () => filteredAccounts.reduce((sum, account) => sum + account.total_cost_30d, 0),
    [filteredAccounts],
  );
  const aggregatedServiceSpend = useMemo(() => aggregateServiceSpend(filteredAccounts), [filteredAccounts]);

  const updatedLabel = refreshInProgress
    ? "Updated moments ago • Refreshing"
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

  const snapshotStatus = refreshInProgress ? "Refreshing" : loadingSnapshot ? "Loading" : "Ready";

  return (
    <div className="relative h-full overflow-y-auto px-5 pb-12 pt-5 sm:px-8">
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

      <div className="relative mx-auto flex min-h-full w-full max-w-7xl flex-col">
        <div className="sticky top-4 z-20 flex justify-end gap-2 pb-4">
          {paneActions}
          {actionButton}
        </div>

        <section className={classNames(glassPanelClass, "px-6 py-8 text-slate-900 sm:px-8 sm:py-9")}>
          <div className="absolute inset-x-8 top-0 h-px bg-white/75" aria-hidden="true" />
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="rounded-[30px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(214,230,255,0.18))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/52 px-4 py-2 text-[11px] uppercase tracking-[0.34em] text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.55)]" />
                Analytics Hub
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
                <div className="max-w-3xl">
                  <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                    A softer glass dashboard for AWS signals, while chat stays focused on conversation.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
                    The hub now carries a distinct dashboard personality: brighter translucency, floating modules, and
                    faster table scanning, while chat remains the darker operational workspace.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 self-start">
                  <div className="rounded-[24px] border border-white/55 bg-white/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <PulseOrb tone="blue" />
                  </div>
                  <div className="rounded-[24px] border border-white/55 bg-white/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <PulseOrb tone="mint" />
                  </div>
                  <div className="rounded-[24px] border border-white/55 bg-white/42 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <PulseOrb tone="violet" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[30px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.44),rgba(219,234,254,0.2))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Snapshot</div>
                <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{snapshotStatus}</div>
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  {snapshot.generated_at_utc ? new Date(snapshot.generated_at_utc).toLocaleString() : "No stored snapshot yet"}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.44),rgba(219,234,254,0.2))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Interaction Mode</div>
                <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                  {isStreaming ? "Live" : "Ready"}
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  {activeMessageCount} chat message(s) are available for discussion from the current workspace.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[30px] border border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(219,234,254,0.18))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Accounts</div>
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
                            ? "border-white/70 bg-white/88 text-slate-900 shadow-[0_14px_28px_rgba(255,255,255,0.3)]"
                            : "border-white/45 bg-white/35 text-slate-700 hover:bg-white/48",
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
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Configured Accounts"
              value={String(availableAccountKeys.length)}
              note={
                availableAccountKeys.length
                  ? `${availableAccountKeys.join(", ")} available from AWS_ACCOUNT_KEYS.`
                  : "No AWS accounts are loaded yet."
              }
              tone="blue"
            />
            <MetricCard
              label="Selected Spend"
              value={formatCurrency(totalSelectedSpend)}
              note={`${filteredAccounts.length} selected account(s) are currently represented in the hub.`}
              tone="mint"
            />
            <MetricCard
              label="Snapshot Health"
              value={refreshInProgress ? "Live" : loadingSnapshot ? "Syncing" : "Stable"}
              note={`Chats in workspace: ${chats.length}. Current mode: ${isStreaming ? "Streaming" : "Ready"}.`}
              tone="violet"
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <DataCard
            title="Financial Impact Table"
            headers={["Service", "Current Spend ($)", "Share of Selected Spend"]}
            rows={serviceSpendRows}
            emptyText="No stored service spend rows are available for the selected accounts yet."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Financial Impact Table",
                ["Service", "Current Spend ($)", "Share of Selected Spend"],
                serviceSpendRows,
              )
            }
          />
          <FinancialImpactPieCard items={aggregatedServiceSpend} total={totalSelectedSpend} />
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
          <DataCard
            title="Monthly Spend Trend"
            headers={["Month", "Spend ($)"]}
            rows={monthlyTrendRows}
            emptyText="No monthly spend trend rows are available yet."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() => void openTableDiscussion("Monthly Spend Trend", ["Month", "Spend ($)"], monthlyTrendRows)}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
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
                certificateRows,
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
    </div>
  );
}
