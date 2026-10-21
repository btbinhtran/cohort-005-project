import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import type { z } from "zod/v4";
import { claudeAgent, required, writeJson } from "../shared/common";
import { extractionPrompt } from "../shared/extraction-prompt";
import { runWithExtraction } from "../shared/run-with-extraction";
import { diffLines } from "./diff-lines";
import { reviewSchema } from "./review-schema";

const BASE_REF = required("BASE_REF");
const GH_REPO = required("GH_REPO");
const VERDICT = "/tmp/review-verdict.md";

type Finding = z.infer<typeof reviewSchema>["comments"][number];

// The agent fixes and commits, writes the verdict file, and hands back the
// findings it left. This script lists those findings in the verdict. The
// workflow pushes the commits, posts the verdict and the inline comments,
// and marks the PR ready.
const result = await runWithExtraction({
  name: "review",
  agent: claudeAgent(),
  sandbox: noSandbox(),
  logging: { type: "stdout" },
  promptFile: path.join(import.meta.dirname, "prompt.md"),
  promptArgs: {
    PR_NUMBER: required("PR_NUMBER"),
    BRANCH: required("BRANCH"),
    BASE_REF,
  },
  output: sandcastle.Output.object({ tag: "comments", schema: reviewSchema }),
  extractionPrompt: extractionPrompt("comments", reviewSchema),
});

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// The diff after the agent's commits: the comments land on that.
const hunks = diffLines(git("diff", `origin/${BASE_REF}...HEAD`));
const head = git("rev-parse", "HEAD").trim();
const { comments: found }: z.infer<typeof reviewSchema> = result.output;
const onDiff = found.filter(({ path: file, line }) =>
  hunks.get(file)?.has(line)
);
const offDiff = found.filter((finding) => !onDiff.includes(finding));

const link = ({ path: file, line }: Finding): string =>
  `[\`${file}:${line}\`](https://github.com/${GH_REPO}/blob/${head}/${file}#L${line})`;

// The verdict names each finding left on a line; the inline comment carries
// it in full. A finding GitHub cannot put on a line goes in the verdict whole,
// so it is not lost.
const leftSection = (): string => {
  const parts: string[] = [];
  if (onDiff.length > 0) {
    parts.push(
      "## Left for you, as inline comments",
      "",
      ...onDiff.map((f) => `- **${f.axis}:** ${f.rule}. ${link(f)}`),
      ""
    );
  }
  if (offDiff.length > 0) {
    parts.push(
      "## Left for you, outside the diff",
      "",
      ...offDiff.flatMap((f) => [
        `- **${f.axis}: ${f.rule}.** ${link(f)}`,
        "",
        f.body.replace(/^/gm, "  "),
        "",
      ])
    );
  }
  return parts.join("\n");
};

if (fs.existsSync(VERDICT) && found.length > 0) {
  fs.appendFileSync(VERDICT, `\n${leftSection()}`);
}

// The request body for POST /repos/{owner}/{repo}/pulls/{n}/reviews.
writeJson("review-comments.json", {
  commit_id: head,
  event: "COMMENT",
  body: "The findings this review left for you, on their lines. The verdict is in its own comment.",
  comments: onDiff.map(({ path: file, line, axis, rule, body }) => ({
    path: file,
    line,
    side: "RIGHT",
    body: `**${axis}: ${rule}.**\n\n${body}`,
  })),
});
