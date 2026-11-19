import type { ProviderEntry } from "./types";

// ---------------------------------------------------------------------------
// Resolution — the seam
// ---------------------------------------------------------------------------

export function buildCommand(
  provider: ProviderEntry,
  baseUrl: string,
  platform: NodeJS.Platform
): string {
  const fill = (text: string) => text.replace(/\{baseUrl\}/g, baseUrl);
  const env = (provider.env ?? []).map(
    ([key, value]) => [key, fill(value)] as const
  );
  // Arguments take the base URL too. Codex has no variable for it, so its
  // whole override arrives as a flag.
  const args = (provider.args ?? []).map(fill);
  const bin = [provider.bin, ...args].join(" ");
  return withEnv(env, bin, platform);
}

/**
 * Join one or more `KEY=value` environment assignments onto the command that
 * needs them, in whichever syntax the student's shell actually understands.
 *
 * POSIX shells — bash, zsh, and Windows' own WSL and Git Bash — accept
 * `KEY=value KEY2=value2 bin` directly, so that is the default this tool has
 * always printed. Windows' native PowerShell has no such syntax at all: typed
 * back verbatim, it comes back as "is not recognized as a name of a cmdlet"
 * (the report that prompted this function). PowerShell instead sets each
 * variable with its own `$env:KEY = 'value'` statement, chained onto one
 * line with semicolons the way PowerShell joins statements.
 */
function withEnv(
  env: ReadonlyArray<readonly [string, string]>,
  bin: string,
  platform: NodeJS.Platform
): string {
  if (env.length === 0) return bin;
  if (platform === "win32") {
    return [
      ...env.map(([key, value]) => `$env:${key} = ${powerShellQuote(value)}`),
      bin,
    ].join("; ");
  }
  return [...env.map(([key, value]) => `${key}=${value}`), bin].join(" ");
}

/** Quote one complete POSIX shell argument, including embedded single quotes. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

/**
 * Quote one complete PowerShell string literal, including embedded single
 * quotes (PowerShell escapes those by doubling them, not by backslash).
 * Single-quoted PowerShell strings do no interpolation at all — unlike
 * double-quoted ones, where a `$` in a base URL or a JSON config would be
 * read as the start of a variable — so this is the literal, injection-safe
 * quoting PowerShell offers.
 */
export function powerShellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
