/**
 * agents.ts — the catalogue of coding agents the request-logger can proxy.
 *
 * This module is the single source of truth for every per-agent fact:
 *  - which upstream host that agent's traffic must go to,
 *  - which renderer reads that wire format,
 *  - the exact command to run, correct by construction.
 *
 * Nothing else in the tool decides these things. The wizard reads the catalogue
 * to build its questions, the proxy reads the resolved target to route and to
 * render, and the startup banner prints the resolved command. Because the facts
 * are data rather than prose, they can be tested — and they cannot silently rot
 * the way a README does.
 *
 * Adding an eighth agent should be one entry here and nothing else.
 *
 * Not every student's setup fits a catalogue entry, though — a local model
 * server or a small provider has no fixed host to hard-code. For those, the
 * wizard offers "Custom base URL" wherever it offers a provider, and builds a
 * CustomTarget from what the student types instead of looking one up. See
 * resolveCustomTarget below.
 */

import { AGENTS } from "./agents/catalogue";
import { resolveCustomTarget } from "./agents/custom-target";
import { buildCommand } from "./agents/shell";
import {
  CUSTOM_ID,
  ISSUE_URL,
  OTHER_ID,
  type AgentChoice,
  type ProviderEntry,
  type RendererId,
  type Resolution,
} from "./agents/types";

// ---------------------------------------------------------------------------
// Reading the catalogue
// ---------------------------------------------------------------------------

export type AgentSummary = {
  id: string;
  label: string;
  supported: boolean;
  /** True when the student must also be asked which model provider they use. */
  needsProvider: boolean;
  /** True when this agent has no catalogue provider: every setup is custom. */
  alwaysCustom: boolean;
};

export type ProviderSummary = {
  id: string;
  label: string;
};

/**
 * Every agent the wizard offers, in the order it offers them.
 *
 * The catalogue is written in order of popularity. The list is then sorted so
 * the agents that cannot be logged sit at the bottom, because a student picking
 * from the top should meet the ones that work first. The sort is stable, so
 * popularity still decides the order inside each group.
 */
export function listAgents(): AgentSummary[] {
  const summaries = AGENTS.map((agent) => ({
    id: agent.id,
    label: agent.label,
    supported: agent.providers != null,
    // An alwaysCustom agent never shows the provider question — askChoice
    // skips straight past it (see agent.alwaysCustom above) — regardless of
    // how many internal templates its catalogue entry holds for
    // findCustomTemplate to pick between. Junie is the first alwaysCustom
    // agent with more than one, so this used to be true by coincidence for
    // every alwaysCustom agent (OMP has exactly one provider); it is
    // spelled out here now that a second one exists.
    needsProvider: !agent.alwaysCustom && (agent.providers?.length ?? 0) > 1,
    alwaysCustom: agent.alwaysCustom === true,
  }));
  return [
    ...summaries.filter((agent) => agent.supported),
    ...summaries.filter((agent) => !agent.supported),
  ];
}

/**
 * The providers to ask about for one agent, when there is more than one to
 * choose between. Empty when there is nothing to ask — a refused agent has
 * none, and an agent with exactly one provider is assumed rather than asked.
 *
 * This stays gated at two on purpose, unchanged by the custom-base-url
 * mechanism: it describes the catalogue, not the wizard's options. See
 * agentProviders for the list config.ts actually builds the provider
 * question's options from, which is not gated this way.
 */
export function listProviders(agentId: string): ProviderSummary[] {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent?.providers || agent.providers.length < 2) return [];
  return agent.providers.map((p) => ({ id: p.id, label: p.label }));
}

/**
 * Every catalogue provider for one agent, regardless of how many there are.
 *
 * config.ts uses this, not listProviders, to build the provider question's
 * options — because "Custom base URL" is now offered at that question for
 * every supported agent, even one with a single catalogue provider, there is
 * always something to pick between even when listProviders would say there
 * is nothing to ask about.
 */
export function agentProviders(agentId: string): ProviderSummary[] {
  const agent = AGENTS.find((a) => a.id === agentId);
  return (agent?.providers ?? []).map((p) => ({ id: p.id, label: p.label }));
}

// ---------------------------------------------------------------------------
// Which requests are worth writing down
// ---------------------------------------------------------------------------

