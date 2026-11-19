/**
 * render.ts — turns a captured request/response into a readable Markdown doc.
 *
 * Design rules (locked):
 *  - Structural sections are delimited by XML tags, NOT Markdown headings,
 *    because the captured content (system prompts especially) is full of its
 *    own `#` headings that would otherwise collide with document structure.
 *  - Verbatim and complete: no truncation, no summarisation, no dedup. The one
 *    exception is base64 image data, which is binary (not "what's sent to the
 *    model as readable text") and is preserved untouched in the .request.txt.
 *  - Every wire format gets a real renderer; unexpected shapes fall back to
 *    pretty-printed JSON so information is never lost.
 *  - The body arrives as bytes, not as a string, because some agents compress
 *    it. Decoding happens here so that the proxy can forward the original bytes
 *    upstream untouched and still write a readable document.
 */

import zlib from "node:zlib";
import type { RendererId } from "./agents";
import {
  renderAnthropicRequest,
  renderAnthropicResponse,
} from "./render/anthropic";
import { renderGeminiRequest, renderGeminiResponse } from "./render/gemini";
import { renderOpenAIRequest, renderOpenAIResponse } from "./render/openai";
import { fence, fenceJson, sseData } from "./render/shared";

type RenderInput = {
  /** Human label for the capture, e.g. "Claude Code" or "Pi (ChatGPT)". */
  agent: string;
  renderer: RendererId;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  /** The request body exactly as it arrived, still compressed if it was sent so. */
  requestBody: Buffer;
  /** The request's content-encoding header, if it had one. */
  requestEncoding?: string;
  responseRaw: string;
};

const REDACT = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "x-goog-api-key",
]);

/**
 * Turn the raw request bytes into text.
 *
 * Pi and Codex both compress their request body (zstd) when they talk to the
 * ChatGPT backend. Without this the readable document would be a page of
 * binary. The proxy still forwards, and still saves, the original bytes:
 * only the copy we read is decoded.
 *
 * A body that claims an encoding but won't decode is never silently shown as
 * if it were text — that just reproduces the original bug (a page of binary
 * in the "readable" document) with no clue why. Instead this returns a loud,
 * unmissable warning ahead of the raw bytes, so a student sees a reason
 * instead of gibberish.
 */
export function decodeRequestBody(body: Buffer, encoding?: string): string {
  const kind = (encoding ?? "").trim().toLowerCase();
  if (kind === "" || kind === "identity") return body.toString("utf8");

  if (
    kind === "zstd" &&
    typeof (zlib as any).zstdDecompressSync !== "function"
  ) {
    return decodeFailureWarning(
      body,
      `this body is zstd-compressed, but this proxy is running on Node ${process.version}, ` +
        "which has no zlib.zstdDecompressSync (that needs Node >=22.15.0 or >=23.8.0). " +
        "Upgrade Node and re-send the request to see the real body."
    );
  }

  try {
    if (kind === "zstd")
      return (zlib as any).zstdDecompressSync(body).toString("utf8");
    if (kind === "gzip") return zlib.gunzipSync(body).toString("utf8");
    if (kind === "br") return zlib.brotliDecompressSync(body).toString("utf8");
    if (kind === "deflate") return zlib.inflateSync(body).toString("utf8");
  } catch (error) {
    return decodeFailureWarning(
      body,
      `this body claims content-encoding "${kind}" but did not decode as that: ${(error as Error).message}`
    );
  }

  return decodeFailureWarning(
    body,
    `content-encoding "${kind}" is not one this tool decodes`
  );
}

function decodeFailureWarning(body: Buffer, reason: string): string {
  return (
    `[request-logger] COULD NOT DECODE THIS BODY — ${reason}\n\n` +
    "The bytes below are still compressed. They are NOT what was actually sent as text:\n\n" +
    body.toString("utf8")
  );
}

export function renderMarkdown(input: RenderInput): string {
  const requestText = decodeRequestBody(
    input.requestBody,
    input.requestEncoding
  );

  let reqJson: any = null;
  try {
    reqJson = JSON.parse(requestText);
  } catch {
    // leave null; renderRequest falls back to raw
  }

  const model = findModel(reqJson, input.path);

  return (
    [
      renderMeta(input, model),
      renderHeaders(input.headers),
      "<request>\n\n" +
        renderRequest(input, reqJson, requestText) +
        "\n\n</request>",
      "<response>\n\n" + renderResponse(input) + "\n\n</response>",
    ].join("\n\n") + "\n"
  );
}

