# request-logger

A small proxy with no dependencies. It sits between your coding agent and the
model provider's API, and writes a **readable Markdown document for every
request**: the real system prompt, the tool definitions, and the messages your
agent sends to the model.

It was built for the AI Coding Crash Course so that you can _see_ what actually
goes over the wire.

## Run it

```bash
npm run request-logger
```

The first time you run it, it asks which agent you use, then which model
provider you use with it. (OMP is the one exception: it has no fixed provider
of its own, so it skips straight to the base URL question below.) Last, it
asks whether to remember your answer. Say no if you swap agents often, and it
asks again every time. It then prints the exact command for your setup, and
starts listening.

It keeps listening until you stop it. Press **Ctrl+C** to stop it. The console
says so too.

Both questions end with **Other, or not sure**. Pick it if your setup is not in
the list, and the tool gives you a link to ask for it.

The provider question has a second way out, too: **Custom base URL**. Pick it
if your provider is not in the list but you know its base URL — a local model
server such as Ollama, or a smaller hosted provider such as DeepSeek, say. It
asks two questions instead of showing you a dead end:

- the base URL of the model server you want to log, for example
  `http://localhost:11434` for Ollama, or `https://api.deepseek.com` for
  DeepSeek; and
- which wire format it speaks — OpenAI-compatible, Anthropic-compatible, or
  "not sure", if you do not know.

If you are not sure, pick "not sure". The tool still logs everything; it just
shows you the raw JSON instead of a fully readable render, because it cannot
safely guess a shape you did not tell it. See "What you get" below.

For **OpenCode** with an **OpenAI-compatible** custom target, and for **every**
**Pi** custom target, the wizard also tries the unauthenticated `/v1/models`
endpoint and offers any model IDs it finds. You can always enter an ID
manually, and the wizard falls back to manual entry if discovery fails.
Endpoints that require credentials for model listing are not supported.

- OpenCode's printed command uses a temporary `OPENCODE_CONFIG_CONTENT`
  provider for that one run, merged with your existing OpenCode configuration
  without editing its file.
- Pi has no such temporary option, so the selected model is written into
  `~/.pi/agent/models.json` alongside the base URL, replacing that provider's
  built-in model list with the one you chose. Without this, Pi would keep
  offering its built-in model names (`gpt-4o`, and the like), which almost
  never exist on a custom server — the agent would start but every turn would
  fail.
- Pi asks for a model on every wire format, including Anthropic-compatible —
  but discovery itself only ever checks the OpenAI-style `/v1/models` listing
  endpoint, which an Anthropic-compatible server often does not expose. If
  discovery finds nothing there, that is expected, and typing the model ID by
  hand is the normal path, not a sign something is broken.

To change a remembered answer:

```bash
npm run request-logger -- --force
```

This forgets the old answer first, then keeps the new one in its place. It does
not ask whether to remember, because you already said yes once. If you pick an
agent that cannot be logged, nothing is kept, and the old answer is gone too.

To use a different port:

```bash
PORT=9000 npm run request-logger
```

On Windows, run that in PowerShell (not Command Prompt) as:

```powershell
$env:PORT = 9000; npm run request-logger
```

A remembered answer is kept in `request-logger/.agent-choice.json`, which is
gitignored. It holds your choice only. The host, the renderer and the command are
worked out again on every start, so an update to this tool reaches you without
you having to clear anything.

The one exception is a **Custom base URL** answer. There is no catalogue entry
for it to be worked out from — you typed it — so the base URL and the wire
format you chose are saved in the file too, alongside your choice. OpenCode's
OpenAI-compatible custom route, and every Pi custom route, also save the
selected model ID, so a remembered choice starts without repeating discovery.
Everything else about a custom answer still behaves the same way: change it
any time with `--force`, and it is never kept for an agent that cannot be
logged.

## The agents

The tool prints the correct command for you, so you do not have to copy anything
from this table. It is here so you can see what is supported before you start.

