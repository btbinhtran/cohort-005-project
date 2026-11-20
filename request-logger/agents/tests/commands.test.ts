import { describe, it, expect } from "vitest";
import { resolveChoice } from "../../agents";
import { target } from "./fixtures";

describe("resolveChoice — commands", () => {
  it("turns tool search back on for Claude Code", () => {
    expect(target("claude-code", "anthropic").command).toContain(
      "ENABLE_TOOL_SEARCH=true"
    );
  });

  it("uses the plain variable name, not the prefixed one", () => {
    expect(target("claude-code", "anthropic").command).not.toContain(
      "CLAUDE_CODE_ENABLE_TOOL_SEARCH"
    );
  });

  it("sets the base URL for Claude Code", () => {
    expect(target("claude-code", "anthropic").command).toBe(
      "ANTHROPIC_BASE_URL=http://localhost:8787 ENABLE_TOOL_SEARCH=true claude"
    );
  });

  it("sets the Vertex base URL variable for Claude Code on Vertex AI, not the plain Anthropic one", () => {
    // ANTHROPIC_BASE_URL is silently ignored once Claude Code is in Vertex
    // mode (CLAUDE_CODE_USE_VERTEX=1) — this is the whole reason the two
    // providers need different env vars.
    expect(target("claude-code", "vertex").command).toBe(
      "ANTHROPIC_VERTEX_BASE_URL=http://localhost:8787 ENABLE_TOOL_SEARCH=true claude"
    );
  });

  it("never puts the plain Anthropic variable in the Vertex command", () => {
    expect(target("claude-code", "vertex").command).not.toContain(
      "ANTHROPIC_BASE_URL=http://localhost:8787 "
    );
  });

  it("sets the base URL for Codex on an API key", () => {
    // Codex 0.133.0 has no OPENAI_BASE_URL. The flag is the only door.
    expect(target("codex", "openai").command).toBe(
      `codex -c 'openai_base_url="http://localhost:8787/v1"'`
    );
  });

  it("sets the base URL for Codex on a ChatGPT subscription", () => {
    expect(target("codex", "chatgpt").command).toBe(
      `codex -c 'openai_base_url="http://localhost:8787/backend-api/codex"'`
    );
  });

  it("never tells a Codex student to use the variable that was removed", () => {
    expect(target("codex", "openai").command).not.toContain("OPENAI_BASE_URL");
    expect(target("codex", "chatgpt").command).not.toContain("OPENAI_BASE_URL");
  });

  it("uses Copilot's own variable", () => {
    expect(target("copilot").command).toContain("COPILOT_API_URL=");
  });

  it("does not change how a Copilot student runs their agent", () => {
    // The built-in MCP servers are part of what Copilot really sends. Turning
    // them off would make the capture tidier and less true.
    expect(target("copilot").command).toBe(
      "COPILOT_API_URL=http://localhost:8787 copilot"
    );
  });

  it("carries the suffix through into the OpenCode command", () => {
    expect(target("opencode", "anthropic").command).toBe(
      "ANTHROPIC_BASE_URL=http://localhost:8787/v1 opencode"
    );
  });

  it("uses the Code Assist variable for a Gemini Google login", () => {
    expect(target("gemini", "google-login").command).toBe(
      "CODE_ASSIST_ENDPOINT=http://localhost:8787 gemini"
    );
  });

  it("uses the other variable for a Gemini API key", () => {
    expect(target("gemini", "api-key").command).toBe(
      "GOOGLE_GEMINI_BASE_URL=http://localhost:8787 gemini"
    );
  });

  it("does not mix the two Gemini variables", () => {
    expect(target("gemini", "api-key").command).not.toContain(
      "CODE_ASSIST_ENDPOINT"
    );
    expect(target("gemini", "google-login").command).not.toContain(
      "GOOGLE_GEMINI_BASE_URL"
    );
  });

  it("runs agy, not gemini, for Antigravity CLI", () => {
    expect(target("antigravity", "api-key").command).toBe(
      "GOOGLE_GEMINI_BASE_URL=http://localhost:8787 agy"
    );
  });

  it("gives Pi a bare command, because Pi has no base URL variable", () => {
    expect(target("pi", "anthropic").command).toBe("pi");
  });
});

describe("resolveChoice — commands on win32", () => {
  // A student on native Windows (not WSL, not Git Bash) has no shell that
  // understands `KEY=value bin` — PowerShell reports it as an unrecognized
  // command, which is exactly the report that prompted this. PowerShell's
  // own syntax is one `$env:KEY = 'value'` statement per variable, chained
  // with semicolons.
  const WIN = { port: 8787, platform: "win32" as NodeJS.Platform };

  function winTarget(agent: string, provider?: string) {
    const result = resolveChoice({ agent, provider }, WIN);
    if (result.kind !== "target") {
      throw new Error(
        `expected a target for ${agent}/${provider}, got ${result.kind}`
      );
    }
    return result;
  }

  it("uses PowerShell $env: syntax instead of POSIX VAR=value", () => {
    expect(winTarget("claude-code", "anthropic").command).toBe(
      "$env:ANTHROPIC_BASE_URL = 'http://localhost:8787'; " +
        "$env:ENABLE_TOOL_SEARCH = 'true'; claude"
    );
  });

  it("never prints the POSIX VAR=value form on win32", () => {
    expect(winTarget("claude-code", "anthropic").command).not.toMatch(
      /^ANTHROPIC_BASE_URL=/
    );
  });

  it("uses PowerShell $env: syntax for Claude Code on Vertex AI too", () => {
    expect(winTarget("claude-code", "vertex").command).toBe(
      "$env:ANTHROPIC_VERTEX_BASE_URL = 'http://localhost:8787'; " +
        "$env:ENABLE_TOOL_SEARCH = 'true'; claude"
    );
  });

  it("chains one assignment per variable with semicolons", () => {
    expect(winTarget("copilot").command).toBe(
      "$env:COPILOT_API_URL = 'http://localhost:8787'; copilot"
    );
  });

  it("leaves a command with no env vars unchanged, since there is nothing to rewrite", () => {
    // Pi has no base URL variable at all.
    expect(winTarget("pi", "anthropic").command).toBe("pi");
  });

  it("leaves Codex's flag-based override unchanged", () => {
    // Codex has no env var override — its whole command is a `-c` flag,
    // single-quoted. PowerShell parses a single-quoted literal the same way
    // bash does (no interpolation), so this needs no rewriting.
    expect(winTarget("codex", "openai").command).toBe(
      `codex -c 'openai_base_url="http://localhost:8787/v1"'`
    );
  });
});
