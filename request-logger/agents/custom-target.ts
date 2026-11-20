import { piModels } from "./setup-files";
import { buildCommand, powerShellQuote, shellQuote } from "./shell";
import {
  CUSTOM_LABEL,
  type AgentChoice,
  type AgentEntry,
  type ProviderEntry,
  type RendererId,
  type Resolution,
  type ResolveError,
} from "./types";

/**
 * Turn what the student typed into an origin (scheme + host [+ port]), or
 * nothing. Only http and https make sense here — the proxy speaks plain HTTP
 * to whatever it forwards to, over either transport — so anything else (a
 * bare host with no scheme, a typo, an unrelated protocol) is rejected
 * rather than guessed at. A wrong guess would fail as a confusing connection
 * error; this fails as a message the student can act on.
 */
function parseUpstreamUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

/**
 * The upstream a CustomTarget forwards to: origin plus any path prefix the
 * student typed, e.g. https://opencode.ai/zen/go. A bare origin's pathname
 * is "/", which collapses to nothing here so a path-free base URL still
 * round-trips to exactly its origin. Any trailing slash on a typed prefix is
 * dropped too, so proxy.ts can join this against a leading-slash request
 * path (e.g. /v1/chat/completions) with plain concatenation and never
 * produce a doubled or missing slash.
 */
