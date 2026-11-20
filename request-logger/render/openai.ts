import {
  blockText,
  fence,
  fenceJson,
  renderMessages,
  renderParams,
  sseData,
} from "./shared";

// ---- OpenAI -----------------------------------------------------------------

export function renderOpenAIRequest(j: any): string {
  const parts: string[] = [];

  const params = renderParams(j, [
    "max_tokens",
    "max_output_tokens",
    "temperature",
    "top_p",
    "stream",
    "stop",
    "tool_choice",
    "reasoning",
    "metadata",
  ]);
  if (params) parts.push(params);

  // /responses uses `instructions` as the system prompt.
  if (typeof j.instructions === "string" && j.instructions.length > 0) {
    parts.push(
      ["<system-prompt>", "", j.instructions, "", "</system-prompt>"].join("\n")
    );
  }

  if (Array.isArray(j.tools) && j.tools.length > 0) {
    parts.push(renderOpenAITools(j.tools));
  }

  // /chat/completions => messages ; /responses => input (string or items)
  if (Array.isArray(j.messages)) {
    parts.push(renderMessages(j.messages, renderOpenAIChatContent));
  } else if (typeof j.input === "string") {
    parts.push(
      [
        "<messages>",
        "",
        '<message role="user">',
        "",
        j.input,
        "",
        "</message>",
        "",
        "</messages>",
      ].join("\n")
    );
  } else if (Array.isArray(j.input)) {
    parts.push(renderMessages(j.input, renderOpenAIResponsesContent));
  }

  return parts.join("\n\n");
}

function renderOpenAITools(tools: any[]): string {
  const rendered = tools.map((tool) => {
    // chat: { type: "function", function: { name, description, parameters } }
    // responses: { type: "function", name, description, parameters }
    const fn = tool.function ?? tool;
    const lines = [`### ${fn.name ?? tool.type ?? "(unnamed tool)"}`, ""];
    if (fn.description) lines.push(fn.description, "");
    if (fn.parameters) lines.push(fenceJson(fn.parameters));
    return lines.join("\n");
  });
  return ["<tools>", "", rendered.join("\n\n"), "", "</tools>"].join("\n");
}

function renderOpenAIChatContent(message: any): string {
  // In chat/completions each element IS the message {role, content, tool_calls}.
  const out: string[] = [];
  const content = message.content;
  if (typeof content === "string") {
    out.push(content);
  } else if (Array.isArray(content)) {
    out.push(
      content
        .map((b) =>
          b?.type === "image_url"
            ? "`[image_url]`"
            : blockText(b) || fenceJson(b)
        )
        .join("\n\n")
    );
  }
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      const fn = call.function ?? {};
      out.push(
        [
          `<tool-use name="${fn.name}" id="${call.id ?? ""}">`,
          "",
          fence(fn.arguments ?? "", "json"),
          "",
          "</tool-use>",
        ].join("\n")
      );
    }
  }
  if (message.role === "tool") {
    out.push(
      [
        `<tool-result tool-call-id="${message.tool_call_id ?? ""}">`,
        "",
        typeof content === "string" ? content : fenceJson(content),
        "",
        "</tool-result>",
      ].join("\n")
    );
  }
  return out.join("\n\n");
}

function renderOpenAIResponsesContent(item: any): string {
  // /responses input items: message, function_call, function_call_output, ...
  switch (item?.type) {
    case "message":
    case undefined: {
      const content = item.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((b) => blockText(b) || fenceJson(b)).join("\n\n");
      }
      return fenceJson(item);
    }
    case "function_call":
      return [
        `<tool-use name="${item.name}" id="${item.call_id ?? item.id ?? ""}">`,
        "",
        fence(item.arguments ?? "", "json"),
        "",
        "</tool-use>",
      ].join("\n");
    case "function_call_output":
      return [
        `<tool-result call-id="${item.call_id ?? ""}">`,
        "",
        typeof item.output === "string" ? item.output : fenceJson(item.output),
        "",
        "</tool-result>",
      ].join("\n");
    default:
      return fenceJson(item);
  }
}

export function renderOpenAIResponse(raw: string): string {
  const events = sseData(raw);
  const isResponses = events.some(
    (event) =>
      typeof event.type === "string" && event.type.startsWith("response.")
  );

  if (isResponses) return renderOpenAIResponsesStream(events);
  return renderOpenAIChatStream(events);
}

function renderOpenAIChatStream(events: any[]): string {
  let text = "";
  const toolCalls: Record<number, { name: string; args: string; id?: string }> =
    {};
  let finish: string | undefined;
  let usage: any;

  for (const ev of events) {
    const choice = ev.choices?.[0];
    const delta = choice?.delta ?? {};
    if (typeof delta.content === "string") text += delta.content;
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        toolCalls[idx] ??= { name: "", args: "", id: tc.id };
        if (tc.id) toolCalls[idx].id = tc.id;
        if (tc.function?.name) toolCalls[idx].name += tc.function.name;
        if (tc.function?.arguments)
          toolCalls[idx].args += tc.function.arguments;
      }
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
    if (ev.usage) usage = ev.usage;
  }

  const parts: string[] = [];
  if (finish) parts.push(`- **finish reason**: ${finish}`);
  if (usage) parts.push(`- **usage**: ${JSON.stringify(usage)}`);
  if (parts.length) parts.push("");
  if (text)
    parts.push(
      ["<assistant-text>", "", text, "", "</assistant-text>"].join("\n")
    );
  for (const idx of Object.keys(toolCalls)
    .map(Number)
    .sort((a, b) => a - b)) {
    const tc = toolCalls[idx];
    parts.push(
      [
        `<tool-use name="${tc.name}" id="${tc.id ?? ""}">`,
        "",
        fence(tc.args || "{}", "json"),
        "",
        "</tool-use>",
      ].join("\n")
    );
  }
  return parts.length ? parts.join("\n\n") : "_(no content decoded)_";
}

function renderOpenAIResponsesStream(events: any[]): string {
  let text = "";
  const toolCalls: Record<string, { name: string; args: string }> = {};
  let usage: any;
  let status: string | undefined;

  for (const ev of events) {
    switch (ev.type) {
      case "response.output_text.delta":
        text += ev.delta ?? "";
        break;
      case "response.function_call_arguments.delta": {
        const key = ev.item_id ?? "0";
        toolCalls[key] ??= { name: "", args: "" };
        toolCalls[key].args += ev.delta ?? "";
        break;
      }
      case "response.output_item.added":
        if (ev.item?.type === "function_call") {
          const key = ev.item.id ?? "0";
          toolCalls[key] ??= { name: "", args: "" };
          toolCalls[key].name = ev.item.name ?? toolCalls[key].name;
        }
        break;
      case "response.completed":
        status = ev.response?.status;
        usage = ev.response?.usage ?? usage;
        break;
    }
  }

  const parts: string[] = [];
  if (status) parts.push(`- **status**: ${status}`);
  if (usage) parts.push(`- **usage**: ${JSON.stringify(usage)}`);
  if (parts.length) parts.push("");
  if (text)
    parts.push(
      ["<assistant-text>", "", text, "", "</assistant-text>"].join("\n")
    );
  for (const key of Object.keys(toolCalls)) {
    const tc = toolCalls[key];
    parts.push(
      [
        `<tool-use name="${tc.name}" id="${key}">`,
        "",
        fence(tc.args || "{}", "json"),
        "",
        "</tool-use>",
      ].join("\n")
    );
  }
  return parts.length ? parts.join("\n\n") : "_(no content decoded)_";
}
