// Fails when a module under app/modules/ ships without a test. A module is
// behaviour behind an entry point a test can call, so it has at least one
// tests/*.test.ts or tests/*.test.tsx. See app/modules/README.md.
// Usage: node scripts/check-modules.js

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "app/modules";

const untested = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(ROOT, entry.name))
  .filter((dir) => {
    const tests = join(dir, "tests");
    return (
      !existsSync(tests) ||
      !readdirSync(tests).some((file) => /\.test\.tsx?$/.test(file))
    );
  });

if (untested.length > 0) {
  console.error("These modules have no tests/*.test.ts:\n");
  for (const dir of untested) console.error(`  ${dir}`);
  console.error(`
Test each module through its entry point, from its tests/ folder. Arrange the
test through the module's own functions. See app/modules/README.md.`);
  process.exit(1);
}