function upstreamBaseUrlWithPath(url: URL): string {
  const prefix = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${prefix}`;
}

/**
 * Which catalogue provider a custom target borrows its command, environment
 * variable and setup file from. A custom target has no ProviderEntry of its
 * own, but every agent still needs a real bin to print, and most need a real
 * env var or config file shape too — this is where those come from instead.
 *
 * An agent with exactly one provider has only one thing to borrow, so that
 * one is used regardless of the wire format chosen: it is a best-effort
 * template, not a promise, and a mismatch is worth a note, not a dead end.
 * An agent with more than one provider picks by matching the chosen wire
 * format against each provider's `customTemplateFor` tags — and only that:
 * an untagged provider is untagged on purpose (see the field's own doc,
 * above), so a format with no exact match returns `undefined` rather than
 * borrowing an unrelated provider's command. `resolveCustomTarget` already
 * degrades honestly when this returns nothing — a bare command, no setup
 * file, no borrowed notes — which is the correct outcome here, not a bug to
 * paper over.
 */
function findCustomTemplate(
  agent: AgentEntry,
  renderer: RendererId
): ProviderEntry | undefined {
  const providers = agent.providers ?? [];
  if (providers.length <= 1) return providers[0];
  return providers.find((p) => p.customTemplateFor?.includes(renderer));
}

/**
 * The note shown whenever a custom target's wire format is "raw" — the
 * student said they were not sure, so every capture falls back to a JSON
 * dump. Every custom-target route says this the same way, so it is written
 * once here rather than copied into each one.
 */
const RAW_WIRE_FORMAT_NOTE =
  'You picked "not sure" for the wire format, so every capture falls ' +
  "back to a raw JSON dump instead of a fully rendered one. That is " +
  "not broken — it is just less readable. Run with --force and pick a " +
  "format once you know it, and the readable renderer takes over.";

/**
 * Whether a custom target for this agent and wire format needs a model
 * declared up front, rather than being able to start against a bare base
 * URL. The single source of truth both the wizard (config.ts, deciding
 * whether to bother discovering one) and resolveCustomTarget (deciding
 * whether to require one) consult, so a third agent that needs this only
 * ever means one edit, here.
 *
 * - OpenCode only needs one for its OpenAI-compatible route: that is the
 *   one built from an ephemeral provider with no catalogue entry to borrow
 *   a model from. Its Anthropic-compatible route borrows a real Anthropic
 *   provider instead, whose model names are real Anthropic model names.
 * - Pi needs one on every route: every one of its custom targets overrides
 *   an existing built-in provider (openai or anthropic), and that
 *   provider's built-in model names almost never exist on a self-hosted
 *   backend, whichever wire format was chosen for rendering.
 */
export function customTargetNeedsModel(
  agentId: string,
  renderer: RendererId
): boolean {
  if (agentId === "pi") return true;
  if (agentId === "opencode") return renderer === "openai";
  return false;
}

/**
 * Read the model the wizard asked for, or the error both routes that need
 * one return when it is missing — a remembered choice saved before this
 * field existed, say, or one edited by hand. Shared so the two routes that
 * call customTargetNeedsModel report the same shape of error, differing
 * only in which target they name.
 */
function resolveCustomModel(
  choice: AgentChoice,
  targetLabel: string
): { kind: "model"; model: string } | ResolveError {
  const model = choice.customModel?.trim();
  if (!model) {
    return {
      kind: "error",
      message: `${targetLabel} needs a model ID. Run with --force to choose again.`,
    };
  }
  return { kind: "model", model };
}

/**
 * Build a target from what the student typed, in place of a catalogue
 * lookup. The only facts on hand are the base URL and the wire format they
 * chose; everything else is borrowed from the closest matching catalogue
 * provider — see findCustomTemplate.
 */
export function resolveCustomTarget(
  agent: AgentEntry,
  choice: AgentChoice,
  port: number,
  platform: NodeJS.Platform
): Resolution {
  if (!choice.customBaseUrl) {
    return {
      kind: "error",
      message: `${agent.label} needs a custom base URL. Run with --force to choose again.`,
    };
  }

  const upstream = parseUpstreamUrl(choice.customBaseUrl);
  if (!upstream) {
    return {
      kind: "error",
      message:
        `"${choice.customBaseUrl}" is not a usable base URL. It must start ` +
        `with http:// or https://, e.g. http://localhost:11434. Run with ` +
        `--force to choose again.`,
    };
  }

  const renderer: RendererId = choice.customRenderer ?? "raw";
  const template = findCustomTemplate(agent, renderer);
  const baseUrl = `http://localhost:${port}${template?.suffix ?? ""}`;

  if (agent.id === "opencode" && customTargetNeedsModel(agent.id, renderer)) {
    const modelResult = resolveCustomModel(
      choice,
      "OpenCode's custom OpenAI-compatible target"
    );
    if (modelResult.kind === "error") return modelResult;
    const { model } = modelResult;

    const providerId = "request-logger";
    const selectedModel = `${providerId}/${model}`;
    const config = JSON.stringify({
      model: selectedModel,
      small_model: selectedModel,
      provider: {
        [providerId]: {
          npm: "@ai-sdk/openai-compatible",
          name: "Request Logger",
          options: { baseURL: baseUrl },
          models: { [model]: { name: model } },
        },
      },
    });

    return {
      kind: "custom-target",
      agent: agent.id,
      agentLabel: agent.label,
      providerLabel: CUSTOM_LABEL,
      upstreamBaseUrl: upstreamBaseUrlWithPath(upstream),
      renderer,
      baseUrl,
      command:
        platform === "win32"
          ? `$env:OPENCODE_CONFIG_CONTENT = ${powerShellQuote(config)}; opencode`
          : `OPENCODE_CONFIG_CONTENT=${shellQuote(config)} opencode`,
      setup: [],
      notes: [
        "This temporary provider is merged with your existing OpenCode " +
          "configuration for this run only; your config file is not changed.",
      ],
      warnings: [],
    };
  }

  /**
   * Pi's custom target, on every wire format — unlike OpenCode's branch
   * above, which only fires for the OpenAI-compatible choice. Pi always
   * writes a models.json override for a custom base URL (see piModels), and
   * that override always replaces one of Pi's built-in providers, whose
   * built-in model names (gpt-4o, claude-*) almost never exist on a
   * self-hosted backend regardless of which wire format the student picked
   * for rendering. So a model is required here every time, not just for one
   * renderer.
   */
  if (agent.id === "pi" && customTargetNeedsModel(agent.id, renderer)) {
    const modelResult = resolveCustomModel(choice, "Pi's custom target");
    if (modelResult.kind === "error") return modelResult;
    const { model } = modelResult;

    // template is the anthropic or openai Pi provider entry (see
    // findCustomTemplate). Every renderer this branch can be reached with
    // ("openai", "anthropic", "raw") has a Pi provider tagged for it — see
    // the catalogue above — so this can only be missing if a future wire
    // format is added there without a matching Pi template.
    if (!template) {
      return {
        kind: "error",
        message:
          `Pi has no custom-target template for the "${renderer}" wire ` +
          `format. Run with --force to choose again.`,
      };
    }
    // template.id is the provider key Pi's built-in catalogue uses, which
    // is also the key this override replaces.
    const providerId = template.id;
    const notes = [
      `This models.json entry replaces Pi's built-in "${providerId}" model ` +
        "catalogue with the one model you selected, since Pi's built-in " +
        "model names almost never exist on a custom server.",
    ];
    if (renderer === "anthropic") {
      notes.push(
        "Model discovery only checks the OpenAI-style /v1/models listing " +
          "endpoint, which an Anthropic-compatible server often does not " +
          "expose. If discovery found nothing here and you typed the model " +
          "ID by hand, that is expected — it does not mean the ID is wrong."
      );
    }
    if (renderer === "raw") notes.push(RAW_WIRE_FORMAT_NOTE);

    return {
      kind: "custom-target",
      agent: agent.id,
      agentLabel: agent.label,
      providerLabel: CUSTOM_LABEL,
      upstreamBaseUrl: upstreamBaseUrlWithPath(upstream),
      renderer,
      baseUrl,
      command: buildCommand(template, baseUrl, platform),
      setup: [piModels(providerId, baseUrl, model)],
      notes,
      warnings: template.warnings ?? [],
    };
  }

  const notes = [
    `This command is built from ${agent.label}'s own setup pattern, since a ` +
      `custom target has no dedicated one of its own. If a note below assumes ` +
      `a specific login or account, it may not apply to your target.`,
    ...(template?.notes ?? []),
  ];
  if (renderer === "raw") notes.push(RAW_WIRE_FORMAT_NOTE);

  return {
    kind: "custom-target",
    agent: agent.id,
    agentLabel: agent.label,
    providerLabel: CUSTOM_LABEL,
    upstreamBaseUrl: upstreamBaseUrlWithPath(upstream),
    renderer,
    baseUrl,
    command: template ? buildCommand(template, baseUrl, platform) : agent.id,
    setup: (template?.setup ?? []).map((file) => ({
      ...file,
      body: file.body.replace(/\{baseUrl\}/g, baseUrl),
    })),
    notes,
    warnings: template?.warnings ?? [],
  };
}
