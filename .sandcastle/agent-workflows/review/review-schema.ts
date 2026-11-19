import { z } from "zod/v4";

// The findings the review left unfixed. The workflow posts each one as an
// inline comment on its file and line, and lists them in the verdict by
// `axis` and `rule`. The comment is the one place a finding is written out.
export const reviewSchema = z
  .strictObject({
    comments: z
      .array(
        z.strictObject({
          axis: z
            .enum(["Standards", "Spec"])
            .describe("The review axis the finding belongs to."),
          rule: z
            .string()
            .min(1)
            .describe(
              'What the finding breaks, in a few words: a CODING_STANDARDS.md heading, a smell, or the spec line it misses. E.g. "Arrange tests through the module under test".'
            ),
          path: z
            .string()
            .min(1)
            .describe("The file, relative to the repository root."),
          line: z
            .number()
            .int()
            .positive()
            .describe(
              "A line in the file as it is now, inside a hunk of the diff against the base. A finding outside the hunks goes into the verdict instead of onto the line."
            ),
          body: z
            .string()
            .min(1)
            .describe(
              "The finding, in Markdown: what is wrong here and what to do instead. The rule is shown above it, so leave it out."
            ),
        })
      )
      .describe("One entry per finding you left unfixed. Empty is fine."),
  })
  .describe("The review's unfixed findings.");
