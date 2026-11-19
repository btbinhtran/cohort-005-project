// Fails when a commit turns a lint rule off for more code: a new file or
// pattern in an `overrides` entry that sets a rule to "off", or a rule newly
// turned off for the whole repo. The exemption lists only shrink. Moving code
// does not carry its old file's exemption: fix the moved code instead.
// Compares the staged .oxlintrc.json with HEAD's.
// Usage: node scripts/check-lint-exemptions.js

import { execFileSync } from "node:child_process";

const CONFIG = ".oxlintrc.json";

const read = (rev) => {
  try {
    const text = execFileSync("git", ["show", `${rev}:${CONFIG}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
  } catch {
    return undefined;
  }
};

const isOff = (setting) =>
  setting === "off" || (Array.isArray(setting) && setting[0] === "off");

// Every (rule, file pattern) pair the config turns off.
const exemptions = (config) => {
  const pairs = new Set();
  for (const [rule, setting] of Object.entries(config.rules ?? {})) {
    if (isOff(setting)) pairs.add(`${rule} for every file`);
  }
  for (const { files = [], rules = {} } of config.overrides ?? []) {
    for (const [rule, setting] of Object.entries(rules)) {
      if (!isOff(setting)) continue;
      for (const file of files) pairs.add(`${rule} for ${file}`);
    }
  }
  return pairs;
};

const before = read("HEAD");
const after = read("");
if (!before || !after) process.exit(0);

const known = exemptions(before);
const added = [...exemptions(after)].filter((pair) => !known.has(pair));

if (added.length > 0) {
  console.error(`${CONFIG} turns off more lint rules than HEAD does:\n`);
  for (const pair of added) console.error(`  ${pair}`);
  console.error(`
Fix the code the rule flags instead: split the long function, or cut the
parameters. Code moved to a new file does not take its old exemption with it.`);
  process.exit(1);
}
