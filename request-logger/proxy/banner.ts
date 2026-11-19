import { styleText } from "node:util";
import type { ProxyTarget } from "../proxy";

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

export const dim = (text: string) => styleText("dim", text);
export const bold = (text: string) => styleText("bold", text);

/** A field in the banner: a dim label, then the value it describes. */
function field(label: string, value: string): void {
  console.log(`  ${dim(label.padEnd(10))} ${value}`);
}

export function printBanner(
  target: ProxyTarget,
  port: number,
  logDir: string
): void {
  const rule = dim("-".repeat(72));
  const forwards =
    target.kind === "target"
      ? `https://${target.upstreamHost}`
      : target.upstreamBaseUrl;
  console.log("");
  console.log(rule);
  field("Agent", bold(`${target.agentLabel} (${target.providerLabel})`));
  field("Listening", `http://localhost:${port}`);
  field("Forwards", forwards);
  field("Logs", dim(logDir));
  console.log(rule);

  for (const file of target.setup) {
    console.log("");
    console.log(`  Put this in ${bold(file.path)}:`);
    console.log("");
    for (const line of file.body.split("\n")) {
      console.log(dim(`      ${line}`));
    }
  }

  console.log("");
  console.log(
    target.setup.length > 0
      ? "  Then run your agent in another terminal with:"
      : "  Run your agent in another terminal with:"
  );
  console.log("");
  console.log(`      ${bold(target.command)}`);
  console.log("");

  for (const note of target.notes) printWrapped("Note", note);
  for (const warning of target.warnings) printWrapped("Warning", warning);

  console.log(
    dim("  Using a different agent now? Run: npm run request-logger -- --force")
  );
  // The tool waits on a port, so nothing tells the student it is finished.
  // Say how to stop it here, where they are already reading.
  // The styles are not nested. Both dim and bold close with the same code, so
  // a bold word inside a dim string ends the dim early.
  console.log(dim("  Press ") + bold("Ctrl+C") + dim(" to stop logging."));
  console.log(rule);
  console.log("");
}

/**
 * Ask the wizard, and keep the answer only if it is to be kept.
 *
 * `offerToRemember` is false when the student has already answered that
 * question: --force replaces a preference they chose to keep, so the new answer
 * simply takes its place. An agent that cannot be logged is never saved.
 */
/** Print a labelled paragraph, indented and wrapped. */
function printWrapped(label: string, text: string): void {
  const lines = wrap(text, 66);
  console.log(`  ${bold(`${label}:`)} ${lines[0] ?? ""}`);
  for (const line of lines.slice(1)) console.log(`        ${line}`);
  console.log("");
}

/** Wrap prose to a width, so a long reason reads as a paragraph. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
