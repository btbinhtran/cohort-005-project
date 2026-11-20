import { describe, it, expect } from "vitest";
import { resolveChoice } from "../../agents";
import { PORT, target } from "./fixtures";

describe("resolveChoice — upstream hosts", () => {
  it("sends Claude Code to Anthropic", () => {
    expect(target("claude-code", "anthropic").upstreamHost).toBe(
      "api.anthropic.com"
    );
  });

  it("sends Claude Code on Vertex AI to the global Vertex endpoint", () => {
    expect(target("claude-code", "vertex").upstreamHost).toBe(
      "aiplatform.googleapis.com"
    );
  });

  it("gives Claude Code's two providers different hosts", () => {
    expect(target("claude-code", "anthropic").upstreamHost).not.toBe(
      target("claude-code", "vertex").upstreamHost
    );
  });

  it("sends Codex on an API key to OpenAI", () => {
    expect(target("codex", "openai").upstreamHost).toBe("api.openai.com");
  });

  it("sends Codex on a ChatGPT subscription to chatgpt.com", () => {
    expect(target("codex", "chatgpt").upstreamHost).toBe("chatgpt.com");
  });

  it("sends Copilot to its own host", () => {
    expect(target("copilot").upstreamHost).toBe("api.githubcopilot.com");
  });

  it("sends OpenCode on Anthropic to Anthropic", () => {
    expect(target("opencode", "anthropic").upstreamHost).toBe(
      "api.anthropic.com"
    );
  });

  it("sends OpenCode on OpenAI to OpenAI", () => {
    expect(target("opencode", "openai").upstreamHost).toBe("api.openai.com");
  });

  it("sends Pi on Anthropic to Anthropic", () => {
    expect(target("pi", "anthropic").upstreamHost).toBe("api.anthropic.com");
  });

  it("sends Pi on OpenAI to OpenAI", () => {
    expect(target("pi", "openai").upstreamHost).toBe("api.openai.com");
  });

  it("sends Pi on a ChatGPT subscription to the ChatGPT host", () => {
    expect(target("pi", "codex").upstreamHost).toBe("chatgpt.com");
  });

  it("does not send Pi on a ChatGPT subscription to the OpenAI host", () => {
    expect(target("pi", "codex").upstreamHost).not.toBe("api.openai.com");
  });

  it("sends Gemini on an API key to the public API host", () => {
    expect(target("gemini", "api-key").upstreamHost).toBe(
      "generativelanguage.googleapis.com"
    );
  });

  it("sends Gemini on a Google login to the Code Assist host", () => {
    expect(target("gemini", "google-login").upstreamHost).toBe(
      "cloudcode-pa.googleapis.com"
    );
  });

  it("gives the two Gemini routes different hosts", () => {
    expect(target("gemini", "api-key").upstreamHost).not.toBe(
      target("gemini", "google-login").upstreamHost
    );
  });

  it("sends Antigravity CLI's API key route to the same public API host as Gemini CLI's", () => {
    expect(target("antigravity", "api-key").upstreamHost).toBe(
      "generativelanguage.googleapis.com"
    );
    expect(target("antigravity", "api-key").upstreamHost).toBe(
      target("gemini", "api-key").upstreamHost
    );
  });
});

describe("resolveChoice — renderers", () => {
  it("reads Claude Code with the Anthropic renderer", () => {
    expect(target("claude-code", "anthropic").renderer).toBe("anthropic");
  });

  it("reads Claude Code on Vertex AI with the Anthropic renderer too, since Vertex's Claude endpoint is the same Messages API shape", () => {
    expect(target("claude-code", "vertex").renderer).toBe("anthropic");
  });

  it("reads Codex with the OpenAI renderer", () => {
    expect(target("codex", "openai").renderer).toBe("openai");
    expect(target("codex", "chatgpt").renderer).toBe("openai");
  });

  it("reads Copilot with the OpenAI renderer", () => {
    expect(target("copilot").renderer).toBe("openai");
  });

  it("reads OpenCode on Anthropic with the Anthropic renderer", () => {
    expect(target("opencode", "anthropic").renderer).toBe("anthropic");
  });

  it("reads OpenCode on OpenAI with the OpenAI renderer", () => {
    expect(target("opencode", "openai").renderer).toBe("openai");
  });

  it("reads Pi on a ChatGPT subscription with the OpenAI renderer", () => {
    expect(target("pi", "codex").renderer).toBe("openai");
  });

  it("reads both Gemini routes with the Gemini renderer", () => {
    expect(target("gemini", "api-key").renderer).toBe("gemini");
    expect(target("gemini", "google-login").renderer).toBe("gemini");
  });

  it("reads Antigravity CLI with the Gemini renderer too, since it speaks the same wire format", () => {
    expect(target("antigravity", "api-key").renderer).toBe("gemini");
  });
});

