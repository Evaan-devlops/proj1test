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
import { useAppConfigStore, type ConfiguredAwsAccount } from "src/store/appConfig.store";
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

function ConfigureIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13.5a7.8 7.8 0 0 0 .05-1l2.05-1.55-2-3.46-2.42.98a7.7 7.7 0 0 0-.86-.5L15.9 5.4h-4l-.36 2.57c-.3.14-.59.31-.86.5l-2.42-.98-2 3.46 2.05 1.55a7.8 7.8 0 0 0 .05 1l-2.1 1.58 2 3.46 2.48-1c.26.18.53.34.82.48l.34 2.58h4l.34-2.58c.29-.14.56-.3.82-.48l2.48 1 2-3.46-2.1-1.58zM13.9 19h-2l-.25-1.88-.56-.22a5.7 5.7 0 0 1-1.1-.64l-.48-.35-1.8.73-1-1.73 1.54-1.16-.08-.58a5.82 5.82 0 0 1 0-1.34l.08-.58-1.5-1.13 1-1.73 1.76.71.48-.35c.34-.25.71-.47 1.1-.64l.56-.22L11.9 7h2l.25 1.88.56.22c.39.17.76.39 1.1.64l.48.35 1.76-.71 1 1.73-1.5 1.13.08.58a5.82 5.82 0 0 1 0 1.34l-.08.58 1.54 1.16-1 1.73-1.8-.73-.48.35c-.34.25-.71.47-1.1.64l-.56.22L13.9 19zM12.9 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
      />
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

