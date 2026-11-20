import {
  blockText,
  fence,
  fenceJson,
  renderMessages,
  renderParams,
  sseData,
} from "./shared";

// ---- Anthropic --------------------------------------------------------------

export function renderAnthropicRequest(j: any): string {
  const parts: string[] = [];

  const params = renderParams(j, [
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "stream",
    "stop_sequences",
    "tool_choice",
    "thinking",
    "metadata",
  ]);
  if (params) parts.push(params);

  if (j.system != null) {
    parts.push(
      [
        "<system-prompt>",
        "",
        renderAnthropicSystem(j.system),
        "",
        "</system-prompt>",
      ].join("\n")
    );
  }

  if (Array.isArray(j.tools) && j.tools.length > 0) {
    parts.push(renderAnthropicTools(j.tools));
  }

  parts.push(renderMessages(j.messages, renderAnthropicContent));

  return parts.join("\n\n");
}

function renderAnthropicSystem(system: any): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    return system
      .map((block) => {
        const text = blockText(block);
        const marker = block?.cache_control
          ? "\n\n<!-- cache_control breakpoint -->"
          : "";
        return text + marker;
      })
      .join("\n\n");
  }
  return fenceJson(system);
}

function renderAnthropicTools(tools: any[]): string {
  const rendered = tools.map((tool) => {
    const lines = [`### ${tool.name ?? "(unnamed tool)"}`, ""];
    if (tool.description) lines.push(tool.description, "");
    if (tool.input_schema) lines.push(fenceJson(tool.input_schema));
    return lines.join("\n");
  });
  return ["<tools>", "", rendered.join("\n\n"), "", "</tools>"].join("\n");
}

export function renderAnthropicContent(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return fenceJson(content);
  return content
    .map((block) => {
      switch (block?.type) {
        case "text":
          return block.text ?? "";
        case "tool_use":
          return [
            `<tool-use name="${block.name}" id="${block.id ?? ""}">`,
            "",
            fenceJson(block.input ?? {}),
            "",
            "</tool-use>",
          ].join("\n");
        case "tool_result": {
          const inner = renderToolResultContent(block.content);
          return [
            `<tool-result tool-use-id="${block.tool_use_id ?? ""}" is-error="${!!block.is_error}">`,
            "",
            inner,
            "",
            "</tool-result>",
          ].join("\n");
        }
        case "image":
          return imagePlaceholder(block);
        case "thinking":
          return [
            "<thinking>",
            "",
            block.thinking ?? "",
            "",
            "</thinking>",
          ].join("\n");
        default:
          return fenceJson(block);
      }
    })
    .join("\n\n");
}

function renderToolResultContent(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b?.type === "image" ? imagePlaceholder(b) : blockText(b) || fenceJson(b)
      )
      .join("\n\n");
  }
  return fenceJson(content);
}

function imagePlaceholder(block: any): string {
  const src = block.source ?? {};
  const bytes = typeof src.data === "string" ? src.data.length : 0;
  return `\`[image: ${src.media_type ?? src.type ?? "unknown"}, ${bytes} base64 chars — full data in .request.txt]\``;
}

export function renderAnthropicResponse(raw: string): string {
  const events = sseData(raw);
  const blocks: Record<
    number,
    { type: string; text: string; name?: string; id?: string }
  > = {};
  let stopReason: string | undefined;
  let usage: any;

  for (const ev of events) {
    switch (ev.type) {
      case "content_block_start":
        blocks[ev.index] = {
          type: ev.content_block?.type ?? "text",
          text: "",
          name: ev.content_block?.name,
          id: ev.content_block?.id,
        };
        break;
      case "content_block_delta":
        if (blocks[ev.index]) {
          const d = ev.delta ?? {};
          blocks[ev.index].text += d.text ?? d.partial_json ?? d.thinking ?? "";
        }
        break;
      case "message_delta":
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.usage) usage = ev.usage;
        break;
      case "message_start":
        if (ev.message?.usage)
          usage = { ...ev.message.usage, ...(usage ?? {}) };
        break;
    }
  }

  const parts: string[] = [];
  if (stopReason) parts.push(`- **stop reason**: ${stopReason}`);
  if (usage) parts.push(`- **usage**: ${JSON.stringify(usage)}`);
  if (parts.length) parts.push("");

  const ordered = Object.keys(blocks)
    .map(Number)
    .sort((a, b) => a - b);
  for (const i of ordered) {
    const b = blocks[i];
    if (b.type === "text") {
      parts.push(
        ["<assistant-text>", "", b.text, "", "</assistant-text>"].join("\n")
      );
    } else if (b.type === "thinking") {
      parts.push(["<thinking>", "", b.text, "", "</thinking>"].join("\n"));
    } else if (b.type === "tool_use") {
      parts.push(
        [
          `<tool-use name="${b.name}" id="${b.id ?? ""}">`,
          "",
          fence(b.text || "{}", "json"),
          "",
          "</tool-use>",
        ].join("\n")
      );
    }
  }
  if (ordered.length === 0 && parts.length === 0) return fence(raw);
  return parts.join("\n\n");
}