/**
 * Some calls reach the model provider but never produce a model reply. One turn
 * fires several of them, so they are noise for "what is sent to the model". The
 * proxy forwards them all. It only writes down the ones this returns true for.
 *
 *  - A model call is always a POST. Agents also send connectivity probes, which
 *    would otherwise write an empty document at the top of the logs folder.
 *  - The direct Anthropic API counts tokens with a `count_tokens` path.
 *    Claude Code on Vertex AI reaches the same Anthropic wire format through a
 *    Vertex-style URL instead, whose token-counting call ends
 *    `:countTokens` — Vertex's own camelCase, colon-suffixed convention,
 *    not Anthropic's underscored one — so both spellings are matched below.
 *  - Gemini counts tokens under a different name, and on the Google login route
 *    it fires several calls that carry no prompt at all. On that route the only
 *    calls worth keeping are the ones that generate content.
 */
export function shouldLogRequest(
  method: string,
  reqPath: string,
  renderer: RendererId
): boolean {
  if (method.toUpperCase() !== "POST") return false;
  // Case-insensitive on purpose: the streaming call is `:streamGenerateContent`,
  // with a capital G, and the non-streaming one is `:generateContent`.
  if (renderer === "gemini") return /generateContent/i.test(reqPath);
  // Matches both `count_tokens` (direct Anthropic API) and `countTokens`
  // (Claude Code on Vertex AI).
  return !/count[_-]?tokens/i.test(reqPath);
}

/**
 * Turn a saved choice into everything the tool needs, or into a clear reason
 * why it cannot.
 *
 * Pure: no disk, no network, no clock. Give it the same choice, the same
 * port and the same platform and it gives back the same answer. `platform`
 * decides only the shell syntax of the printed command — POSIX `KEY=value
 * bin` everywhere except win32, where PowerShell needs `$env:KEY = 'value'`
 * statements instead (see withEnv). The caller reads `process.platform`
 * once and passes it in, the same way it already does for `port`.
 */
export function resolveChoice(
  choice: AgentChoice,
  options: { port: number; platform: NodeJS.Platform }
): Resolution {
  const agent = AGENTS.find((a) => a.id === choice.agent);

  // "Other" at either question means the same thing: the catalogue has no entry
  // for this student. Checked before the agent lookup, because "other" is not
  // an agent and must not read as an unknown one.
  if (choice.agent === OTHER_ID || choice.provider === OTHER_ID) {
    return {
      kind: "request",
      agentLabel: agent?.label ?? null,
      url: ISSUE_URL,
    };
  }

  if (!agent) {
    return {
      kind: "error",
      message:
        `Unknown agent "${choice.agent}". Run with --force to choose again. ` +
        `Known agents: ${AGENTS.map((a) => a.id).join(", ")}.`,
    };
  }

  if (!agent.providers) {
    return {
      kind: "refusal",
      agent: agent.id,
      agentLabel: agent.label,
      reason: agent.reason ?? "This agent cannot be logged.",
    };
  }

  // A custom target is resolved from what the student typed, not from a
  // catalogue lookup — either because they chose "Custom base URL" at the
  // provider question, or because every setup for this agent is custom
  // (alwaysCustom, e.g. OMP), which never shows that question at all.
  if (agent.alwaysCustom || choice.provider === CUSTOM_ID) {
    return resolveCustomTarget(agent, choice, options.port, options.platform);
  }

  let provider: ProviderEntry | undefined;
  if (agent.providers.length === 1) {
    // One provider, so the wizard never asked. Ignore anything saved.
    provider = agent.providers[0];
  } else if (choice.provider == null) {
    return {
      kind: "error",
      message:
        `${agent.label} can drive more than one model provider, so a provider ` +
        `must be chosen. Run with --force to choose again. Providers: ` +
        `${agent.providers.map((p) => p.id).join(", ")}.`,
    };
  } else {
    provider = agent.providers.find((p) => p.id === choice.provider);
    if (!provider) {
      return {
        kind: "error",
        message:
          `Unknown provider "${choice.provider}" for ${agent.label}. Run with ` +
          `--force to choose again. Providers: ` +
          `${agent.providers.map((p) => p.id).join(", ")}.`,
      };
    }
  }

  const baseUrl = `http://localhost:${options.port}${provider.suffix ?? ""}`;

  return {
    kind: "target",
    agent: agent.id,
    agentLabel: agent.label,
    provider: provider.id,
    providerLabel: provider.label,
    upstreamHost: provider.upstreamHost,
    renderer: provider.renderer,
    baseUrl,
    command: buildCommand(provider, baseUrl, options.platform),
    setup: (provider.setup ?? []).map((file) => ({
      ...file,
      body: file.body.replace(/\{baseUrl\}/g, baseUrl),
    })),
    notes: provider.notes ?? [],
    warnings: provider.warnings ?? [],
  };
}
