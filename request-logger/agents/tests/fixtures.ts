import { resolveChoice, type AgentChoice } from "../../agents";

export const PORT = { port: 8787, platform: "linux" as NodeJS.Platform };

/** Resolve, and fail loudly if the answer was not a usable target. */
export function target(agent: string, provider?: string) {
  const result = resolveChoice({ agent, provider }, PORT);
  if (result.kind !== "target") {
    throw new Error(
      `expected a target for ${agent}/${provider}, got ${result.kind}`
    );
  }
  return result;
}

/** Resolve a custom-base-url choice, and fail loudly if it was not a usable target. */
export function customTarget(choice: AgentChoice) {
  const result = resolveChoice(choice, PORT);
  if (result.kind !== "custom-target") {
    throw new Error(`expected a custom-target, got ${result.kind}`);
  }
  return result;
}
