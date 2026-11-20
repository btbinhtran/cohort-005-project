import { fenceJson, renderMessages, renderParams, sseData } from "./shared";

// ---- Gemini -----------------------------------------------------------------
//
// Gemini's shape differs from the other two everywhere it matters:
//  - the system prompt sits beside the messages as `systemInstruction`, not as
//    a field on the request and not as the first message;
//  - roles are `user` and `model`. There is no `assistant`;
//  - tools are nested twice, and the schema sits under a different key;
//  - sampling settings live in a nested config object.
//
// Under the free Google account login the whole body is wrapped one level
// deeper, and every response event is wrapped too. Both are unwrapped first, so
// the two auth routes then share one code path.

function unwrapGeminiRequest(j: any): any {
  return j && typeof j.request === "object" && j.request !== null
    ? j.request
    : j;
}

function unwrapGeminiResponse(j: any): any {
  return j && typeof j.response === "object" && j.response !== null
    ? j.response
    : j;
}

export function renderGeminiRequest(rawJson: any): string {
  const j = unwrapGeminiRequest(rawJson);
  const parts: string[] = [];

  const params = renderParams(
    {
      ...(j.generationConfig ?? {}),
      toolConfig: j.toolConfig,
      safetySettings: j.safetySettings,
    },
    [
      "temperature",
      "topP",
      "topK",
      "maxOutputTokens",
      "candidateCount",
      "stopSequences",
      "responseMimeType",
      "thinkingConfig",
      "toolConfig",
      "safetySettings",
    ]
  );
  if (params) parts.push(params);

  if (j.systemInstruction != null) {
    parts.push(
      [
        "<system-prompt>",
        "",
        renderGeminiParts(j.systemInstruction.parts ?? j.systemInstruction),
        "",
        "</system-prompt>",
      ].join("\n")
    );
  }

  if (Array.isArray(j.tools) && j.tools.length > 0) {
    parts.push(renderGeminiTools(j.tools));
  }

  parts.push(
    renderMessages(
      Array.isArray(j.contents) ? j.contents : [],
      renderGeminiContent
    )
  );

  return parts.join("\n\n");
}

function renderGeminiTools(tools: any[]): string {
  const rendered: string[] = [];
  for (const tool of tools) {
    if (Array.isArray(tool?.functionDeclarations)) {
      for (const fn of tool.functionDeclarations) {
        const lines = [`### ${fn.name ?? "(unnamed tool)"}`, ""];
        if (fn.description) lines.push(fn.description, "");
        const schema = fn.parametersJsonSchema ?? fn.parameters;
        if (schema) lines.push(fenceJson(schema));
        rendered.push(lines.join("\n"));
      }
      continue;
    }
    // Built-in tools arrive as bare keys, e.g. { googleSearch: {} }
    for (const key of Object.keys(tool ?? {})) {
      rendered.push([`### ${key}`, "", fenceJson(tool[key])].join("\n"));
    }
  }
  return ["<tools>", "", rendered.join("\n\n"), "", "</tools>"].join("\n");
}

function renderGeminiContent(message: any): string {
  return renderGeminiParts(message?.parts);
}

function renderGeminiParts(parts: any): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return fenceJson(parts);
  return parts
    .map((part) => {
      if (typeof part?.text === "string") {
        return part.thought
          ? ["<thinking>", "", part.text, "", "</thinking>"].join("\n")
          : part.text;
      }
      if (part?.functionCall) {
        const call = part.functionCall;
        return [
          `<tool-use name="${call.name ?? ""}" id="${call.id ?? ""}">`,
          "",
          fenceJson(call.args ?? {}),
          "",
          "</tool-use>",
        ].join("\n");
      }
      if (part?.functionResponse) {
        const result = part.functionResponse;
        return [
          `<tool-result name="${result.name ?? ""}" id="${result.id ?? ""}">`,
          "",
          typeof result.response === "string"
            ? result.response
            : fenceJson(result.response),
          "",
          "</tool-result>",
        ].join("\n");
      }
      if (part?.inlineData) {
        const data = part.inlineData;
        const bytes = typeof data.data === "string" ? data.data.length : 0;
        return `\`[inline data: ${data.mimeType ?? "unknown"}, ${bytes} base64 chars — full data in .request.txt]\``;
      }
      return fenceJson(part);
    })
    .join("\n\n");
}

export function renderGeminiResponse(raw: string): string {
  const events = sseData(raw).map(unwrapGeminiResponse);

  let text = "";
  let thinking = "";
  const toolCalls: Array<{ name: string; args: unknown }> = [];
  let finish: string | undefined;
  let usage: any;

  for (const ev of events) {
    const candidate = ev?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (typeof part?.text === "string") {
          if (part.thought) thinking += part.text;
          else text += part.text;
        } else if (part?.functionCall) {
          toolCalls.push({
            name: part.functionCall.name ?? "",
            args: part.functionCall.args ?? {},
          });
        }
      }
    }
    if (candidate?.finishReason) finish = candidate.finishReason;
    if (ev?.usageMetadata) usage = ev.usageMetadata;
  }

  const out: string[] = [];
  if (finish) out.push(`- **finish reason**: ${finish}`);
  if (usage) out.push(`- **usage**: ${JSON.stringify(usage)}`);
  if (out.length) out.push("");
  if (thinking)
    out.push(["<thinking>", "", thinking, "", "</thinking>"].join("\n"));
  if (text)
    out.push(
      ["<assistant-text>", "", text, "", "</assistant-text>"].join("\n")
    );
  for (const call of toolCalls) {
    out.push(
      [
        `<tool-use name="${call.name}" id="">`,
        "",
        fenceJson(call.args),
        "",
        "</tool-use>",
      ].join("\n")
    );
  }
  return out.length ? out.join("\n\n") : "_(no content decoded)_";
}
