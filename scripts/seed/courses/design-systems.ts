import { db, type Category, type User } from "../db";
import { daysAgo } from "../helpers";
import { insertCourseContent } from "../course-content";
import * as schema from "../../../app/db/schema";
import { CourseStatus } from "../../../app/db/schema";
import { markdown } from "../../../app/lib/text";

export function seedDesignSystemsCourse({
  instructor1,
  catBySlug,
}: {
  instructor1: User;
  catBySlug: Record<string, Category>;
}) {
  // ─── Course 3: Design Systems with Tailwind (Sarah Chen) ───
  // A second selling course for Sarah, so the per-instructor views have more
  // than one row and revenue splits across courses.

  const [course3] = db
    .insert(schema.courses)
    .values({
      title: "Design Systems with Tailwind",
      slug: "design-systems-with-tailwind",
      description:
        "Build a design system that survives contact with a real product team. Tokens, component APIs, theming, and the discipline that keeps a system from rotting into a component graveyard.",
      salesCopy: markdown(`## Design Systems That Survive

Most design systems die the same way: a beautiful component library nobody uses, drifting out of sync with the product it was meant to serve.

This course is about the other kind — the system your team reaches for because it is faster than not using it.

### What You'll Learn

- **Design tokens** — colour, spacing and type scales that mean something
- **Component APIs** — variants that compose instead of multiplying
- **Theming** — light, dark, and brand themes without a fork
- **Governance** — how changes land without breaking every consumer

## Who Is This For?

Frontend developers who have built components before and watched the collection turn into a mess. Tailwind experience helps but is not required.`),
      instructorId: instructor1.id,
      categoryId: catBySlug["design"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-typescript.svg",
      price: 3999,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(14),
    })
    .returning()
    .all();

  const course3LessonIds = insertCourseContent(
    course3.id,
    [
      {
        title: "Foundations",
        lessons: [
          {
            title: "What a Design System Is For",
            duration: 9,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## What a Design System Is For\n\nA design system is a shared vocabulary, not a component folder. This lesson covers what belongs in one and — more usefully — what does not.",
          },
          {
            title: "Design Tokens",
            duration: 14,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## Design Tokens\n\nColour, spacing, radius and type scales expressed as named values, so a change lands in one place instead of two hundred.",
          },
          {
            title: "Spacing and Type Scales",
            duration: 12,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## Scales\n\nWhy a constrained scale produces better layouts than free choice, and how to pick one you can live with.",
          },
        ],
      },
      {
        title: "Components",
        lessons: [
          {
            title: "Variants and Composition",
            duration: 18,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            githubRepoUrl:
              "https://github.com/total-typescript/design-system-variants",
            content:
              "## Variants\n\nA variant API that composes beats one that enumerates. We build a button whose options multiply without the source doing the same.",
          },
          {
            title: "Accessible Primitives",
            duration: 16,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## Accessible Primitives\n\nFocus management, keyboard interaction and ARIA — handled once in the primitive rather than in every consumer.",
          },
          {
            title: "Theming and Dark Mode",
            duration: 15,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## Theming\n\nOne set of components, several themes, no forks. CSS custom properties do most of the work.",
          },
        ],
      },
      {
        title: "Living With It",
        lessons: [
          {
            title: "Documentation That Gets Read",
            duration: 11,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## Documentation\n\nDocs next to the code, examples that run, and the one page every new team member actually opens.",
          },
          {
            title: "Versioning and Breaking Changes",
            duration: 13,
            videoUrl: "https://www.youtube.com/watch?v=zQnBQ4tB3ZA",
            content:
              "## Breaking Changes\n\nHow to ship a breaking change to twelve teams without becoming the reason they fork.",
          },
          {
            title: "Course Wrap-Up",
            duration: 6,
            content:
              "## Wrap-Up\n\nYou have a token layer, a component API you can defend, and a story for how changes land. Go and delete some CSS.",
          },
        ],
      },
    ],
    195
  );

  console.log(
    `Created course "${course3.title}" with 3 modules and ${course3LessonIds.length} lessons.`
  );

  return { course3, course3LessonIds };
}
