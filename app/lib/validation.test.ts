import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseParams, recordId } from "./validation";

describe("recordId", () => {
  it("coerces a numeric string to its id", () => {
    expect(recordId.parse("42")).toBe(42);
  });

  it.each([
    ["an empty string", ""],
    ["a missing value", null],
    ["zero", "0"],
    ["a negative id", "-3"],
    ["a fraction", "1.5"],
    ["a non-number", "abc"],
  ])("refuses %s", (_, input) => {
    expect(recordId.safeParse(input).success).toBe(false);
  });
});

describe("parseParams with recordId", () => {
  const schema = z.object({ lessonId: recordId });

  it("returns the parsed id", () => {
    expect(parseParams({ lessonId: "18" }, schema)).toEqual({ lessonId: 18 });
  });

  it("throws a 400 for an id Number() would have read as 0", () => {
    let thrown: unknown;
    try {
      parseParams({ lessonId: "" }, schema);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ init: { status: 400 } });
  });
});