| Agent           | Works | What you need                                                                                  |
| --------------- | ----- | ---------------------------------------------------------------------------------------------- |
| Claude Code     | Yes   | One command. Works with a subscription login, an Anthropic API key, or Google Vertex AI.       |
| Codex           | Yes   | One flag. A subscription or an API key works.                                                  |
| GitHub Copilot  | Yes   | Your normal subscription login.                                                                |
| OpenCode        | Yes   | One command, or a config file.                                                                 |
| Pi              | Yes   | A config file. Pi has no base URL variable.                                                    |
| OMP             | Yes   | A YAML config file. Point it at any backend.                                                   |
| Gemini CLI      | Yes   | One command. The free Google login works.                                                      |
| Antigravity CLI | Yes   | A config file and a real Gemini API key — see [the reference](./REFERENCE.md#antigravity-cli). |
| Junie           | Yes   | A config file, and a real API key pasted in — see [the reference](./REFERENCE.md#junie).       |
| Cursor CLI      | No    | Nothing can make it work. See [the reference](./REFERENCE.md#why-cursor-and-amp-cannot-work).  |
| Amp             | No    | Nothing can make it work. See [the reference](./REFERENCE.md#why-cursor-and-amp-cannot-work).  |

Any other provider — a local model server, or a smaller hosted one — works
through **Custom base URL**, above, on any agent in this table except Cursor
and Amp.

## What you get

Every request writes three files to `request-logger/logs/`, which is gitignored.
They share a base name such as `2026-07-07T14-32-05-123_claude-code`:

| File            | Contents                                 |
| --------------- | ---------------------------------------- |
| `.md`           | The readable render. Start here.         |
| `.request.txt`  | The request body exactly as it was sent. |
| `.response.txt` | The raw response stream.                 |

The `.md` file uses **XML tags** (`<request>`, `<system-prompt>`, `<tools>`,
`<messages>`, `<response>`) to mark its sections, because the captured content is
full of its own Markdown headings. It is complete and not truncated, so it is a
trustworthy readout of what the model received.

If you picked "not sure" for a custom base URL's wire format, the `.md` file
holds pretty-printed JSON instead of that fully tagged render — there is no
system prompt or tool section, because the tool was not told the shape needed
to find them. Nothing is lost: it is still the whole request and response, just
less readable. Run with `--force` and pick the real wire format once you know
it, and the tagged render takes over from the next request.

Secret headers (`authorization`, `x-api-key`, `api-key`) are hidden in the `.md`
file and are never written to the `.txt` files.

Some agents compress the request body. The `.md` file shows the decoded body so
that you can read it. The `.request.txt` file keeps the bytes exactly as they
were sent, so you can still replay it.

## If your logs folder stays empty

The failure modes here are quiet ones. An empty folder looks the same whichever
of these happened:

1. **You changed agent and forgot to say so.** Run
   `npm run request-logger -- --force`. The line at the top of the console names
   the agent the tool currently thinks you use.
2. **Your agent chose a WebSocket.** This tool reads HTTP. Some Copilot models,
   and Pi's default transport, negotiate a WebSocket instead, and a WebSocket
   turn writes no log at all. The printed command sets the right transport where
   it can.
3. **You are signed in a way that goes around the tool.** A ChatGPT sign-in on
   OpenCode talks to a different host on purpose. Use an API key for that one.
   Codex is different: pick the ChatGPT route in the wizard and it works.
4. **You started your agent before setting the variable.** Agents read the
   variable once, at startup.
5. **You are on an older Codex, or following an older guide.** Codex used to
   read an OPENAI_BASE_URL variable. Version 0.133.0 does not. It ignores the
   variable in silence, so the only sign is an empty logs folder. Use the
   command this tool prints.

## Reference

The rest of the detail lives in [REFERENCE.md](./REFERENCE.md):

- [Per-agent notes](./REFERENCE.md#per-agent-notes): Claude Code on Google
  Vertex AI, Antigravity CLI, Junie, and why Cursor and Amp cannot work.
- [The Observer Effect](./REFERENCE.md#the-observer-effect)
- [How it works](./REFERENCE.md#how-it-works), including what to do
  [if your logs folder fills up in seconds](./REFERENCE.md#if-your-logs-folder-fills-up-in-seconds).
- [How much this was tested](./REFERENCE.md#how-much-this-was-tested)
- [Extending it](./REFERENCE.md#extending-it)
