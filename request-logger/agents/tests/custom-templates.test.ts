import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolveChoice } from "../../agents";
import { CUSTOM_ID } from "../types";
import { PORT, customTarget } from "./fixtures";

describe("resolveChoice — custom base URL, per-agent command template", () => {
  it("builds a one-run OpenCode provider config for the OpenAI-compatible route", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    const assignment = result.command.slice(0, -" opencode".length);
    const serialized = execFileSync(
      "/bin/sh",
      [
        "-c",
        `${assignment} node -e 'process.stdout.write(process.env.OPENCODE_CONFIG_CONTENT)'`,
      ],
      { encoding: "utf8" }
    );
    const config = JSON.parse(serialized);

    expect(config.provider["request-logger"]).toEqual({
      npm: "@ai-sdk/openai-compatible",
      name: "Request Logger",
      options: { baseURL: "http://localhost:8787/v1" },
      models: { "qwen3:8b": { name: "qwen3:8b" } },
    });
    expect(config.model).toBe("request-logger/qwen3:8b");
    expect(config.small_model).toBe("request-logger/qwen3:8b");
    expect(result.setup).toEqual([]);
  });

  it("shell-quotes a model ID containing quotes and metacharacters", () => {
    const model = `model ' "$HOME"; printf INJECTED`;
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: model,
    });
    const assignment = result.command.slice(0, -" opencode".length);
    const serialized = execFileSync(
      "/bin/sh",
      [
        "-c",
        `${assignment} node -e 'process.stdout.write(process.env.OPENCODE_CONFIG_CONTENT)'`,
      ],
      { encoding: "utf8" }
    );
    const config = JSON.parse(serialized);

    expect(config.model).toBe(`request-logger/${model}`);
    expect(config.provider["request-logger"].models).toEqual({
      [model]: { name: model },
    });
  });

  it("requires a remembered model for specialized OpenCode custom targets", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
      },
      PORT
    );
    expect(result.kind).toBe("error");
    expect(result.kind === "error" && result.message).toContain("--force");
  });

  it("borrows OpenCode's Anthropic env var and config file for an anthropic-compatible custom target", () => {
    // The env var and the config file both point the agent at the proxy's own
    // address (http://localhost:8787), not at the upstream the student typed
    // — same as every catalogue target. See upstreamBaseUrl for the upstream.
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
    });
    expect(result.command).toContain(
      "ANTHROPIC_BASE_URL=http://localhost:8787/v1"
    );
    expect(result.setup[0].path).toBe("~/.config/opencode/opencode.json");
    expect(result.upstreamBaseUrl).toBe("http://localhost:11434");
  });

  it("uses PowerShell syntax for a borrowed-template custom target on win32", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "anthropic",
      },
      { port: 8787, platform: "win32" }
    );
    if (result.kind !== "custom-target") {
      throw new Error(`expected a custom-target, got ${result.kind}`);
    }
    expect(result.command).toBe(
      "$env:ANTHROPIC_BASE_URL = 'http://localhost:8787/v1'; opencode"
    );
  });

  it("uses OpenCode's temporary config for an openai-compatible custom target", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.command).toContain("OPENCODE_CONFIG_CONTENT=");
    expect(result.setup).toEqual([]);
  });

  it("uses PowerShell syntax for OpenCode's temporary config on win32", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
        customModel: "test-model",
      },
      { port: 8787, platform: "win32" }
    );
    if (result.kind !== "custom-target") {
      throw new Error(`expected a custom-target, got ${result.kind}`);
    }
    expect(result.command.startsWith("$env:OPENCODE_CONFIG_CONTENT = '")).toBe(
      true
    );
    expect(result.command.endsWith("; opencode")).toBe(true);
    expect(result.command).not.toContain("OPENCODE_CONFIG_CONTENT=$env");
    expect(result.command).not.toMatch(/^OPENCODE_CONFIG_CONTENT=/);
  });

  it("doubles an embedded single quote in the PowerShell-quoted config, since PowerShell has no backslash escape", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
        customModel: `model's name`,
      },
      { port: 8787, platform: "win32" }
    );
    if (result.kind !== "custom-target") {
      throw new Error(`expected a custom-target, got ${result.kind}`);
    }
    expect(result.command).toContain("model''s name");
  });

  it("defaults OpenCode's raw/not-sure custom target to the OpenAI template", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.command).toContain("OPENAI_BASE_URL=");
  });

  it("borrows Pi's OpenAI provider key for an openai-compatible custom target", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    expect(result.setup[0].body).toContain('"openai"');
    expect(result.setup[0].body).not.toContain('"openai-codex"');
  });

  it("never borrows Pi's ChatGPT-subscription template for a custom target", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    expect(result.setup).toHaveLength(1);
  });

  it("requires a remembered model for every Pi custom target, not just one wire format", () => {
    for (const customRenderer of ["openai", "anthropic", "raw"] as const) {
      const result = resolveChoice(
        {
          agent: "pi",
          provider: CUSTOM_ID,
          customBaseUrl: "http://localhost:11434",
          customRenderer,
        },
        PORT
      );
      expect(result.kind).toBe("error");
      expect(result.kind === "error" && result.message).toContain("--force");
    }
  });

  it("writes the selected model into Pi's models file, replacing its built-in catalogue", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    const written = JSON.parse(result.setup[0].body);
    expect(written.providers.openai).toEqual({
      baseUrl: "http://localhost:8787/v1",
      models: [{ id: "qwen3:8b" }],
    });
  });

  it("writes Pi's Anthropic provider key for an anthropic-compatible custom target, with the selected model", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
      customModel: "llama3.1:8b",
    });
    const written = JSON.parse(result.setup[0].body);
    expect(written.providers.anthropic).toEqual({
      baseUrl: "http://localhost:8787",
      models: [{ id: "llama3.1:8b" }],
    });
  });

  it("warns an Anthropic-compatible Pi custom target that discovery may find nothing, since /v1/models is OpenAI-shaped", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
      customModel: "llama3.1:8b",
    });
    expect(result.notes.join(" ")).toContain("/v1/models");
  });

  it("gives an openai-compatible Pi custom target no discovery caveat, since that is exactly what discovery checks", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    expect(result.notes.join(" ")).not.toContain("/v1/models");
  });

  it("gives Pi a bare command for a custom target too, since Pi has no base URL variable", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    expect(result.command).toBe("pi");
  });

  it("does not carry Pi's built-in-catalogue note into a custom target, since that note is no longer true there", () => {
    const result = customTarget({
      agent: "pi",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "qwen3:8b",
    });
    expect(result.notes.join(" ")).not.toContain("whole built-in model list");
  });

  it("reuses Claude Code's Anthropic template regardless of the wire format chosen, since that provider is tagged as the catch-all", () => {
    // Claude Code now has two providers (anthropic, vertex), so this no
    // longer falls out of findCustomTemplate's single-provider shortcut —
    // it works because the "anthropic" provider is tagged
    // customTemplateFor: ["anthropic", "openai", "raw"]. "vertex" is
    // untagged on purpose: it needs Google Cloud auth, so it would silently
    // misconfigure an unrelated custom server.
    const result = customTarget({
      agent: "claude-code",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.command).toContain(
      "ANTHROPIC_BASE_URL=http://localhost:8787"
    );
    expect(result.command).toContain("claude");
    expect(result.upstreamBaseUrl).toBe("http://localhost:11434");
  });

  it("reuses Copilot's own template regardless of the wire format chosen, since it has only one", () => {
    const result = customTarget({
      agent: "copilot",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "anthropic",
    });
    expect(result.command).toContain("COPILOT_API_URL=http://localhost:8787");
  });

  it("never borrows Codex's ChatGPT-subscription template for a custom target", () => {
    const result = customTarget({
      agent: "codex",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
    });
    expect(result.command).not.toContain("/backend-api/codex");
    expect(result.baseUrl).toBe("http://localhost:8787/v1");
  });
});
