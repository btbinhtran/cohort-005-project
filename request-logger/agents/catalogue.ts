import { CUSTOM_ID, CUSTOM_LABEL, type AgentEntry } from "./types";
import {
  ANTIGRAVITY_KEY_NOTE,
  ANTIGRAVITY_LOGIN_WARNING,
  ANTIGRAVITY_MERGE_NOTE,
  ANTIGRAVITY_NOTE,
  CODEX_OVERRIDE_NOTE,
  JUNIE_MERGE_NOTE,
  JUNIE_NOTE,
  junieConfig,
  OMP_NOTE,
  ompModels,
  OPENCODE_NOTE,
  PI_NOTE,
  piModels,
} from "./setup-files";

/**
 * Ordered by popularity, decided 2026-08-06. The wizard shows them in this
 * order, so a student is most likely to find theirs first.
 */
export const AGENTS: AgentEntry[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    providers: [
      {
        id: "anthropic",
        label: "Anthropic",
        upstreamHost: "api.anthropic.com",
        renderer: "anthropic",
        env: [
          ["ANTHROPIC_BASE_URL", "{baseUrl}"],
          ["ENABLE_TOOL_SEARCH", "true"],
        ],
        bin: "claude",
        // Claude Code's own wire format is Anthropic-shaped regardless of
        // what a custom target claims to speak, so this stays the catch-all
        // for every wire format a custom target might pick — the same
        // "used regardless of the wire format chosen" guarantee this agent
        // had when it was the only provider, back when findCustomTemplate's
        // single-provider branch picked it unconditionally. Now that
        // "vertex" (below) is a second provider, that branch no longer
        // fires, so the guarantee has to be spelled out here instead.
        customTemplateFor: ["anthropic", "openai", "raw"],
        notes: [
          "ENABLE_TOOL_SEARCH=true is important. Claude Code trusts one host only. " +
            "When the base URL points somewhere else, it turns off tool search, stops " +
            "deferring tools, and writes every tool schema into the request. Your " +
            "capture is then larger than a real one and has a different shape. The " +
            "flag turns that effect off, so what you read is what Claude Code really sends.",
          "This works with a Claude subscription login. Your login stays active. " +
            "Only the model traffic moves.",
        ],
      },
      {
        id: "vertex",
        label: "Google Vertex AI",
        // Fixed to the global endpoint on purpose — see the region note below.
        upstreamHost: "aiplatform.googleapis.com",
        // Vertex's Claude endpoint is Anthropic's own Messages API shape,
        // routed by URL path instead of a body field — the model ID moves
        // from the body's "model" key into the URL
        // (.../publishers/anthropic/models/{model}:streamRawPredict), and
        // the body gains "anthropic_version". findModel() in render.ts
        // already falls back to reading the model out of the path when the
        // body has none, and the Anthropic renderer only reads specific
        // known keys, so the existing "anthropic" renderer reads this
        // correctly without a dedicated renderer of its own.
        renderer: "anthropic",
        env: [
          ["ANTHROPIC_VERTEX_BASE_URL", "{baseUrl}"],
          ["ENABLE_TOOL_SEARCH", "true"],
        ],
        bin: "claude",
        notes: [
          "This assumes CLAUDE_CODE_USE_VERTEX=1, CLOUD_ML_REGION and " +
            "ANTHROPIC_VERTEX_PROJECT_ID are already exported in your shell — " +
            "request-logger does not set those, only ANTHROPIC_VERTEX_BASE_URL, " +
            "which is the variable Claude Code actually reads for a base-URL " +
            "override once Vertex mode is on. ANTHROPIC_BASE_URL, used by the " +
            "plain Anthropic route above, is silently ignored in Vertex mode — " +
            "that mismatch is the usual reason a Vertex student's logs folder " +
            "stays empty.",
          "Only CLOUD_ML_REGION=global is supported by this entry. A regional " +
            "value (us-east5, say) talks to a different host " +
            "({region}-aiplatform.googleapis.com), which this entry does not " +
            "resolve to yet — ask for it via the issue tracker if you hit this.",
          "ENABLE_TOOL_SEARCH=true matters here for the same reason it does on " +
            "the plain Anthropic route above: a non-default host turns off tool " +
            "search unless this is set.",
        ],
      },
    ],
  },
  {
    id: "codex",
    label: "Codex",
    providers: [
      {
        id: "chatgpt",
        label: "ChatGPT subscription",
        upstreamHost: "chatgpt.com",
        renderer: "openai",
        // Codex joins the base URL and the word `responses` with one slash, so
        // the base URL must carry the whole prefix that it would otherwise use,
        // which is https://chatgpt.com/backend-api/codex.
        suffix: "/backend-api/codex",
        bin: "codex",
        args: ["-c", `'openai_base_url="{baseUrl}"'`],
        notes: [CODEX_OVERRIDE_NOTE],
      },
      {
        id: "openai",
        label: "OpenAI API key",
        upstreamHost: "api.openai.com",
        renderer: "openai",
        // The API key route defaults to https://api.openai.com/v1, and Codex
        // appends `responses` to it, so the base URL keeps the /v1.
        suffix: "/v1",
        bin: "codex",
        args: ["-c", `'openai_base_url="{baseUrl}"'`],
        // The only usable template for a custom Codex target: Codex only
        // ever speaks the OpenAI-compatible wire format, so it is the
        // catch-all for every choice, including "anthropic" — a mismatch
        // there is Codex's limitation, not a bug in this tool.
        customTemplateFor: ["openai", "raw", "anthropic"],
        notes: [CODEX_OVERRIDE_NOTE],
      },
    ],
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    providers: [
      {
        id: "github",
        label: "GitHub subscription",
        upstreamHost: "api.githubcopilot.com",
        renderer: "openai",
        env: [["COPILOT_API_URL", "{baseUrl}"]],
        bin: "copilot",
        notes: [
          "Copilot's built-in MCP servers add their tools to every request, and " +
            "they make calls of their own, so you get more documents than turns " +
            "you typed. That is what your agent really sends, so it is worth " +
            "reading once. If you want a smaller capture, add " +
            "--disable-builtin-mcps to the command.",
        ],
        warnings: [
          "Some models negotiate a WebSocket transport. This tool cannot see a " +
            "WebSocket, so those turns write no log at all. If your logs folder " +
            "stays empty, try a different model. gpt-5.1 used plain HTTP in testing.",
        ],
      },
    ],
  },
  {
    id: "cursor",
    label: "Cursor CLI",
    reason:
      "Cursor builds its system prompt on its own servers. The request that " +
      "leaves your machine holds your message and very little else, so there is " +
      "no system prompt and no tool list for this tool to show you. No proxy can " +
      "read what your machine never sends. Search the whole shipped Cursor " +
      "bundle and you will find no system prompt text and no tool schemas.",
  },
  {
    id: "opencode",
    label: "OpenCode",
    providers: [
      {
        id: "anthropic",
        label: "Anthropic",
        upstreamHost: "api.anthropic.com",
        renderer: "anthropic",
        suffix: "/v1",
        env: [["ANTHROPIC_BASE_URL", "{baseUrl}"]],
        bin: "opencode",
        customTemplateFor: ["anthropic"],
        setup: [
          {
            path: "~/.config/opencode/opencode.json",
            language: "json",
            body: [
              "{",
              '  "$schema": "https://opencode.ai/config.json",',
              '  "model": "anthropic/claude-sonnet-4-5",',
              '  "small_model": "anthropic/claude-sonnet-4-5",',
              '  "provider": {',
              '    "anthropic": {',
              '      "options": {',
              '        "apiKey": "{env:ANTHROPIC_API_KEY}",',
              '        "baseURL": "{baseUrl}"',
              "      }",
              "    }",
              "  }",
              "}",
            ].join("\n"),
          },
        ],
        notes: [
          OPENCODE_NOTE,
          "OpenCode never counts tokens. Instead it makes a second call with its " +
            "small model to title the thread, so one turn writes exactly two captures.",
        ],
      },
      {
        id: "openai",
        label: "OpenAI API key",
        upstreamHost: "api.openai.com",
        renderer: "openai",
        suffix: "/v1",
        env: [["OPENAI_BASE_URL", "{baseUrl}"]],
        bin: "opencode",
        // Also the catch-all for "raw"/not sure: a third-party server behind
        // a custom base URL is far more often OpenAI-compatible than
        // Anthropic-compatible, so this is the better default guess.
        customTemplateFor: ["openai", "raw"],
        setup: [
          {
            path: "~/.config/opencode/opencode.json",
            language: "json",
            body: [
              "{",
              '  "$schema": "https://opencode.ai/config.json",',
              '  "model": "openai/gpt-5.1",',
              '  "small_model": "openai/gpt-5.1",',
              '  "provider": {',
              '    "openai": {',
              '      "options": {',
              '        "apiKey": "{env:OPENAI_API_KEY}",',
              '        "baseURL": "{baseUrl}"',
              "      }",
              "    }",
              "  }",
              "}",
            ].join("\n"),
          },
        ],
        notes: [
          OPENCODE_NOTE,
          "OpenCode uses a different system prompt for each provider. Run it once " +
            "against Anthropic and once against OpenAI and compare the two captures.",
        ],
        warnings: [
          "A ChatGPT login will not work here. OpenCode sends that traffic to a " +
            "different host on purpose, so it goes around this tool. Use an " +
            "OpenAI API key.",
        ],
      },
    ],
  },
  {
    id: "pi",
    label: "Pi",
    providers: [
      {
        id: "anthropic",
        label: "Anthropic",
        upstreamHost: "api.anthropic.com",
        renderer: "anthropic",
        bin: "pi",
        customTemplateFor: ["anthropic"],
        setup: [piModels("anthropic", "{baseUrl}")],
        notes: [
          PI_NOTE,
          "This route works with an Anthropic API key and with a Claude " +
            "subscription login.",
          "Pi never counts tokens, so every file in your logs folder is a real turn.",
        ],
      },
      {
        id: "openai",
        label: "OpenAI API key",
        upstreamHost: "api.openai.com",
        renderer: "openai",
        // Pi hands this to the OpenAI SDK, which appends `/responses`.
        suffix: "/v1",
        bin: "pi",
        // Also the catch-all for "raw"/not sure — see the OpenCode entry
        // above for why an OpenAI-compatible guess is the better default.
        customTemplateFor: ["openai", "raw"],
        setup: [piModels("openai", "{baseUrl}")],
        notes: [PI_NOTE],
      },
      {
        id: "codex",
        label: "ChatGPT subscription (Codex)",
        upstreamHost: "chatgpt.com",
        renderer: "openai",
        // Pi appends `/codex/responses` itself, and the real endpoint lives
        // under `/backend-api`. Without this suffix the forwarded path would be
        // missing that segment and the request would fail.
        suffix: "/backend-api",
        bin: "pi",
        setup: [
          piModels("openai-codex", "{baseUrl}"),
          {
            path: "~/.pi/agent/settings.json",
            language: "json",
            body: ["{", '  "transport": "sse"', "}"].join("\n"),
          },
        ],
        notes: [
          PI_NOTE,
          "The SSE transport is not optional on this route. Pi's default tries " +
            "a WebSocket first, and this tool cannot see a WebSocket. The " +
            "setting goes in the settings file, not in the models file. Pi " +
            "accepts it in the models file and then quietly ignores it.",
          "Pi compresses the request body on this route. The readable .md file " +
            "shows the decoded body. The .request.txt file keeps the compressed " +
            "bytes exactly as sent, so you can still replay it.",
        ],
      },
    ],
  },
  {
    id: "omp",
    label: "OMP (Oh My Pi)",
    // Every setup for OMP goes through the custom-base-url questions — see
    // AgentEntry.alwaysCustom. The one provider below never reaches the
    // wizard; it exists purely to hold the bin and setup-file template that
    // resolveCustomTarget borrows from, the same way findCustomTemplate
    // borrows from a real provider for every other agent.
    alwaysCustom: true,
    providers: [
      {
        id: CUSTOM_ID,
        label: CUSTOM_LABEL,
        // Unused: OMP never reaches the normal (non-custom) resolution path
        // that would read this.
        upstreamHost: "",
        // Irrelevant here too — the resolved renderer always comes from the
        // student's answer, not from this template. See resolveCustomTarget.
        renderer: "raw",
        bin: "omp",
        setup: [ompModels("{baseUrl}")],
        notes: [OMP_NOTE],
      },
    ],
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    providers: [
      {
        id: "google-login",
        label: "Free Google account login",
        upstreamHost: "cloudcode-pa.googleapis.com",
        renderer: "gemini",
        env: [["CODE_ASSIST_ENDPOINT", "{baseUrl}"]],
        bin: "gemini",
        notes: [
          "This is the free tier. You do not need to buy anything to finish the lesson.",
          "On this route Gemini also makes several housekeeping calls that carry no " +
            "prompt. This tool forwards them but does not log them, so your logs " +
            "folder holds real turns only.",
        ],
      },
      {
        id: "api-key",
        label: "Gemini API key",
        upstreamHost: "generativelanguage.googleapis.com",
        renderer: "gemini",
        env: [["GOOGLE_GEMINI_BASE_URL", "{baseUrl}"]],
        bin: "gemini",
        // The only usable template for a custom Gemini CLI target: the
        // Google-login route is tied to that login and would misconfigure an
        // unrelated server. Gemini CLI's own wire format does not actually
        // match any of the custom choices, so this is a best-effort catch-all
        // for all three — a mismatch shows up as a renderer warning, not a
        // silent one.
        customTemplateFor: ["openai", "anthropic", "raw"],
        warnings: [
          "The two Gemini routes use different variables and they are not " +
            "interchangeable. GOOGLE_GEMINI_BASE_URL is ignored under a Google " +
            "account login, and CODE_ASSIST_ENDPOINT is ignored under an API key. " +
            "Neither one gives you an error. You just get an empty logs folder.",
        ],
      },
    ],
  },
  {
    id: "antigravity",
    label: "Antigravity CLI",
    providers: [
      {
        id: "api-key",
        label: "Gemini API key",
        upstreamHost: "generativelanguage.googleapis.com",
        renderer: "gemini",
        env: [["GOOGLE_GEMINI_BASE_URL", "{baseUrl}"]],
        bin: "agy",
        setup: [
          {
            path: "~/.gemini/antigravity-cli/settings.json",
            language: "json",
            body: ["{", '  "modelProvider": "gemini"', "}"].join("\n"),
          },
        ],
        notes: [ANTIGRAVITY_NOTE, ANTIGRAVITY_KEY_NOTE, ANTIGRAVITY_MERGE_NOTE],
        warnings: [ANTIGRAVITY_LOGIN_WARNING],
      },
    ],
  },
  {
    id: "junie",
    label: "Junie",
    // Junie is BYOK across several backends (OpenAI, Anthropic, Google, xAI,
    // OpenRouter, Copilot, a LiteLLM proxy) with no single fixed host of its
    // own — the same shape as OMP — so every setup for it is custom too. See
    // AgentEntry.alwaysCustom.
    //
    // Junie CLI is closed source, so unlike every other entry in this
    // catalogue this one is verified against JetBrains' published docs only,
    // not against real source or a real install. Testing status is recorded
    // in the README's "How much this was tested" section, the same way every
    // other agent's is; it is not printed to the student, the same way no
    // other agent's is either.
    alwaysCustom: true,
    providers: [
      {
        id: "anthropic",
        label: "Anthropic-compatible",
        // Unused: Junie never reaches the normal (non-custom) resolution
        // path that would read this. See resolveCustomTarget.
        upstreamHost: "",
        renderer: "raw",
        bin: "junie",
        customTemplateFor: ["anthropic"],
        setup: [
          junieConfig(
            "{baseUrl}",
            "Anthropic",
            "x-api-key: YOUR_ANTHROPIC_API_KEY"
          ),
        ],
        notes: [JUNIE_NOTE, JUNIE_MERGE_NOTE],
      },
      {
        id: "openai",
        label: "OpenAI-compatible",
        // Unused, same as the Anthropic-compatible entry above: Junie never
        // reaches the normal (non-custom) resolution path that would read
        // this. See resolveCustomTarget.
        upstreamHost: "",
        renderer: "raw",
        bin: "junie",
        // Also the catch-all for "raw"/not sure — see the OpenCode and Pi
        // entries above for why an OpenAI-compatible guess is the better
        // default for an unidentified custom server.
        customTemplateFor: ["openai", "raw"],
        setup: [
          junieConfig(
            "{baseUrl}",
            "OpenAI",
            "Authorization: Bearer YOUR_OPENAI_API_KEY"
          ),
        ],
        notes: [JUNIE_NOTE, JUNIE_MERGE_NOTE],
      },
    ],
  },
  {
    id: "amp",
    label: "Amp",
    reason:
      "Amp builds its system prompt on its own servers, the same as Cursor. " +
      "Amp does have a URL setting, but it points at Amp's own server, not at " +
      "the model endpoint, so it cannot help you here.",
  },
];