const MOCK_SNAPSHOT: AnalyticsHubSnapshot = {
  generated_at_utc: new Date().toISOString(),
  account_count: 3,
  accounts: [
    {
      account_key: "dev",
      account_id: "111122223333",
      region: "us-east-1",
      project_name: "GenAI Sandbox",
      project_owner: "Platform AI",
      total_cost_30d: 18420.75,
      service_spend_30d: [
        { service: "Amazon ECS", cost: 4210.2 },
        { service: "Amazon OpenSearch Service", cost: 3988.42 },
        { service: "AmazonCloudWatch", cost: 1875.18 },
        { service: "Amazon Relational Database Service", cost: 1760.25 },
        { service: "AWS Lambda", cost: 890.77 },
      ],
      monthly_cost_trend: [
        { month: "2026-01-01", cost: 14880.11 },
        { month: "2026-02-01", cost: 15920.44 },
        { month: "2026-03-01", cost: 17340.19 },
        { month: "2026-04-01", cost: 18420.75 },
      ],
      expiring_certificates: [
        {
          certificate_arn: "arn:aws:acm:us-east-1:111122223333:certificate/mock-dev-1",
          domain_name: "dev.api.internal.example.com",
          expiry_date: "2026-05-28",
          days_to_expiry: 21,
        },
        {
          certificate_arn: "arn:aws:acm:us-east-1:111122223333:certificate/mock-dev-2",
          domain_name: "dev-console.internal.example.com",
          expiry_date: "2026-07-14",
          days_to_expiry: 68,
        },
      ],
      ecs_clusters: [
        {
          cluster_name: "dev-app-ecs-cluster",
          cluster_arn: "arn:aws:ecs:us-east-1:111122223333:cluster/dev-app-ecs-cluster",
          status: "ACTIVE",
          severity: "warning",
          insight: "One service has pending tasks and should be checked for capacity placement.",
          services: [
            {
              service_name: "genai-chat-api",
              service_arn: "arn:aws:ecs:us-east-1:111122223333:service/dev-app-ecs-cluster/genai-chat-api",
              status: "ACTIVE",
              desired_count: 4,
              running_count: 3,
              pending_count: 1,
              launch_type: "FARGATE",
              task_definition: "genai-chat-api:42",
              deployment_status: "IN_PROGRESS",
              severity: "warning",
              insight: "Only 3/4 desired task(s) are running.",
              events: ["service genai-chat-api was unable to place a task because CPU capacity was unavailable."],
              tasks: [
                {
                  task_arn: "arn:aws:ecs:task/dev-app-ecs-cluster/mock-task-1",
                  task_id: "mock-task-1",
                  last_status: "RUNNING",
                  desired_status: "RUNNING",
                  health_status: "HEALTHY",
                  launch_type: "FARGATE",
                  stopped_reason: null,
                  container_reasons: [],
                  severity: "ok",
                },
                {
                  task_arn: "arn:aws:ecs:task/dev-app-ecs-cluster/mock-task-2",
                  task_id: "mock-task-2",
                  last_status: "PENDING",
                  desired_status: "RUNNING",
                  health_status: "UNKNOWN",
                  launch_type: "FARGATE",
                  stopped_reason: null,
                  container_reasons: ["RESOURCE:CPU"],
                  severity: "warning",
                },
              ],
            },
            {
              service_name: "genai-worker",
              service_arn: "arn:aws:ecs:us-east-1:111122223333:service/dev-app-ecs-cluster/genai-worker",
              status: "ACTIVE",
              desired_count: 2,
              running_count: 2,
              pending_count: 0,
              launch_type: "FARGATE",
              task_definition: "genai-worker:18",
              deployment_status: "COMPLETED",
              severity: "ok",
              insight: "Service is active with 2/2 desired task(s) running.",
              events: ["service genai-worker has reached a steady state."],
              tasks: [],
            },
          ],
        },
      ],
    },
    {
      account_key: "prod",
      account_id: "444455556666",
      region: "us-east-1",
      project_name: "Production Workloads",
      project_owner: "Cloud Ops",
      total_cost_30d: 64210.32,
      service_spend_30d: [
        { service: "Amazon Textract", cost: 18840.91 },
        { service: "Amazon ECS", cost: 13422.18 },
        { service: "Amazon OpenSearch Service", cost: 11902.64 },
        { service: "Amazon Relational Database Service", cost: 6720.1 },
        { service: "AmazonCloudWatch", cost: 4091.33 },
      ],
      monthly_cost_trend: [
        { month: "2026-01-01", cost: 57910.2 },
        { month: "2026-02-01", cost: 60440.71 },
        { month: "2026-03-01", cost: 62118.5 },
        { month: "2026-04-01", cost: 64210.32 },
      ],
      expiring_certificates: [
        {
          certificate_arn: "arn:aws:acm:us-east-1:444455556666:certificate/mock-prod-1",
          domain_name: "prod.api.internal.example.com",
          expiry_date: "2026-06-03",
          days_to_expiry: 27,
        },
      ],
      ecs_clusters: [
        {
          cluster_name: "test-app-ecs-cluster",
          cluster_arn: "arn:aws:ecs:us-east-1:444455556666:cluster/test-app-ecs-cluster",
          status: "ACTIVE",
          severity: "critical",
          insight: "One selected service has no running tasks.",
          services: [
            {
              service_name: "genai-ingestion",
              service_arn: "arn:aws:ecs:us-east-1:444455556666:service/test-app-ecs-cluster/genai-ingestion",
              status: "ACTIVE",
              desired_count: 3,
              running_count: 0,
              pending_count: 0,
              launch_type: "FARGATE",
              task_definition: "genai-ingestion:67",
              deployment_status: "FAILED",
              severity: "critical",
              insight: "Only 0/3 desired task(s) are running.",
              events: ["service genai-ingestion deployment failed because essential container exited."],
              tasks: [
                {
                  task_arn: "arn:aws:ecs:task/test-app-ecs-cluster/mock-task-3",
                  task_id: "mock-task-3",
                  last_status: "STOPPED",
                  desired_status: "STOPPED",
                  health_status: "UNKNOWN",
                  launch_type: "FARGATE",
                  stopped_reason: "Essential container in task exited",
                  container_reasons: ["Exit code 1 from app container"],
                  severity: "critical",
                },
              ],
            },
            {
              service_name: "genai-router",
              service_arn: "arn:aws:ecs:us-east-1:444455556666:service/test-app-ecs-cluster/genai-router",
              status: "ACTIVE",
              desired_count: 5,
              running_count: 5,
              pending_count: 0,
              launch_type: "FARGATE",
              task_definition: "genai-router:31",
              deployment_status: "COMPLETED",
              severity: "ok",
              insight: "Service is active with 5/5 desired task(s) running.",
              events: ["service genai-router has reached a steady state."],
              tasks: [],
            },
          ],
        },
      ],
    },
    {
      account_key: "shared",
      account_id: "777788889999",
      region: "us-west-2",
      project_name: "Shared Observability",
      project_owner: "SRE",
      total_cost_30d: 9275.64,
      service_spend_30d: [
        { service: "AmazonCloudWatch", cost: 3150.44 },
        { service: "AWS CloudTrail", cost: 1520.75 },
        { service: "Amazon S3", cost: 1240.11 },
        { service: "AWS Config", cost: 890.18 },
      ],
      monthly_cost_trend: [
        { month: "2026-01-01", cost: 8750.9 },
        { month: "2026-02-01", cost: 9025.28 },
        { month: "2026-03-01", cost: 9188.77 },
        { month: "2026-04-01", cost: 9275.64 },
      ],
      expiring_certificates: [],
      ecs_clusters: [],
    },
  ],
  errors: [],
};

