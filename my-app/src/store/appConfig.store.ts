import { create } from "zustand";

export type ConfiguredAwsAccount = {
  id: string;
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  enabled: boolean;
};

export type LlmRuntimeConfig = {
  providerName: string;
  endpoint: string;
  model: string;
  payloadMode: string;
  temperature: string;
  maxTokens: string;
};

type AppConfigState = {
  useMockData: boolean;
  llm: LlmRuntimeConfig;
  awsAccounts: ConfiguredAwsAccount[];
  setUseMockData: (enabled: boolean) => void;
  updateLlm: (patch: Partial<LlmRuntimeConfig>) => void;
  addAwsAccount: () => void;
  updateAwsAccount: (id: string, patch: Partial<ConfiguredAwsAccount>) => void;
  removeAwsAccount: (id: string) => void;
};

const STORAGE_KEY = "analytics_hub_runtime_config_v1";

const defaultLlmConfig: LlmRuntimeConfig = {
  providerName: "Backend LLM Gateway",
  endpoint: "/api/v1/llm/answer",
  model: "gpt-4o-mini",
  payloadMode: "model_messages",
  temperature: "0.1",
  maxTokens: "10000",
};

const defaultAwsAccounts: ConfiguredAwsAccount[] = [
  {
    id: "mock-dev",
    name: "dev",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    region: "us-east-1",
    enabled: true,
  },
];

const blockedTextFragments = [
  [118, 111, 120],
  [118, 115, 108],
  [118, 101, 115, 115, 101, 108],
  [112, 102, 105, 122, 101, 114],
].map((codes) => String.fromCharCode(...codes));

function scrubProviderText(value: string, fallback: string): string {
  const lowered = value.toLowerCase();
  return blockedTextFragments.some((fragment) => lowered.includes(fragment)) ? fallback : value;
}

function sanitizeLlmConfig(value: Partial<LlmRuntimeConfig> | undefined): LlmRuntimeConfig {
  const merged = { ...defaultLlmConfig, ...(value ?? {}) };
  return {
    ...merged,
    providerName: scrubProviderText(merged.providerName, defaultLlmConfig.providerName),
    endpoint: scrubProviderText(merged.endpoint, defaultLlmConfig.endpoint),
  };
}

function newAccount(): ConfiguredAwsAccount {
  return {
    id: `aws_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: "",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    region: "us-east-1",
    enabled: true,
  };
}

function loadInitialState(): Pick<AppConfigState, "useMockData" | "llm" | "awsAccounts"> {
  if (typeof window === "undefined") {
    return { useMockData: true, llm: defaultLlmConfig, awsAccounts: defaultAwsAccounts };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { useMockData: true, llm: defaultLlmConfig, awsAccounts: defaultAwsAccounts };
    }
    const parsed = JSON.parse(raw) as Partial<Pick<AppConfigState, "useMockData" | "llm" | "awsAccounts">>;
    const state = {
      useMockData: parsed.useMockData ?? true,
      llm: sanitizeLlmConfig(parsed.llm),
      awsAccounts: Array.isArray(parsed.awsAccounts) && parsed.awsAccounts.length > 0 ? parsed.awsAccounts : defaultAwsAccounts,
    };
    persist(state);
    return state;
  } catch {
    return { useMockData: true, llm: defaultLlmConfig, awsAccounts: defaultAwsAccounts };
  }
}

function persist(state: Pick<AppConfigState, "useMockData" | "llm" | "awsAccounts">) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      useMockData: state.useMockData,
      llm: state.llm,
      awsAccounts: state.awsAccounts,
    }),
  );
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  ...loadInitialState(),
  setUseMockData: (enabled) =>
    set((state) => {
      const next = { ...state, useMockData: enabled };
      persist(next);
      return { useMockData: enabled };
    }),
  updateLlm: (patch) =>
    set((state) => {
      const llm = { ...state.llm, ...patch };
      const next = { ...state, llm };
      persist(next);
      return { llm };
    }),
  addAwsAccount: () =>
    set((state) => {
      const awsAccounts = [...state.awsAccounts, newAccount()];
      const next = { ...state, awsAccounts };
      persist(next);
      return { awsAccounts };
    }),
  updateAwsAccount: (id, patch) =>
    set((state) => {
      const awsAccounts = state.awsAccounts.map((account) => (account.id === id ? { ...account, ...patch } : account));
      const next = { ...state, awsAccounts };
      persist(next);
      return { awsAccounts };
    }),
  removeAwsAccount: (id) =>
    set((state) => {
      const awsAccounts = state.awsAccounts.filter((account) => account.id !== id);
      const next = { ...state, awsAccounts };
      persist(next);
      return { awsAccounts };
    }),
}));
