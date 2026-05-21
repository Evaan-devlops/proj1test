import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { chatApi } from "src/features/chat/api/chatApi";
import type {
  AnalyticsCertificateItem,
  AnalyticsEcsClusterItem,
  AnalyticsEcsServiceItem,
  AnalyticsEcsTaskItem,
  AnalyticsHubAccountError,
  AnalyticsHubAccountSnapshot,
  AnalyticsHubSnapshot,
  AnalyticsHubStorageStatus,
  AnalyticsUtilizationResourceItem,
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

function StatusPulseIcon({ active }: { active: boolean }) {
  return (
    <span
      className={classNames(
        "h-2.5 w-2.5 rounded-full",
        active
          ? "animate-pulse bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.72)]"
          : "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.52)]",
      )}
      aria-hidden="true"
    />
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
  type: "idle" | "certificate" | "utilization" | "recommendation" | "chat" | "priority" | "financial" | "ecs";
}) {
  const paths = {
    idle: "M7 18a4 4 0 0 1-.72-7.94A6 6 0 0 1 17.78 8.7 4.5 4.5 0 0 1 18 18H7z",
    certificate:
      "M12 3l7 3v5.2c0 4.1-2.7 7.9-7 9.8-4.3-1.9-7-5.7-7-9.8V6l7-3zm0 3.1-4 1.7v3.4c0 2.8 1.5 5.5 4 7 2.5-1.5 4-4.2 4-7V7.8l-4-1.7z",
    utilization: "M5 19V9h3v10H5zm5 0V5h3v14h-3zm5 0v-7h3v7h-3z",
    recommendation:
      "M12 3a6 6 0 0 1 3.6 10.8c-.7.5-1.1 1.2-1.1 2V16h-5v-.2c0-.8-.4-1.5-1.1-2A6 6 0 0 1 12 3zm-2.5 15h5v2h-5v-2z",
    chat: "M5 5h14v9H9l-4 4V5zm4 3v2h6V8H9zm0 3v2h4v-2H9z",
    priority: "M5 4l2 1h10v9H8l-3-1v7H3V4h2z",
    financial: "M4 18h16v2H4v-2zm2-2V8h3v8H6zm5 0V4h3v12h-3zm5 0v-6h3v6h-3z",
    ecs: "M12 3l7 4v10l-7 4-7-4V7l7-4zm0 2.3L7 8.1v5.8l5 2.8 5-2.8V8.1l-5-2.8z",
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
  "relative overflow-hidden rounded-[24px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(226,238,255,0.34))] shadow-[0_22px_70px_rgba(15,23,42,0.13)] backdrop-blur-[22px]";

const glassButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-white/55 text-slate-700 shadow-[0_10px_22px_rgba(148,163,184,0.14)] transition hover:bg-white/68 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500";

const featureTabs = [
  {
    title: "Certificate Expiry Watch",
    description: "Track expiring certificates and act before service disruption.",
    icon: "certificate",
  },
  {
    title: "Utilization Insights",
    description: "Review underused and overused resources from AWS signals.",
    icon: "utilization",
  },
  {
    title: "Idle Resource Detector",
    description: "Stop cloud waste before it impacts your budget.",
    icon: "idle",
  },
  {
    title: "Financial Impact",
    description: "Open selected spend drivers and service cost concentration.",
    icon: "financial",
  },
  {
    title: "ECS Health",
    description: "Inspect ECS clusters, services, tasks, and account context.",
    icon: "ecs",
  },
  {
    title: "Priority Action Queue",
    description: "Work the highest-risk findings first with evidence and actions.",
    icon: "priority",
  },
  {
    title: "Proactive Recommendations",
    description: "Review optimization opportunities from current signals.",
    icon: "recommendation",
  },
  {
    title: "Unified Troubleshooting",
    description: "Ask questions, review logs, and get answers in one place.",
    icon: "chat",
  },
] as const;

const cloudVendors = [
  { key: "aws", label: "AWS", enabled: true },
  { key: "azure", label: "Azure", enabled: false },
  { key: "gcp", label: "GCP", enabled: false },
] as const;

const TRACKED_UTILIZATION_STORAGE_KEY = "analytics_hub_tracked_utilization_resources_v1";
const DEFAULT_TRACKED_UTILIZATION_COUNT = 4;

const knowMePositioning =
  "Your AWS operations co-pilot - watching connected accounts, explaining what matters, ranking risks by business impact, and guiding safe, approved fixes.";

const guideHighlights = {
  why: [
    {
      title: "See what needs attention first",
      body: "I bring cost, certificates, idle resources, ECS health, and utilization signals into one operations view so you do not have to jump across AWS pages.",
    },
    {
      title: "Understand business impact",
      body: "I rank findings by urgency, cost impact, expiry risk, and resource health so you know what to fix first.",
    },
    {
      title: "Move from data to action",
      body: "Every important signal can be discussed, explained, and turned into a practical next step.",
    },
    {
      title: "Stay safer while acting",
      body: "Risky fixes should be reviewed and approved before execution. The assistant should guide actions, not blindly perform them.",
    },
  ],
  suggestions: [
    {
      title: "Fix urgent expiry risks",
      body: "Review certificates that are close to expiry and understand which services may be affected.",
    },
    {
      title: "Reduce cloud waste",
      body: "Find idle and underused resources that may be safe to stop, resize, or review.",
    },
    {
      title: "Catch performance pressure",
      body: "Spot overused or underprovisioned resources before they become incidents.",
    },
    {
      title: "Investigate cost drivers",
      body: "See which services and accounts are driving spend, then discuss the reason with the assistant.",
    },
    {
      title: "Review ECS health",
      body: "Inspect clusters, services, tasks, and related utilization signals from one place.",
    },
  ],
  identity: [
    {
      title: "Operations cockpit",
      body: "A single place for account health, cost, utilization, certificates, idle resources, and ECS context.",
    },
    {
      title: "Troubleshooting workspace",
      body: "Upload logs, traces, or RCA notes and continue the investigation in chat.",
    },
    {
      title: "Decision assistant",
      body: "I help convert AWS signals into impact, evidence, and next steps.",
    },
  ],
  help: [
    {
      title: "Connect accounts",
      body: "The app reads configured AWS accounts and prepares account-aware insights.",
    },
    {
      title: "Collect signals",
      body: "It gathers cost, certificates, utilization, idle resources, ECS, and account health data.",
    },
    {
      title: "Rank what matters",
      body: "Findings are grouped and prioritized by risk, business impact, urgency, and savings.",
    },
    {
      title: "Discuss with context",
      body: "Send any row, table, or finding into chat so the assistant already knows what you are asking about.",
    },
    {
      title: "Act safely",
      body: "Use recommendations and action plans to review what to do next before applying changes.",
    },
  ],
} as const;

const guideSteps = [
  {
    title: "Select accounts",
    tag: "Accounts",
    body: "Choose the AWS accounts you want to inspect.",
    action: "Open account management and select the connected accounts for this review.",
  },
  {
    title: "Refresh key signals",
    tag: "Signals",
    body: "Start with Financial Impact, Certificates, Utilization, and Idle Resources.",
    action: "Refresh the table that matters for your current investigation.",
  },
  {
    title: "Open Priority Action Queue",
    tag: "Priority",
    body: "Review the highest-risk findings first.",
    action: "Use the queue to compare impact, evidence, and recommended action.",
  },
  {
    title: "Discuss a finding",
    tag: "Chat",
    body: "Send any row into chat for explanation, RCA, or cleanup planning.",
    action: "Use Discuss on certificates, utilization, ECS, financial impact, or idle resources.",
  },
  {
    title: "Use Unified Troubleshooting",
    tag: "Troubleshoot",
    body: "Paste logs, traces, or RCA notes to start an issue-focused chat.",
    action: "Start troubleshooting when you have incident context that needs structured analysis.",
  },
] as const;

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3a7 7 0 0 0-4 12.74V18h8v-2.26A7 7 0 0 0 12 3zm-2 17h4v2h-4v-2zm2-15a5 5 0 0 1 2.86 9.1l-.86.6V16h-4v-1.3l-.86-.6A5 5 0 0 1 12 5z"
      />
    </svg>
  );
}

function GuideDock({
  open,
  onToggle,
  onStartTour,
  onAccounts,
  onUtilization,
  onPriority,
  onCertificates,
  onFinancial,
  onTroubleshooting,
}: {
  open: boolean;
  onToggle: () => void;
  onStartTour: () => void;
  onAccounts: () => void;
  onUtilization: () => void;
  onPriority: () => void;
  onCertificates: () => void;
  onFinancial: () => void;
  onTroubleshooting: () => void;
}) {
  const [activeTopic, setActiveTopic] = useState<"why" | "suggest" | "iam" | "help" | "tour">("why");
  const tabs = [
    ["why", "Why use me"],
    ["suggest", "What I suggest"],
    ["iam", "What I am"],
    ["help", "How I help"],
    ["tour", "Quick tour"],
  ] as const;
  const currentCards =
    activeTopic === "why"
      ? guideHighlights.why
      : activeTopic === "suggest"
        ? guideHighlights.suggestions
        : activeTopic === "iam"
          ? guideHighlights.identity
          : activeTopic === "help"
            ? guideHighlights.help
            : guideSteps;

  return (
    <aside className="fixed left-3 top-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-start gap-3 sm:left-5 sm:top-5">
      <button
        type="button"
        onClick={onToggle}
        className="guide-glow inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/70 bg-slate-950/82 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_rgba(15,23,42,0.28)] backdrop-blur-md transition hover:bg-slate-900 sm:min-h-12 sm:py-3"
        aria-expanded={open}
      >
        <GuideIcon />
        <span>Know Me</span>
      </button>

      {open ? (
        <div className="guide-slide-in flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-6.5rem)] flex-col gap-3 overflow-y-auto rounded-[26px] border border-white/65 bg-[linear-gradient(135deg,rgba(245,251,255,0.98),rgba(218,235,255,0.94))] p-3 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.24)] backdrop-blur-[24px] sm:max-w-[48rem]">
          <div className="flex items-start justify-between gap-3 rounded-[22px] border border-white/65 bg-white/54 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Know Me</div>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-900">{knowMePositioning}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">One place to watch AWS risks, understand impact, and act safely.</p>
            </div>
            <button type="button" onClick={onToggle} className={glassButtonClass} aria-label="Close Know Me guide" title="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onMouseEnter={() => setActiveTopic(key)}
                onFocus={() => setActiveTopic(key)}
                onClick={() => setActiveTopic(key)}
                className={classNames(
                  "rounded-full border px-3.5 py-2 text-xs font-semibold transition sm:px-4",
                  activeTopic === key
                    ? "border-sky-300/70 bg-sky-600 text-white shadow-[0_12px_26px_rgba(2,132,199,0.18)]"
                    : "border-white/70 bg-white/62 text-slate-700 hover:bg-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="guide-popover guide-shine relative overflow-hidden rounded-[24px] border border-white/65 bg-[linear-gradient(135deg,rgba(2,132,199,0.96),rgba(15,23,42,0.92))] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
            <div className="relative">
              {activeTopic === "iam" ? (
                <p className="rounded-2xl border border-white/16 bg-white/10 px-3 py-2 text-sm leading-6 text-sky-50/95">
                  I am your AWS operations co-pilot. I watch connected AWS accounts, organize operational signals,
                  explain what matters, and help you move from findings to safer actions.
                </p>
              ) : null}
              <div className={classNames("grid gap-2 text-xs leading-5 text-sky-50/90", activeTopic === "tour" ? "mt-0" : "mt-3", "sm:grid-cols-2")}>
                {currentCards.map((item, index) => (
                  <div key={item.title} className="rounded-2xl border border-white/16 bg-white/10 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      {activeTopic === "tour" ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-sky-800">{index + 1}</span> : null}
                      <span>{item.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-sky-50/86">{item.body}</p>
                  </div>
                ))}
              </div>
              {activeTopic === "suggest" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={onPriority} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
                    View priority queue
                  </button>
                  <button type="button" onClick={onUtilization} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Check utilization
                  </button>
                  <button type="button" onClick={onCertificates} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Review certificates
                  </button>
                  <button type="button" onClick={onFinancial} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Open financial impact
                  </button>
                </div>
              ) : null}
              {activeTopic === "tour" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={onAccounts} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
                    Manage accounts
                  </button>
                  <button type="button" onClick={onPriority} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Open priority queue
                  </button>
                  <button type="button" onClick={onTroubleshooting} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Start troubleshooting
                  </button>
                  <button type="button" onClick={onStartTour} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Open guided walkthrough
                  </button>
                </div>
              ) : null}
              {activeTopic === "help" ? (
                <div className="mt-3 rounded-2xl border border-white/16 bg-white/10 px-3 py-2 text-xs leading-5 text-sky-50/84">
                  Local storage is embedded with the app. No external database server is required.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function GuideTourModal({
  stepIndex,
  onStepIndexChange,
  onClose,
  onAccounts,
  onIdle,
  onUtilization,
  onPriority,
  onTroubleshooting,
}: {
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  onClose: () => void;
  onAccounts: () => void;
  onIdle: () => void;
  onUtilization: () => void;
  onPriority: () => void;
  onTroubleshooting: () => void;
}) {
  const currentStep = guideSteps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / guideSteps.length) * 100);

  function move(offset: number) {
    onStepIndexChange((stepIndex + offset + guideSteps.length) % guideSteps.length);
  }

  function runStepAction() {
    if (currentStep.tag === "Accounts") onAccounts();
    else if (currentStep.tag === "Signals") onUtilization();
    else if (currentStep.tag === "Priority") onPriority();
    else if (currentStep.tag === "Troubleshoot") onTroubleshooting();
    else if (currentStep.tag === "Chat") onIdle();
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/48 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="guide-slide-in max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-[26px] border border-white/65 bg-[linear-gradient(180deg,rgba(246,251,255,0.98),rgba(213,232,255,0.96))] text-slate-900 shadow-[0_36px_96px_rgba(15,23,42,0.34)] sm:max-h-[calc(100vh-3rem)] sm:rounded-[32px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid xl:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[15rem] overflow-hidden bg-[linear-gradient(150deg,rgba(14,116,144,0.94),rgba(2,132,199,0.78),rgba(15,23,42,0.9))] p-4 text-white sm:min-h-[18rem] sm:p-6 xl:min-h-full">
            <div className="absolute inset-0 opacity-28 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:34px_34px]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs">
                <GuideIcon />
                Quick tour
              </div>
              <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:mt-5 sm:text-3xl">Start from what matters</h2>
              <p className="mt-3 text-xs leading-6 text-sky-50/88 sm:mt-4 sm:text-sm sm:leading-7">
                Choose accounts, review priority issues, discuss findings with context, and use troubleshooting when
                logs or RCA notes need a focused workspace.
              </p>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-1.5 sm:mt-8 sm:grid-cols-6 sm:gap-2">
              {guideSteps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => onStepIndexChange(index)}
                  className={classNames(
                    "group flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center transition sm:gap-2 sm:px-2 sm:py-3",
                    index === stepIndex ? "border-white bg-white/24" : "border-white/18 bg-white/8 hover:bg-white/14",
                  )}
                  aria-label={`Go to ${step.title}`}
                >
                  <span className={classNames("grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold sm:h-8 sm:w-8 sm:text-xs", index === stepIndex ? "bg-white text-sky-800" : "bg-white/14 text-white")}>
                    {index + 1}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">{step.tag}</span>
                </button>
              ))}
            </div>
            <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/16 sm:mt-7">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Step {stepIndex + 1} of {guideSteps.length}
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:mt-3 sm:text-2xl">{currentStep.title}</h3>
              </div>
              <button type="button" onClick={onClose} className={glassButtonClass} aria-label="Close guide tour" title="Close">
                <CloseIcon />
              </button>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/65 bg-white/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] sm:mt-6 sm:rounded-[26px] sm:p-5">
              <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 sm:text-xs">
                {currentStep.tag}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700 sm:mt-4 sm:text-base sm:leading-8">{currentStep.body}</p>
              <div className="mt-4 rounded-[18px] border border-sky-100 bg-sky-50/80 px-4 py-3 text-xs font-medium leading-5 text-sky-900 sm:mt-5 sm:rounded-[20px] sm:text-sm sm:leading-6">
                {currentStep.action}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/65 bg-white/38 p-4 sm:mt-5 sm:rounded-[24px]">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Showcase actions</div>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-700 sm:text-sm sm:leading-6 xl:grid-cols-2">
                {guideHighlights.suggestions.map((suggestion) => (
                  <li key={suggestion.title} className="flex gap-2">
                    <CheckIcon />
                    <span>{suggestion.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button type="button" onClick={() => move(-1)} className="rounded-full border border-white/70 bg-white/62 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white">
                  Back
                </button>
                <button type="button" onClick={() => move(1)} className="rounded-full border border-white/70 bg-white/62 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white">
                  Next
                </button>
              </div>
              <button type="button" onClick={runStepAction} className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(2,132,199,0.18)] transition hover:bg-sky-700">
                Try this step
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureTab({
  title,
  description,
  icon,
  hasAlert = false,
  onClick,
  children,
}: {
  title: string;
  description: string;
  icon: (typeof featureTabs)[number]["icon"];
  hasAlert?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[8.75rem] flex-col items-start justify-between rounded-[18px] border border-white/65 bg-white/54 px-4 py-4 text-left text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_12px_32px_rgba(30,64,175,0.07)] transition hover:-translate-y-0.5 hover:border-white/90 hover:bg-white/72 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_42px_rgba(30,64,175,0.11)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      aria-label={`${title}: ${description}`}
    >
      <span className="flex w-full items-start justify-between gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/70 bg-sky-50 text-sky-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
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
      <span className="mt-4 block">
        <span className="block text-base font-semibold leading-6 text-slate-900 group-hover:text-sky-800">
          {title}
        </span>
        <span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span>
        {children ? <span className="mt-4 block w-full">{children}</span> : null}
      </span>
    </button>
  );
}

function SummaryMetric({
  label,
  value,
  helper,
  tone = "sky",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "sky" | "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClass = {
    sky: "border-sky-100 bg-sky-50/78 text-sky-900",
    emerald: "border-emerald-100 bg-emerald-50/78 text-emerald-900",
    amber: "border-amber-100 bg-amber-50/82 text-amber-950",
    rose: "border-rose-100 bg-rose-50/80 text-rose-950",
    slate: "border-slate-200 bg-white/62 text-slate-900",
  }[tone];

  return (
    <div className={classNames("rounded-[18px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]", toneClass)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-2 text-xs leading-5 opacity-75">{helper}</div>
    </div>
  );
}

function RefreshStatusStrip({
  refreshInProgress,
  refreshingTableKey,
  updatedLabel,
  accountCount,
  selectedAccountCount,
  storageStatus,
}: {
  refreshInProgress: boolean;
  refreshingTableKey: string | null;
  updatedLabel: string;
  accountCount: number;
  selectedAccountCount: number;
  storageStatus: AnalyticsHubStorageStatus | null;
}) {
  const dbReady = Boolean(storageStatus?.sqlite_enabled && storageStatus.db_exists && storageStatus.db_connected !== false);
  const activeStorageLabel = storageStatus?.active_storage_source === "sqlite" ? "SQLite primary" : "JSONL fallback";
  const accountRows = storageStatus?.table_counts.aws_accounts ?? 0;
  const findingRows =
    (storageStatus?.table_counts.priority_findings ?? 0) +
    (storageStatus?.table_counts.utilization_findings ?? 0) +
    (storageStatus?.table_counts.certificates ?? 0) +
    (storageStatus?.table_counts.idle_resources ?? 0);
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition hover:bg-white">
        <StatusPulseIcon active={refreshInProgress} />
        <span>Status</span>
        <span className={classNames("h-1.5 w-1.5 rounded-full", dbReady ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-[18px] border border-white/70 bg-white/95 p-3 text-xs leading-5 text-slate-700 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur-md">
        <div className="font-semibold text-slate-950">
          {refreshInProgress ? `Refreshing ${refreshingTableKey ?? "data"}` : "Cache ready"}
        </div>
        <div className="mt-1">{updatedLabel}</div>
        <div className="mt-1">{selectedAccountCount} selected of {accountCount} connected</div>
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-emerald-900">
          <div className="font-semibold">{dbReady ? "Embedded DB connected" : "Embedded DB fallback active"}</div>
          <div className="mt-1">{activeStorageLabel} / {accountRows} account row{accountRows === 1 ? "" : "s"} / {findingRows} signal row{findingRows === 1 ? "" : "s"}</div>
          <div className="mt-1 text-emerald-800/80">No DB server or DB restart needed. Copy `backend/data` with the code.</div>
        </div>
      </div>
    </details>
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
    <div className={classNames(glassPanelClass, "p-5 text-slate-900 sm:p-6")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4 border-b border-white/45 pb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">{title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-white/60 bg-white/48 px-2.5 py-1">{updatedLabel}</span>
            <button type="button" onClick={onRefresh} className={glassButtonClass} aria-label={`Refresh ${title}`} title="Refresh">
              <RefreshIcon />
            </button>
            {controls}
          </div>
        </div>

        <button
          type="button"
          onClick={onDiscuss}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-700 shadow-[0_12px_26px_rgba(148,163,184,0.12)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          aria-label={`Discuss ${title}`}
          title="Discuss"
        >
          <ChatIcon />
        </button>
      </div>

      {children ?? (
        <DataTable title={title} headers={headers} rows={rows} emptyText={emptyText} />
      )}
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
  rows: ReactNode[][];
  emptyText: string;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-[18px] border border-white/60 bg-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <table className="min-w-full border-collapse text-sm text-slate-800">
        <thead>
          <tr className="border-b border-slate-300/35 bg-white/38 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
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
                className="border-b border-slate-200/45 transition hover:bg-sky-50/46 last:border-b-0"
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
  );
}

function FinancialImpactBarChart({
  items,
  total,
}: {
  items: Array<{ service: string; cost: number; share: string }>;
  total: number;
}) {
  const chartItems = items;
  const maxCost = Math.max(...chartItems.map((item) => item.cost), 0);
  const rankPalette = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#64748b"];

  return (
    <div className="mt-5 rounded-[28px] border border-white/55 bg-white/36 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">Selected spend</div>
        <div className="text-sm font-semibold text-slate-950">{formatCurrency(total)}</div>
      </div>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
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

function FinancialImpactCard({
  rows,
  items,
  total,
  topAccountLabel,
  possibleSaving,
  accountKeys,
  selectedAccountKeys,
  updatedLabel,
  view,
  onViewChange,
  onToggleAccount,
  onRefresh,
  onDiscuss,
  onExplainSpend,
  onFindWaste,
  onShowHighestCost,
}: {
  rows: ReactNode[][];
  items: Array<{ service: string; cost: number; share: string }>;
  total: number;
  topAccountLabel: string;
  possibleSaving: number;
  accountKeys: string[];
  selectedAccountKeys: string[];
  updatedLabel: string;
  view: "table" | "bar";
  onViewChange: (view: "table" | "bar") => void;
  onToggleAccount: (accountKey: string) => void;
  onRefresh: () => void;
  onDiscuss: () => void;
  onExplainSpend: () => void;
  onFindWaste: () => void;
  onShowHighestCost: () => void;
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
  const selectedSet = new Set(selectedAccountKeys);
  const topService = items[0];
  const concentrationWarning = topService && Number(topService.share) >= 45;

  return (
    <DataCard
      title="Financial Impact / Cost Driver Assistant"
      headers={["Service", "Current Spend ($)", "Share of Selected Spend"]}
      rows={view === "table" ? rows : []}
      emptyText="No stored service spend rows are available for the selected accounts yet."
      updatedLabel={updatedLabel}
      onRefresh={onRefresh}
      onDiscuss={onDiscuss}
      controls={controls}
    >
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric label="30d spend" value={formatCurrency(total)} helper="Selected accounts" tone="sky" />
        <SummaryMetric label="Top service" value={topService?.service ?? "None"} helper={topService ? formatCurrency(topService.cost) : "No spend rows"} tone="amber" />
        <SummaryMetric label="Top account" value={topAccountLabel} helper="Highest selected spend" tone="emerald" />
        <SummaryMetric label="Possible saving" value={formatCurrency(possibleSaving)} helper="Idle resource estimate" tone={possibleSaving > 0 ? "emerald" : "slate"} />
        <SummaryMetric label="Concentration" value={concentrationWarning ? "Watch" : "Normal"} helper={topService ? `${topService.share}% in top service` : "No spend"} tone={concentrationWarning ? "rose" : "slate"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 rounded-[20px] border border-white/55 bg-white/34 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        {[
          ["Explain spend drivers", onExplainSpend],
          ["Find waste", onFindWaste],
          ["Show highest-cost services", onShowHighestCost],
          ["Discuss financial impact", onDiscuss],
        ].map(([label, handler]) => (
          <button
            key={label as string}
            type="button"
            onClick={handler as () => void}
            className="rounded-full border border-white/70 bg-white/68 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
          >
            {label as string}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-[24px] border border-white/55 bg-white/34 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Account Filter</div>
            <div className="mt-1 text-sm text-slate-600">Financial Impact refreshes first on load and can be filtered independently.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {accountKeys.length > 0 ? (
              accountKeys.map((accountKey) => {
                const selected = selectedSet.has(accountKey);
                return (
                  <button
                    key={`financial-filter-${accountKey}`}
                    type="button"
                    onClick={() => onToggleAccount(accountKey)}
                    className={classNames(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
                      selected
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-white/55 bg-white/42 text-slate-600 hover:bg-white/70",
                    )}
                  >
                    {selected ? <CheckIcon /> : null}
                    {formatAccountLabel(accountKey)}
                  </button>
                );
              })
            ) : (
              <span className="text-sm text-slate-500">No backend accounts loaded.</span>
            )}
          </div>
        </div>
      </div>
      {view === "table" ? (
        <DataTable
          title="Financial Impact Table"
          headers={["Service", "Current Spend ($)", "Share of Selected Spend"]}
          rows={rows}
          emptyText="No stored service spend rows are available for the selected accounts yet."
        />
      ) : (
        <FinancialImpactBarChart items={items} total={total} />
      )}
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
    "I need troubleshooting help for an AWS issue. Analyze probable root cause, affected AWS services/resources, missing evidence, immediate mitigation, permanent fix, and AWS tools/data needed next.",
    "Use the supplied issue text and uploaded context as the initial evidence. Do not invent factual AWS state that is not in the context.",
    "",
    "source=analytics_hub",
    "context_type=unified_troubleshooting",
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
        <div className="ecs-connector-line h-7 w-px" aria-hidden="true" />
        {services.length > 0 ? (
          <div className="relative w-full">
            <div className="ecs-connector-line absolute left-[12%] right-[12%] top-0 hidden h-px md:block" aria-hidden="true" />
            <div className="grid w-full gap-4 pt-4 md:grid-cols-2">
            {services.map((service) => (
              <div key={service.service_arn} className="relative flex min-w-0 flex-col items-center">
                <div className="ecs-connector-line absolute -top-4 left-1/2 hidden h-4 w-px md:block" aria-hidden="true" />
                <EcsNode
                  label={service.service_name}
                  severity={service.severity}
                  insight={service.insight}
                  onClick={service.severity === "ok" ? undefined : () => onNodeDetail(serviceDetail(service))}
                />
                <div className="ecs-connector-line h-5 w-px" aria-hidden="true" />
                <div className="relative grid w-full gap-2 pl-5">
                  {service.tasks.length > 0 ? <div className="ecs-connector-line absolute bottom-4 left-2 top-0 w-px" aria-hidden="true" /> : null}
                  {(service.tasks.length > 0 ? service.tasks : []).slice(0, 8).map((task) => (
                    <div key={task.task_arn} className="relative flex justify-center">
                      <div className="ecs-connector-line absolute left-[-0.75rem] top-1/2 h-px w-4" aria-hidden="true" />
                      <EcsNode
                        label={task.task_id.slice(0, 12)}
                        severity={task.severity}
                        insight={task.stopped_reason || `${task.last_status} / ${task.health_status ?? "health unknown"}`}
                        onClick={task.severity === "ok" ? undefined : () => onNodeDetail(taskDetail(task))}
                      />
                    </div>
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
  utilizationIssues,
  onFilterChange,
  onExpand,
  onNodeDetail,
  onDiscuss,
  onFindIssues,
  onExplain,
  onRefresh,
}: {
  accounts: AnalyticsHubAccountSnapshot[];
  filter: string;
  utilizationIssues: number;
  onFilterChange: (value: string) => void;
  onExpand: () => void;
  onNodeDetail: (detail: EcsNodeDetail) => void;
  onDiscuss: () => void;
  onFindIssues: () => void;
  onExplain: () => void;
  onRefresh: () => void;
}) {
  const clusters = accounts.flatMap((account) => account.ecs_clusters ?? []);
  const services = clusters.flatMap((cluster) => cluster.services);
  const tasks = services.flatMap((service) => service.tasks);
  const warningCount =
    clusters.filter((cluster) => cluster.severity !== "ok").length +
    services.filter((service) => service.severity !== "ok" || service.events.length > 0).length +
    tasks.filter((task) => task.severity !== "ok").length;
  return (
    <div className={classNames(glassPanelClass, "p-6 text-slate-900")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">ECS Insight</div>
          <div className="mt-3 text-xs text-slate-600">Clusters, services, tasks, events, and linked utilization signals.</div>
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
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <SummaryMetric label="Clusters" value={String(clusters.length)} helper="Selected accounts" tone="sky" />
        <SummaryMetric label="Services" value={String(services.length)} helper="ECS services" tone="emerald" />
        <SummaryMetric label="Tasks" value={String(tasks.length)} helper="Known tasks" tone="slate" />
        <SummaryMetric label="Warnings" value={String(warningCount + utilizationIssues)} helper="Events and utilization" tone={warningCount + utilizationIssues > 0 ? "amber" : "slate"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 rounded-[18px] border border-white/55 bg-white/34 p-3">
        <button type="button" onClick={onDiscuss} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">
          Discuss ECS context
        </button>
        <button type="button" onClick={onFindIssues} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
          Find service issues
        </button>
        <button type="button" onClick={onExplain} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
          Explain ECS structure
        </button>
        <button type="button" onClick={onRefresh} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
          Refresh ECS
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
      {clusters.length > 0 ? (
        <EcsInsightTree accounts={accounts} filter={filter} onNodeDetail={onNodeDetail} />
      ) : (
        <div className="mt-5 rounded-[20px] border border-white/60 bg-white/46 p-5 text-sm leading-6 text-slate-600">
          No ECS resources loaded for the selected accounts.
        </div>
      )}
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

type UtilizationInsightRow = {
  accountKey: string;
  account: string;
  region: string;
  cluster: string;
  service: string;
  resourceId: string;
  resourceType: string;
  source: string;
  desired: number;
  running: number;
  pending: number;
  utilizationPct: number;
  utilizationStatus: string;
  cpuAveragePct: number | null;
  memoryAveragePct: number | null;
  severity: "ok" | "warning" | "critical";
  recommendation: string;
  evidence: string;
  evidenceItems: string[];
  reason: string;
  solution: string;
  currentConfiguration: Record<string, unknown> | null;
  recommendedConfiguration: Record<string, unknown> | null;
  consoleUrl: string | null;
  raw: unknown;
};

type IdleResourceRow = {
  accountKey: string;
  account: string;
  resourceType: string;
  resourceId: string;
  name: string | null;
  region: string;
  signal: string;
  finding: string;
  implication: string;
  suggestedAction: string;
  severity: "ok" | "warning" | "critical";
  idle: boolean;
  cpuAveragePct: number | null;
  networkAverageBytes: number | null;
  estimatedMonthlyWaste: number | null;
  consoleUrl: string | null;
  raw: unknown;
};

function flattenIdleResources(accounts: AnalyticsHubAccountSnapshot[]) {
  const rows: IdleResourceRow[] = [];
  for (const account of accounts) {
    for (const item of account.idle_resources ?? []) {
      rows.push({
        accountKey: account.account_key,
        account: formatAccountLabel(account.account_key),
        resourceType: item.resource_type,
        resourceId: item.resource_id,
        name: item.name ?? null,
        region: item.region,
        signal: item.signal,
        finding: item.finding,
        implication: item.implication,
        suggestedAction: item.suggested_action,
        severity: item.severity,
        idle: item.idle,
        cpuAveragePct: item.cpu_average_percent ?? null,
        networkAverageBytes: item.network_average_bytes ?? null,
        estimatedMonthlyWaste: item.estimated_monthly_waste ?? null,
        consoleUrl: item.console_url ?? null,
        raw: item,
      });
    }
  }
  const severityRank = { critical: 0, warning: 1, ok: 2 };
  return rows.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.account.localeCompare(b.account));
}

function utilizationRecommendation(service: AnalyticsEcsServiceItem) {
  if (service.solution) return service.solution;
  if (service.desired_count === 0) {
    return "Underused: service is scaled to zero; confirm it is intentionally idle.";
  }
  if (service.running_count === 0) {
    return "Critical underutilization: no desired tasks are running.";
  }
  if (service.running_count < service.desired_count) {
    return "Capacity shortfall: running tasks are below desired count.";
  }
  if (service.pending_count > 0) {
    return "Possible overpressure: pending tasks indicate placement or capacity constraints.";
  }
  if (service.tasks.some((task) => task.severity !== "ok")) {
    return "Review task health: one or more tasks reported warnings or failures.";
  }
  return "Healthy utilization: running task count matches desired capacity.";
}

function formatUtilizationMetrics(metrics: Record<string, number>) {
  return Object.entries(metrics)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function utilizationResourceDisplayName(resource: AnalyticsUtilizationResourceItem) {
  return resource.resource_name || resource.resource_id;
}

function flattenUtilizationInsights(accounts: AnalyticsHubAccountSnapshot[]) {
  const rows: UtilizationInsightRow[] = [];
  for (const account of accounts) {
    for (const resource of account.utilization_resources ?? []) {
      const metricsText = formatUtilizationMetrics(resource.metrics);
      const evidenceItems = [
        `${resource.resource_type} ${resource.finding}`,
        resource.reason,
        metricsText ? `metrics=${metricsText}` : "",
        resource.recommended_configuration ? `recommendation=${JSON.stringify(resource.recommended_configuration)}` : "",
      ].filter(Boolean);
      rows.push({
        accountKey: account.account_key,
        account: formatAccountLabel(account.account_key),
        region: resource.region,
        cluster: resource.source,
        service: utilizationResourceDisplayName(resource),
        resourceId: resource.resource_id,
        resourceType: resource.resource_type,
        source: resource.source,
        desired: 0,
        running: 0,
        pending: 0,
        utilizationPct:
          resource.utilization_status === "overused"
            ? 100
            : resource.utilization_status === "underused"
              ? 15
              : 50,
        utilizationStatus: resource.utilization_status,
        cpuAveragePct: resource.metrics.CPU ?? resource.metrics.CPUUtilization ?? null,
        memoryAveragePct: resource.metrics.Memory ?? resource.metrics.MemoryUtilization ?? null,
        severity: resource.severity,
        recommendation: resource.suggested_action,
        reason: resource.reason,
        solution: resource.suggested_action,
        currentConfiguration: resource.current_configuration,
        recommendedConfiguration: resource.recommended_configuration ?? null,
        consoleUrl: resource.console_url ?? null,
        evidence: evidenceItems.join("; "),
        evidenceItems,
        raw: resource,
      });
    }
    for (const cluster of account.ecs_clusters ?? []) {
      for (const service of cluster.services) {
        const utilizationPct = Math.round(service.utilization_percent ?? (service.desired_count > 0 ? (service.running_count / service.desired_count) * 100 : 0));
        const failedTaskCount = service.tasks.filter((task) => task.severity !== "ok").length;
        const utilizationStatus = service.utilization_status ?? (utilizationPct >= 85 ? "overused" : utilizationPct <= 30 ? "underused" : "balanced");
        const evidenceItems = [
          service.insight,
          service.reason ? `reason=${service.reason}` : "",
          service.cpu_average_percent != null ? `cpu=${service.cpu_average_percent}%` : "",
          service.memory_average_percent != null ? `memory=${service.memory_average_percent}%` : "",
          service.deployment_status ? `deployment=${service.deployment_status}` : "",
          failedTaskCount > 0 ? `${failedTaskCount} task issue(s)` : "",
        ].filter(Boolean);
        rows.push({
          accountKey: account.account_key,
          account: formatAccountLabel(account.account_key),
          region: account.region,
          cluster: cluster.cluster_name,
          service: service.service_name,
          resourceId: service.service_arn,
          resourceType: "ECS service",
          source: "AWS ECS and CloudWatch",
          desired: service.desired_count,
          running: service.running_count,
          pending: service.pending_count,
          utilizationPct,
          utilizationStatus,
          cpuAveragePct: service.cpu_average_percent ?? null,
          memoryAveragePct: service.memory_average_percent ?? null,
          severity: service.severity,
          recommendation: utilizationRecommendation(service),
          reason: service.reason || service.insight,
          solution: service.solution || utilizationRecommendation(service),
          currentConfiguration: {
            desired_count: service.desired_count,
            running_count: service.running_count,
            pending_count: service.pending_count,
            task_definition: service.task_definition ?? null,
          },
          recommendedConfiguration: null,
          consoleUrl: service.console_url ?? null,
          evidence: evidenceItems.join("; "),
          evidenceItems,
          raw: service,
        });
      }
    }
  }
  return rows.sort((a, b) => {
    const severityRank = { critical: 0, warning: 1, ok: 2 };
    return severityRank[a.severity] - severityRank[b.severity] || a.account.localeCompare(b.account);
  });
}

function utilizationFallbackAnalysis(rows: UtilizationInsightRow[]) {
  if (rows.length === 0) {
    return "No ECS service utilization rows are available yet. Refresh Analytics Hub after AWS credentials and ECS access are configured.";
  }
  const critical = rows.filter((row) => row.severity === "critical");
  const warning = rows.filter((row) => row.severity === "warning");
  if (critical.length > 0) {
    return `${critical.length} service(s) need immediate attention. Start with ${critical
      .slice(0, 3)
      .map((row) => `${row.account}/${row.service}`)
      .join(", ")} because desired tasks are not fully running or task failures were reported.`;
  }
  if (warning.length > 0) {
    return `${warning.length} service(s) have utilization warnings. Review pending tasks, deployment state, and non-healthy task events before scaling decisions.`;
  }
  return "Selected resources are aligned with their current capacity. No underused or overused resource is currently visible in the stored snapshot.";
}

function buildUtilizationLlmContext(rows: UtilizationInsightRow[]) {
  const dataRows = rows.slice(0, 30).map((row) => ({
    account: row.account,
    cluster: row.cluster,
    service: row.service,
    desired_tasks: row.desired,
    running_tasks: row.running,
    pending_tasks: row.pending,
    utilization_pct: row.utilizationPct,
    utilization_status: row.utilizationStatus,
    cpu_average_pct: row.cpuAveragePct,
    memory_average_pct: row.memoryAveragePct,
    severity: row.severity,
    recommendation: row.recommendation,
    reason: row.reason,
    solution: row.solution,
    evidence: row.evidence,
  }));
  return JSON.stringify(
    {
      source: "Analytics Hub utilization snapshot built from AWS Compute Optimizer recommendations plus ECS and CloudWatch service health.",
      row_count: rows.length,
      rows: dataRows,
    },
    null,
    2,
  );
}

type WorkflowModalKind = "proactive" | "actionPlan" | "priority";

type WorkflowModalItem = {
  category: string;
  title: string;
  severity: "ok" | "warning" | "critical";
  reason: string;
  action: string;
};

type FindingSource = "certificate" | "utilization" | "idle" | "financial" | "ecs" | "account";
type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
type FindingImpactType = "outage" | "cost" | "performance" | "security" | "operational";

type NormalizedFinding = {
  id: string;
  source: FindingSource;
  severity: FindingSeverity;
  impactType: FindingImpactType;
  title: string;
  accountKey: string;
  accountId: string;
  region: string;
  resourceType: string;
  resourceId: string;
  impactText: string;
  evidence: string[];
  recommendedAction: string;
  estimatedMonthlySaving?: number | null;
  daysRemaining?: number | null;
  priorityScore: number;
  raw: unknown;
};

function topSeverity(severities: Array<"ok" | "warning" | "critical">): "ok" | "warning" | "critical" {
  if (severities.includes("critical")) return "critical";
  if (severities.includes("warning")) return "warning";
  return "ok";
}

function mapOpsSeverity(severity: "ok" | "warning" | "critical"): FindingSeverity {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "medium";
  return "info";
}

function certificateRiskSeverity(daysRemaining: number): FindingSeverity {
  if (daysRemaining <= 7) return "critical";
  if (daysRemaining <= 15) return "high";
  if (daysRemaining <= 30) return "medium";
  if (daysRemaining <= 60) return "low";
  return "info";
}

function certificateRiskLabel(daysRemaining: number) {
  if (daysRemaining <= 7) return "Critical";
  if (daysRemaining <= 15) return "High";
  if (daysRemaining <= 30) return "Medium";
  if (daysRemaining <= 60) return "Low";
  return "Healthy";
}

function certificateRecommendedAction(item: AnalyticsCertificateItem & { in_use_by?: string[]; renewal_eligibility?: string; type?: string }) {
  if (item.days_to_expiry <= 7) return "Critical: renew or replace immediately.";
  const typeText = `${item.type ?? ""} ${item.renewal_eligibility ?? ""}`.toLowerCase();
  if (typeText.includes("import")) return "Prepare renewed certificate and import before expiry.";
  if (item.in_use_by?.length) return "Validate dependent service before replacement.";
  if (typeText.includes("eligible") || typeText.includes("amazon")) return "Monitor DNS/email validation and renewal status.";
  return "Confirm renewal owner, validation status, and dependent services before the expiry window closes.";
}

function severityTone(severity: FindingSeverity) {
  return {
    critical: "border-red-200 bg-red-50 text-red-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    low: "border-sky-200 bg-sky-50 text-sky-700",
    info: "border-slate-200 bg-white/70 text-slate-600",
  }[severity];
}

function FindingSeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={classNames("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase", severityTone(severity))}>
      {severity}
    </span>
  );
}

function scoreFinding(
  finding: Omit<NormalizedFinding, "priorityScore">,
  repeatedKeys: Map<string, number>,
) {
  const severityScore = {
    critical: 100,
    high: 75,
    medium: 45,
    low: 20,
    info: 5,
  }[finding.severity];
  const normalizedAccount = finding.accountKey.toLowerCase();
  const repeatedKey = `${finding.source}:${finding.resourceType}:${finding.title.toLowerCase()}`;
  return (
    severityScore +
    (finding.impactType === "outage" ? 20 : 0) +
    (finding.impactType === "security" ? 15 : 0) +
    (normalizedAccount.includes("prod") || normalizedAccount.includes("production") ? 15 : 0) +
    ((finding.daysRemaining ?? Number.POSITIVE_INFINITY) <= 7 ? 10 : 0) +
    ((finding.estimatedMonthlySaving ?? 0) > 50 ? 10 : 0) +
    ((repeatedKeys.get(repeatedKey) ?? 0) > 1 ? 5 : 0)
  );
}

function buildNormalizedFindings({
  certificates,
  utilizationRows,
  idleRows,
  spendItems,
  accounts,
}: {
  certificates: Array<AnalyticsCertificateItem & { account_key: string }>;
  utilizationRows: UtilizationInsightRow[];
  idleRows: IdleResourceRow[];
  spendItems: Array<{ service: string; cost: number; share: string }>;
  accounts: AnalyticsHubAccountSnapshot[];
}) {
  const draftFindings: Array<Omit<NormalizedFinding, "priorityScore">> = [];
  const accountRegion = new Map(accounts.map((account) => [account.account_key, account.region]));
  const accountId = new Map(accounts.map((account) => [account.account_key, account.account_id]));

  for (const item of certificates) {
    const rawRecord = item as AnalyticsCertificateItem & { account_key: string; in_use_by?: string[]; renewal_eligibility?: string; type?: string };
    draftFindings.push({
      id: `certificate:${item.account_key}:${item.certificate_arn}`,
      source: "certificate",
      severity: certificateRiskSeverity(item.days_to_expiry),
      impactType: item.days_to_expiry <= 30 ? "outage" : "operational",
      title: item.domain_name,
      accountKey: item.account_key,
      accountId: accountId.get(item.account_key) ?? "",
      region: accountRegion.get(item.account_key) ?? "-",
      resourceType: "ACM certificate",
      resourceId: item.certificate_arn,
      impactText: `${item.domain_name} expires in ${item.days_to_expiry} day${item.days_to_expiry === 1 ? "" : "s"}.`,
      evidence: [
        `Expiry date: ${item.expiry_date}`,
        `Days remaining: ${item.days_to_expiry}`,
        rawRecord.renewal_eligibility ? `Renewal: ${rawRecord.renewal_eligibility}` : "",
        rawRecord.in_use_by?.length ? `Attached: ${rawRecord.in_use_by.join(", ")}` : "",
      ].filter(Boolean),
      recommendedAction: certificateRecommendedAction(rawRecord),
      daysRemaining: item.days_to_expiry,
      raw: item,
    });
  }

  for (const row of utilizationRows) {
    if (row.utilizationStatus === "balanced" && row.severity === "ok") continue;
    const overused = row.utilizationStatus === "overused" || row.severity === "critical";
    draftFindings.push({
      id: `utilization:${row.accountKey}:${row.resourceId || row.service}`,
      source: "utilization",
      severity: row.severity === "critical" ? "critical" : row.utilizationStatus === "overused" ? "high" : "medium",
      impactType: overused ? "performance" : "cost",
      title: `${row.resourceType}: ${row.service}`,
      accountKey: row.accountKey,
      accountId: accountId.get(row.accountKey) ?? "",
      region: row.region,
      resourceType: row.resourceType,
      resourceId: row.resourceId || row.service,
      impactText: overused ? "Capacity pressure may affect performance or availability." : "Provisioned capacity may be higher than current demand.",
      evidence: row.evidenceItems.length ? row.evidenceItems : [row.reason],
      recommendedAction: row.solution,
      estimatedMonthlySaving: row.utilizationStatus === "underused" ? 75 : null,
      raw: row.raw,
    });
  }

  for (const row of idleRows) {
    draftFindings.push({
      id: `idle:${row.accountKey}:${row.resourceId}`,
      source: "idle",
      severity: mapOpsSeverity(row.severity),
      impactType: "cost",
      title: `${row.resourceType}: ${row.resourceId}`,
      accountKey: row.accountKey,
      accountId: accountId.get(row.accountKey) ?? "",
      region: row.region,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      impactText: row.implication,
      evidence: [row.finding, row.signal, row.cpuAveragePct != null ? `CPU ${row.cpuAveragePct}%` : "", row.networkAverageBytes != null ? `Network ${Math.round(row.networkAverageBytes)} bytes` : ""].filter(Boolean),
      recommendedAction: row.suggestedAction,
      estimatedMonthlySaving: row.estimatedMonthlyWaste,
      raw: row.raw,
    });
  }

  spendItems
    .filter((item) => item.cost > 0 && Number(item.share) >= 35)
    .slice(0, 5)
    .forEach((item) => {
      draftFindings.push({
        id: `financial:${item.service}`,
        source: "financial",
        severity: item.cost > 500 ? "medium" : "low",
        impactType: "cost",
        title: `${item.service} spend concentration`,
        accountKey: "selected",
        accountId: "",
        region: "multi-region",
        resourceType: "AWS service spend",
        resourceId: item.service,
        impactText: `${item.service} accounts for ${item.share}% of selected 30 day spend.`,
        evidence: [`30 day spend: ${formatCurrency(item.cost)}`, `Share: ${item.share}%`],
        recommendedAction: "Review service-level cost drivers and confirm spend is expected for the selected accounts.",
        raw: item,
      });
    });

  for (const account of accounts) {
    for (const cluster of account.ecs_clusters ?? []) {
      if (cluster.severity === "ok") continue;
      draftFindings.push({
        id: `ecs:${account.account_key}:${cluster.cluster_arn ?? cluster.cluster_name}`,
        source: "ecs",
        severity: cluster.severity === "critical" ? "high" : "medium",
        impactType: "operational",
        title: `ECS cluster ${cluster.cluster_name}`,
        accountKey: account.account_key,
        accountId: account.account_id,
        region: account.region,
        resourceType: "ECS cluster",
        resourceId: cluster.cluster_arn ?? cluster.cluster_name,
        impactText: cluster.insight,
        evidence: [`Status: ${cluster.status ?? "unknown"}`, `Services: ${cluster.services.length}`],
        recommendedAction: "Open ECS Health, inspect affected services and task events, then discuss the cluster evidence in chat.",
        raw: cluster,
      });
    }
  }

  const repeatedKeys = new Map<string, number>();
  for (const finding of draftFindings) {
    const key = `${finding.source}:${finding.resourceType}:${finding.title.toLowerCase()}`;
    repeatedKeys.set(key, (repeatedKeys.get(key) ?? 0) + 1);
  }

  return draftFindings
    .map((finding) => ({ ...finding, priorityScore: scoreFinding(finding, repeatedKeys) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title));
}

function findingContextType(source: FindingSource) {
  return {
    certificate: "certificate_expiry",
    utilization: "utilization",
    idle: "idle",
    financial: "financial",
    ecs: "ecs",
    account: "account",
  }[source];
}

function findingToDiscussionRows(finding: NormalizedFinding) {
  return [
    ["source", "analytics_hub"],
    ["context_type", "priority_finding"],
    ["finding_source", finding.source],
    ["source_context_type", findingContextType(finding.source)],
    ["accountKey", finding.accountKey],
    ["accountId", finding.accountId],
    ["region", finding.region],
    ["resource_type", finding.resourceType],
    ["resource_id", finding.resourceId],
    ["severity", finding.severity],
    ["impact_type", finding.impactType],
    ["impact", finding.impactText],
    ["evidence", finding.evidence.join(" | ")],
    ["recommendedAction", finding.recommendedAction],
    ["raw", JSON.stringify(finding.raw, null, 2)],
  ];
}

function findingToChatContext(finding: NormalizedFinding) {
  return {
    source: "analytics_hub",
    context_type: "priority_finding",
    finding_source: finding.source,
    accountKey: finding.accountKey,
    accountId: finding.accountId,
    region: finding.region,
    resourceType: finding.resourceType,
    resourceId: finding.resourceId,
    severity: finding.severity,
    impactType: finding.impactType,
    impactText: finding.impactText,
    evidence: finding.evidence,
    recommendedAction: finding.recommendedAction,
    raw: finding.raw,
  };
}

function topFinancialService(items: Array<{ service: string; cost: number; share: string }>) {
  return items.find((item) => item.cost > 0);
}

function buildProactiveRecommendationItems({
  idleRows,
  utilizationRows,
  certificates,
  spendItems,
}: {
  idleRows: IdleResourceRow[];
  utilizationRows: UtilizationInsightRow[];
  certificates: Array<AnalyticsCertificateItem & { account_key: string }>;
  spendItems: Array<{ service: string; cost: number; share: string }>;
}): WorkflowModalItem[] {
  const urgentCertificates = certificates.filter((item) => item.days_to_expiry < 30);
  const utilizationIssues = utilizationRows.filter((row) => row.utilizationStatus !== "balanced" || row.severity !== "ok");
  const topSpend = topFinancialService(spendItems);
  const items: WorkflowModalItem[] = [];

  if (idleRows.length > 0) {
    const severity = topSeverity(idleRows.map((row) => row.severity));
    items.push({
      category: "Idle resources",
      title: `${idleRows.length} cleanup candidate${idleRows.length === 1 ? "" : "s"}`,
      severity,
      reason: idleRows.slice(0, 2).map((row) => `${row.account}/${row.resourceId}`).join(", "),
      action: "Validate ownership, then stop, schedule, rightsize, or terminate stale capacity.",
    });
  }
  if (utilizationIssues.length > 0) {
    const severity = topSeverity(utilizationIssues.map((row) => row.severity));
    items.push({
      category: "Utilization",
      title: `${utilizationIssues.length} underused or overused signal${utilizationIssues.length === 1 ? "" : "s"}`,
      severity,
      reason: utilizationIssues.slice(0, 2).map((row) => `${row.account}/${row.service}`).join(", "),
      action: "Review Compute Optimizer/ECS evidence before scaling capacity up or down.",
    });
  }
  if (urgentCertificates.length > 0) {
    items.push({
      category: "Certificates",
      title: `${urgentCertificates.length} certificate${urgentCertificates.length === 1 ? "" : "s"} under 30 days`,
      severity: "critical",
      reason: urgentCertificates.slice(0, 2).map((item) => `${formatAccountLabel(item.account_key)}/${item.domain_name}`).join(", "),
      action: "Confirm renewal path and owner before the expiry window closes.",
    });
  }
  if (topSpend) {
    items.push({
      category: "Financial",
      title: `${topSpend.service} leads selected spend`,
      severity: "warning",
      reason: `${formatCurrency(topSpend.cost)} across selected accounts (${topSpend.share}%).`,
      action: "Use Financial Impact discussion to inspect drivers and confirm if spend is expected.",
    });
  }

  return items.slice(0, 6);
}

function buildActionPlanItems({
  idleRows,
  utilizationRows,
  certificates,
}: {
  idleRows: IdleResourceRow[];
  utilizationRows: UtilizationInsightRow[];
  certificates: Array<AnalyticsCertificateItem & { account_key: string }>;
}): WorkflowModalItem[] {
  const urgentCertificates = certificates.filter((item) => item.days_to_expiry < 30);
  const utilizationIssues = utilizationRows.filter((row) => row.utilizationStatus !== "balanced" || row.severity !== "ok");
  const items: WorkflowModalItem[] = [];

  urgentCertificates.slice(0, 2).forEach((item, index) => {
    items.push({
      category: `Step ${items.length + 1}`,
      title: `Renew ${item.domain_name}`,
      severity: index === 0 ? "critical" : "warning",
      reason: `${item.days_to_expiry} day${item.days_to_expiry === 1 ? "" : "s"} left in ${formatAccountLabel(item.account_key)}.`,
      action: "Assign certificate owner, validate DNS/ACM status, and schedule renewal verification.",
    });
  });
  utilizationIssues.slice(0, 2).forEach((row) => {
    items.push({
      category: `Step ${items.length + 1}`,
      title: `Review ${row.service}`,
      severity: row.severity,
      reason: `${row.utilizationStatus} signal from ${row.source}.`,
      action: row.solution,
    });
  });
  idleRows.slice(0, 2).forEach((row) => {
    items.push({
      category: `Step ${items.length + 1}`,
      title: `Validate ${row.resourceId}`,
      severity: row.severity,
      reason: row.signal,
      action: row.suggestedAction,
    });
  });

  return items.slice(0, 6);
}

function buildPriorityIssueItems({
  idleRows,
  utilizationRows,
  certificates,
}: {
  idleRows: IdleResourceRow[];
  utilizationRows: UtilizationInsightRow[];
  certificates: Array<AnalyticsCertificateItem & { account_key: string }>;
}): WorkflowModalItem[] {
  const certificateItems = certificates.map((item): WorkflowModalItem => ({
    category: "Certificate",
    title: item.domain_name,
    severity: item.days_to_expiry < 30 ? "critical" : "warning",
    reason: `${item.days_to_expiry} day${item.days_to_expiry === 1 ? "" : "s"} to expiry in ${formatAccountLabel(item.account_key)}.`,
    action: "Prioritize renewal validation and owner confirmation.",
  }));
  const utilizationItems = utilizationRows
    .filter((row) => row.utilizationStatus !== "balanced" || row.severity !== "ok")
    .map((row): WorkflowModalItem => ({
      category: "Utilization",
      title: row.service,
      severity: row.severity,
      reason: row.reason,
      action: row.solution,
    }));
  const idleItems = idleRows.map((row): WorkflowModalItem => ({
    category: "Idle",
    title: row.resourceId,
    severity: row.severity,
    reason: row.finding,
    action: row.suggestedAction,
  }));
  const rank = { critical: 0, warning: 1, ok: 2 };
  return [...certificateItems, ...utilizationItems, ...idleItems]
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.category.localeCompare(b.category))
    .slice(0, 6);
}

function UtilizationBar({ percent, status }: { percent: number; status: string }) {
  const normalizedPercent = Math.max(0, Math.min(100, percent));
  const isOverused = status === "overused";
  const isUnderused = status === "underused";
  const barClass = isOverused
    ? "bg-red-500"
    : isUnderused
      ? "bg-emerald-500"
      : "bg-sky-500";
  const labelClass = isOverused
    ? "text-red-700"
    : isUnderused
      ? "text-emerald-700"
      : "text-sky-700";

  return (
    <div className="min-w-[11rem]">
      <div className="flex items-center justify-between gap-3">
        <span className={classNames("text-sm font-semibold", labelClass)}>{percent}%</span>
        <span className="text-xs font-medium capitalize text-slate-500">{status}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70 shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]">
        <div className={classNames("h-full rounded-full", barClass)} style={{ width: `${normalizedPercent}%` }} />
      </div>
    </div>
  );
}

function utilizationResourceKey(row: UtilizationInsightRow) {
  return [row.account, row.cluster, row.service].join("::");
}

function utilizationResourceLabel(row: UtilizationInsightRow) {
  return `${row.account} / ${row.cluster} / ${row.service}`;
}

function utilizationPriority(row: UtilizationInsightRow) {
  if (row.utilizationStatus === "overused") return 0;
  if (row.severity === "critical") return 1;
  if (row.severity === "warning") return 2;
  if (row.utilizationStatus === "underused") return 3;
  return 4;
}

function defaultTrackedUtilizationKeys(rows: UtilizationInsightRow[]) {
  return [...rows]
    .sort((a, b) => utilizationPriority(a) - utilizationPriority(b) || b.utilizationPct - a.utilizationPct)
    .slice(0, DEFAULT_TRACKED_UTILIZATION_COUNT)
    .map(utilizationResourceKey);
}

function loadTrackedUtilizationKeys() {
  if (typeof window === "undefined") return [];
  try {
    const rawValue = window.localStorage.getItem(TRACKED_UTILIZATION_STORAGE_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function persistTrackedUtilizationKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRACKED_UTILIZATION_STORAGE_KEY, JSON.stringify(keys));
}

function compactTrackedUtilizationRows(rows: UtilizationInsightRow[], trackedKeys: string[]) {
  const trackedSet = new Set(trackedKeys);
  const selectedRows = rows.filter((row) => trackedSet.has(utilizationResourceKey(row)));
  return selectedRows.length > 0 ? selectedRows : rows.filter((row) => defaultTrackedUtilizationKeys(rows).includes(utilizationResourceKey(row)));
}

function utilizationHasOverusedResource(rows: UtilizationInsightRow[]) {
  return rows.some((row) => row.utilizationStatus === "overused" || row.severity === "critical" || row.utilizationPct >= 85);
}

function UtilizationTileBars({ rows }: { rows: UtilizationInsightRow[] }) {
  const shownRows = rows.slice(0, DEFAULT_TRACKED_UTILIZATION_COUNT);
  if (shownRows.length === 0) {
    return (
      <span className="block rounded-2xl border border-white/55 bg-white/34 px-3 py-2 text-xs font-medium text-slate-500">
        Waiting for monitored resources
      </span>
    );
  }

  return (
    <span className="grid w-full gap-2">
      {shownRows.map((row) => {
        const normalizedPercent = Math.max(0, Math.min(100, row.utilizationPct));
        const isOverused = row.utilizationStatus === "overused" || row.utilizationPct >= 85;
        const isUnderused = row.utilizationStatus === "underused";
        return (
          <span
            key={`tracked-tile-${utilizationResourceKey(row)}`}
            className="block"
            title={`${utilizationResourceLabel(row)} - ${row.utilizationPct}% ${row.utilizationStatus}`}
          >
            <span className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
              <span className="max-w-[9.5rem] truncate">{row.service}</span>
              <span className={classNames(isOverused ? "text-red-700" : isUnderused ? "text-emerald-700" : "text-sky-700")}>
                {row.utilizationPct}%
              </span>
            </span>
            <span className="block h-1.5 overflow-hidden rounded-full bg-slate-300/70">
              <span
                className={classNames("block h-full rounded-full", isOverused ? "bg-red-500" : isUnderused ? "bg-emerald-500" : "bg-sky-500")}
                style={{ width: `${normalizedPercent}%` }}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: "ok" | "warning" | "critical" }) {
  return (
    <span className={classNames("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase", ecsSeverityClass(severity))}>
      {severity}
    </span>
  );
}

type OperationsBriefItem = {
  id: string;
  title: string;
  explanation: string;
  accountKey: string;
  region: string;
  severity: FindingSeverity;
  finding: NormalizedFinding | null;
};

function OperationsBrief({
  findings,
  spendItems,
  idleRows,
  utilizationRows,
  certificates,
  accounts,
  storageStatus,
  updatedLabel,
  onDiscuss,
}: {
  findings: NormalizedFinding[];
  spendItems: Array<{ service: string; cost: number; share: string }>;
  idleRows: IdleResourceRow[];
  utilizationRows: UtilizationInsightRow[];
  certificates: Array<AnalyticsCertificateItem & { account_key: string }>;
  accounts: AnalyticsHubAccountSnapshot[];
  storageStatus: AnalyticsHubStorageStatus | null;
  updatedLabel: string;
  onDiscuss: (finding: NormalizedFinding) => void;
}) {
  const topRisk = findings[0] ?? null;
  const topSpend = spendItems[0] ?? null;
  const topSaving = [...idleRows].sort((a, b) => (b.estimatedMonthlyWaste ?? 0) - (a.estimatedMonthlyWaste ?? 0))[0] ?? null;
  const nextExpiry = certificates[0] ?? null;
  const utilizationWarning = utilizationRows.find((row) => row.utilizationStatus !== "balanced" || row.severity !== "ok") ?? null;
  const ecsWarning = findings.find((finding) => finding.source === "ecs") ?? null;
  const storageLabel = storageStatus?.active_storage_source === "sqlite" ? "SQLite active" : "Cached fallback";
  const briefItems: OperationsBriefItem[] = [
    topRisk
      ? {
          id: "top-risk",
          title: topRisk.title,
          explanation: topRisk.impactText,
          accountKey: topRisk.accountKey,
          region: topRisk.region,
          severity: topRisk.severity,
          finding: topRisk,
        }
      : null,
    topSpend
      ? {
          id: "top-cost",
          title: `${topSpend.service} leads selected spend`,
          explanation: `${formatCurrency(topSpend.cost)} across selected accounts (${topSpend.share}%).`,
          accountKey: "selected",
          region: "multi-region",
          severity: Number(topSpend.share) >= 50 ? "medium" : "low",
          finding: findings.find((finding) => finding.source === "financial" && finding.resourceId === topSpend.service) ?? null,
        }
      : null,
    topSaving
      ? {
          id: "top-saving",
          title: `${topSaving.resourceType} ${topSaving.resourceId} can be reviewed`,
          explanation: topSaving.estimatedMonthlyWaste ? `${formatCurrency(topSaving.estimatedMonthlyWaste)} estimated monthly waste.` : topSaving.implication,
          accountKey: topSaving.accountKey,
          region: topSaving.region,
          severity: mapOpsSeverity(topSaving.severity),
          finding: findings.find((finding) => finding.source === "idle" && finding.resourceId === topSaving.resourceId) ?? null,
        }
      : null,
    nextExpiry
      ? {
          id: "expiry",
          title: `${nextExpiry.domain_name} expires in ${nextExpiry.days_to_expiry} days`,
          explanation: "Certificate renewal needs owner and validation review.",
          accountKey: nextExpiry.account_key,
          region: accounts.find((account) => account.account_key === nextExpiry.account_key)?.region ?? "-",
          severity: certificateRiskSeverity(nextExpiry.days_to_expiry),
          finding: findings.find((finding) => finding.source === "certificate" && finding.resourceId === nextExpiry.certificate_arn) ?? null,
        }
      : null,
    utilizationWarning
      ? {
          id: "utilization",
          title: `${utilizationWarning.service} is ${utilizationWarning.utilizationStatus}`,
          explanation: utilizationWarning.reason,
          accountKey: utilizationWarning.accountKey,
          region: utilizationWarning.region,
          severity: utilizationWarning.severity === "critical" ? "critical" : utilizationWarning.utilizationStatus === "overused" ? "high" : "medium",
          finding: findings.find((finding) => finding.source === "utilization" && finding.resourceId === utilizationWarning.resourceId) ?? null,
        }
      : null,
    ecsWarning
      ? {
          id: "ecs",
          title: ecsWarning.title,
          explanation: ecsWarning.impactText,
          accountKey: ecsWarning.accountKey,
          region: ecsWarning.region,
          severity: ecsWarning.severity,
          finding: ecsWarning,
        }
      : null,
  ].filter((item): item is OperationsBriefItem => item !== null);

  return (
    <section className={classNames(glassPanelClass, "mt-6 p-5 text-slate-900 sm:p-6 content-visibility-auto")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Operations Brief</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Today's AWS Brief</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Your AWS operations co-pilot - watching every connected account, explaining what matters, ranking risks by business impact, and guiding safe, approved fixes.
          </div>
        </div>
        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3 lg:min-w-[27rem]">
          <span className="rounded-full border border-white/70 bg-white/62 px-3 py-2 font-semibold text-slate-800">{storageLabel}</span>
          <span className="rounded-full border border-white/70 bg-white/62 px-3 py-2">{updatedLabel}</span>
          <span className="rounded-full border border-white/70 bg-white/62 px-3 py-2">{accounts.length} selected account{accounts.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      {briefItems.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {briefItems.map((item) => (
            <div key={item.id} className="rounded-[20px] border border-white/65 bg-white/54 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</div>
                </div>
                <FindingSeverityBadge severity={item.severity} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">{formatAccountLabel(item.accountKey)} / {item.region}</div>
                <button
                  type="button"
                  onClick={() => item.finding && onDiscuss(item.finding)}
                  disabled={!item.finding}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Discuss
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[20px] border border-white/65 bg-white/54 p-5 text-sm leading-6 text-slate-600">
          No AWS findings yet. Connect accounts or refresh Analytics Hub to populate the brief.
        </div>
      )}
    </section>
  );
}

function UtilizationInsightsCard({
  rows,
  analysis,
  isAnalyzing,
  updatedLabel,
  analysisInitiallyOpen = true,
  onAnalyze,
  onRefresh,
  onDiscuss,
  onDiscussRow,
}: {
  rows: UtilizationInsightRow[];
  analysis: string;
  isAnalyzing: boolean;
  updatedLabel: string;
  analysisInitiallyOpen?: boolean;
  onAnalyze: () => void;
  onRefresh: () => void;
  onDiscuss: () => void;
  onDiscussRow?: (row: UtilizationInsightRow) => void;
}) {
  const underusedCount = rows.filter((row) => row.utilizationStatus === "underused").length;
  const overusedCount = rows.filter((row) => row.utilizationStatus === "overused" || row.severity === "critical").length;
  const potentialSaving = rows
    .filter((row) => row.utilizationStatus === "underused")
    .reduce((sum) => sum + 75, 0);
  const performanceRiskCount = rows.filter((row) => row.utilizationStatus === "overused" || row.pending > 0 || row.severity === "critical").length;
  const computeOptimizerRows = rows.filter((row) => row.source.toLowerCase().includes("compute optimizer") || row.cluster.toLowerCase().includes("compute optimizer")).length;
  const tableRows = rows.map((row) => [
    <SeverityBadge key={`${row.account}-${row.resourceId}-severity`} severity={row.severity} />,
    row.resourceType,
    <div key={`${row.account}-${row.cluster}-${row.service}-resource`} className="min-w-0">
      <div className="font-semibold text-slate-900">{row.service}</div>
      <div className="text-xs text-slate-500">{row.resourceId || row.cluster}</div>
    </div>,
    row.account,
    row.region,
    <div key={`${row.account}-${row.resourceId}-finding`} className="min-w-[10rem]">
      <div className="font-medium capitalize text-slate-900">{row.utilizationStatus}</div>
      <div className="mt-1 text-xs text-slate-500">{row.source}</div>
    </div>,
    <div key={`${row.account}-${row.cluster}-${row.service}-reason`} className="max-w-xl">
      <div className="font-medium text-slate-900">{row.reason}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        {row.cpuAveragePct != null ? <span>CPU {row.cpuAveragePct}%</span> : null}
        {row.memoryAveragePct != null ? <span>Memory {row.memoryAveragePct}%</span> : null}
      </div>
    </div>,
    <pre key={`${row.account}-${row.resourceId}-current`} className="max-w-xs whitespace-pre-wrap rounded-xl bg-white/58 px-3 py-2 text-xs leading-5 text-slate-700">
      {JSON.stringify(row.currentConfiguration ?? {}, null, 2)}
    </pre>,
    <pre key={`${row.account}-${row.resourceId}-recommended`} className="max-w-xs whitespace-pre-wrap rounded-xl bg-white/58 px-3 py-2 text-xs leading-5 text-slate-700">
      {row.recommendedConfiguration ? JSON.stringify(row.recommendedConfiguration, null, 2) : row.desired > 0 || row.running > 0 ? `${row.running}/${row.desired} running, ${row.pending} pending` : "-"}
    </pre>,
    <div key={`${row.account}-${row.resourceId}-action`} className="max-w-md">
      <div className="font-medium text-slate-900">{row.solution}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDiscussRow?.(row)}
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
        >
          Discuss
        </button>
        {row.consoleUrl ? (
          <a href={row.consoleUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white">
            Open AWS
          </a>
        ) : null}
      </div>
    </div>,
  ]);

  const controls = (
    <button
      type="button"
      onClick={onAnalyze}
      disabled={isAnalyzing || rows.length === 0}
      className="rounded-full border border-white/55 bg-white/58 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-white/76 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {isAnalyzing ? "Analyzing" : "Analyze"}
    </button>
  );

  return (
    <DataCard
      title="Utilization Insights"
      headers={["Severity", "Resource type", "Resource id/name", "Account", "Region", "Finding", "Reason", "Current config", "Recommended config", "Suggested action"]}
      rows={tableRows}
      emptyText="No utilization rows are available yet. Refresh after AWS credentials and Compute Optimizer access are configured."
      updatedLabel={updatedLabel}
      onRefresh={onRefresh}
      onDiscuss={onDiscuss}
      controls={controls}
    >
      <details
        className="mt-5 rounded-[22px] border border-white/55 bg-white/36 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] open:rounded-[28px]"
        open={analysisInitiallyOpen}
      >
        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
          Analysis
        </summary>
        <div className="mt-3 text-sm leading-7 text-slate-700">{analysis}</div>
      </details>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryMetric label="Underused" value={String(underusedCount)} helper="Rightsizing candidates" tone={underusedCount > 0 ? "amber" : "slate"} />
        <SummaryMetric label="Overused" value={String(overusedCount)} helper="Capacity pressure" tone={overusedCount > 0 ? "rose" : "slate"} />
        <SummaryMetric label="Potential saving" value={formatCurrency(potentialSaving)} helper="Estimated from underused signals" tone={potentialSaving > 0 ? "emerald" : "slate"} />
        <SummaryMetric label="Performance risk" value={String(performanceRiskCount)} helper="Overused or pending" tone={performanceRiskCount > 0 ? "rose" : "slate"} />
        <SummaryMetric label="Compute Optimizer" value={computeOptimizerRows > 0 ? "Active" : "Missing"} helper={`${computeOptimizerRows} AWS-native rows`} tone={computeOptimizerRows > 0 ? "sky" : "amber"} />
      </div>
      {rows.length === 0 || computeOptimizerRows === 0 ? (
        <div className="mt-4 rounded-[18px] border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
          Compute Optimizer data is not visible in the cached snapshot yet. Refresh utilization after Compute Optimizer and IAM permissions are enabled.
        </div>
      ) : null}
      <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/55 bg-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead>
            <tr className="border-b border-slate-300/35 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {["Severity", "Resource type", "Resource id/name", "Account", "Region", "Finding", "Reason", "Current config", "Recommended config", "Suggested action"].map((header) => (
                <th key={header} className="px-4 py-4 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.length > 0 ? (
              tableRows.map((row, rowIndex) => (
                <tr key={`utilization-${rowIndex}`} className="border-b border-slate-200/45 transition hover:bg-white/18 last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={`utilization-${rowIndex}-${cellIndex}`} className="px-4 py-4 align-top text-[14px] leading-6 text-slate-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-7 text-slate-500">
                  No utilization rows are available yet. Refresh after AWS credentials and Compute Optimizer access are configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

function UtilizationInsightsModal({
  rows,
  trackedRows,
  trackedKeys,
  analysis,
  isAnalyzing,
  updatedLabel,
  onAnalyze,
  onRefresh,
  onDiscuss,
  onDiscussRow,
  onToggleTracked,
  onClose,
}: {
  rows: UtilizationInsightRow[];
  trackedRows: UtilizationInsightRow[];
  trackedKeys: string[];
  analysis: string;
  isAnalyzing: boolean;
  updatedLabel: string;
  onAnalyze: () => void;
  onRefresh: () => void;
  onDiscuss: () => void;
  onDiscussRow: (row: UtilizationInsightRow) => void;
  onToggleTracked: (key: string) => void;
  onClose: () => void;
}) {
  const trackedSet = new Set(trackedKeys);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-white/65 bg-[linear-gradient(180deg,rgba(239,247,255,0.96),rgba(214,232,255,0.94))] p-5 text-slate-900 shadow-[0_34px_90px_rgba(15,23,42,0.32)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Utilization Insights</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Tracked resource utilization</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/70 text-slate-700 transition hover:bg-white"
            aria-label="Close Utilization Insights"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[26px] border border-white/58 bg-white/46 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Pinned bars</div>
              {utilizationHasOverusedResource(trackedRows) ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Overused
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4">
              {trackedRows.length > 0 ? (
                trackedRows.map((row) => (
                  <div key={`modal-tracked-${utilizationResourceKey(row)}`} title={`${utilizationResourceLabel(row)} - ${row.utilizationPct}% ${row.utilizationStatus}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{row.service}</div>
                        <div className="truncate text-xs text-slate-500">{row.account} / {row.resourceType}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">{row.utilizationPct}%</div>
                    </div>
                    <UtilizationBar percent={row.utilizationPct} status={row.utilizationStatus} />
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/55 bg-white/48 p-4 text-sm leading-6 text-slate-600">
                  No tracked resources are available yet. Refresh utilization data after AWS access is configured.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/58 bg-white/46 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Configure monitored resources</div>
                <div className="mt-1 text-xs text-slate-500">Choose the resources that appear on the Utilization Insights tile.</div>
              </div>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto pr-1">
              {rows.length > 0 ? (
                <div className="grid gap-2">
                  {rows.map((row) => {
                    const key = utilizationResourceKey(row);
                    const selected = trackedSet.has(key);
                    return (
                      <button
                        key={`tracked-option-${key}`}
                        type="button"
                        onClick={() => onToggleTracked(key)}
                        className={classNames(
                          "flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
                          selected
                            ? "border-emerald-200 bg-emerald-50/86 text-emerald-950"
                            : "border-white/55 bg-white/42 text-slate-700 hover:bg-white/62",
                        )}
                        aria-pressed={selected}
                        title={`${utilizationResourceLabel(row)} - ${row.utilizationPct}% ${row.utilizationStatus}`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={classNames("grid h-7 w-7 shrink-0 place-items-center rounded-full border", selected ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-slate-200 bg-white/70 text-slate-400")}>
                            {selected ? <CheckIcon /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{row.service}</span>
                            <span className="block truncate text-xs text-slate-500">{row.account} / {row.resourceType} / {row.source}</span>
                          </span>
                        </span>
                        <span className="w-32 shrink-0">
                          <UtilizationTileBars rows={[row]} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/55 bg-white/48 p-4 text-sm leading-6 text-slate-600">
                  No utilization resources are available in the current snapshot.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-5">
          <UtilizationInsightsCard
            rows={rows}
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            updatedLabel={updatedLabel}
            analysisInitiallyOpen={false}
            onAnalyze={onAnalyze}
            onRefresh={onRefresh}
            onDiscuss={onDiscuss}
            onDiscussRow={onDiscussRow}
          />
        </div>
      </div>
    </div>
  );
}

function WorkflowModal({
  title,
  subtitle,
  items,
  onClose,
  onDiscuss,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  items: WorkflowModalItem[];
  onClose: () => void;
  onDiscuss: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(247,251,255,0.98),rgba(223,237,255,0.96))] p-5 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/60 pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">{title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</div>
          </div>
          <button type="button" onClick={onClose} className={glassButtonClass} aria-label={`Close ${title}`} title="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 max-h-[28rem] overflow-y-auto pr-1">
          {items.length > 0 ? (
            <div className="grid gap-3">
              {items.map((item, index) => (
                <div
                  key={`${item.category}-${item.title}-${index}`}
                  className="rounded-[18px] border border-white/65 bg-white/58 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.category}</div>
                      <div className="mt-1 text-base font-semibold text-slate-950">{item.title}</div>
                    </div>
                    <SeverityBadge severity={item.severity} />
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-700">{item.reason}</div>
                  <div className="mt-2 rounded-[14px] border border-sky-100 bg-sky-50/82 px-3 py-2 text-sm font-medium leading-6 text-sky-950">
                    {item.action}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-white/65 bg-white/58 p-5 text-sm leading-6 text-slate-600">
              No current signals in cached snapshot.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onRefresh} className="rounded-full border border-white/65 bg-white/58 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
            Refresh Signals
          </button>
          <button
            type="button"
            onClick={onDiscuss}
            disabled={items.length === 0}
            className="rounded-full border border-sky-300/60 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(2,132,199,0.18)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-55"
          >
            Discuss
          </button>
        </div>
      </div>
    </div>
  );
}

type ResourceDoctorFilter = "all" | "critical" | "cost" | "performance" | "expiry" | "ecs" | "certificates";

function ResourceDoctor({
  findings,
  filter,
  onFilterChange,
  onDiscuss,
  onPlan,
  onRefreshSource,
}: {
  findings: NormalizedFinding[];
  filter: ResourceDoctorFilter;
  onFilterChange: (filter: ResourceDoctorFilter) => void;
  onDiscuss: (finding: NormalizedFinding) => void;
  onPlan: (finding: NormalizedFinding) => void;
  onRefreshSource: (source: FindingSource) => void;
}) {
  const filterOptions: Array<{ key: ResourceDoctorFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "critical", label: "Critical" },
    { key: "cost", label: "Cost" },
    { key: "performance", label: "Performance" },
    { key: "expiry", label: "Expiry" },
    { key: "ecs", label: "ECS" },
    { key: "certificates", label: "Certificates" },
  ];
  const grouped = new Map<string, NormalizedFinding[]>();
  for (const finding of findings) {
    const key = `${finding.accountKey}::${finding.region}::${finding.resourceType}::${finding.resourceId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }
  const resourceRows = [...grouped.values()]
    .map((items) => {
      const sortedItems = [...items].sort((a, b) => b.priorityScore - a.priorityScore);
      const primary = sortedItems[0];
      return {
        primary,
        findings: sortedItems,
        hasCost: sortedItems.some((finding) => finding.impactType === "cost"),
        hasPerformance: sortedItems.some((finding) => finding.impactType === "performance"),
        hasExpiry: sortedItems.some((finding) => finding.source === "certificate"),
        hasEcs: sortedItems.some((finding) => finding.source === "ecs" || finding.resourceType.toLowerCase().includes("ecs")),
      };
    })
    .filter((item) => {
      if (filter === "all") return true;
      if (filter === "critical") return item.primary.severity === "critical" || item.primary.severity === "high";
      if (filter === "cost") return item.hasCost;
      if (filter === "performance") return item.hasPerformance;
      if (filter === "expiry") return item.hasExpiry;
      if (filter === "ecs") return item.hasEcs;
      if (filter === "certificates") return item.primary.source === "certificate";
      return true;
    })
    .slice(0, 12);

  return (
    <section className={classNames(glassPanelClass, "mt-6 p-5 text-slate-900 sm:p-6 content-visibility-auto")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Resource Doctor</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Inspect resources by health, cost, utilization, and expiry</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">One place to watch AWS risks, understand impact, and act safely.</div>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterChange(option.key)}
              className={classNames(
                "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                filter === option.key
                  ? "border-sky-200 bg-sky-600 text-white shadow-[0_12px_24px_rgba(2,132,199,0.16)]"
                  : "border-white/70 bg-white/60 text-slate-700 hover:bg-white",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {resourceRows.length > 0 ? (
        <div className="mt-5 grid max-h-[34rem] gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
          {resourceRows.map(({ primary, findings: relatedFindings, hasCost, hasPerformance, hasExpiry, hasEcs }) => (
            <div key={primary.id} className="rounded-[20px] border border-white/65 bg-white/54 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{primary.resourceId || primary.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{primary.resourceType}</div>
                </div>
                <FindingSeverityBadge severity={primary.severity} />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <span>{formatAccountLabel(primary.accountKey)} / {primary.region}</span>
                <span>{relatedFindings.length} signal{relatedFindings.length === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {hasCost ? <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Cost</span> : null}
                {hasPerformance ? <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Performance</span> : null}
                {hasExpiry ? <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Expiry</span> : null}
                {hasEcs ? <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">ECS</span> : null}
              </div>
              <div className="mt-3 rounded-2xl border border-white/60 bg-white/58 px-3 py-2 text-sm leading-6 text-slate-700">
                <div className="font-medium text-slate-900">{primary.impactText}</div>
                <div className="mt-1 text-slate-600">{primary.recommendedAction}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onDiscuss(primary)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">
                  Discuss resource
                </button>
                <button type="button" onClick={() => onPlan(primary)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
                  Create action plan
                </button>
                <button type="button" onClick={() => onRefreshSource(primary.source)} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
                  Refresh related data
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[20px] border border-white/65 bg-white/54 p-5 text-sm leading-6 text-slate-600">
          No resource-level findings match this view yet. Refresh Analytics Hub or select connected accounts to populate Resource Doctor.
        </div>
      )}
    </section>
  );
}

function PriorityActionQueue({
  findings,
  updatedLabel,
  ignoredIds,
  onDiscuss,
  onDetails,
  onPlan,
  onRefreshSource,
  onIgnore,
}: {
  findings: NormalizedFinding[];
  updatedLabel: string;
  ignoredIds: Set<string>;
  onDiscuss: (finding: NormalizedFinding) => void;
  onDetails: (finding: NormalizedFinding) => void;
  onPlan: (finding: NormalizedFinding) => void;
  onRefreshSource: (source: FindingSource) => void;
  onIgnore: (findingId: string) => void;
}) {
  const visibleFindings = findings.filter((finding) => !ignoredIds.has(finding.id)).slice(0, 12);
  return (
    <DataCard
      title="Priority Action Queue"
      headers={["Priority", "Issue", "Account", "Impact", "Evidence", "Recommended Action", "Actions"]}
      rows={[]}
      emptyText="No current signals in cached snapshot."
      updatedLabel={updatedLabel}
      onRefresh={() => onRefreshSource("account")}
      onDiscuss={() => {
        if (visibleFindings[0]) onDiscuss(visibleFindings[0]);
      }}
    >
      <div className="mt-5 max-h-[32rem] overflow-auto rounded-[18px] border border-white/60 bg-white/46 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-slate-300/35 bg-white/90 text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 backdrop-blur">
              {["Priority", "Issue", "Account", "Impact", "Evidence", "Recommended Action", "Actions"].map((header) => (
                <th key={header} className="px-4 py-4 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleFindings.length > 0 ? (
              visibleFindings.map((finding) => (
                <tr key={finding.id} className="border-b border-slate-200/45 transition hover:bg-sky-50/46 last:border-b-0">
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-slate-950">{finding.priorityScore}</div>
                    <div className="mt-2"><FindingSeverityBadge severity={finding.severity} /></div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="min-w-[14rem] font-semibold text-slate-950">{finding.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{finding.source} / {finding.resourceType}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="font-medium text-slate-900">{formatAccountLabel(finding.accountKey)}</div>
                    <div className="mt-1 text-xs text-slate-500">{finding.region}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="max-w-xs text-slate-700">{finding.impactText}</div>
                    <div className="mt-2 rounded-full border border-white/65 bg-white/58 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                      {finding.impactType}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="max-w-sm text-xs leading-5 text-slate-600">{finding.evidence.slice(0, 3).join(" | ") || "-"}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="max-w-sm font-medium leading-6 text-slate-800">{finding.recommendedAction}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex min-w-[12rem] flex-wrap gap-2">
                      <button type="button" onClick={() => onDiscuss(finding)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">
                        Discuss
                      </button>
                      <button type="button" onClick={() => onDetails(finding)} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
                        View details
                      </button>
                      <button type="button" onClick={() => onPlan(finding)} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
                        Action plan
                      </button>
                      <button type="button" onClick={() => onRefreshSource(finding.source)} className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
                        Refresh source
                      </button>
                      <button type="button" onClick={() => onIgnore(finding.id)} className="rounded-full border border-white/70 bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white">
                        Ignore
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-7 text-slate-500">No current signals in cached snapshot.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

function CertificateExpiryWatchCard({
  items,
  accounts,
  updatedLabel,
  onRefresh,
  onDiscuss,
  onDetails,
}: {
  items: Array<AnalyticsCertificateItem & { account_key: string }>;
  accounts: AnalyticsHubAccountSnapshot[];
  updatedLabel: string;
  onRefresh: () => void;
  onDiscuss: (finding: NormalizedFinding) => void;
  onDetails: (finding: NormalizedFinding) => void;
}) {
  const findings = buildNormalizedFindings({
    certificates: items,
    utilizationRows: [],
    idleRows: [],
    spendItems: [],
    accounts,
  });
  return (
    <DataCard
      title="Certificate Expiry Watch"
      headers={["Risk", "Domain/name", "Account", "Region", "Expires in", "Status", "Used by", "Renewal type", "Recommended action", "Discuss"]}
      rows={[]}
      emptyText="No ACM certificates expiring within the current snapshot window were found."
      updatedLabel={updatedLabel}
      onRefresh={onRefresh}
      onDiscuss={() => {
        if (findings[0]) onDiscuss(findings[0]);
      }}
    >
      <div className="mt-5 max-h-[30rem] overflow-auto rounded-[18px] border border-white/60 bg-white/46 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-slate-300/35 bg-white/90 text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 backdrop-blur">
              {["Risk", "Domain/name", "Account", "Region", "Expires in", "Status", "Used by", "Renewal type", "Recommended action", "Discuss"].map((header) => (
                <th key={header} className="px-4 py-4 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => {
                const rawRecord = item as AnalyticsCertificateItem & { in_use_by?: string[]; renewal_eligibility?: string; type?: string; status?: string };
                const finding = findings.find((candidate) => candidate.resourceId === item.certificate_arn) ?? findings[0];
                return (
                  <tr key={item.certificate_arn} className="border-b border-slate-200/45 transition hover:bg-sky-50/46 last:border-b-0">
                    <td className="px-4 py-4 align-top"><FindingSeverityBadge severity={certificateRiskSeverity(item.days_to_expiry)} /></td>
                    <td className="px-4 py-4 align-top">
                      <button type="button" onClick={() => finding && onDetails(finding)} className="min-w-[13rem] text-left font-semibold text-slate-950 transition hover:text-sky-800">
                        {item.domain_name}
                      </button>
                      <div className="mt-1 max-w-xs truncate text-xs text-slate-500">{item.certificate_arn}</div>
                    </td>
                    <td className="px-4 py-4 align-top">{formatAccountLabel(item.account_key)}</td>
                    <td className="px-4 py-4 align-top">{finding?.region ?? "-"}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-slate-950">{item.days_to_expiry} day{item.days_to_expiry === 1 ? "" : "s"}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.expiry_date}</div>
                    </td>
                    <td className="px-4 py-4 align-top">{rawRecord.status ?? certificateRiskLabel(item.days_to_expiry)}</td>
                    <td className="px-4 py-4 align-top">{rawRecord.in_use_by?.join(", ") || "Not available"}</td>
                    <td className="px-4 py-4 align-top">{rawRecord.renewal_eligibility ?? rawRecord.type ?? "Not available"}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="max-w-sm font-medium leading-6 text-slate-800">
                        {finding?.recommendedAction ?? "Confirm renewal owner and validation status."}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button type="button" onClick={() => finding && onDiscuss(finding)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">
                        Discuss
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-7 text-slate-500">No ACM certificates expiring within the current snapshot window were found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

function FindingDetailModal({
  finding,
  onClose,
  onDiscuss,
}: {
  finding: NormalizedFinding;
  onClose: () => void;
  onDiscuss: (finding: NormalizedFinding) => void;
}) {
  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(247,251,255,0.98),rgba(223,237,255,0.96))] p-5 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.28)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/60 pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">{finding.source} finding</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{finding.title}</h2>
          </div>
          <button type="button" onClick={onClose} className={glassButtonClass} aria-label="Close finding details" title="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Severity" value={finding.severity} helper={`Priority ${finding.priorityScore}`} tone={finding.severity === "critical" || finding.severity === "high" ? "rose" : finding.severity === "medium" ? "amber" : "slate"} />
          <SummaryMetric label="Account" value={formatAccountLabel(finding.accountKey)} helper={finding.region} tone="sky" />
          <SummaryMetric label="Impact" value={finding.impactType} helper={finding.resourceType} tone="emerald" />
        </div>
        <div className="mt-5 rounded-[18px] border border-white/65 bg-white/58 p-4 text-sm leading-6 text-slate-700">
          <div className="font-semibold text-slate-950">Impact</div>
          <div className="mt-2">{finding.impactText}</div>
          <div className="mt-4 font-semibold text-slate-950">Evidence</div>
          <ul className="mt-2 grid gap-2">
            {finding.evidence.map((item) => <li key={item} className="rounded-xl bg-white/68 px-3 py-2">{item}</li>)}
          </ul>
          <div className="mt-4 font-semibold text-slate-950">Recommended action</div>
          <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/82 px-3 py-2 text-sky-950">{finding.recommendedAction}</div>
        </div>
        <pre className="mt-5 max-h-72 overflow-auto rounded-[18px] border border-white/65 bg-slate-950/90 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(finding.raw, null, 2)}
        </pre>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-white/65 bg-white/58 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
            Close
          </button>
          <button type="button" onClick={() => onDiscuss(finding)} className="rounded-full border border-sky-300/60 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(2,132,199,0.18)] transition hover:bg-sky-700">
            Discuss
          </button>
        </div>
      </div>
    </div>
  );
}

function TroubleshootingEntrySection({
  onOpen,
}: {
  onOpen: () => void;
}) {
  return (
    <section className={classNames(glassPanelClass, "mt-6 p-5 text-slate-900 sm:p-6 content-visibility-auto")}>
      <div className="absolute inset-x-6 top-0 h-px bg-white/70" aria-hidden="true" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Unified Troubleshooting</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Have logs, traces, or RCA notes?</div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Paste issue context or upload a log file, then start a troubleshooting chat grounded in the supplied evidence.
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="w-fit rounded-full border border-sky-300/60 bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(2,132,199,0.2)] transition hover:bg-sky-700"
        >
          Start troubleshooting chat
        </button>
      </div>
    </section>
  );
}

const EMPTY_SNAPSHOT: AnalyticsHubSnapshot = {
  generated_at_utc: null,
  account_count: 0,
  accounts: [],
  errors: [],
};

function snapshotSignature(snapshot: AnalyticsHubSnapshot) {
  return [
    snapshot.generated_at_utc ?? "",
    snapshot.account_count,
    snapshot.accounts.map((account) => [
      account.account_key,
      account.total_cost_30d,
      account.service_spend_30d.length,
      account.monthly_cost_trend.length,
      account.expiring_certificates.length,
      account.ecs_clusters.length,
      account.utilization_resources.length,
      account.idle_resources.length,
    ].join(":")).join("|"),
    snapshot.errors.length,
  ].join("::");
}

export default function AnalyticsHub({
  actionButton,
  paneActions,
}: {
  actionButton: ReactNode;
  paneActions: ReactNode;
}) {
  const availableAccountKeys = useChatStore((s) => s.availableAccountKeys);
  const selectedAccountKeys = useChatStore((s) => s.selectedAccountKeys);
  const toggleAccountSelection = useChatStore((s) => s.toggleAccountSelection);
  const newChat = useChatStore((s) => s.newChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const openSingleView = useUiStore((s) => s.openSingleView);
  const openDiscussionTable = useUiStore((s) => s.openDiscussionTable);
  const closeDiscussionTable = useUiStore((s) => s.closeDiscussionTable);
  const [snapshot, setSnapshot] = useState<AnalyticsHubSnapshot>(EMPTY_SNAPSHOT);
  const [storageStatus, setStorageStatus] = useState<AnalyticsHubStorageStatus | null>(null);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [refreshingTableKey, setRefreshingTableKey] = useState<string | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [financialImpactView, setFinancialImpactView] = useState<"table" | "bar">("bar");
  const [financialAccountKeys, setFinancialAccountKeys] = useState<string[]>([]);
  const [ecsFilter, setEcsFilter] = useState("genai");
  const [ecsExpanded, setEcsExpanded] = useState(false);
  const [ecsNodeDetail, setEcsNodeDetail] = useState<EcsNodeDetail | null>(null);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);
  const [troubleshootingText, setTroubleshootingText] = useState("");
  const [troubleshootingFiles, setTroubleshootingFiles] = useState<File[]>([]);
  const [troubleshootingSubmitting, setTroubleshootingSubmitting] = useState(false);
  const [troubleshootingError, setTroubleshootingError] = useState<string | null>(null);
  const [utilizationAnalysis, setUtilizationAnalysis] = useState("");
  const [utilizationAnalyzing, setUtilizationAnalyzing] = useState(false);
  const [utilizationModalOpen, setUtilizationModalOpen] = useState(false);
  const [workflowModalKind, setWorkflowModalKind] = useState<WorkflowModalKind | null>(null);
  const [findingDetail, setFindingDetail] = useState<NormalizedFinding | null>(null);
  const [ignoredFindingIds, setIgnoredFindingIds] = useState<Set<string>>(() => new Set());
  const [resourceDoctorFilter, setResourceDoctorFilter] = useState<ResourceDoctorFilter>("all");
  const [trackedUtilizationKeys, setTrackedUtilizationKeys] = useState<string[]>(() => loadTrackedUtilizationKeys());
  const [guideDockOpen, setGuideDockOpen] = useState(false);
  const [guideTourOpen, setGuideTourOpen] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const resourceDoctorSectionRef = useRef<HTMLElement | null>(null);
  const utilizationSectionRef = useRef<HTMLElement | null>(null);
  const certificatesSectionRef = useRef<HTMLElement | null>(null);
  const priorityQueueSectionRef = useRef<HTMLElement | null>(null);
  const financialSectionRef = useRef<HTMLElement | null>(null);
  const ecsSectionRef = useRef<HTMLElement | null>(null);

  async function loadSnapshot() {
    const [result, storageResult] = await Promise.all([
      chatApi.getAnalyticsHubSnapshot(),
      chatApi.getAnalyticsHubStorageStatus(),
    ]);
    if (storageResult.ok) {
      setStorageStatus(storageResult.data);
    }
    if (!result.ok) {
      setRefreshInProgress(false);
      return;
    }
    setSnapshot((current) =>
      snapshotSignature(current) === snapshotSignature(result.data.snapshot)
        ? current
        : result.data.snapshot,
    );
    setRefreshInProgress((current) => {
      const nextValue = Boolean(result.data.refresh_in_progress);
      return current === nextValue ? current : nextValue;
    });
  }

  async function queueRefresh(tableKey = "all") {
    setRefreshInProgress(true);
    setRefreshingTableKey(tableKey);
    const result = await chatApi.refreshAnalyticsHubSnapshot(tableKey);
    if (!result.ok) {
      setRefreshInProgress(false);
      setRefreshingTableKey(null);
      return;
    }
    if (!result.data.queued && !result.data.refresh_in_progress) {
      setRefreshInProgress(false);
      setRefreshingTableKey(null);
      void loadSnapshot();
      return;
    }
    window.setTimeout(() => {
      void loadSnapshot();
    }, 700);
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
      if (!refreshInProgress) {
        setRefreshingTableKey(null);
      }
    }, 2500);
    return () => window.clearTimeout(timerId);
  }, [refreshInProgress]);

  useEffect(() => {
    if (refreshInProgress) return;
    setRefreshingTableKey(null);
  }, [refreshInProgress]);

  const filteredAccounts = useMemo(() => {
    const selectedSet = new Set(selectedAccountKeys);
    return snapshot.accounts.filter((account) => selectedSet.has(account.account_key));
  }, [selectedAccountKeys, snapshot.accounts]);

  useEffect(() => {
    setFinancialAccountKeys((current) => {
      const availableSet = new Set(availableAccountKeys);
      const retained = current.filter((accountKey) => availableSet.has(accountKey));
      if (retained.length > 0) return retained;
      return selectedAccountKeys.length > 0 ? selectedAccountKeys.filter((accountKey) => availableSet.has(accountKey)) : availableAccountKeys;
    });
  }, [availableAccountKeys, selectedAccountKeys]);

  const financialFilteredAccounts = useMemo(() => {
    const selectedSet = new Set(financialAccountKeys.length ? financialAccountKeys : selectedAccountKeys);
    return snapshot.accounts.filter((account) => selectedSet.has(account.account_key));
  }, [financialAccountKeys, selectedAccountKeys, snapshot.accounts]);

  const financialServiceSpendRows = useMemo(
    () =>
      aggregateServiceSpend(financialFilteredAccounts).map((item) => [
        item.service,
        formatCurrency(item.cost),
        `${item.share}%`,
      ]),
    [financialFilteredAccounts],
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

  const hasUrgentCertificate = useMemo(
    () => certificateItems.some((item) => item.days_to_expiry < 30),
    [certificateItems],
  );

  const totalFinancialSpend = useMemo(
    () => financialFilteredAccounts.reduce((sum, account) => sum + account.total_cost_30d, 0),
    [financialFilteredAccounts],
  );
  const topFinancialAccount = useMemo(
    () => [...financialFilteredAccounts].sort((a, b) => b.total_cost_30d - a.total_cost_30d)[0] ?? null,
    [financialFilteredAccounts],
  );
  const aggregatedServiceSpend = useMemo(() => aggregateServiceSpend(financialFilteredAccounts), [financialFilteredAccounts]);
  const idleResourceRows = useMemo(() => flattenIdleResources(filteredAccounts), [filteredAccounts]);
  const possibleIdleSaving = useMemo(
    () => idleResourceRows.reduce((sum, row) => sum + (row.estimatedMonthlyWaste ?? 0), 0),
    [idleResourceRows],
  );
  const utilizationRows = useMemo(() => flattenUtilizationInsights(filteredAccounts), [filteredAccounts]);
  const trackedUtilizationRows = useMemo(
    () => compactTrackedUtilizationRows(utilizationRows, trackedUtilizationKeys),
    [trackedUtilizationKeys, utilizationRows],
  );
  const hasOverusedTrackedUtilizationResource = useMemo(
    () => utilizationHasOverusedResource(trackedUtilizationRows),
    [trackedUtilizationRows],
  );
  const utilizationDiscussionRows = useMemo(
    () =>
      utilizationRows.map((row) => [
        row.account,
        row.source,
        `${row.resourceType}: ${row.service}`,
        row.desired > 0 || row.running > 0 ? `${row.running}/${row.desired}` : "-",
        row.pending ? String(row.pending) : "-",
        `${row.utilizationPct}% ${row.utilizationStatus}`,
        row.severity,
        `${row.reason} Solution: ${row.solution}`,
      ]),
    [utilizationRows],
  );
  const normalizedFindings = useMemo(
    () =>
      buildNormalizedFindings({
        certificates: certificateItems,
        utilizationRows,
        idleRows: idleResourceRows,
        spendItems: aggregatedServiceSpend,
        accounts: filteredAccounts,
      }),
    [aggregatedServiceSpend, certificateItems, filteredAccounts, idleResourceRows, utilizationRows],
  );

  const updatedLabel = refreshInProgress
    ? `Updated moments ago - Refreshing ${refreshingTableKey ?? "data"}`
    : formatRelativeTime(snapshot.generated_at_utc);

  const dashboardSummary = useMemo(
    () => {
      const activeFindings = normalizedFindings.filter((finding) => !ignoredFindingIds.has(finding.id));
      const criticalIssues = activeFindings.filter((finding) => finding.severity === "critical" || finding.severity === "high").length;
      const utilizationIssues = activeFindings.filter((finding) => finding.source === "utilization").length;
      const urgentCertificates = certificateItems.filter((item) => item.days_to_expiry <= 30).length;
      const potentialSavings =
        idleResourceRows.reduce((sum, row) => sum + (row.estimatedMonthlyWaste ?? 0), 0) +
        activeFindings.reduce((sum, finding) => sum + (finding.source === "utilization" ? finding.estimatedMonthlySaving ?? 0 : 0), 0);
      const healthScore = Math.max(
        0,
        Math.min(
          100,
          100 -
            activeFindings.filter((finding) => finding.severity === "critical").length * 18 -
            activeFindings.filter((finding) => finding.severity === "high").length * 12 -
            activeFindings.filter((finding) => finding.severity === "medium").length * 6 -
            activeFindings.filter((finding) => finding.severity === "low").length * 2,
        ),
      );
      return {
        selectedAccounts: selectedAccountKeys.length,
        connectedAccounts: availableAccountKeys.length,
        spend: totalFinancialSpend,
        healthScore,
        criticalIssues,
        potentialSavings,
        urgentCertificates,
        utilizationIssues,
        idleCandidates: idleResourceRows.length,
      };
    },
    [availableAccountKeys.length, certificateItems, idleResourceRows, ignoredFindingIds, normalizedFindings, selectedAccountKeys.length, totalFinancialSpend],
  );

  const proactiveRecommendationItems = useMemo(
    () =>
      buildProactiveRecommendationItems({
        idleRows: idleResourceRows,
        utilizationRows,
        certificates: certificateItems,
        spendItems: aggregatedServiceSpend,
      }),
    [aggregatedServiceSpend, certificateItems, idleResourceRows, utilizationRows],
  );

  const actionPlanItems = useMemo(
    () =>
      buildActionPlanItems({
        idleRows: idleResourceRows,
        utilizationRows,
        certificates: certificateItems,
      }),
    [certificateItems, idleResourceRows, utilizationRows],
  );

  const priorityIssueItems = useMemo(
    () =>
      buildPriorityIssueItems({
        idleRows: idleResourceRows,
        utilizationRows,
        certificates: certificateItems,
      }),
    [certificateItems, idleResourceRows, utilizationRows],
  );

  const workflowModalConfig = useMemo(() => {
    if (workflowModalKind === "proactive") {
      return {
        title: "Proactive Recommendations",
        subtitle: "Optimization opportunities assembled from cached spend, utilization, certificate, and idle-resource signals.",
        items: proactiveRecommendationItems,
        refreshKey: "all",
      };
    }
    if (workflowModalKind === "actionPlan") {
      return {
        title: "Action Plan Generator",
        subtitle: "Owner-ready steps derived from the highest-priority current findings.",
        items: actionPlanItems,
        refreshKey: "all",
      };
    }
    if (workflowModalKind === "priority") {
      return {
        title: "Priority Issue Tracker",
        subtitle: "Current cached issues ranked by severity and operational risk.",
        items: priorityIssueItems,
        refreshKey: "all",
      };
    }
    return null;
  }, [actionPlanItems, priorityIssueItems, proactiveRecommendationItems, workflowModalKind]);

  useEffect(() => {
    setUtilizationAnalysis(utilizationFallbackAnalysis(utilizationRows));
  }, [utilizationRows]);

  useEffect(() => {
    if (utilizationRows.length === 0) return;
    setTrackedUtilizationKeys((current) => {
      const availableKeys = new Set(utilizationRows.map(utilizationResourceKey));
      const retainedKeys = current.filter((key) => availableKeys.has(key));
      const nextKeys = retainedKeys.length > 0 ? retainedKeys : defaultTrackedUtilizationKeys(utilizationRows);
      persistTrackedUtilizationKeys(nextKeys);
      return nextKeys;
    });
  }, [utilizationRows]);

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

  async function openFindingDiscussion(finding: NormalizedFinding) {
    const rows = findingToDiscussionRows(finding);
    closeDiscussionTable();
    await newChat();
    openDiscussionTable({
      title: `Analytics Hub Finding: ${finding.title}`,
      headers: ["Field", "Value"],
      rows,
      updatedAtMs: snapshot.generated_at_utc ? new Date(snapshot.generated_at_utc).getTime() : null,
    });
    openSingleView("chat");
    void sendMessage(
      [
        "Analyze this Analytics Hub finding. Use only the supplied AWS snapshot evidence for factual state.",
        "Explain risk, likely impact, immediate mitigation, permanent fix, and AWS data/tools to check next.",
        "",
        JSON.stringify(findingToChatContext(finding), null, 2),
      ].join("\n"),
    );
  }

  function refreshFindingSource(source: FindingSource) {
    const refreshKey = {
      certificate: "certificates",
      utilization: "utilization",
      idle: "idle",
      financial: "financial",
      ecs: "accounts",
      account: "accounts",
    }[source];
    void queueRefresh(refreshKey);
  }

  function openActionPlanForFinding(finding: NormalizedFinding) {
    setWorkflowModalKind(null);
    void openTableDiscussion(
      `Action Plan: ${finding.title}`,
      ["Step", "Action"],
      [
        ["1", `Confirm scope: ${finding.accountKey} / ${finding.region} / ${finding.resourceType} / ${finding.resourceId}`],
        ["2", `Validate evidence: ${finding.evidence.join(" | ") || "No additional evidence in cache"}`],
        ["3", finding.recommendedAction],
        ["4", "After remediation, refresh the source table and verify the finding is cleared."],
      ],
    );
  }

  function findUtilizationFinding(row: UtilizationInsightRow) {
    return normalizedFindings.find((finding) => finding.source === "utilization" && finding.resourceId === (row.resourceId || row.service));
  }

  function discussFinancialContext(mode: "drivers" | "waste" | "highest") {
    const title = {
      drivers: "Why is my AWS bill high?",
      waste: "Find AWS waste",
      highest: "Highest-cost AWS services",
    }[mode];
    const rows = [
      ["source", "analytics_hub"],
      ["context_type", "financial"],
      ["selected_accounts", (financialAccountKeys.length ? financialAccountKeys : selectedAccountKeys).join(", ")],
      ["total_30d_spend", formatCurrency(totalFinancialSpend)],
      ["top_account", topFinancialAccount ? `${formatAccountLabel(topFinancialAccount.account_key)} ${formatCurrency(topFinancialAccount.total_cost_30d)}` : "None"],
      ["possible_idle_saving", formatCurrency(possibleIdleSaving)],
      ["services", JSON.stringify(aggregatedServiceSpend.slice(0, 12), null, 2)],
      ["idle_candidates", JSON.stringify(idleResourceRows.slice(0, 12), null, 2)],
    ];
    void openTableDiscussion(title, ["Field", "Value"], rows);
  }

  function discussEcsContext(mode: "context" | "issues" | "structure") {
    const clusters = filteredAccounts.flatMap((account) =>
      (account.ecs_clusters ?? []).map((cluster) => ({
        account_key: account.account_key,
        account_id: account.account_id,
        region: account.region,
        cluster,
      })),
    );
    const title = {
      context: "ECS Context",
      issues: "ECS Service Issues",
      structure: "Explain ECS Structure",
    }[mode];
    void openTableDiscussion(
      title,
      ["Field", "Value"],
      [
        ["source", "analytics_hub"],
        ["context_type", "ecs"],
        ["mode", mode],
        ["cluster_count", String(clusters.length)],
        ["utilization_linked_issues", String(normalizedFindings.filter((finding) => finding.source === "utilization" && finding.resourceType.toLowerCase().includes("ecs")).length)],
        ["ecs_snapshot", JSON.stringify(clusters, null, 2)],
      ],
    );
  }

  function workflowItemsToRows(items: WorkflowModalItem[]) {
    return items.map((item) => [
      item.category,
      item.title,
      item.severity,
      item.reason,
      item.action,
    ]);
  }

  function discussWorkflowModal() {
    if (!workflowModalConfig) return;
    void openTableDiscussion(
      workflowModalConfig.title,
      ["Category", "Signal", "Severity", "Reason", "Recommended Action"],
      workflowItemsToRows(workflowModalConfig.items),
    );
    setWorkflowModalKind(null);
  }

  function scrollToCertificates() {
    certificatesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToSection(ref: RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openGuideTour(stepIndex = 0) {
    setGuideStepIndex(stepIndex);
    setGuideTourOpen(true);
  }

  function openAccountsFromGuide() {
    setGuideTourOpen(false);
    setGuideDockOpen(false);
    setAccountsOpen(true);
  }

  function openUtilizationFromGuide() {
    setGuideTourOpen(false);
    setGuideDockOpen(false);
    setUtilizationModalOpen(true);
    if (!utilizationAnalysis || utilizationAnalysis === utilizationFallbackAnalysis(utilizationRows)) {
      void analyzeUtilization();
    }
  }

  function openPriorityFromGuide() {
    setGuideTourOpen(false);
    setGuideDockOpen(false);
    scrollToSection(priorityQueueSectionRef);
  }

  function openCertificatesFromGuide() {
    setGuideTourOpen(false);
    setGuideDockOpen(false);
    scrollToCertificates();
  }

  function openFinancialFromGuide() {
    setGuideTourOpen(false);
    setGuideDockOpen(false);
    scrollToSection(financialSectionRef);
  }

  function openTroubleshootingFromGuide() {
    setGuideTourOpen(false);
    setGuideDockOpen(false);
    setTroubleshootingOpen(true);
  }

  function toggleFinancialAccount(accountKey: string) {
    setFinancialAccountKeys((current) => {
      const base = current.length ? current : selectedAccountKeys;
      const selected = base.includes(accountKey);
      if (selected && base.length === 1) return base;
      return selected ? base.filter((key) => key !== accountKey) : [...base, accountKey];
    });
  }

  function toggleTrackedUtilizationResource(key: string) {
    setTrackedUtilizationKeys((current) => {
      if (current.includes(key) && current.length === 1) return current;
      const nextKeys = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      persistTrackedUtilizationKeys(nextKeys);
      return nextKeys;
    });
  }

  async function analyzeUtilization() {
    if (utilizationAnalyzing || utilizationRows.length === 0) return;
    setUtilizationAnalyzing(true);
    const fallback = utilizationFallbackAnalysis(utilizationRows);
    const result = await chatApi.answerWithContext({
      query: [
        "Analyze these AWS ECS utilization rows for underused and overpressured resources.",
        "Give a concise operational summary and name the first services to review.",
        "Use only the supplied context.",
      ].join(" "),
      context: buildUtilizationLlmContext(utilizationRows),
    });
    setUtilizationAnalysis(result.ok ? result.data.answer : fallback);
    setUtilizationAnalyzing(false);
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
    try {
      const fileContext = await readTroubleshootingFiles(troubleshootingFiles);
      const prompt = formatTroubleshootingPrompt(troubleshootingText, fileContext);
      const chatId = await newChat();
      if (!chatId) {
        setTroubleshootingSubmitting(false);
        setTroubleshootingError("Unable to create a troubleshooting chat. Check that the backend chat API is reachable, then try again.");
        return;
      }

      openSingleView("chat");
      const sent = await sendMessage(prompt);
      if (!sent) {
        setTroubleshootingSubmitting(false);
        setTroubleshootingError("The troubleshooting chat was created, but the first message could not be sent. Open Chat and retry from there.");
        return;
      }

      setTroubleshootingOpen(false);
      setTroubleshootingText("");
      setTroubleshootingFiles([]);
      setTroubleshootingSubmitting(false);
    } catch (error) {
      setTroubleshootingSubmitting(false);
      setTroubleshootingError(error instanceof Error ? error.message : "Unable to submit troubleshooting context.");
      return;
    }
  }

  return (
    <div className="relative h-full overflow-y-auto bg-[#d8e8fb] px-4 pb-12 pt-2 text-slate-900 sm:px-7">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#eaf4ff_0%,#d4e7fb_42%,#c8def3_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:36px_36px]"
        aria-hidden="true"
      />

      {utilizationModalOpen ? (
        <UtilizationInsightsModal
          rows={utilizationRows}
          trackedRows={trackedUtilizationRows}
          trackedKeys={trackedUtilizationKeys}
          analysis={utilizationAnalysis}
          isAnalyzing={utilizationAnalyzing}
          updatedLabel={updatedLabel}
          onAnalyze={() => void analyzeUtilization()}
          onRefresh={() => void queueRefresh("utilization")}
          onDiscuss={() =>
            void openTableDiscussion(
              "Utilization Insights",
              ["Account", "Source", "Resource", "Running / Desired", "Pending", "Utilization", "Severity", "Reason / Solution"],
              utilizationDiscussionRows,
            )
          }
          onDiscussRow={(row) => {
            const finding = findUtilizationFinding(row);
            if (finding) void openFindingDiscussion(finding);
          }}
          onToggleTracked={toggleTrackedUtilizationResource}
          onClose={() => setUtilizationModalOpen(false)}
        />
      ) : null}

      {workflowModalConfig ? (
        <WorkflowModal
          title={workflowModalConfig.title}
          subtitle={workflowModalConfig.subtitle}
          items={workflowModalConfig.items}
          onClose={() => setWorkflowModalKind(null)}
          onDiscuss={discussWorkflowModal}
          onRefresh={() => void queueRefresh(workflowModalConfig.refreshKey)}
        />
      ) : null}

      {findingDetail ? (
        <FindingDetailModal
          finding={findingDetail}
          onClose={() => setFindingDetail(null)}
          onDiscuss={(finding) => {
            setFindingDetail(null);
            void openFindingDiscussion(finding);
          }}
        />
      ) : null}

      <header className="sticky top-0 z-20 shrink-0 px-4 pt-4">
        <div className="flex w-full items-center justify-end gap-2 pr-2">
          {paneActions}
          {actionButton}
        </div>
      </header>

      <div className="relative mx-auto mt-2 flex min-h-full w-full max-w-7xl flex-col">
        <section className="rounded-[24px] border border-white/65 bg-white/54 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_22px_70px_rgba(15,23,42,0.12)] backdrop-blur-[20px] sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                  <StatusPulseIcon active={refreshInProgress} />
                  Analytics Hub
                </div>
                <RefreshStatusStrip
                  refreshInProgress={refreshInProgress}
                  refreshingTableKey={refreshingTableKey}
                  updatedLabel={updatedLabel}
                  accountCount={dashboardSummary.connectedAccounts}
                  selectedAccountCount={dashboardSummary.selectedAccounts}
                  storageStatus={storageStatus}
                />
              </div>

            </div>

            <div className="grid gap-3">
              <div className="rounded-[16px] border border-white/70 bg-white/58 p-3 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Vendor</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    AWS active
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {cloudVendors.map((vendor) => (
                    <button
                      key={vendor.key}
                      type="button"
                      disabled={!vendor.enabled}
                      aria-pressed={vendor.enabled}
                      title={vendor.enabled ? "Analytics Hub is currently using AWS data sources." : `${vendor.label} support will be added later.`}
                      className={classNames(
                        "min-w-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                        vendor.enabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-[0_12px_22px_rgba(16,185,129,0.14)]"
                          : "cursor-not-allowed border-white/55 bg-white/30 text-slate-400",
                      )}
                    >
                      <span className="block truncate">{vendor.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccountsOpen((open) => !open)}
                className="inline-flex items-center justify-between gap-3 rounded-[16px] border border-white/70 bg-white/76 px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_12px_28px_rgba(148,163,184,0.16)] transition hover:bg-white"
                aria-expanded={accountsOpen}
              >
                <span>Manage accounts</span>
                <span className={classNames("text-slate-500 transition", accountsOpen ? "rotate-180" : "")}>v</span>
              </button>
            </div>
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
                  {selectedAccountKeys.length > 0 ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckIcon />
                      AWS account connected successfully
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  {availableAccountKeys.length > 0 ? (
                    availableAccountKeys.map((accountKey) => {
                      const isSelected = selectedAccountKeys.includes(accountKey);
                      const snapshotAccount = snapshot.accounts.find((account) => account.account_key === accountKey);
                      return (
                        <button
                          key={accountKey}
                          type="button"
                          onClick={() => toggleAccountSelection(accountKey)}
                          className={classNames(
                            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                            isSelected
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_14px_28px_rgba(16,185,129,0.16)]"
                              : "border-white/45 bg-white/30 text-slate-700 hover:bg-white/48",
                          )}
                          aria-pressed={isSelected}
                          title={[
                            snapshotAccount?.account_id ? `Account ID: ${snapshotAccount.account_id}` : "",
                            snapshotAccount?.region ? `Region: ${snapshotAccount.region}` : "",
                          ].filter(Boolean).join(" | ")}
                        >
                          {isSelected ? <span className="text-emerald-600"><CheckIcon /></span> : null}
                          <span>{formatAccountLabel(accountKey)}</span>
                          {isSelected ? <span className="text-xs font-semibold text-emerald-700">Connected</span> : null}
                          {snapshotAccount?.region ? <span className="text-xs text-slate-500">{snapshotAccount.region}</span> : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-slate-600">No accounts loaded.</div>
                  )}
                </div>
                {selectedAccountKeys.length > 0 ? (
                  <div className="min-w-[14rem] space-y-2 text-sm text-slate-700">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Account Details</div>
                    {selectedAccountKeys.map((accountKey) => {
                      const snapshotAccount = snapshot.accounts.find((account) => account.account_key === accountKey);
                      return (
                        <div key={`${accountKey}-details`} className="leading-6">
                          <div className="font-semibold text-slate-900">{formatAccountLabel(accountKey)}</div>
                          <div>ID: {snapshotAccount?.account_id || "Pending snapshot"}</div>
                          <div>Region: {snapshotAccount?.region || "Pending snapshot"}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <SummaryMetric
              label="Cloud Health Score"
              value={`${dashboardSummary.healthScore}`}
              helper="100 is clean"
              tone={dashboardSummary.healthScore >= 85 ? "emerald" : dashboardSummary.healthScore >= 65 ? "amber" : "rose"}
            />
            <SummaryMetric
              label="Critical Issues"
              value={String(dashboardSummary.criticalIssues)}
              helper="Critical and high"
              tone={dashboardSummary.criticalIssues > 0 ? "rose" : "slate"}
            />
            <SummaryMetric
              label="Monthly Spend"
              value={formatCurrency(dashboardSummary.spend)}
              helper="30 day selected spend"
              tone="sky"
            />
            <SummaryMetric
              label="Potential Savings"
              value={formatCurrency(dashboardSummary.potentialSavings)}
              helper="Idle and rightsizing"
              tone={dashboardSummary.potentialSavings > 0 ? "emerald" : "slate"}
            />
            <SummaryMetric
              label="Expiring Certificates"
              value={String(dashboardSummary.urgentCertificates)}
              helper="Within 30 days"
              tone={dashboardSummary.urgentCertificates > 0 ? "rose" : "slate"}
            />
            <SummaryMetric
              label="Utilization Alerts"
              value={String(dashboardSummary.utilizationIssues)}
              helper="Underused or overused"
              tone={dashboardSummary.utilizationIssues > 0 ? "amber" : "slate"}
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureTabs.map((feature) => {
              const isCertificateFeature = feature.title === "Certificate Expiry Watch";
              const isUtilizationFeature = feature.title === "Utilization Insights";
              const isIdleFeature = feature.title === "Idle Resource Detector";
              const isFinancialFeature = feature.title === "Financial Impact";
              const isEcsFeature = feature.title === "ECS Health";
              const isPriorityFeature = feature.title === "Priority Action Queue";
              const isProactiveFeature = feature.title === "Proactive Recommendations";
              const isTroubleshootingFeature = feature.title === "Unified Troubleshooting";
              return (
                <FeatureTab
                  key={feature.title}
                  {...feature}
                  hasAlert={
                    isPriorityFeature
                      ? normalizedFindings.some((finding) => finding.severity === "critical" || finding.severity === "high")
                      : isUtilizationFeature
                        ? hasOverusedTrackedUtilizationResource
                        : isCertificateFeature && hasUrgentCertificate
                  }
                  onClick={
                    isCertificateFeature
                      ? scrollToCertificates
                      : isUtilizationFeature
                        ? () => {
                            setUtilizationModalOpen(true);
                            if (!utilizationAnalysis || utilizationAnalysis === utilizationFallbackAnalysis(utilizationRows)) {
                              void analyzeUtilization();
                            }
                          }
                        : isIdleFeature
                          ? () => scrollToSection(resourceDoctorSectionRef)
                          : isFinancialFeature
                            ? () => scrollToSection(financialSectionRef)
                            : isEcsFeature
                              ? () => scrollToSection(ecsSectionRef)
                              : isPriorityFeature
                                ? () => scrollToSection(priorityQueueSectionRef)
                                : isProactiveFeature
                                  ? () => setWorkflowModalKind("proactive")
                          : isTroubleshootingFeature
                            ? () => setTroubleshootingOpen(true)
                          : undefined
                  }
                >
                  {isUtilizationFeature ? <UtilizationTileBars rows={trackedUtilizationRows} /> : null}
                </FeatureTab>
              );
            })}
          </div>
        </section>

        <OperationsBrief
          findings={normalizedFindings.filter((finding) => !ignoredFindingIds.has(finding.id))}
          spendItems={aggregatedServiceSpend}
          idleRows={idleResourceRows}
          utilizationRows={utilizationRows}
          certificates={certificateItems}
          accounts={filteredAccounts}
          storageStatus={storageStatus}
          updatedLabel={updatedLabel}
          onDiscuss={(finding) => void openFindingDiscussion(finding)}
        />

        <section ref={priorityQueueSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <PriorityActionQueue
            findings={normalizedFindings}
            updatedLabel={updatedLabel}
            ignoredIds={ignoredFindingIds}
            onDiscuss={(finding) => void openFindingDiscussion(finding)}
            onDetails={setFindingDetail}
            onPlan={openActionPlanForFinding}
            onRefreshSource={refreshFindingSource}
            onIgnore={(findingId) =>
              setIgnoredFindingIds((current) => {
                const next = new Set(current);
                next.add(findingId);
                return next;
              })
            }
          />
        </section>

        <section ref={resourceDoctorSectionRef} className="scroll-mt-24">
          <ResourceDoctor
            findings={normalizedFindings.filter((finding) => !ignoredFindingIds.has(finding.id))}
            filter={resourceDoctorFilter}
            onFilterChange={setResourceDoctorFilter}
            onDiscuss={(finding) => void openFindingDiscussion(finding)}
            onPlan={openActionPlanForFinding}
            onRefreshSource={refreshFindingSource}
          />
        </section>

        <section ref={financialSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <FinancialImpactCard
            rows={financialServiceSpendRows}
            items={aggregatedServiceSpend}
            total={totalFinancialSpend}
            topAccountLabel={topFinancialAccount ? formatAccountLabel(topFinancialAccount.account_key) : "None"}
            possibleSaving={possibleIdleSaving}
            accountKeys={availableAccountKeys}
            selectedAccountKeys={financialAccountKeys.length ? financialAccountKeys : selectedAccountKeys}
            updatedLabel={updatedLabel}
            view={financialImpactView}
            onViewChange={setFinancialImpactView}
            onToggleAccount={toggleFinancialAccount}
            onRefresh={() => void queueRefresh("financial")}
            onDiscuss={() =>
              void openTableDiscussion(
                "Financial Impact Table",
                ["Service", "Current Spend ($)", "Share of Selected Spend"],
                financialServiceSpendRows,
              )
            }
            onExplainSpend={() => discussFinancialContext("drivers")}
            onFindWaste={() => discussFinancialContext("waste")}
            onShowHighestCost={() => discussFinancialContext("highest")}
          />
        </section>

        <section ref={utilizationSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <UtilizationInsightsCard
            rows={utilizationRows}
            analysis={utilizationAnalysis}
            isAnalyzing={utilizationAnalyzing}
            updatedLabel={updatedLabel}
            onAnalyze={() => void analyzeUtilization()}
            onRefresh={() => void queueRefresh("utilization")}
            onDiscuss={() =>
              void openTableDiscussion(
                "Utilization Insights",
                ["Account", "Source", "Resource", "Running / Desired", "Pending", "Utilization", "Severity", "Reason / Solution"],
                utilizationDiscussionRows,
              )
            }
            onDiscussRow={(row) => {
              const finding = findUtilizationFinding(row);
              if (finding) void openFindingDiscussion(finding);
            }}
          />
        </section>

        <section ref={ecsSectionRef} className="mt-6 grid scroll-mt-24 gap-4 lg:grid-cols-2 content-visibility-auto">
          <DataCard
            title="Account Summary"
            headers={["Account", "Region", "Project Name", "Project Owner", "30d Spend", "Top Service"]}
            rows={accountSummaryRows}
            emptyText="No account summary rows are available yet."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh("accounts")}
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
            utilizationIssues={utilizationRows.filter((row) => row.resourceType.toLowerCase().includes("ecs") && (row.utilizationStatus !== "balanced" || row.severity !== "ok")).length}
            onFilterChange={setEcsFilter}
            onExpand={() => setEcsExpanded(true)}
            onNodeDetail={setEcsNodeDetail}
            onDiscuss={() => discussEcsContext("context")}
            onFindIssues={() => discussEcsContext("issues")}
            onExplain={() => discussEcsContext("structure")}
            onRefresh={() => void queueRefresh("utilization")}
          />
        </section>

        <section ref={certificatesSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <CertificateExpiryWatchCard
            items={certificateItems}
            accounts={filteredAccounts}
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh("certificates")}
            onDiscuss={(finding) => void openFindingDiscussion(finding)}
            onDetails={setFindingDetail}
          />
        </section>

        <TroubleshootingEntrySection onOpen={() => setTroubleshootingOpen(true)} />

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

      <GuideDock
        open={guideDockOpen}
        onToggle={() => setGuideDockOpen((current) => !current)}
        onStartTour={() => openGuideTour(0)}
        onAccounts={openAccountsFromGuide}
        onUtilization={openUtilizationFromGuide}
        onPriority={openPriorityFromGuide}
        onCertificates={openCertificatesFromGuide}
        onFinancial={openFinancialFromGuide}
        onTroubleshooting={openTroubleshootingFromGuide}
      />

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

      {guideTourOpen ? (
        <GuideTourModal
          stepIndex={guideStepIndex}
          onStepIndexChange={setGuideStepIndex}
          onClose={() => setGuideTourOpen(false)}
          onAccounts={openAccountsFromGuide}
          onIdle={() => {
            setGuideTourOpen(false);
            setGuideDockOpen(false);
            scrollToSection(resourceDoctorSectionRef);
          }}
          onUtilization={openUtilizationFromGuide}
          onPriority={openPriorityFromGuide}
          onTroubleshooting={openTroubleshootingFromGuide}
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
