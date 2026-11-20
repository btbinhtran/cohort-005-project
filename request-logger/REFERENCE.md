# request-logger reference

The deep reference for the request-logger. Start with the
[README](./README.md), which covers how to run it and what you get.

## Per-agent notes

### Claude Code on Google Vertex AI

If your Claude Code already talks to Vertex AI (`CLAUDE_CODE_USE_VERTEX=1` is
set), pick **Google Vertex AI** at the provider question instead of
**Anthropic**. Vertex mode reads a different variable for a base-URL
override — `ANTHROPIC_VERTEX_BASE_URL`, not `ANTHROPIC_BASE_URL` — because
`ANTHROPIC_BASE_URL` belongs to the direct-API code path and is silently
ignored once Vertex mode is on. Picking **Anthropic** here while
`CLAUDE_CODE_USE_VERTEX=1` is set is the most common way a Vertex student's
logs folder stays empty with no error at all.

This route only covers `CLOUD_ML_REGION=global`, the default and most common
setting. A regional value (`us-east5`, say) talks to a different host and
is not wired up yet — ask for it via the issue tracker if you hit this.

### Antigravity CLI

Antigravity CLI (`agy`) is a separate Google product from Gemini CLI — a
different binary, a different agent harness — not a rebrand of it. Its API-key
route, though, stores its settings under Gemini CLI's own directory
(`~/.gemini/antigravity-cli/settings.json`) and calls the public Gemini API
directly, reading the exact same `GOOGLE_GEMINI_BASE_URL` variable Gemini
CLI's own API-key route reads. That means the existing `gemini` renderer
already reads this capture correctly — no new wire format was needed, only a
catalogue entry.

Two things must both be true before Antigravity CLI takes this route at all,
rather than falling back to its own account sign-in:

- `modelProvider` is `"gemini"` in the settings file the wizard writes for you, and
- `GEMINI_API_KEY` is exported in your shell — this tool does not set it, the
  same way it does not set `ANTHROPIC_API_KEY` for Claude Code's own API-key
  route.

Only this API-key route is covered. Antigravity CLI's default account
sign-in was not verified — Antigravity CLI is closed source, and public
reporting on the related Antigravity IDE suggests its account-login traffic
can go to a different, internal host rather than the Code Assist host Gemini
CLI's own free login uses. Ask for it via the issue tracker if you need it
logged.

### Junie

