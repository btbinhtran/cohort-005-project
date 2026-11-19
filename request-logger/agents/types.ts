export type RendererId = "anthropic" | "openai" | "gemini" | "raw";

/**
 * What the student picked. This, and only this, is what gets saved to disk —
 * except the custom target fields, which are the one documented exception.
 * See config.ts.
 */
export type AgentChoice = {
  agent: string;
  provider?: string;
  /** Only set when provider is CUSTOM_ID: the base URL the student typed. */
  customBaseUrl?: string;
  /** Only set when provider is CUSTOM_ID: the wire format they chose for it. */
  customRenderer?: RendererId;
  /**
   * Selected model for a custom target that needs one declared up front:
   * OpenCode's custom OpenAI-compatible route, and any of Pi's custom
   * routes (see resolveCustomTarget).
   */
  customModel?: string;
};

export type ResolvedTarget = {
  kind: "target";
  agent: string;
  agentLabel: string;
  provider: string;
  providerLabel: string;
  /** The single host every request is forwarded to. */
  upstreamHost: string;
  renderer: RendererId;
  /** The base URL the student points their agent at, e.g. http://localhost:8787/v1 */
  baseUrl: string;
  /** The copy-pasteable command, complete with env vars and flags. */
  command: string;
  /** Config files the student must write before the command will work. */
  setup: SetupFile[];
  /** Things worth knowing. Printed under the command. */
  notes: string[];
  /** Things that will otherwise look like the tool is broken. */
  warnings: string[];
};

/**
 * Resolved to a target the catalogue has no entry for: the student typed
 * their own base URL and picked their own wire format, rather than one being
 * looked up from a ProviderEntry. It plays the same role as a ResolvedTarget
 * everywhere downstream — the proxy routes to it and renders it exactly the
 * same way — so the two are only ever told apart by `kind`.
 */
export type CustomTarget = {
  kind: "custom-target";
  agent: string;
  agentLabel: string;
  /** Always "Custom base URL": there is no catalogue provider label to show. */
  providerLabel: string;
  /**
   * The scheme+host[+port] the student typed, plus any path prefix it
   * carried (e.g. https://opencode.ai/zen/go). proxy.ts joins that prefix
   * against each request's own path when forwarding — see
   * upstreamPathPrefix in proxy.ts.
   */
  upstreamBaseUrl: string;
  renderer: RendererId;
  baseUrl: string;
  command: string;
  setup: SetupFile[];
  notes: string[];
  warnings: string[];
};

export type AgentRefusal = {
  kind: "refusal";
  agent: string;
  agentLabel: string;
  reason: string;
};

export type ResolveError = {
  kind: "error";
  message: string;
};

/**
 * The student's setup is not in the catalogue, and they said so.
 *
 * This is not an error. The catalogue is a list of what has been tested, not a
 * list of what is possible, so the only useful answer is to ask for the missing
 * entry. It is never saved.
 */
export type SetupRequest = {
  kind: "request";
  /** The agent, when the student named one the catalogue knows. */
  agentLabel: string | null;
  /** Where to ask for the missing entry. */
  url: string;
};

export type Resolution =
  | ResolvedTarget
  | CustomTarget
  | AgentRefusal
  | ResolveError
  | SetupRequest;

/**
 * The last option in both questions.
 *
 * A student whose agent or provider is missing has nowhere to go otherwise.
 * They would either pick the nearest wrong thing and read a capture that is not
 * theirs, or quit. Both questions therefore end with this, and it leads to the
 * issue tracker.
 */
export const OTHER_ID = "other";
export const OTHER_LABEL = "Other, or not sure";
export const ISSUE_URL =
  "https://github.com/ai-hero-dev/cohort-005-project/issues/new";

/**
 * The option next to "Other" at the provider question: a student whose
 * provider is not in the catalogue, but who knows its base URL, does not have
 * to file an issue and wait. This is offered on every supported agent's
 * provider question, however many catalogue providers it has — see
 * agentProviders and askChoice in config.ts.
 */
export const CUSTOM_ID = "custom";
export const CUSTOM_LABEL = "Custom base URL";

/**
 * The wire-format question a custom target answers instead of a renderer
 * being looked up from a ProviderEntry. "raw" is a real RendererId, not a
 * placeholder — render.ts checks it first and never guesses at a shape it
 * was not told.
 */
export const WIRE_FORMAT_OPTIONS: Array<{ id: RendererId; label: string }> = [
  { id: "openai", label: "OpenAI-compatible (chat/completions)" },
  { id: "anthropic", label: "Anthropic-compatible (messages)" },
  { id: "raw", label: "Not sure — show me the raw JSON" },
];

export type SetupFile = {
  path: string;
  body: string;
  language: string;
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export type ProviderEntry = {
  id: string;
  label: string;
  upstreamHost: string;
  renderer: RendererId;
  /**
   * Appended to http://localhost:PORT to make the base URL.
   *
   * Per-agent, never global. OpenCode's SDK appends `/messages` to whatever it
   * is given, so it needs `/v1`. Aider's layer appends the whole path, so it
   * must not have one. Getting this wrong produces a 404 the student cannot
   * explain, so it is data, and it is tested.
   */
  suffix?: string;
  /** Environment variables, in the order they should appear in the command. */
  env?: Array<[string, string]>;
  bin: string;
  args?: string[];
  setup?: SetupFile[];
  notes?: string[];
  warnings?: string[];
  /**
   * Which custom-base-url wire formats this provider's command, env and
   * setup file are a reasonable stand-in for. Only consulted on an agent
   * with more than one provider — see findCustomTemplate. A provider tied to
   * one specific login route (a ChatGPT subscription, a Google account) is
   * never tagged: reusing its template for an unrelated third-party server
   * would silently misconfigure it rather than help.
   */
  customTemplateFor?: RendererId[];
};

export type AgentEntry = {
  id: string;
  label: string;
  /** A supported agent has providers. A refused one has a reason. */
  providers?: ProviderEntry[];
  reason?: string;
  /**
   * True when every setup for this agent is a custom target: there is no
   * fixed catalogue provider to fall back to, so the wizard skips the
   * provider question and asks the two custom-base-url questions directly.
   * OMP is the first agent like this — it can point at Ollama, LM Studio,
   * llama.cpp, LiteLLM, or anything else, so no single upstream host is ever
   * right for it.
   */
  alwaysCustom?: boolean;
};
