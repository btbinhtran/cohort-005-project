import { describe, it, expect } from "vitest";
import { resolveChoice, customTargetNeedsModel, CUSTOM_ID } from "../../agents";
import { PORT, customTarget } from "./fixtures";

// ---------------------------------------------------------------------------
// Custom base URL — resolving a target the catalogue does not know about
// ---------------------------------------------------------------------------

describe("resolveChoice — custom base URL", () => {
  it("resolves a valid http:// target", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe("http://localhost:11434");
  });

  it("resolves a valid https:// target", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "https://api.deepseek.com",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe("https://api.deepseek.com");
  });

  it("keeps a path segment from the typed base URL instead of discarding it", () => {
    // Regression test for #74: a custom base URL like OpenCode Go's
    // https://opencode.ai/zen/go carries a path prefix the upstream actually
    // needs. Reducing this to origin-only silently drops it, and proxy.ts
    // then forwards to https://opencode.ai/v1/chat/completions — a 404 —
    // instead of https://opencode.ai/zen/go/v1/chat/completions.
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "https://api.deepseek.com/v1/some/path",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe(
      "https://api.deepseek.com/v1/some/path"
    );
  });

  it("drops a trailing slash from a typed path prefix, so proxy.ts never joins a doubled slash", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "https://opencode.ai/zen/go/",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result.upstreamBaseUrl).toBe("https://opencode.ai/zen/go");
  });

  it("rejects a base URL with no scheme", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "localhost:11434",
      },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("rejects a base URL that is not a URL at all", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID, customBaseUrl: "not a url" },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("rejects a base URL with an unrelated scheme", () => {
    const result = resolveChoice(
      {
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "ftp://example.com",
      },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("names the base URL in the rejection", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID, customBaseUrl: "not a url" },
      PORT
    );
    expect(result.kind === "error" && result.message).toContain("not a url");
  });

  it("points the student at --force when the base URL cannot be resolved", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID, customBaseUrl: "not a url" },
      PORT
    );
    expect(result.kind === "error" && result.message).toContain("--force");
  });

  it("rejects a custom choice with no base URL at all", () => {
    const result = resolveChoice(
      { agent: "opencode", provider: CUSTOM_ID },
      PORT
    );
    expect(result.kind).toBe("error");
  });

  it("defaults to the raw renderer when no wire format was given", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
    });
    expect(result.renderer).toBe("raw");
  });

  it("uses the openai renderer when that wire format is chosen", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
        customModel: "test-model",
      }).renderer
    ).toBe("openai");
  });

  it("uses the anthropic renderer when that wire format is chosen", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "anthropic",
      }).renderer
    ).toBe("anthropic");
  });

  it("uses the raw renderer when the student says they are not sure", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "raw",
      }).renderer
    ).toBe("raw");
  });

  it("warns the student that a raw capture is a JSON dump, not a broken one", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "raw",
    });
    expect(result.notes.join(" ")).toContain("not broken");
  });

  it("labels a custom target's provider as Custom base URL", () => {
    expect(
      customTarget({
        agent: "opencode",
        provider: CUSTOM_ID,
        customBaseUrl: "http://localhost:11434",
        customRenderer: "openai",
        customModel: "test-model",
      }).providerLabel
    ).toBe("Custom base URL");
  });

  it("has no catalogue provider id at all", () => {
    const result = customTarget({
      agent: "opencode",
      provider: CUSTOM_ID,
      customBaseUrl: "http://localhost:11434",
      customRenderer: "openai",
      customModel: "test-model",
    });
    expect(result).not.toHaveProperty("provider");
  });
});

describe("customTargetNeedsModel", () => {
  it("needs a model for Pi on every wire format", () => {
    expect(customTargetNeedsModel("pi", "openai")).toBe(true);
    expect(customTargetNeedsModel("pi", "anthropic")).toBe(true);
    expect(customTargetNeedsModel("pi", "raw")).toBe(true);
  });

  it("needs a model for OpenCode only on the OpenAI-compatible wire format", () => {
    expect(customTargetNeedsModel("opencode", "openai")).toBe(true);
    expect(customTargetNeedsModel("opencode", "anthropic")).toBe(false);
    expect(customTargetNeedsModel("opencode", "raw")).toBe(false);
  });

  it("needs no model for any other agent, on any wire format", () => {
    for (const renderer of ["openai", "anthropic", "raw"] as const) {
      expect(customTargetNeedsModel("codex", renderer)).toBe(false);
      expect(customTargetNeedsModel("claude-code", renderer)).toBe(false);
      expect(customTargetNeedsModel("omp", renderer)).toBe(false);
    }
  });
});
