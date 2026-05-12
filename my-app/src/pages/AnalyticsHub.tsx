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

const TRACKED_UTILIZATION_STORAGE_KEY = "analytics_hub_tracked_utilization_resources_v1";
const DEFAULT_TRACKED_UTILIZATION_COUNT = 4;

const guideHighlights = {
  whyMe: [
    "I turn configured AWS accounts into a live operations cockpit with fast JSONL-backed tables.",
    "I route chat questions through a scored tool catalog before asking the LLM to synthesize.",
    "I help convert spend, idle-resource, certificate, and utilization signals into practical actions.",
  ],
  suggestions: [
    "Start with Accounts, then inspect Financial Impact because that table refreshes first.",
    "Refresh Detect Idle Resources to pull EC2 and CloudWatch evidence into the JSONL snapshot.",
    "Open Utilization Insights to pin the ECS services you want monitored on the tile.",
    "Send any table to chat when you need a grounded explanation or cleanup plan.",
  ],
} as const;

const agentFlowHighlights = [
  {
    label: "1. Deterministic first",
    detail: "Entities, triggers, and semantic similarity score the tool catalog before an LLM planner is used.",
  },
  {
    label: "2. JSONL memory",
    detail: "Chat context, AWS responses, table refreshes, and tool vectors are persisted locally without a database.",
  },
  {
    label: "3. AWS-native pulls",
    detail: "Tools call Cost Explorer, CloudWatch, EC2, ECS, ACM, Budgets, STS, and tagging APIs directly.",
  },
  {
    label: "4. LLM after grounding",
    detail: "The LLM explains implications only after AWS data has been fetched, cached, and shaped.",
  },
] as const;

const agentBuildDetails = [
  {
    title: "Tool catalog",
    body: "Each tool declares endpoint, trigger language, required inputs, cache policy, response shape, and live-call need.",
  },
  {
    title: "Semantic router",
    body: "FAISS is used when available; otherwise the same normalized vector score runs locally in Python.",
  },
  {
    title: "Idle resource evidence",
    body: "EC2 inventory and CloudWatch CPU/network metrics produce idle findings, implications, and actions.",
  },
  {
    title: "Chat-ready tables",
    body: "Every table can become a focused chat context so follow-ups reuse the latest session dataset.",
  },
] as const;

const agentScoreFormula =
  "Improvement path: final_score = 0.55 * semantic similarity + 0.25 * deterministic trigger score + 0.20 * entity score.";