const MOCK_IDLE_RESOURCE_ROWS = [
  ["prod", "ECS service", "genai-ingestion", "0/3 tasks running", "Critical idle/failure", "Open service events and restart deployment after fixing container exit."],
  ["dev", "ECS service", "genai-chat-api", "3/4 tasks running", "Under capacity", "Check Fargate CPU placement and raise task CPU reservation or cluster capacity."],
  ["shared", "CloudWatch logs", "legacy-debug-log-group", "No reads in 21 days", "Idle candidate", "Archive or reduce retention to 7 days after owner approval."],
  ["dev", "Load balancer target group", "genai-blue-tg", "0 healthy targets", "Unused path", "Confirm traffic cutover and delete target group if no rollback is needed."],
];

const MOCK_PROACTIVE_RECOMMENDATION_ROWS = [
  ["Cost", "OpenSearch spend is 21% of selected monthly cost", "Review index lifecycle policy and warm/cold storage split.", "High"],
  ["Reliability", "prod genai-ingestion has failed deployment and stopped tasks", "Inspect task logs, fix container startup, then force new deployment.", "Critical"],
  ["Security", "prod API certificate expires in 27 days", "Renew ACM certificate and validate DNS before expiry window.", "High"],
  ["Capacity", "dev genai-chat-api has pending tasks", "Check service quotas, subnet capacity, and task CPU/memory settings.", "Medium"],
];

const MOCK_ACTION_PLAN_ROWS = [
  ["1", "Restore prod genai-ingestion", "Cloud Ops", "Fix container exit, publish task definition, force deployment", "Today"],
  ["2", "Reduce OpenSearch cost", "Platform AI", "Review old indices, enable lifecycle policy, resize warm nodes", "This week"],
  ["3", "Renew expiring certificates", "SRE", "Validate DNS records and rotate certificates before 2026-06-03", "This week"],
  ["4", "Clean idle resources", "FinOps", "Validate unused log groups and target groups, then remove or reduce retention", "Next sprint"],
];

const MOCK_PRIORITY_ISSUE_ROWS = [
  ["P0", "prod/genai-ingestion has 0/3 tasks running", "Customer ingestion outage risk", "Critical", "Open ECS detail"],
  ["P1", "prod API certificate expires in 27 days", "TLS expiry can break clients", "High", "Start renewal"],
  ["P1", "OpenSearch cost spike", "Top recurring spend driver", "High", "Analyze index storage"],
  ["P2", "dev/genai-chat-api pending task", "Reduced dev test capacity", "Medium", "Check placement"],
];

const guideHighlights = {
  whyMe: [
    "If you want a demo-ready cloud command center without configuring real AWS first.",
    "If you want cost, reliability, certificate, and utilization signals in one operational view.",
    "If you want every table to become a chat-ready investigation context.",
  ],
  suggestions: [
    "Start with mock data, then open Financial Impact and send the table to chat.",
    "Use Utilization Insights to generate an LLM-backed summary from ECS service rows.",
    "Open Priority Issue Tracker, pick the P0 row, then convert the issue into an action plan.",
    "Use Configure to switch from mock data to live backend accounts when credentials are ready.",
  ],
} as const;

const agentFlowHighlights = [
  {
    label: "1. Deterministic first",
    detail: "Triggers, entities, and AWS intent route clear questions before an LLM call.",
  },
  {
    label: "2. Tool catalog in code",
    detail: "Tools declare endpoint, triggers, inputs, cache, live-data need, and response shape.",
  },
  {
    label: "3. Bounded execution",
    detail: "The orchestrator validates, calls the backend method, streams progress, and compacts memory.",
  },
  {
    label: "4. LLM after grounding",
    detail: "The LLM writes from tool/table context, or helps when routing confidence is low.",
  },
] as const;

