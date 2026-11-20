import { renderAnthropicContent } from "./anthropic";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function fenceJson(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

export function fence(text: string, lang = ""): string {
  return "```" + lang + "\n" + text + "\n```";
}

/** Collapse a content field that may be a string or an array of text-ish blocks
 * down to plain text, preserving everything (only image base64 is placeheld). */
export function blockText(block: any): string {
  if (typeof block === "string") return block;
  if (block?.type === "text" && typeof block.text === "string")
    return block.text;
  if (block?.type === "input_text" && typeof block.text === "string")
    return block.text;
  if (block?.type === "output_text" && typeof block.text === "string")
    return block.text;
  return "";
}

export function renderParams(reqJson: any, keys: string[]): string {
  const present = keys
    .filter((k) => reqJson[k] !== undefined)
    .map((k) => {
      const v = reqJson[k];
      const shown = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `- **${k}**: ${shown}`;
    });
  if (present.length === 0) return "";
  return ["<params>", "", ...present, "", "</params>"].join("\n");
}

// ---- shared message list ----------------------------------------------------

export function renderMessages(
  messages: any[],
  renderContent: (message: any) => string
): string {
  if (!Array.isArray(messages)) return "<messages></messages>";
  const rendered = messages.map((message, i) => {
    const role = message.role ?? message.type ?? "unknown";
    // Anthropic: content lives on msg.content ; renderContent handles the shape.
    const inner =
      renderContent === renderAnthropicContent
        ? renderAnthropicContent(message.content)
        : renderContent(message);
    return [
      `<message index="${i + 1}" role="${role}">`,
      "",
      inner,
      "",
      "</message>",
    ].join("\n");
  });
  return ["<messages>", "", rendered.join("\n\n"), "", "</messages>"].join(
    "\n"
  );
}

/** Pull the JSON payloads out of `data: {...}` SSE lines. */
export function sseData(raw: string): any[] {
  const out: any[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^data:\s?(.*)$/);
    if (!m) continue;
    const payload = m[1];
    if (payload === "[DONE]" || payload.trim() === "") continue;
    try {
      out.push(JSON.parse(payload));
    } catch {
      // skip un-parseable data lines
    }
  }
  return out;
}