const guideSteps = [
  {
    title: "Land on live signals",
    tag: "Landing",
    body: "Analytics Hub opens from stored JSON/JSONL data first, then refreshes AWS-backed sections without blocking the first screen.",
    action: "Review Financial Impact first, then use the tiles to jump into operational signals.",
  },
  {
    title: "Choose accounts",
    tag: "Accounts",
    body: "Accounts lets you choose from the backend-configured AWS accounts before reviewing cost, utilization, and certificate data.",
    action: "Open Accounts and select the environments you want included.",
  },
  {
    title: "Find idle waste",
    tag: "Idle",
    body: "Detect Idle Resources uses AWS EC2 inventory and CloudWatch metrics to surface stopped, idle, and underused instances with implications.",
    action: "Refresh the idle table, then click Analyze for an LLM-written cleanup summary.",
  },
  {
    title: "Track utilization",
    tag: "Analyze",
    body: "Utilization Insights tracks ECS services, lets you pin monitored resources, and blinks red when a tracked service is overused.",
    action: "Open the Utilization modal, choose monitored resources, and expand Analysis when you need the summary.",
  },
  {
    title: "Discuss a table",
    tag: "Chat",
    body: "The discuss button sends the current table into a dedicated chat context so follow-up questions stay grounded in the selected data.",
    action: "Use the chat icon on any table and ask for root cause, risk, or next steps.",
  },
  {
    title: "Move to action",
    tag: "Workflow",
    body: "The chat flow can turn table evidence into owner-ready remediation plans while staying grounded in the selected data.",
    action: "Send an idle, certificate, financial, or utilization table to chat and ask for the next safe action.",
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
}: {
  open: boolean;
  onToggle: () => void;
  onStartTour: () => void;
  onAccounts: () => void;
  onUtilization: () => void;
  onPriority: () => void;
}) {
  const [activeTopic, setActiveTopic] = useState<"why" | "suggest" | "iam" | "built">("why");
  const topicContent = {
    why: { title: "Why me", body: guideHighlights.whyMe },
    suggest: { title: "I suggest", body: guideHighlights.suggestions },
    iam: {
      title: "I am",
      body: [
        "A lightweight cloud operations workspace that blends AWS cost, resource health, guided troubleshooting, and LLM-assisted analysis into one dashboard.",
      ],
    },
    built: {
      title: "How I am built",
      body: [
        ...agentFlowHighlights.map((item) => `${item.label}: ${item.detail}`),
        `Semantic scoring upgrade: ${agentScoreFormula}`,
        ...agentBuildDetails.map((item) => `${item.title}: ${item.body}`),
      ],
    },
  } as const;
  const currentTopic = topicContent[activeTopic];

  return (
    <aside className="fixed left-3 top-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-start gap-3 sm:left-5 sm:top-5">
      <button
        type="button"
        onClick={onToggle}
        className="guide-glow inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/70 bg-slate-950/82 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_rgba(15,23,42,0.28)] backdrop-blur-md transition hover:bg-slate-900 sm:min-h-12 sm:py-3"
        aria-expanded={open}
      >
        <GuideIcon />
        <span>Your Guide</span>
      </button>

      {open ? (
        <div className="guide-slide-in flex max-w-[calc(100vw-6.5rem)] flex-col gap-2 rounded-[26px] border border-white/65 bg-[linear-gradient(135deg,rgba(245,251,255,0.98),rgba(218,235,255,0.94))] p-3 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.24)] backdrop-blur-[24px] sm:max-w-[46rem]">
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["why", "Why me"],
              ["suggest", "I suggest"],
              ["iam", "I am"],
              ["built", "How I am built"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onMouseEnter={() => setActiveTopic(key)}
                onFocus={() => setActiveTopic(key)}
                onClick={() => setActiveTopic(key)}
                className={classNames(
                  "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                  activeTopic === key
                    ? "border-sky-300/70 bg-sky-600 text-white shadow-[0_12px_26px_rgba(2,132,199,0.18)]"
                    : "border-white/70 bg-white/62 text-slate-700 hover:bg-white",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onStartTour}
              className="rounded-full border border-sky-300/70 bg-white/82 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-800 transition hover:bg-white"
            >
              Tour
            </button>
            <button type="button" onClick={onToggle} className={glassButtonClass} aria-label="Close guide" title="Close">
              <CloseIcon />
            </button>
          </div>

          <div className="guide-popover guide-shine relative overflow-hidden rounded-[24px] border border-white/65 bg-[linear-gradient(135deg,rgba(2,132,199,0.96),rgba(15,23,42,0.92))] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
            <div className="relative">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">{currentTopic.title}</div>
              <ul className="mt-3 grid gap-2 text-xs leading-5 text-sky-50/90 sm:grid-cols-2">
                {currentTopic.body.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/16 bg-white/10 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
              {activeTopic === "suggest" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={onUtilization} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
                    Analyze utilization
                  </button>
                  <button type="button" onClick={onPriority} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Priority issues
                  </button>
                  <button type="button" onClick={onAccounts} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Accounts
                  </button>
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
  onActionPlan,
}: {
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  onClose: () => void;
  onAccounts: () => void;
  onIdle: () => void;
  onUtilization: () => void;
  onPriority: () => void;
  onActionPlan: () => void;
}) {
  const currentStep = guideSteps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / guideSteps.length) * 100);

  function move(offset: number) {
    onStepIndexChange((stepIndex + offset + guideSteps.length) % guideSteps.length);
  }

  function runStepAction() {
    if (currentStep.tag === "Accounts") onAccounts();
    else if (currentStep.tag === "Analyze") onUtilization();
    else if (currentStep.tag === "Idle") onIdle();
    else if (currentStep.tag === "Workflow") onPriority();
    else if (currentStep.tag === "Chat") onActionPlan();
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
                Guided tour
              </div>
              <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:mt-5 sm:text-3xl">Navigate from signal to action</h2>
              <p className="mt-3 text-xs leading-6 text-sky-50/88 sm:mt-4 sm:text-sm sm:leading-7">
                Follow the animated path: choose accounts, inspect live signals, ask grounded questions, then turn
                findings into an action plan.
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
                  <li key={suggestion} className="flex gap-2">
                    <CheckIcon />
                    <span>{suggestion}</span>
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
        {children ? <span className="mt-4 block w-full">{children}</span> : null}
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
  accountKeys,
  selectedAccountKeys,
  updatedLabel,
  view,
  onViewChange,
  onToggleAccount,
  onRefresh,
  onDiscuss,
}: {
  rows: ReactNode[][];
  items: Array<{ service: string; cost: number; share: string }>;
  total: number;
  accountKeys: string[];
  selectedAccountKeys: string[];
  updatedLabel: string;
  view: "table" | "bar";
  onViewChange: (view: "table" | "bar") => void;
  onToggleAccount: (accountKey: string) => void;
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
  const selectedSet = new Set(selectedAccountKeys);

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
          <div className="mt-3 text-xs text-slate-600">Monitoring test-app-ecs-cluster and dev-app-ecs-cluster</div>
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

type UtilizationInsightRow = {
  account: string;
  cluster: string;
  service: string;
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
  reason: string;
  solution: string;
  consoleUrl: string | null;
};

type IdleResourceRow = {
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
  consoleUrl: string | null;
};

function flattenIdleResources(accounts: AnalyticsHubAccountSnapshot[]) {
  const rows: IdleResourceRow[] = [];
  for (const account of accounts) {
    for (const item of account.idle_resources ?? []) {
      rows.push({
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
        consoleUrl: item.console_url ?? null,
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

function flattenUtilizationInsights(accounts: AnalyticsHubAccountSnapshot[]) {
  const rows: UtilizationInsightRow[] = [];
  for (const account of accounts) {
    for (const cluster of account.ecs_clusters ?? []) {
      for (const service of cluster.services) {
        const utilizationPct = Math.round(service.utilization_percent ?? (service.desired_count > 0 ? (service.running_count / service.desired_count) * 100 : 0));
        const failedTaskCount = service.tasks.filter((task) => task.severity !== "ok").length;
        const utilizationStatus = service.utilization_status ?? (utilizationPct >= 85 ? "overused" : utilizationPct <= 30 ? "underused" : "balanced");
        rows.push({
          account: formatAccountLabel(account.account_key),
          cluster: cluster.cluster_name,
          service: service.service_name,
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
          consoleUrl: service.console_url ?? null,
          evidence: [
            service.insight,
            service.reason ? `reason=${service.reason}` : "",
            service.cpu_average_percent != null ? `cpu=${service.cpu_average_percent}%` : "",
            service.memory_average_percent != null ? `memory=${service.memory_average_percent}%` : "",
            service.deployment_status ? `deployment=${service.deployment_status}` : "",
            failedTaskCount > 0 ? `${failedTaskCount} task issue(s)` : "",
          ]
            .filter(Boolean)
            .join("; "),
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
  return "Selected ECS services are aligned with desired running capacity. No underused or overpressured service is currently visible in the stored snapshot.";
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
      source: "Analytics Hub ECS snapshot built from AWS ECS describe_clusters, list_services, describe_services, list_tasks, and describe_tasks.",
      row_count: rows.length,
      rows: dataRows,
    },
    null,
    2,
  );
}

function idleFallbackAnalysis(rows: IdleResourceRow[]) {
  if (rows.length === 0) {
    return "No idle or underused resources are available yet. Refresh idle resources after AWS credentials and EC2/CloudWatch access are configured.";
  }
  const critical = rows.filter((row) => row.severity === "critical");
  const warning = rows.filter((row) => row.severity === "warning");
  const firstItems = rows.slice(0, 3).map((row) => `${row.account}/${row.resourceId}`).join(", ");
  if (critical.length > 0) {
    return `${critical.length} critical idle resource candidate(s) need review. Start with ${firstItems}; validate ownership, then stop, schedule, rightsize, or terminate as appropriate.`;
  }
  if (warning.length > 0) {
    return `${warning.length} underused or stopped resource candidate(s) were found. Review implications before cleanup, especially attached storage and scheduled workloads.`;
  }
  return "No high-risk idle resource candidates are visible in the stored AWS snapshot.";
}

function buildIdleLlmContext(rows: IdleResourceRow[]) {
  return JSON.stringify(
    {
      source: "Analytics Hub idle resources snapshot built from AWS EC2 describe_instances and CloudWatch AWS/EC2 CPU/network metrics.",
      row_count: rows.length,
      rows: rows.slice(0, 50).map((row) => ({
        account: row.account,
        resource_type: row.resourceType,
        resource_id: row.resourceId,
        name: row.name,
        region: row.region,
        severity: row.severity,
        idle: row.idle,
        signal: row.signal,
        finding: row.finding,
        implication: row.implication,
        suggested_action: row.suggestedAction,
        cpu_average_pct: row.cpuAveragePct,
        network_average_bytes: row.networkAverageBytes,
      })),
    },
    null,
    2,
  );
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

function UtilizationInsightsCard({
  rows,
  analysis,
  isAnalyzing,
  updatedLabel,
  analysisInitiallyOpen = true,
  onAnalyze,
  onRefresh,
  onDiscuss,
}: {
  rows: UtilizationInsightRow[];
  analysis: string;
  isAnalyzing: boolean;
  updatedLabel: string;
  analysisInitiallyOpen?: boolean;
  onAnalyze: () => void;
  onRefresh: () => void;
  onDiscuss: () => void;
}) {
  const tableRows = rows.map((row) => [
    row.account,
    row.cluster,
    row.service,
    `${row.running}/${row.desired}`,
    row.pending ? String(row.pending) : "0",
    <UtilizationBar key={`${row.account}-${row.cluster}-${row.service}-bar`} percent={row.utilizationPct} status={row.utilizationStatus} />,
    <SeverityBadge key={`${row.account}-${row.cluster}-${row.service}-severity`} severity={row.severity} />,
    <div key={`${row.account}-${row.cluster}-${row.service}-reason`} className="max-w-xl">
      <div className="font-medium text-slate-900">{row.reason}</div>
      <div className="mt-1 text-slate-600">{row.solution}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        {row.cpuAveragePct != null ? <span>CPU {row.cpuAveragePct}%</span> : null}
        {row.memoryAveragePct != null ? <span>Memory {row.memoryAveragePct}%</span> : null}
        {row.consoleUrl ? (
          <a href={row.consoleUrl} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:text-sky-900">
            Open in AWS
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
      headers={["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Reason / Solution"]}
      rows={tableRows}
      emptyText="No ECS utilization rows are available yet. Refresh Analytics Hub after AWS credentials are configured."
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
      <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/55 bg-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead>
            <tr className="border-b border-slate-300/35 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Reason / Solution"].map((header) => (
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
                <td colSpan={8} className="px-4 py-7 text-slate-500">
                  No ECS utilization rows are available yet. Refresh Analytics Hub after AWS credentials are configured.
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
                        <div className="truncate text-xs text-slate-500">{row.account} / {row.cluster}</div>
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
                            <span className="block truncate text-xs text-slate-500">{row.account} / {row.cluster}</span>
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
          />
        </div>
      </div>
    </div>
  );
}

function IdleResourcesCard({
  rows,
  analysis,
  isAnalyzing,
  updatedLabel,
  onAnalyze,
  onRefresh,
  onDiscuss,
}: {
  rows: IdleResourceRow[];
  analysis: string;
  isAnalyzing: boolean;
  updatedLabel: string;
  onAnalyze: () => void;
  onRefresh: () => void;
  onDiscuss: () => void;
}) {
  const tableRows = rows.map((row) => [
    row.account,
    row.resourceType,
    <div key={`${row.resourceId}-resource`} className="min-w-0">
      <div className="font-semibold text-slate-900">{row.resourceId}</div>
      {row.name ? <div className="text-xs text-slate-500">{row.name}</div> : null}
    </div>,
    <SeverityBadge key={`${row.resourceId}-severity`} severity={row.severity} />,
    <div key={`${row.resourceId}-signal`} className="max-w-lg">
      <div className="font-medium text-slate-900">{row.finding}</div>
      <div className="mt-1 text-slate-600">{row.signal}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        {row.cpuAveragePct != null ? <span>CPU {row.cpuAveragePct}%</span> : null}
        {row.networkAverageBytes != null ? <span>Network {Math.round(row.networkAverageBytes)} bytes</span> : null}
        {row.consoleUrl ? (
          <a href={row.consoleUrl} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 hover:text-sky-900">
            Open in AWS
          </a>
        ) : null}
      </div>
    </div>,
    <div key={`${row.resourceId}-impact`} className="max-w-xl">
      <div className="font-medium text-slate-900">{row.implication}</div>
      <div className="mt-1 text-slate-600">{row.suggestedAction}</div>
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
      title="Detect Idle Resources"
      headers={["Account", "Resource Type", "Resource", "Severity", "Signal", "Implication / Action"]}
      rows={tableRows}
      emptyText="No idle resources are available in the current AWS snapshot."
      updatedLabel={updatedLabel}
      onRefresh={onRefresh}
      onDiscuss={onDiscuss}
      controls={controls}
    >
      <details className="mt-5 rounded-[22px] border border-white/55 bg-white/36 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
          LLM implication summary
        </summary>
        <div className="mt-3 text-sm leading-7 text-slate-700">{analysis}</div>
      </details>
      <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/55 bg-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead>
            <tr className="border-b border-slate-300/35 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {["Account", "Resource Type", "Resource", "Severity", "Signal", "Implication / Action"].map((header) => (
                <th key={header} className="px-4 py-4 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.length > 0 ? (
              tableRows.map((row, rowIndex) => (
                <tr key={`idle-${rowIndex}`} className="border-b border-slate-200/45 transition hover:bg-white/18 last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={`idle-${rowIndex}-${cellIndex}`} className="px-4 py-4 align-top text-[14px] leading-6 text-slate-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-7 text-slate-500">
                  No idle resources are available in the current AWS snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
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
  const [trackedUtilizationKeys, setTrackedUtilizationKeys] = useState<string[]>(() => loadTrackedUtilizationKeys());
  const [idleAnalysis, setIdleAnalysis] = useState("");
  const [idleAnalyzing, setIdleAnalyzing] = useState(false);
  const [guideDockOpen, setGuideDockOpen] = useState(false);
  const [guideTourOpen, setGuideTourOpen] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const idleResourcesSectionRef = useRef<HTMLElement | null>(null);
  const utilizationSectionRef = useRef<HTMLElement | null>(null);
  const proactiveSectionRef = useRef<HTMLElement | null>(null);
  const actionPlanSectionRef = useRef<HTMLElement | null>(null);
  const prioritySectionRef = useRef<HTMLElement | null>(null);
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

  async function queueRefresh(tableKey = "all") {
    setRefreshInProgress(true);
    setRefreshingTableKey(tableKey);
    const result = await chatApi.refreshAnalyticsHubSnapshot(tableKey);
    if (!result.ok) {
      setRefreshInProgress(false);
      setRefreshingTableKey(null);
      return;
    }
    window.setTimeout(() => {
      void loadSnapshot();
      setRefreshingTableKey(null);
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

  const totalFinancialSpend = useMemo(
    () => financialFilteredAccounts.reduce((sum, account) => sum + account.total_cost_30d, 0),
    [financialFilteredAccounts],
  );
  const aggregatedServiceSpend = useMemo(() => aggregateServiceSpend(financialFilteredAccounts), [financialFilteredAccounts]);
  const idleResourceRows = useMemo(() => flattenIdleResources(filteredAccounts), [filteredAccounts]);
  const idleDiscussionRows = useMemo(
    () =>
      idleResourceRows.map((row) => [
        row.account,
        row.resourceType,
        row.resourceId,
        row.severity,
        row.signal,
        `${row.implication} Action: ${row.suggestedAction}`,
      ]),
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
        row.cluster,
        row.service,
        `${row.running}/${row.desired}`,
        String(row.pending),
        `${row.utilizationPct}% ${row.utilizationStatus}`,
        row.severity,
        `${row.reason} Solution: ${row.solution}`,
      ]),
    [utilizationRows],
  );

  const updatedLabel = refreshInProgress
    ? `Updated moments ago - Refreshing ${refreshingTableKey ?? "data"}`
    : formatRelativeTime(snapshot.generated_at_utc);

  useEffect(() => {
    setUtilizationAnalysis(utilizationFallbackAnalysis(utilizationRows));
  }, [utilizationRows]);

  useEffect(() => {
    setIdleAnalysis(idleFallbackAnalysis(idleResourceRows));
  }, [idleResourceRows]);

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
    setAccountsOpen(true);
  }

  function openUtilizationFromGuide() {
    setGuideTourOpen(false);
    setUtilizationModalOpen(true);
    if (!utilizationAnalysis || utilizationAnalysis === utilizationFallbackAnalysis(utilizationRows)) {
      void analyzeUtilization();
    }
  }

  function openPriorityFromGuide() {
    setGuideTourOpen(false);
    scrollToSection(prioritySectionRef);
  }

  function openActionPlanFromGuide() {
    setGuideTourOpen(false);
    scrollToSection(actionPlanSectionRef);
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

  async function analyzeIdleResources() {
    if (idleAnalyzing || idleResourceRows.length === 0) return;
    setIdleAnalyzing(true);
    const fallback = idleFallbackAnalysis(idleResourceRows);
    const result = await chatApi.answerWithContext({
      query: [
        "Analyze these AWS idle and underused resource rows.",
        "Explain operational and cost implications, name the first resources to review, and suggest practical cleanup actions.",
        "Use only the supplied context.",
      ].join(" "),
      context: buildIdleLlmContext(idleResourceRows),
    });
    setIdleAnalysis(result.ok ? result.data.answer : fallback);
    setIdleAnalyzing(false);
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
              ["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Reason / Solution"],
              utilizationDiscussionRows,
            )
          }
          onToggleTracked={toggleTrackedUtilizationResource}
          onClose={() => setUtilizationModalOpen(false)}
        />
      ) : null}

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
            <button
              type="button"
              onClick={() => openGuideTour(0)}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/65 bg-slate-950/82 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition hover:bg-slate-900"
            >
              <GuideIcon />
              <span>Tour</span>
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
              const isUtilizationFeature = feature.title === "Utilization Insights";
              const isIdleFeature = feature.title === "Detect Idle Resources";
              const isProactiveFeature = feature.title === "Proactive Recommendations";
              return (
                <FeatureTab
                  key={feature.title}
                  {...feature}
                  hasAlert={isUtilizationFeature ? hasOverusedTrackedUtilizationResource : isCertificateFeature && hasUrgentCertificate}
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
                          ? () => scrollToSection(idleResourcesSectionRef)
                          : isProactiveFeature
                            ? () => scrollToSection(proactiveSectionRef)
                            : undefined
                  }
                >
                  {isUtilizationFeature ? <UtilizationTileBars rows={trackedUtilizationRows} /> : null}
                </FeatureTab>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureTabs.slice(4).map((feature) => {
              const isTroubleshootingFeature = feature.title === "Unified Troubleshooting Chat";
              const isActionPlanFeature = feature.title === "Action Plan Generator";
              const isPriorityFeature = feature.title === "Priority Issue Tracker";
              return (
                <FeatureTab
                  key={feature.title}
                  {...feature}
                  onClick={
                    isTroubleshootingFeature
                      ? () => setTroubleshootingOpen(true)
                      : isActionPlanFeature
                        ? () => scrollToSection(actionPlanSectionRef)
                        : isPriorityFeature
                          ? () => scrollToSection(prioritySectionRef)
                          : undefined
                  }
                />
              );
            })}
          </div>
        </section>

        <section className="mt-6 content-visibility-auto">
          <FinancialImpactCard
            rows={financialServiceSpendRows}
            items={aggregatedServiceSpend}
            total={totalFinancialSpend}
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
                ["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Reason / Solution"],
                utilizationDiscussionRows,
              )
            }
          />
        </section>

        <section ref={idleResourcesSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <IdleResourcesCard
            rows={idleResourceRows}
            analysis={idleAnalysis}
            isAnalyzing={idleAnalyzing}
            updatedLabel={updatedLabel}
            onAnalyze={() => void analyzeIdleResources()}
            onRefresh={() => void queueRefresh("idle")}
            onDiscuss={() =>
              void openTableDiscussion(
                "Detect Idle Resources",
                ["Account", "Resource Type", "Resource", "Severity", "Signal", "Implication / Action"],
                idleDiscussionRows,
              )
            }
          />
        </section>

        <section ref={proactiveSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <DataCard
            title="Proactive Recommendations"
            headers={["Category", "Signal", "Recommendation", "Priority"]}
            rows={[]}
            emptyText="No proactive recommendations are available in the current AWS snapshot."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh("utilization")}
            onDiscuss={() =>
              void openTableDiscussion(
                "Proactive Recommendations",
                ["Category", "Signal", "Recommendation", "Priority"],
                [],
              )
            }
          />
        </section>

        <section ref={actionPlanSectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <DataCard
            title="Action Plan Generator"
            headers={["Step", "Action", "Owner", "Next Step", "Target"]}
            rows={[]}
            emptyText="No action plan rows are available yet."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh("utilization")}
            onDiscuss={() =>
              void openTableDiscussion(
                "Action Plan Generator",
                ["Step", "Action", "Owner", "Next Step", "Target"],
                [],
              )
            }
          />
        </section>

        <section ref={prioritySectionRef} className="mt-6 scroll-mt-24 content-visibility-auto">
          <DataCard
            title="Priority Issue Tracker"
            headers={["Priority", "Issue", "Impact", "Severity", "Recommended Workflow"]}
            rows={[]}
            emptyText="No priority issues are available in the current AWS snapshot."
            updatedLabel={`${updatedLabel} - ranked by severity and operational impact`}
            onRefresh={() => void queueRefresh("utilization")}
            onDiscuss={() =>
              void openTableDiscussion(
                "Priority Issue Tracker",
                ["Priority", "Issue", "Impact", "Severity", "Recommended Workflow"],
                [],
              )
            }
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2 content-visibility-auto">
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
            onFilterChange={setEcsFilter}
            onExpand={() => setEcsExpanded(true)}
            onNodeDetail={setEcsNodeDetail}
          />
        </section>

        <section ref={certificatesSectionRef} className="mt-6 grid scroll-mt-24 gap-4 lg:grid-cols-[1.25fr_0.75fr] content-visibility-auto">
          <DataCard
            title="ACM Certificates Expiring Soon"
            headers={["Account", "Domain", "Expiry Date", "Days Left"]}
            rows={certificateRows}
            emptyText="No ACM certificates expiring within the current snapshot window were found."
            updatedLabel={updatedLabel}
            onRefresh={() => void queueRefresh("certificates")}
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
            <p>Analytics Hub is the default entry point, and the background AWS refresh keeps these modules current.</p>
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

      <GuideDock
        open={guideDockOpen}
        onToggle={() => setGuideDockOpen((current) => !current)}
        onStartTour={() => openGuideTour(0)}
        onAccounts={openAccountsFromGuide}
        onUtilization={openUtilizationFromGuide}
        onPriority={openPriorityFromGuide}
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
            scrollToSection(idleResourcesSectionRef);
          }}
          onUtilization={openUtilizationFromGuide}
          onPriority={openPriorityFromGuide}
          onActionPlan={openActionPlanFromGuide}
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
