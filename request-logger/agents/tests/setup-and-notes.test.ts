import { describe, it, expect } from "vitest";
import { target } from "./fixtures";

describe("resolveChoice — setup files", () => {
  it("gives OpenCode a config file as the durable option", () => {
    expect(target("opencode", "anthropic").setup[0].path).toBe(
      "~/.config/opencode/opencode.json"
    );
  });

  it("puts the suffixed base URL into the OpenCode config file", () => {
    expect(target("opencode", "anthropic").setup[0].body).toContain(
      '"baseURL": "http://localhost:8787/v1"'
    );
  });

  it("leaves other placeholders in the OpenCode config alone", () => {
    expect(target("opencode", "anthropic").setup[0].body).toContain(
      "{env:ANTHROPIC_API_KEY}"
    );
  });

  it("gives Claude Code no config file to write", () => {
    expect(target("claude-code", "anthropic").setup).toEqual([]);
  });

  it("gives Claude Code on Vertex AI no config file either — it's all env vars", () => {
    expect(target("claude-code", "vertex").setup).toEqual([]);
  });

  it("gives Pi its models file, because Pi has no variable to set", () => {
    expect(target("pi", "anthropic").setup[0].path).toBe(
      "~/.pi/agent/models.json"
    );
  });

  it("uses Pi's exact spelling of the base URL key", () => {
    expect(target("pi", "anthropic").setup[0].body).toContain('"baseUrl"');
    expect(target("pi", "anthropic").setup[0].body).not.toContain('"baseURL"');
  });

  it("names Pi's Anthropic provider", () => {
    expect(target("pi", "anthropic").setup[0].body).toContain('"anthropic"');
  });

  it("names Pi's Codex provider with its hyphenated id", () => {
    expect(target("pi", "codex").setup[0].body).toContain('"openai-codex"');
  });

  it("gives Pi on a ChatGPT subscription a second file for the transport", () => {
    const files = target("pi", "codex").setup;
    expect(files).toHaveLength(2);
    expect(files[1].path).toBe("~/.pi/agent/settings.json");
  });

  it("sets the SSE transport in that second file", () => {
    expect(target("pi", "codex").setup[1].body).toContain('"transport": "sse"');
  });

  it("does not put the transport in the models file, where Pi would ignore it", () => {
    expect(target("pi", "codex").setup[0].body).not.toContain("transport");
  });

  it("gives Pi on Anthropic only one file to write", () => {
    expect(target("pi", "anthropic").setup).toHaveLength(1);
  });
});

describe("resolveChoice — notes and warnings", () => {
  it("explains the tool search flag to a Claude Code student", () => {
    expect(target("claude-code", "anthropic").notes.join(" ")).toContain(
      "ENABLE_TOOL_SEARCH"
    );
  });

  it("tells a Vertex AI student that ANTHROPIC_BASE_URL is ignored in Vertex mode", () => {
    const notes = target("claude-code", "vertex").notes.join(" ");
    expect(notes).toContain("ANTHROPIC_VERTEX_BASE_URL");
    expect(notes).toContain("ANTHROPIC_BASE_URL");
    expect(notes).toContain("silently ignored");
  });

  it("tells a Vertex AI student this entry only covers the global region", () => {
    expect(target("claude-code", "vertex").notes.join(" ")).toContain(
      "CLOUD_ML_REGION=global"
    );
  });

  it("tells a Codex student the flag does not touch their config file", () => {
    expect(target("codex", "openai").notes.join(" ")).toContain("config.toml");
  });

  it("tells a Copilot student where the extra documents come from", () => {
    expect(target("copilot").notes.join(" ")).toContain("MCP");
  });

  it("warns a Copilot student that some models write no log", () => {
    expect(target("copilot").warnings.join(" ")).toContain("WebSocket");
  });

  it("tells a Pi student on a ChatGPT subscription to use SSE", () => {
    expect(target("pi", "codex").notes.join(" ")).toContain("SSE");
  });

  it("tells a Pi student that the raw file keeps the compressed bytes", () => {
    expect(target("pi", "codex").notes.join(" ")).toContain(".request.txt");
  });

  it("warns a Gemini student that the two variables are not interchangeable", () => {
    expect(target("gemini", "api-key").warnings.join(" ")).toContain(
      "CODE_ASSIST_ENDPOINT"
    );
  });

  it("tells a Gemini student the Google login is free", () => {
    expect(target("gemini", "google-login").notes.join(" ")).toContain("free");
  });

  it("writes Antigravity CLI's settings file with modelProvider set to gemini", () => {
    const result = target("antigravity", "api-key");
    expect(result.setup).toHaveLength(1);
    expect(result.setup[0].path).toBe(
      "~/.gemini/antigravity-cli/settings.json"
    );
    expect(result.setup[0].body).toContain('"modelProvider": "gemini"');
  });

  it("tells an Antigravity CLI student to also export GEMINI_API_KEY", () => {
    expect(target("antigravity", "api-key").notes.join(" ")).toContain(
      "GEMINI_API_KEY"
    );
  });

  it("warns an Antigravity CLI student that the account sign-in route is not covered", () => {
    expect(target("antigravity", "api-key").warnings.join(" ")).toContain(
      "sign-in"
    );
  });
});
