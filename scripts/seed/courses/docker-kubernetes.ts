import { db, type Category, type User } from "../db";
import { daysAgo } from "../helpers";
import { insertCourseContent } from "../course-content";
import * as schema from "../../../app/db/schema";
import { CourseStatus } from "../../../app/db/schema";
import { markdown } from "../../../app/lib/text";

export function seedDockerKubernetesCourse({
  instructor2,
  catBySlug,
}: {
  instructor2: User;
  catBySlug: Record<string, Category>;
}) {
  // ─── Course 5: Shipping with Docker and Kubernetes (Marcus Johnson) ───
  // Draft — never appears in the catalogue, and must be excluded from published
  // course counts and revenue.

  const [course5] = db
    .insert(schema.courses)
    .values({
      title: "Shipping with Docker and Kubernetes",
      slug: "shipping-with-docker-and-kubernetes",
      description:
        "Containerise an application and run it on Kubernetes without cargo-culting a YAML file you do not understand.",
      salesCopy: markdown(`## From Laptop to Cluster

Containers made deployment reproducible and Kubernetes made it configurable. This course covers both without pretending either is simple.

### Topics

- Writing a Dockerfile that builds fast and ships small
- Pods, deployments, services — what each one is actually for
- Config, secrets and the twelve-factor bits that matter
- Rolling out a change and rolling it back

## Status

This course is still in draft while the cluster examples are rewritten against the current API.`),
      instructorId: instructor2.id,
      categoryId: catBySlug["devops"].id,
      status: CourseStatus.Draft,
      coverImageUrl: "/images/course-nodejs.svg",
      price: 5499,
      createdAt: daysAgo(18),
      updatedAt: daysAgo(2),
    })
    .returning()
    .all();

  const course5LessonIds = insertCourseContent(
    course5.id,
    [
      {
        title: "Containers",
        lessons: [
          {
            title: "Why Containers",
            duration: 8,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Why Containers\n\nThe problem containers solve, stated precisely enough to know when you do not have it.",
          },
          {
            title: "Writing a Dockerfile",
            duration: 17,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## Dockerfiles\n\nLayer caching, multi-stage builds, and getting the image under a hundred megabytes.",
          },
          {
            title: "Images and Registries",
            duration: 12,
            content:
              "## Registries\n\nTagging, pushing, and why `latest` is not a version.",
          },
        ],
      },
      {
        title: "Kubernetes Basics",
        lessons: [
          {
            title: "Pods, Deployments, Services",
            duration: 19,
            videoUrl: "https://www.youtube.com/watch?v=lsMQRaeKNDk",
            content:
              "## The Core Objects\n\nThree objects explain most of Kubernetes. This lesson is those three.",
          },
          {
            title: "Config and Secrets",
            duration: 14,
            content:
              "## Config\n\nConfigMaps, Secrets, and keeping environment differences out of the image.",
          },
        ],
      },
    ],
    15
  );

  console.log(
    `Created course "${course5.title}" with 2 modules and ${course5LessonIds.length} lessons (draft).`
  );
}