describe("resolveChoice — base URLs", () => {
  it("gives OpenCode the /v1 suffix its SDK needs", () => {
    expect(target("opencode", "anthropic").baseUrl).toBe(
      "http://localhost:8787/v1"
    );
  });

  it("gives Claude Code no suffix, because it appends the whole path itself", () => {
    expect(target("claude-code", "anthropic").baseUrl).toBe(
      "http://localhost:8787"
    );
  });

  it("gives Claude Code on Vertex AI no suffix either, for the same reason", () => {
    expect(target("claude-code", "vertex").baseUrl).toBe(
      "http://localhost:8787"
    );
  });

  it("gives Copilot no suffix", () => {
    expect(target("copilot").baseUrl).toBe("http://localhost:8787");
  });

  it("gives Pi on Anthropic no suffix, because Pi's SDK adds /v1/messages", () => {
    expect(target("pi", "anthropic").baseUrl).toBe("http://localhost:8787");
  });

  it("gives Pi on OpenAI the /v1 suffix, because that SDK adds only /responses", () => {
    expect(target("pi", "openai").baseUrl).toBe("http://localhost:8787/v1");
  });

  it("gives Pi on a ChatGPT subscription the /backend-api suffix", () => {
    // Pi appends /codex/responses itself, and the real endpoint sits under
    // /backend-api. Without the suffix the forwarded path loses that segment.
    expect(target("pi", "codex").baseUrl).toBe(
      "http://localhost:8787/backend-api"
    );
  });

  it("uses the port it is given", () => {
    const result = resolveChoice(
      { agent: "claude-code", provider: "anthropic" },
      { port: 9000, platform: "linux" }
    );
    expect(result.kind === "target" && result.baseUrl).toBe(
      "http://localhost:9000"
    );
  });

  it("puts the chosen port into the command", () => {
    const result = resolveChoice(
      { agent: "claude-code", provider: "anthropic" },
      { port: 9000, platform: "linux" }
    );
    expect(result.kind === "target" && result.command).toContain(
      "http://localhost:9000"
    );
  });
});

describe("resolveChoice — refusals", () => {
  it("refuses Cursor", () => {
    expect(resolveChoice({ agent: "cursor" }, PORT).kind).toBe("refusal");
  });

  it("gives a reason for refusing Cursor", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result.kind === "refusal" && result.reason).toContain("own servers");
  });

  it("refuses Amp", () => {
    expect(resolveChoice({ agent: "amp" }, PORT).kind).toBe("refusal");
  });

  it("gives a reason for refusing Amp", () => {
    const result = resolveChoice({ agent: "amp" }, PORT);
    expect(result.kind === "refusal" && result.reason).toContain("own servers");
  });

  it("names the agent in the refusal", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result.kind === "refusal" && result.agentLabel).toBe("Cursor CLI");
  });

  it("gives no upstream host for a refused agent", () => {
    const result = resolveChoice({ agent: "cursor" }, PORT);
    expect(result).not.toHaveProperty("upstreamHost");
  });
});

describe("resolveChoice — bad input", () => {
  it("rejects an unknown agent", () => {
    expect(resolveChoice({ agent: "nonesuch" }, PORT).kind).toBe("error");
  });

  it("lists the known agents when the agent is unknown", () => {
    const result = resolveChoice({ agent: "nonesuch" }, PORT);
    expect(result.kind === "error" && result.message).toContain("claude-code");
  });

  it("rejects a choice that omits a needed provider", () => {
    expect(resolveChoice({ agent: "opencode" }, PORT).kind).toBe("error");
  });

  it("lists the providers when one is missing", () => {
    const result = resolveChoice({ agent: "opencode" }, PORT);
    expect(result.kind === "error" && result.message).toContain("anthropic");
  });

  it("rejects an unknown provider", () => {
    expect(
      resolveChoice({ agent: "opencode", provider: "cohere" }, PORT).kind
    ).toBe("error");
  });

  it("accepts a single-provider agent with no provider given", () => {
    // Claude Code no longer qualifies now it has two providers (see below) —
    // Copilot is still single-provider and exercises this general case.
    expect(resolveChoice({ agent: "copilot" }, PORT).kind).toBe("target");
  });

  it("ignores a stale provider on a single-provider agent", () => {
    expect(target("copilot", "whatever").upstreamHost).toBe(
      "api.githubcopilot.com"
    );
  });

  it("now requires a provider for Claude Code, since it has two", () => {
    const result = resolveChoice({ agent: "claude-code" }, PORT);
    expect(result.kind).toBe("error");
    expect(result.kind === "error" && result.message).toContain("vertex");
  });

  it("points the student at --force when a choice cannot be resolved", () => {
    const result = resolveChoice({ agent: "nonesuch" }, PORT);
    expect(result.kind === "error" && result.message).toContain("--force");
  });
});