const agentBuildDetails = [
  {
    title: "Tool catalog",
    body: "Backend-aware metadata: endpoint, trigger language, required inputs, live requirement, cache policy, and response shape.",
  },
  {
    title: "LLM fallback",
    body: "Used when routing confidence is low, entities are missing, synthesis spans tools, or live refresh needs explanation.",
  },
  {
    title: "Lightweight by design",
    body: "No heavy framework loop. Routing, validation, tool calls, memory, SSE, and LLM composition stay inspectable.",
  },
  {
    title: "Why not LangChain first",
    body: "LangChain is strong for generic ReAct. This app benefits more from tight AWS control, lower latency, and easy debugging.",
  },
] as const;

const agentScoreFormula =
  "Improvement path: final_score = 0.55 * semantic similarity + 0.25 * deterministic trigger score + 0.20 * entity score.";

const guideSteps = [
  {
    title: "Start with the hub",
    tag: "Landing",
    body: "Analytics Hub is the first screen. It gives a clean snapshot of spend, utilization, certificates, active issues, recommendations, and action plans.",
    action: "Use the feature tiles to jump directly to the work area you want.",
  },
  {
    title: "Choose the data source",
    tag: "Configure",
    body: "Configure lets you keep mock data enabled for demos or switch to backend AWS snapshots by adding one or more accounts.",
    action: "Open Configure, review data source, LLM profile, and account settings.",
  },
  {
    title: "Read the signal",
    tag: "Analyze",
    body: "Financial Impact and Utilization Insights turn raw cloud inventory into tables, charts, and LLM summaries.",
    action: "Click Analyze in Utilization Insights to produce an operational summary.",
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
    body: "Priority Issue Tracker, Proactive Recommendations, and Action Plan Generator show how the portal turns observations into ownership and execution.",
    action: "Review the highest priority issue, then open the generated plan.",
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
  onConfigure,
  onUtilization,
  onPriority,
}: {
  open: boolean;
  onToggle: () => void;
  onStartTour: () => void;
  onConfigure: () => void;
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
                  <button type="button" onClick={onConfigure} className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-semibold text-white">
                    Configure
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
  onConfigure,
  onUtilization,
  onPriority,
  onActionPlan,
}: {
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  onClose: () => void;
  onConfigure: () => void;
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
    if (currentStep.tag === "Configure") onConfigure();
    else if (currentStep.tag === "Analyze") onUtilization();
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
                Follow the animated path: configure data, inspect live or mock signals, ask grounded questions, then turn
                findings into an action plan.
              </p>
            </div>
            <div className="relative mt-5 grid grid-cols-5 gap-1.5 sm:mt-8 sm:gap-2">
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

function ConfigField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-white/65 bg-white/62 px-4 py-2.5 text-sm text-slate-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-200/70"
      />
    </label>
  );
}