/** Most APIs name the model in the body. Gemini names it in the URL. */
function findModel(reqJson: any, path: string): string {
  if (typeof reqJson?.model === "string") return reqJson.model;
  const fromPath = path.match(/models\/([^:/?]+)/);
  if (fromPath) return fromPath[1];
  return "unknown";
}

function renderMeta(input: RenderInput, model: string): string {
  return [
    "<meta>",
    "",
    `- **timestamp**: ${input.timestamp}`,
    `- **agent**: ${input.agent}`,
    `- **wire format**: ${input.renderer}`,
    `- **model**: ${model}`,
    `- **endpoint**: ${input.method} ${input.path}`,
    `- **upstream status**: ${input.statusCode}`,
    "",
    "</meta>",
  ].join("\n");
}

function renderHeaders(headers: RenderInput["headers"]): string {
  const lines = Object.entries(headers).map(([key, value]) => {
    const shown = REDACT.has(key.toLowerCase())
      ? "[REDACTED]"
      : Array.isArray(value)
        ? value.join(", ")
        : (value ?? "");
    return `${key}: ${shown}`;
  });
  return ["<headers>", "", "```", ...lines, "```", "", "</headers>"].join("\n");
}

// ---------------------------------------------------------------------------
// Request rendering
// ---------------------------------------------------------------------------

function renderRequest(
  input: RenderInput,
  reqJson: any,
  requestText: string
): string {
  // Checked first and explicitly: without this, "raw" is not "anthropic" and
  // not "gemini", so it would silently fall into the OpenAI parser below —
  // the same implicit default every other unrecognised renderer id already
  // falls into. "raw" must never guess at a shape it was not told; it always
  // goes straight to the generic fallback instead.
  if (input.renderer === "raw") {
    return reqJson == null ? fence(requestText) : fenceJson(reqJson);
  }
  if (reqJson == null) {
    return fence(requestText);
  }
  try {
    if (input.renderer === "anthropic") return renderAnthropicRequest(reqJson);
    if (input.renderer === "gemini") return renderGeminiRequest(reqJson);
    return renderOpenAIRequest(reqJson);
  } catch (error) {
    return (
      `<!-- renderer error, showing raw JSON: ${(error as Error).message} -->\n\n` +
      fenceJson(reqJson)
    );
  }
}

// ---------------------------------------------------------------------------
// Response rendering (reassembled from the streamed SSE)
// ---------------------------------------------------------------------------

function renderResponse(input: RenderInput): string {
  const raw = input.responseRaw;
  if (raw.trim().length === 0) return "_(empty response)_";

  const looksSSE = /(^|\n)\s*(event:|data:)/.test(raw);

  // Checked first and explicitly, for the same reason as renderRequest
  // above: "raw" must never fall through into the OpenAI stream parser.
  // Ollama's own response shape — newline-delimited bare JSON, no `data:`
  // prefix — is not reconstructed here; that is a separate fast-follow. This
  // path still shows something rather than nothing: an SSE-ish stream is
  // dumped one parsed event per JSON block, and anything else (including
  // Ollama's NDJSON) falls back to the untouched raw text.
  if (input.renderer === "raw") {
    try {
      if (!looksSSE) return fenceJson(JSON.parse(raw));
      const events = sseData(raw);
      return events.length > 0
        ? events.map((event) => fenceJson(event)).join("\n\n")
        : fence(raw);
    } catch {
      return fence(raw);
    }
  }

  try {
    if (!looksSSE) {
      // Non-streaming JSON body.
      const parsed = JSON.parse(raw);
      return fenceJson(parsed);
    }
    if (input.renderer === "anthropic") return renderAnthropicResponse(raw);
    if (input.renderer === "gemini") return renderGeminiResponse(raw);
    return renderOpenAIResponse(raw);
  } catch (error) {
    return (
      `<!-- response renderer error, showing raw stream: ${(error as Error).message} -->\n\n` +
      fence(raw)
    );
  }
}
