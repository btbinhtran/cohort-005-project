import { describe, it, expect } from "vitest";
import { shouldLogRequest } from "../../agents";

describe("shouldLogRequest", () => {
  it("logs a real Anthropic turn", () => {
    expect(
      shouldLogRequest("POST", "/v1/messages?beta=true", "anthropic")
    ).toBe(true);
  });

  it("drops Anthropic token counting", () => {
    expect(
      shouldLogRequest("POST", "/v1/messages/count_tokens", "anthropic")
    ).toBe(false);
  });

  it("logs a real Claude Code on Vertex AI turn", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1/projects/my-proj/locations/global/publishers/anthropic/models/claude-sonnet-4-5:streamRawPredict",
        "anthropic"
      )
    ).toBe(true);
  });

  it("drops Vertex AI token counting, which uses countTokens instead of count_tokens", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1/projects/my-proj/locations/global/publishers/anthropic/models/claude-sonnet-4-5:countTokens",
        "anthropic"
      )
    ).toBe(false);
  });

  it("drops a connectivity probe, which would write an empty document", () => {
    expect(shouldLogRequest("HEAD", "/api/hello", "anthropic")).toBe(false);
  });

  it("drops a GET, because a model call is always a POST", () => {
    expect(shouldLogRequest("GET", "/v1/models", "openai")).toBe(false);
  });

  it("ignores the case of the method", () => {
    expect(shouldLogRequest("post", "/v1/messages", "anthropic")).toBe(true);
  });

  it("logs a real OpenAI turn", () => {
    expect(shouldLogRequest("POST", "/v1/responses", "openai")).toBe(true);
  });

  it("logs a streaming Gemini turn", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1beta/models/gemini-2.5-pro:streamGenerateContent",
        "gemini"
      )
    ).toBe(true);
  });

  it("logs a non-streaming Gemini turn", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1beta/models/gemini-2.5-pro:generateContent",
        "gemini"
      )
    ).toBe(true);
  });

  it("drops Gemini token counting, which has its own name", () => {
    expect(
      shouldLogRequest(
        "POST",
        "/v1beta/models/gemini-2.5-pro:countTokens",
        "gemini"
      )
    ).toBe(false);
  });

  it("drops the Google login housekeeping calls, which carry no prompt", () => {
    expect(
      shouldLogRequest("POST", "/v1internal:loadCodeAssist", "gemini")
    ).toBe(false);
    expect(
      shouldLogRequest("POST", "/v1internal:retrieveUserQuota", "gemini")
    ).toBe(false);
    expect(
      shouldLogRequest("POST", "/v1internal:listExperiments", "gemini")
    ).toBe(false);
    expect(
      shouldLogRequest("POST", "/v1internal:recordCodeAssistMetrics", "gemini")
    ).toBe(false);
  });
});
