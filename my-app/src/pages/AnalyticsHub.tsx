import { useEffect, useMemo, useState, type ReactNode } from "react";
import { chatApi } from "src/features/chat/api/chatApi";
import type {
  AnalyticsCertificateItem,
  AnalyticsHubAccountError,
  AnalyticsHubAccountSnapshot,
  AnalyticsHubSnapshot,
} from "src/features/chat/api/types";
import { useChatStore } from "src/store/chat.store";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
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

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">{label}</div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{note}</div>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  emptyText: string;
}) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur">
      <div className="text-sm font-medium uppercase tracking-[0.28em] text-white/55">{title}</div>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm text-slate-100">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
              {headers.map((header) => (
                <th key={header} className="px-3 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-b border-white/5">
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-3 py-3 align-top text-slate-200">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-3 py-6 text-slate-400">
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

export default function AnalyticsHub({ actionButton }: { actionButton: ReactNode }) {
  const chats = useChatStore((s) => s.chats);
  const availableAccountKeys = useChatStore((s) => s.availableAccountKeys);
  const selectedAccountKeys = useChatStore((s) => s.selectedAccountKeys);
  const toggleAccountSelection = useChatStore((s) => s.toggleAccountSelection);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const messagesByChatId = useChatStore((s) => s.messagesByChatId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const [snapshot, setSnapshot] = useState<AnalyticsHubSnapshot>(EMPTY_SNAPSHOT);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  const activeMessageCount = useMemo(() => {
    if (!activeChatId) return 0;
    return messagesByChatId[activeChatId]?.length ?? 0;
  }, [activeChatId, messagesByChatId]);

  async function loadSnapshot() {
    setLoadingSnapshot(true);
    const result = await chatApi.getAnalyticsHubSnapshot();
    if (!result.ok || !result.data) {
      setLoadingSnapshot(false);
      return;
    }
    setSnapshot(result.data.snapshot ?? EMPTY_SNAPSHOT);
    setRefreshInProgress(Boolean(result.data.refresh_in_progress));
    setLoadingSnapshot(false);
  }

  useEffect(() => {
    void loadSnapshot();
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

  const lastUpdatedText = snapshot.generated_at_utc
    ? new Date(snapshot.generated_at_utc).toLocaleString()
    : "No stored snapshot yet";

  return (
    <div className="relative h-full overflow-y-auto px-5 pb-8 pt-5 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_24%),linear-gradient(180deg,#0b1220_0%,#0f172a_100%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col">
        <div className="flex justify-end">{actionButton}</div>

        <section className="mt-10 rounded-[36px] border border-white/10 bg-slate-950/35 px-6 py-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:px-10 sm:py-10">
          <div className="max-w-3xl">
            <div className="text-sm uppercase tracking-[0.36em] text-cyan-200/70">Analytics Hub</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Live AWS-backed tables with a stored snapshot behind them.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Chat stays the default landing page while the backend refreshes Analytics Hub data in the background and
              stores it in the backend data folder. This page reads the latest stored snapshot every time it opens.
            </p>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="shrink-0 text-sm font-medium uppercase tracking-[0.22em] text-white/60">Accounts :</div>
              <div className="flex flex-wrap gap-3">
                {availableAccountKeys.length > 0 ? (
                  availableAccountKeys.map((accountKey) => {
                    const isSelected = selectedAccountKeys.includes(accountKey);
                    return (
                      <button
                        key={accountKey}
                        type="button"
                        onClick={() => toggleAccountSelection(accountKey)}
                        className={[
                          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                          isSelected
                            ? "border-white/70 bg-white text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.12)]"
                            : "border-white/15 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]",
                        ].join(" ")}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? <CheckIcon /> : null}
                        <span>{formatAccountLabel(accountKey)}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-400">No accounts loaded.</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Configured Accounts"
              value={String(availableAccountKeys.length)}
              note={
                availableAccountKeys.length
                  ? `${availableAccountKeys.join(", ")} available from AWS_ACCOUNT_KEYS.`
                  : "No AWS accounts are loaded yet."
              }
            />
            <MetricCard
              label="Selected Spend"
              value={formatCurrency(totalSelectedSpend)}
              note={`${filteredAccounts.length} selected account(s) in the current Analytics Hub scope.`}
            />
            <MetricCard
              label="Snapshot Status"
              value={refreshInProgress ? "Refreshing" : loadingSnapshot ? "Loading" : "Ready"}
              note={`Last updated: ${lastUpdatedText}`}
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <DataTable
            title="Financial Impact Table"
            headers={["Service", "Current Spend ($)", "Share of Selected Spend"]}
            rows={serviceSpendRows}
            emptyText="No stored service spend rows are available for the selected accounts yet."
          />

          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-cyan-400/12 via-slate-900/55 to-blue-400/12 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="text-sm font-medium uppercase tracking-[0.28em] text-white/55">Snapshot Summary</div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <p>Chats available: <span className="font-semibold text-white">{chats.length}</span></p>
              <p>Current mode: <span className="font-semibold text-white">{isStreaming ? "Streaming response" : "Ready for a new question"}</span></p>
              <p>Active chat messages: <span className="font-semibold text-white">{activeMessageCount}</span></p>
              <p>Selected accounts: <span className="font-semibold text-white">{selectedAccountKeys.map(formatAccountLabel).join(", ") || "None"}</span></p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <DataTable
            title="Account Summary"
            headers={["Account", "Region", "30d Spend", "Top Service"]}
            rows={accountSummaryRows}
            emptyText="No account summary rows are available yet."
          />
          <DataTable
            title="Monthly Spend Trend"
            headers={["Month", "Spend ($)"]}
            rows={monthlyTrendRows}
            emptyText="No monthly spend trend rows are available yet."
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <DataTable
            title="ACM Certificates Expiring Soon"
            headers={["Account", "Domain", "Expiry Date", "Days Left"]}
            rows={certificateRows}
            emptyText="No ACM certificates expiring within the current snapshot window were found."
          />

          <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur">
            <div className="text-sm font-medium uppercase tracking-[0.28em] text-white/55">Refresh Notes</div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <p>The backend stores Analytics Hub data in the backend data folder so the page can open immediately.</p>
              <p>Chat is the default landing page, and the app queues a live AWS refresh when that page loads.</p>
              <p>Tables currently use AWS Cost Explorer and ACM-backed data pulled with your configured account credentials.</p>
            </div>
          </div>
        </section>

        {snapshot.errors.length > 0 ? (
          <section className="mt-6 rounded-[28px] border border-amber-300/20 bg-amber-300/8 p-5">
            <div className="text-sm font-medium uppercase tracking-[0.22em] text-amber-100">Account Refresh Errors</div>
            <div className="mt-4 space-y-3 text-sm text-amber-50/90">
              {snapshot.errors.map((error: AnalyticsHubAccountError) => (
                <div key={`${error.account_key}-${error.error}`} className="rounded-2xl border border-amber-200/10 bg-black/10 px-4 py-3">
                  <div className="font-medium">{formatAccountLabel(error.account_key)}</div>
                  <div className="mt-1 text-amber-50/80">{error.error}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
