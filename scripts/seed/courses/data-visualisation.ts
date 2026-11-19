import { db, type Category, type User } from "../db";
import { daysAgo } from "../helpers";
import { insertCourseContent } from "../course-content";
import * as schema from "../../../app/db/schema";
import { CourseStatus } from "../../../app/db/schema";
import { markdown } from "../../../app/lib/text";

export function seedDataVisualisationCourse({
  instructor2,
  catBySlug,
}: {
  instructor2: User;
  catBySlug: Record<string, Category>;
}) {
  // ─── Course 4: Practical Data Visualisation (Marcus Johnson) ───
  // Published but has never sold. The analytics views must render a course with
  // zero revenue, zero enrolments and zero progress without dividing by it.

  const [course4] = db
    .insert(schema.courses)
    .values({
      title: "Practical Data Visualisation",
      slug: "practical-data-visualisation",
      description:
        "Turn data into charts people can actually read. Chart selection, scales, colour, and the accessibility rules most dashboards break.",
      salesCopy: markdown(`## Charts People Can Read

A chart is an argument. This course is about making the argument clearly — picking the right encoding, scaling it honestly, and colouring it so everyone can read it.

### Topics

- Choosing an encoding that matches the question
- Scales, axes, and the zero-baseline argument
- Colour palettes that survive colour blindness
- Annotating a chart so it needs no caption

## Who Is This For?

Developers and analysts who produce charts for other people to act on.`),
      instructorId: instructor2.id,
      categoryId: catBySlug["data-science"].id,
      status: CourseStatus.Published,
      coverImageUrl: "/images/course-nodejs.svg",
      price: 4499,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(6),
    })
    .returning()
    .all();

  const course4LessonIds = insertCourseContent(
    course4.id,
    [
      {
        title: "Choosing a Chart",
        lessons: [
          {
            title: "Encodings and What They Say",
            duration: 12,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Encodings\n\nPosition beats length beats angle beats area. Pick the strongest encoding the question allows.",
          },
          {
            title: "Time Series Done Right",
            duration: 14,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Time Series\n\nRanges, resampling, and why a 30-day and a 90-day view of the same data should not look identical.",
          },
          {
            title: "Distributions",
            duration: 13,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Distributions\n\nHistograms, box plots, and the mean hiding a bimodal population.",
          },
        ],
      },
      {
        title: "Making It Readable",
        lessons: [
          {
            title: "Scales and Axes",
            duration: 11,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Scales\n\nWhen truncating an axis is honest, and when it is a lie with a legend.",
          },
          {
            title: "Colour and Accessibility",
            duration: 15,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Colour\n\nSequential, diverging and categorical palettes, checked against the three common forms of colour blindness.",
          },
          {
            title: "Annotation and Narrative",
            duration: 10,
            content:
              "## Annotation\n\nThe label on the spike is doing more work than the spike.",
          },
        ],
      },
    ],
    35
  );

  console.log(
    `Created course "${course4.title}" with 2 modules and ${course4LessonIds.length} lessons (published, no sales).`
  );
}