function ConfigureModal({
  useMockData,
  llm,
  awsAccounts,
  availableAccountKeys,
  selectedAccountKeys,
  onUseMockDataChange,
  onLlmChange,
  onAddAccount,
  onAccountChange,
  onRemoveAccount,
  onToggleAccountSelection,
  onClose,
}: {
  useMockData: boolean;
  llm: ReturnType<typeof useAppConfigStore.getState>["llm"];
  awsAccounts: ConfiguredAwsAccount[];
  availableAccountKeys: string[];
  selectedAccountKeys: string[];
  onUseMockDataChange: (enabled: boolean) => void;
  onLlmChange: (patch: Partial<ReturnType<typeof useAppConfigStore.getState>["llm"]>) => void;
  onAddAccount: () => void;
  onAccountChange: (id: string, patch: Partial<ConfiguredAwsAccount>) => void;
  onRemoveAccount: (id: string) => void;
  onToggleAccountSelection: (accountKey: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-white/60 bg-[linear-gradient(180deg,rgba(239,247,255,0.98),rgba(210,231,255,0.94))] p-6 text-slate-900 shadow-[0_32px_90px_rgba(15,23,42,0.3)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Configure</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Runtime settings</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/62 text-slate-700 transition hover:bg-white"
            aria-label="Close configure"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <section className="mt-6 rounded-[26px] border border-white/58 bg-white/42 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">Data source</div>
              <div className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Mock data is enabled by default so every Analytics Hub tab has populated sample data. Turn it off to use the backend AWS snapshot service.
              </div>
            </div>
            <label className="inline-flex items-center gap-3 rounded-full border border-white/65 bg-white/68 px-4 py-2.5 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={useMockData}
                onChange={(event) => onUseMockDataChange(event.target.checked)}
                className="h-4 w-4 accent-sky-600"
              />
              Use mock dashboard data
            </label>
          </div>

          <div className="mt-5 rounded-[22px] border border-white/55 bg-white/34 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Dashboard account filter</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {useMockData
                ? "Mock data shows all sample accounts so the full dashboard story is visible."
                : "Choose which configured backend accounts should drive the portal views."}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(useMockData ? MOCK_SNAPSHOT.accounts.map((account) => account.account_key) : availableAccountKeys).map((accountKey) => {
                const selected = useMockData || selectedAccountKeys.includes(accountKey);
                return (
                  <button
                    key={accountKey}
                    type="button"
                    disabled={useMockData}
                    onClick={() => onToggleAccountSelection(accountKey)}
                    className={classNames(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                      selected
                        ? "border-white/75 bg-white/92 text-slate-900 shadow-[0_14px_28px_rgba(255,255,255,0.24)]"
                        : "border-white/45 bg-white/30 text-slate-700 hover:bg-white/48",
                      useMockData ? "cursor-default" : "",
                    )}
                  >
                    {selected ? <CheckIcon /> : null}
                    {formatAccountLabel(accountKey)}
                  </button>
                );
              })}
              {!useMockData && availableAccountKeys.length === 0 ? (
                <div className="text-sm text-slate-500">No backend accounts loaded yet.</div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[26px] border border-white/58 bg-white/42 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="text-sm font-semibold text-slate-950">LLM configuration</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">
            These values document the model setup used by analysis features. The app calls the backend LLM endpoint, which can map these settings to its configured gateway.
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ConfigField label="Provider" value={llm.providerName} onChange={(providerName) => onLlmChange({ providerName })} />
            <ConfigField label="Endpoint" value={llm.endpoint} onChange={(endpoint) => onLlmChange({ endpoint })} />
            <ConfigField label="Model" value={llm.model} onChange={(model) => onLlmChange({ model })} />
            <ConfigField label="Payload mode" value={llm.payloadMode} onChange={(payloadMode) => onLlmChange({ payloadMode })} />
            <ConfigField label="Temperature" value={llm.temperature} onChange={(temperature) => onLlmChange({ temperature })} />
            <ConfigField label="Max tokens" value={llm.maxTokens} onChange={(maxTokens) => onLlmChange({ maxTokens })} />
          </div>
        </section>

        <section className="mt-5 rounded-[26px] border border-white/58 bg-white/42 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">AWS rapid accounts</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">
                Add one or more AWS accounts for real data source planning. Credentials are kept in this browser configuration.
              </div>
            </div>
            <button
              type="button"
              onClick={onAddAccount}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/60 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(2,132,199,0.18)] transition hover:bg-sky-700"
            >
              <PlusIcon />
              Add account
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {awsAccounts.map((account) => (
              <div key={account.id} className="rounded-[24px] border border-white/58 bg-white/42 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={account.enabled}
                      onChange={(event) => onAccountChange(account.id, { enabled: event.target.checked })}
                      className="h-4 w-4 accent-sky-600"
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemoveAccount(account.id)}
                    className="rounded-full border border-white/65 bg-white/58 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-white"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ConfigField label="Account name" value={account.name} onChange={(name) => onAccountChange(account.id, { name })} placeholder="dev" />
                  <ConfigField label="Region" value={account.region} onChange={(region) => onAccountChange(account.id, { region })} placeholder="us-east-1" />
                  <ConfigField label="KEY_ID" value={account.accessKeyId} onChange={(accessKeyId) => onAccountChange(account.id, { accessKeyId })} placeholder="AKIA..." />
                  <ConfigField label="ACCESS_KEY" value={account.secretAccessKey} onChange={(secretAccessKey) => onAccountChange(account.id, { secretAccessKey })} type="password" />
                  <div className="md:col-span-2">
                    <ConfigField label="SESSION_TOKEN" value={account.sessionToken} onChange={(sessionToken) => onAccountChange(account.id, { sessionToken })} type="password" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
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
  severity: "ok" | "warning" | "critical";
  recommendation: string;
  evidence: string;
};

function utilizationRecommendation(service: AnalyticsEcsServiceItem) {
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
        const utilizationPct =
          service.desired_count > 0
            ? Math.round((service.running_count / service.desired_count) * 100)
            : 0;
        const failedTaskCount = service.tasks.filter((task) => task.severity !== "ok").length;
        rows.push({
          account: formatAccountLabel(account.account_key),
          cluster: cluster.cluster_name,
          service: service.service_name,
          desired: service.desired_count,
          running: service.running_count,
          pending: service.pending_count,
          utilizationPct,
          severity: service.severity,
          recommendation: utilizationRecommendation(service),
          evidence: [
            service.insight,
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
    running_vs_desired_pct: row.utilizationPct,
    severity: row.severity,
    recommendation: row.recommendation,
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
  onAnalyze,
  onRefresh,
  onDiscuss,
}: {
  rows: UtilizationInsightRow[];
  analysis: string;
  isAnalyzing: boolean;
  updatedLabel: string;
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
    `${row.utilizationPct}%`,
    <SeverityBadge key={`${row.account}-${row.cluster}-${row.service}-severity`} severity={row.severity} />,
    row.recommendation,
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
      headers={["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Recommendation"]}
      rows={tableRows}
      emptyText="No ECS utilization rows are available yet. Refresh Analytics Hub after AWS credentials are configured."
      updatedLabel={updatedLabel}
      onRefresh={onRefresh}
      onDiscuss={onDiscuss}
      controls={controls}
    >
      <div className="mt-5 rounded-[28px] border border-white/55 bg-white/36 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <div className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Analysis</div>
        <div className="mt-3 text-sm leading-7 text-slate-700">{analysis}</div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/55 bg-white/36 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <table className="min-w-full border-collapse text-sm text-slate-800">
          <thead>
            <tr className="border-b border-slate-300/35 text-left text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Recommendation"].map((header) => (
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
  const useMockData = useAppConfigStore((s) => s.useMockData);
  const llmConfig = useAppConfigStore((s) => s.llm);
  const configuredAwsAccounts = useAppConfigStore((s) => s.awsAccounts);
  const setUseMockData = useAppConfigStore((s) => s.setUseMockData);
  const updateLlm = useAppConfigStore((s) => s.updateLlm);
  const addAwsAccount = useAppConfigStore((s) => s.addAwsAccount);
  const updateAwsAccount = useAppConfigStore((s) => s.updateAwsAccount);
  const removeAwsAccount = useAppConfigStore((s) => s.removeAwsAccount);
  const [snapshot, setSnapshot] = useState<AnalyticsHubSnapshot>(EMPTY_SNAPSHOT);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [financialImpactView, setFinancialImpactView] = useState<"table" | "bar">("bar");
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
    if (useMockData) {
      setRefreshInProgress(false);
      return;
    }
    const result = await chatApi.getAnalyticsHubSnapshot();
    if (!result.ok) {
      setRefreshInProgress(false);
      return;
    }
    setSnapshot(result.data.snapshot);
    setRefreshInProgress(Boolean(result.data.refresh_in_progress));
  }

  async function queueRefresh() {
    if (useMockData) {
      setRefreshInProgress(false);
      return;
    }
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
  }, [useMockData]);

  useEffect(() => {
    if (!refreshInProgress) return;
    const timerId = window.setTimeout(() => {
      void loadSnapshot();
    }, 4000);
    return () => window.clearTimeout(timerId);
  }, [refreshInProgress]);

  const activeSnapshot = useMockData ? MOCK_SNAPSHOT : snapshot;
  const dataSourceLabel = useMockData ? "Mock data" : "AWS backend";
  const displayedAccountKeys = useMockData
    ? activeSnapshot.accounts.map((account) => account.account_key)
    : availableAccountKeys.length > 0
      ? availableAccountKeys
      : configuredAwsAccounts.filter((account) => account.enabled && account.name.trim()).map((account) => account.name.trim());

  const filteredAccounts = useMemo(() => {
    if (useMockData) {
      return activeSnapshot.accounts;
    }
    const selectedSet = new Set(selectedAccountKeys);
    return activeSnapshot.accounts.filter((account) => selectedSet.has(account.account_key));
  }, [activeSnapshot.accounts, selectedAccountKeys, useMockData]);

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
  const utilizationRows = useMemo(() => flattenUtilizationInsights(filteredAccounts), [filteredAccounts]);
  const utilizationDiscussionRows = useMemo(
    () =>
      utilizationRows.map((row) => [
        row.account,
        row.cluster,
        row.service,
        `${row.running}/${row.desired}`,
        String(row.pending),
        `${row.utilizationPct}%`,
        row.severity,
        row.recommendation,
      ]),
    [utilizationRows],
  );

  const updatedLabel = refreshInProgress
    ? "Updated moments ago - Refreshing"
    : formatRelativeTime(activeSnapshot.generated_at_utc);

  useEffect(() => {
    setUtilizationAnalysis(utilizationFallbackAnalysis(utilizationRows));
  }, [utilizationRows]);

  async function openTableDiscussion(title: string, headers: string[], rows: string[][]) {
    closeDiscussionTable();
    await newChat();
    openDiscussionTable({
      title,
      headers,
      rows,
      updatedAtMs: activeSnapshot.generated_at_utc ? new Date(activeSnapshot.generated_at_utc).getTime() : null,
    });
    openSingleView("chat");
  }

  function scrollToCertificates() {
    certificatesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToUtilization() {
    utilizationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!utilizationAnalysis || utilizationAnalysis === utilizationFallbackAnalysis(utilizationRows)) {
      void analyzeUtilization();
    }
  }

  function scrollToSection(ref: RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openGuideTour(stepIndex = 0) {
    setGuideStepIndex(stepIndex);
    setGuideTourOpen(true);
  }

  function openConfigureFromGuide() {
    setGuideTourOpen(false);
    setConfigureOpen(true);
  }

  function openUtilizationFromGuide() {
    setGuideTourOpen(false);
    scrollToUtilization();
  }

  function openPriorityFromGuide() {
    setGuideTourOpen(false);
    scrollToSection(prioritySectionRef);
  }

  function openActionPlanFromGuide() {
    setGuideTourOpen(false);
    scrollToSection(actionPlanSectionRef);
  }

  async function analyzeUtilization() {
    if (utilizationAnalyzing || utilizationRows.length === 0) return;
    setUtilizationAnalyzing(true);
    const fallback = utilizationFallbackAnalysis(utilizationRows);
    const result = await chatApi.answerWithContext({
      query: [
        `Use the configured LLM profile "${llmConfig.providerName}" with model "${llmConfig.model}" for this analysis.`,
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
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/48 px-4 py-2 text-xs font-semibold text-slate-700 sm:ml-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {dataSourceLabel}
            </div>
            <button
              type="button"
              onClick={() => setConfigureOpen(true)}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full border border-white/65 bg-white/82 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_14px_28px_rgba(148,163,184,0.18)] transition hover:bg-white"
            >
              <ConfigureIcon />
              <span>Configure</span>
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
                  hasAlert={isCertificateFeature && hasUrgentCertificate}
                  onClick={
                    isCertificateFeature
                      ? scrollToCertificates
                      : isUtilizationFeature
                        ? scrollToUtilization
                        : isIdleFeature
                          ? () => scrollToSection(idleResourcesSectionRef)
                          : isProactiveFeature
                            ? () => scrollToSection(proactiveSectionRef)
                            : undefined
                  }
                />
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

        <section ref={utilizationSectionRef} className="mt-6 scroll-mt-24">
          <UtilizationInsightsCard
            rows={utilizationRows}
            analysis={utilizationAnalysis}
            isAnalyzing={utilizationAnalyzing}
            updatedLabel={updatedLabel}
            onAnalyze={() => void analyzeUtilization()}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Utilization Insights",
                ["Account", "Cluster", "Service", "Running / Desired", "Pending", "Utilization", "Severity", "Recommendation"],
                utilizationDiscussionRows,
              )
            }
          />
        </section>

        <section ref={idleResourcesSectionRef} className="mt-6 scroll-mt-24">
          <DataCard
            title="Detect Idle Resources"
            headers={["Account", "Resource Type", "Resource", "Signal", "Finding", "Suggested Action"]}
            rows={MOCK_IDLE_RESOURCE_ROWS}
            emptyText="No idle resource examples are available."
            updatedLabel={`${updatedLabel} - ${dataSourceLabel}`}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Detect Idle Resources",
                ["Account", "Resource Type", "Resource", "Signal", "Finding", "Suggested Action"],
                MOCK_IDLE_RESOURCE_ROWS,
              )
            }
          />
        </section>

        <section ref={proactiveSectionRef} className="mt-6 scroll-mt-24">
          <DataCard
            title="Proactive Recommendations"
            headers={["Category", "Signal", "Recommendation", "Priority"]}
            rows={MOCK_PROACTIVE_RECOMMENDATION_ROWS}
            emptyText="No proactive recommendation examples are available."
            updatedLabel={`${updatedLabel} - ${dataSourceLabel}`}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Proactive Recommendations",
                ["Category", "Signal", "Recommendation", "Priority"],
                MOCK_PROACTIVE_RECOMMENDATION_ROWS,
              )
            }
          />
        </section>

        <section ref={actionPlanSectionRef} className="mt-6 scroll-mt-24">
          <DataCard
            title="Action Plan Generator"
            headers={["Step", "Action", "Owner", "Next Step", "Target"]}
            rows={MOCK_ACTION_PLAN_ROWS}
            emptyText="No action plan examples are available."
            updatedLabel={`${updatedLabel} - generated from mock issue context`}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Action Plan Generator",
                ["Step", "Action", "Owner", "Next Step", "Target"],
                MOCK_ACTION_PLAN_ROWS,
              )
            }
          />
        </section>

        <section ref={prioritySectionRef} className="mt-6 scroll-mt-24">
          <DataCard
            title="Priority Issue Tracker"
            headers={["Priority", "Issue", "Impact", "Severity", "Recommended Workflow"]}
            rows={MOCK_PRIORITY_ISSUE_ROWS}
            emptyText="No priority issue examples are available."
            updatedLabel={`${updatedLabel} - ranked by severity and operational impact`}
            onRefresh={() => void queueRefresh()}
            onDiscuss={() =>
              void openTableDiscussion(
                "Priority Issue Tracker",
                ["Priority", "Issue", "Impact", "Severity", "Recommended Workflow"],
                MOCK_PRIORITY_ISSUE_ROWS,
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
                {useMockData ? displayedAccountKeys.map(formatAccountLabel).join(", ") : selectedAccountKeys.map(formatAccountLabel).join(", ") || "None"}
              </span>
            </p>
            <p>
              Data source: <span className="font-semibold text-slate-900">{dataSourceLabel}</span>
            </p>
            <p>
              LLM profile: <span className="font-semibold text-slate-900">{llmConfig.providerName}</span> using{" "}
              <span className="font-semibold text-slate-900">{llmConfig.model}</span>
            </p>
            <p>The Analytics Hub uses stored backend data so the page opens immediately with the latest available tables.</p>
            <p>Analytics Hub is the default entry point, and the background AWS refresh keeps these modules current.</p>
            <p>Every table can still be sent into a dedicated discussion flow if deeper analysis is needed.</p>
          </NoteCard>
        </section>

        {activeSnapshot.errors.length > 0 ? (
          <section className="mt-6 rounded-[30px] border border-rose-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(254,226,226,0.24))] p-5 text-slate-900 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-[22px]">
            <div className="text-[11px] uppercase tracking-[0.28em] text-rose-600">Account Refresh Errors</div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {activeSnapshot.errors.map((error: AnalyticsHubAccountError) => (
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
        onConfigure={openConfigureFromGuide}
        onUtilization={openUtilizationFromGuide}
        onPriority={openPriorityFromGuide}
      />

      {configureOpen ? (
        <ConfigureModal
          useMockData={useMockData}
          llm={llmConfig}
          awsAccounts={configuredAwsAccounts}
          availableAccountKeys={availableAccountKeys}
          selectedAccountKeys={selectedAccountKeys}
          onUseMockDataChange={setUseMockData}
          onLlmChange={updateLlm}
          onAddAccount={addAwsAccount}
          onAccountChange={updateAwsAccount}
          onRemoveAccount={removeAwsAccount}
          onToggleAccountSelection={toggleAccountSelection}
          onClose={() => setConfigureOpen(false)}
        />
      ) : null}

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
          onConfigure={openConfigureFromGuide}
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
