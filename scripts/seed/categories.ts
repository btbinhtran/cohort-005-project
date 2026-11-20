import { db } from "./db";
import * as schema from "../../app/db/schema";

export function seedCategories() {
  // ─── Categories ───

  const categoriesData = db
    .insert(schema.categories)
    .values([
      { name: "Programming", slug: "programming" },
      { name: "Design", slug: "design" },
      { name: "Data Science", slug: "data-science" },
      { name: "DevOps", slug: "devops" },
      { name: "Marketing", slug: "marketing" },
    ])
    .returning()
    .all();

  const catBySlug = Object.fromEntries(categoriesData.map((c) => [c.slug, c]));

  console.log(`Created ${categoriesData.length} categories.`);

  return catBySlug;
}
