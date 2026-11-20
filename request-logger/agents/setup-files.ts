import type { SetupFile } from "./types";

/**
 * Codex has no base URL environment variable. OPENAI_BASE_URL was read by older
 * versions and is gone from 0.133.0, so a student following an older guide gets
 * an empty logs folder and no error. The `-c` flag sets one config key for one
 * run, which is why it is used here in place of editing a file.
 */
export const CODEX_OVERRIDE_NOTE =
  "The -c flag sets this for one run only. Your ~/.codex/config.toml is not " +
  "touched, so your normal Codex is unchanged the moment you stop using this " +
  "command. Keep the quotes exactly as they are: Codex reads the value as TOML, " +
  "and an unquoted URL does not parse.";

export const PI_NOTE =
  "Pi has no base URL variable and no flag. A config file is the only way to " +
  "point it at this tool. Overriding the provider keeps Pi's whole built-in " +
  "model list, so you do not have to list the models yourself.";

/**
 * Pi's provider override file. The key is `baseUrl`, in this exact spelling.
 * Pi accepts other spellings into the file and then refuses to start, so this
 * is worth getting right for the student.
 *
 * `modelId`, when given, is written as a one-entry `models` array under the
 * same provider. Pi replaces that provider's whole built-in model catalogue
 * with whatever `models` lists — see resolveCustomTarget's Pi branch, which
 * is the only caller that passes it. Omitted, as it is for every catalogue
 * entry above, Pi keeps its built-in catalogue for that provider, which is
 * correct there because those routes really do talk to Anthropic or OpenAI.
 */
export function piModels(
  providerId: string,
  baseUrl: string,
  modelId?: string
): SetupFile {
  return {
    path: "~/.pi/agent/models.json",
    language: "json",
    body: [
      "{",
      '  "providers": {',
      `    "${providerId}": {`,
      `      "baseUrl": "${baseUrl}"${modelId ? "," : ""}`,
      ...(modelId ? [`      "models": [{ "id": "${modelId}" }]`] : []),
      "    }",
      "  }",
      "}",
    ].join("\n"),
  };
}

/**
 * OMP's provider override file, in YAML, under ~/.omp/agent/models.yml.
 *
 * OMP does not know, and this tool cannot know, which backend the student is
 * actually pointing at — Ollama, LM Studio, llama.cpp, LiteLLM, or something
 * else entirely — so the provider key below is a generic placeholder
 * ("custom") rather than a real backend name. OMP does not care what the key
 * is called, only that baseUrl is set correctly under it, so the placeholder
 * costs the student nothing; they may rename it if they prefer a name that
 * matches their backend.
 */
export function ompModels(baseUrl: string): SetupFile {
  return {
    path: "~/.omp/agent/models.yml",
    language: "yaml",
    body: ["providers:", "  custom:", `    baseUrl: "${baseUrl}"`].join("\n"),
  };
}

export const OMP_NOTE =
  "OMP has no backend of its own to hard-code the way the rest of this " +
  "catalogue does. It can point at Ollama, LM Studio, llama.cpp, LiteLLM, or " +
  "any other server that speaks one of the wire formats offered here, so " +
  "every OMP setup goes through the base URL and wire format you chose.";

/**
 * Junie's custom-proxy override, in JSON, under ~/.junie/config.json (user
 * scope; see Junie's own configuration-files docs for how a project-scope
 * file layers on top). Unlike ompModels/piModels, this one genuinely differs
 * by wire format: Junie's proxy entry declares a `kind` — the protocol Junie
 * itself will speak on the wire — so a mismatched kind does not 404, it just
 * sends the wrong shape of request. That is why Junie gets two catalogue
 * providers below (tagged by customTemplateFor) instead of OMP's one: the
 * kind, and the auth header format that goes with it, must track the
 * renderer the student actually picked.
 *
 * `authHeader` is a placeholder line, not a real credential — see JUNIE_NOTE.
 */
export function junieConfig(
  baseUrl: string,
  kind: "Anthropic" | "OpenAI",
  authHeader: string
): SetupFile {
  return {
    path: "~/.junie/config.json",
    language: "json",
    body: [
      "{",
      '  "proxies": [',
      "    {",
      '      "name": "request-logger",',
      `      "kind": "${kind}",`,
      `      "api-url": "${baseUrl}",`,
      `      "headers": ["${authHeader}"]`,
      "    }",
      "  ],",
      '  "provider": "request-logger"',
      "}",
    ].join("\n"),
  };
}

export const JUNIE_NOTE =
  "Junie has no existing login for this tool to pass through the way Claude " +
  "Code or Codex do. Its custom proxy bypasses JetBrains AI authentication " +
  "entirely, so a real API key for whichever backend you are logging goes " +
  "straight into config.json's headers array in plaintext. Do not commit " +
  "this file.";

export const JUNIE_MERGE_NOTE =
  "This is merged into ~/.junie/config.json, not a replacement for it — add " +
  "the proxies entry and the provider key alongside whatever else is " +
  "already in that file.";

/**
 * Antigravity CLI (`agy`) is a separate Google product from Gemini CLI — a
 * different binary, a different agent harness — but its API-key route stores
 * its settings under Gemini CLI's own directory (`~/.gemini/...`) and, per
 * Google's docs, calls the public Gemini API directly and reads the exact
 * same GOOGLE_GEMINI_BASE_URL variable Gemini CLI's own API-key route does.
 * The existing "gemini" renderer already reads that wire format correctly,
 * so this entry needed no renderer of its own — only a catalogue entry with
 * the right bin and the settings file that switches this route on.
 */
export const ANTIGRAVITY_NOTE =
  "Antigravity CLI is a different product from Gemini CLI, with its own " +
  "binary (agy, not gemini). This route works the same as Gemini CLI's API " +
  "key route, though: both call the public Gemini API directly and read the " +
  "same GOOGLE_GEMINI_BASE_URL variable, so the existing gemini renderer " +
  "reads this capture correctly with no changes.";

export const ANTIGRAVITY_KEY_NOTE =
  "GEMINI_API_KEY must also be exported in your shell, and modelProvider " +
  'must be "gemini" in the settings file below. Without both, Antigravity ' +
  "CLI falls back to its own account sign-in instead — a different, " +
  "unverified route this catalogue does not cover yet (see the warning below).";

export const ANTIGRAVITY_MERGE_NOTE =
  "This is merged into ~/.gemini/antigravity-cli/settings.json, not a " +
  "replacement for it — add modelProvider alongside whatever else is " +
  "already in that file.";

export const ANTIGRAVITY_LOGIN_WARNING =
  "This entry covers the Gemini API key route only. Antigravity CLI's " +
  "default account sign-in was not verified against real source (it is " +
  "closed source) or a real login, and public reporting on the Antigravity " +
  "IDE suggests its account-login traffic can go to a different, internal " +
  "host rather than the Code Assist host Gemini CLI's own free login uses — " +
  "so this catalogue does not claim that route works. Ask for it via the " +
  "issue tracker if you need it logged.";

export const OPENCODE_NOTE =
  "The environment variable above works, but only by accident: OpenCode passes " +
  "no base URL of its own for this provider, so the bundled SDK falls back to " +
  "reading the variable. The config file below is the durable way to do it.";