Junie is BYOK across several backends, with no fixed host of its own — the
same shape as OMP — so it goes through the base URL and wire format
questions like a custom target does, picking a real Anthropic-compatible or
OpenAI-compatible template depending which you choose. It writes a proxy
entry to `~/.junie/config.json` (user scope; a project-scope file at
`<project-root>/.junie/config.json` takes precedence if you have one — see
Junie's own docs), merged in alongside whatever else is already there.

Junie is the one agent here with no existing login for this tool to pass
through. Its custom-proxy mechanism bypasses JetBrains AI authentication
entirely, so the printed config carries a placeholder header line and you
paste in a real API key yourself — an Anthropic key on the
Anthropic-compatible route, an OpenAI key on the OpenAI-compatible one.
Treat that file the way you would any other file holding a real key: do not
commit it.

### Why Cursor and Amp cannot work

This is the most interesting thing in the whole lesson, so it is worth saying
clearly.

Some vendors build the system prompt **on your machine** and send it to the
model. You can read that, because it goes past your network card.

Some vendors build the system prompt **on their servers**. Your machine sends
your message and very little else. The prompt and the tool list are added after
your request arrives at their server.

Cursor and Amp are the second kind. Search the whole shipped Cursor bundle and
you will find no system prompt text and no tool schemas at all. No proxy can
read what your machine never sends. This is not a limit of this tool. It is a
property of the product.

If you use Cursor or Amp, install one of the other agents to follow the lesson.

## The Observer Effect

Watching a thing can change the thing.

Claude Code trusts exactly one host. When you point it somewhere else, it turns
off tool search. That means it stops deferring tools and writes every tool
schema into the request instead. Your capture is then bigger than a real one and
has a different shape. That is the opposite of what you want from a tool whose
whole job is to show you the truth.

The command this tool prints for you sets `ENABLE_TOOL_SEARCH=true`, which turns
the effect off.

Measured through this tool with the same prompt:

| Run                            | Capture size |
| ------------------------------ | ------------ |
| Base URL only                  | 63,596 bytes |
| With `ENABLE_TOOL_SEARCH=true` | 39,013 bytes |

That is 39% smaller, and the tool-search tool appears only in the second
capture.

## How it works

- One process, one port, **one upstream host**. Your choice decides where
  requests go and how they are read. The tool does not guess from the URL,
  because several agents share the same URLs and guessing gets them wrong.
- Your real auth header passes through untouched, so your requests authenticate
  normally. The tool only reads a copy on the way past.
- Responses are **streamed straight back** as they arrive, so your agent behaves
  exactly as it would without the tool.

### One message is not one request

A single message you send is often **not** a single API request. A typical
Claude Code turn fans out into:

- **one** real generation call, which is the only one that produces a reply, and
  the one whose request holds the full system prompt and tools; and
- **many** token-counting calls, which are housekeeping. They measure sizes for
  the context bar, for caching and for compaction, and they return a number
  rather than model output.

Housekeeping calls carry no model output, so the tool **forwards them but does
not log them**. Your logs folder therefore holds real turns only. You still see a
`(housekeeping, not logged)` line in the console when they happen, so the fan-out
stays visible.

Different agents fan out differently, and that is worth watching:

- **OpenCode** never counts tokens. Instead it makes a second call with a small
  model to title the thread, so one turn writes exactly two captures.
- **Pi** never counts tokens at all, so every file is a real turn.
- **Gemini** on the free Google login makes several extra calls that carry no
  prompt. Those are not logged either.

### If your logs folder fills up in seconds

Some agents retry a failing call immediately and with no backoff. If the
call keeps failing the same way — a wrong base URL scheme, a bad model ID,
bad credentials — that turns into a tight loop of real requests, each one a
genuine POST the tool would otherwise write a full capture for. Left
unchecked, that is thousands of near-identical files in a few seconds.

Once the same method, path and status code repeats more than 20 times inside
2 seconds, this tool stops writing a capture for every repeat. It still
forwards every one of them untouched, so your agent is not affected; it just
stops filling your disk and your terminal with duplicates. You get one loud
warning naming the call and the likely causes, then a single summary line
every 500 repeats for as long as the loop continues.

The fix is always upstream of this tool: stop the agent, fix the base URL,
model ID or credentials, and start again. `omp` hitting `http://` instead of
`https://` on a provider's real API is the case this was built for — the
plaintext request gets rejected in milliseconds with no retry guidance in the
response, and some agents read that as "retry", not "give up."

## How much this was tested

Be fair to the tool when you judge a failure.

- **Claude Code on the direct Anthropic API, and OMP, are tested end to end.**
  The measurements above are real, and OMP is run daily by the person who
  built this tool.
- **The others were verified** by reading the published code of each agent and
  by driving them against a local listener. They were not each run through a
  full course of the lesson. Claude Code on Google Vertex AI is in this
  group — verified against Anthropic's own Vertex documentation, not yet
  driven against a real Vertex project.
- **Junie is the least-verified entry in the catalogue.** Junie CLI is
  closed source, so unlike every other agent here its entry was not checked
  against real source, only against JetBrains' published Junie CLI docs
  (`config.json`, custom proxies, and CLI reference). It has not been driven
  against a real Junie install. If the proxy `kind`, the config file's
  precise shape, or the header format is wrong, that is the likely reason,
  and the fix is one line in `agents/catalogue.ts`.
- **Antigravity CLI is verified against published docs only, the same way
  Junie is.** Antigravity CLI is also closed source. Its API-key route was
  checked against Google's own Antigravity CLI documentation (installation,
  authentication and the `GOOGLE_GEMINI_BASE_URL` variable), not against real
  source or a real install, and its account sign-in route was not verified
  at all — see "Antigravity CLI" above for why that route is left out.
- **A custom base URL is only as tested as the agent it is attached to.** The
  base URL and wire format mechanism itself is tested directly (see
  `agents/tests/`); a specific third-party server behind it has not
  necessarily been driven end to end.
- **Windows is not tested end to end either.** WSL and Git Bash need no
  special handling — they are POSIX shells, so they use the same command as
  Mac and Linux. Native PowerShell gets its own `$env:NAME = 'value'` syntax
  instead (see `withEnv` in `agents/shell.ts`), verified by unit test but not by
  running a real agent against it on Windows. Command Prompt (`cmd.exe`) is
  not supported; use PowerShell, which is the default terminal in Windows
  Terminal and VS Code.

If one of them is wrong, it is worth reporting, and the fix is likely to be one
line in `agents/catalogue.ts`.

## Extending it

- **Add an agent:** add one entry to the catalogue in `agents/catalogue.ts`, giving its
  upstream host, its renderer, its base URL suffix, and its command. That is the
  whole job. The wizard, the banner and the routing all read from there, so
  nothing else needs to change.
- **Add an agent with no fixed upstream at all**, the way OMP has none: give it
  no upstream host, set `alwaysCustom: true`, and give its one provider entry a
  bin and a setup file. The wizard then skips the provider question for it
  entirely and asks the two custom-base-url questions directly. See the OMP
  entry in `agents/catalogue.ts` for the whole shape.
- **Add a wire format:** add a renderer in `render/` and name it on the
  catalogue entry. Unknown shapes already fall back to pretty-printed JSON, so
  you can iterate safely.
- **Watch the base URL suffix.** It is per-agent on purpose and never a global
  rule. Some agents append the whole path to what you give them and so must not
  have a `/v1`. Some append only the last part and so must have one. Getting it
  wrong produces a 404 that is hard to read. There is a test for each one.
- **Nothing to do for a student on an unlisted provider.** "Custom base URL" at
  the provider question already covers that — see the [README](./README.md#run-it). It
  is not a per-agent thing to add; every supported agent gets it for free.
