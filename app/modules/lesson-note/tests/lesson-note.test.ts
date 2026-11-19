import { describe, it, expect } from "vitest";
import { describeNoteEditor } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

const idle = { saving: false, error: undefined, submittedDraft: undefined };

describe("describeNoteEditor", () => {
  it("is empty, with Save disabled, before the Student writes anything", () => {
    expect(describeNoteEditor({ ...idle, draft: "", savedBody: null })).toEqual(
      {
        status: "empty",
        canSave: false,
        tooLong: false,
        length: 0,
        maxLength: MAX_NOTE_LENGTH,
      }
    );
  });

  it("is unsaved, with Save enabled, once the Student types", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "Result types",
      savedBody: null,
    });
    expect(state.status).toBe("unsaved");
    expect(state.canSave).toBe(true);
    expect(state.length).toBe(12);
  });

  it("is saved, with Save disabled, when the draft matches the saved Note", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "Result types",
      savedBody: "Result types",
    });
    expect(state.status).toBe("saved");
    expect(state.canSave).toBe(false);
  });

  it("ignores surrounding whitespace, because the server trims before it stores", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "  Result types\n",
      savedBody: "Result types",
    });
    expect(state.status).toBe("saved");
    expect(state.length).toBe(12);
  });

  it("is unsaved when the draft differs from the saved Note", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "Result types and never",
      savedBody: "Result types",
    });
    expect(state.status).toBe("unsaved");
    expect(state.canSave).toBe(true);
  });

  it("does not let the Student save whitespace", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "   ",
      savedBody: null,
    });
    expect(state.status).toBe("empty");
    expect(state.canSave).toBe(false);
  });

  it("does not let the Student save an emptied Note", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "",
      savedBody: "Result types",
    });
    expect(state.status).toBe("unsaved");
    expect(state.canSave).toBe(false);
  });

  it("allows a Note exactly at the limit", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "a".repeat(MAX_NOTE_LENGTH),
      savedBody: null,
    });
    expect(state.tooLong).toBe(false);
    expect(state.canSave).toBe(true);
  });

  it("flags a Note over the limit and disables Save", () => {
    const state = describeNoteEditor({
      ...idle,
      draft: "a".repeat(MAX_NOTE_LENGTH + 1),
      savedBody: null,
    });
    expect(state.tooLong).toBe(true);
    expect(state.canSave).toBe(false);
    expect(state.length).toBe(MAX_NOTE_LENGTH + 1);
  });

  it("is saving, with Save disabled, while the save is in flight", () => {
    const state = describeNoteEditor({
      draft: "Result types",
      savedBody: null,
      saving: true,
      error: "Earlier failure",
      submittedDraft: "Result types",
    });
    expect(state.status).toBe("saving");
    expect(state.canSave).toBe(false);
  });

  it("shows the error the last save came back with", () => {
    const state = describeNoteEditor({
      draft: "Result types",
      savedBody: null,
      saving: false,
      error: "Something went wrong",
      submittedDraft: "Result types",
    });
    expect(state.status).toBe("error");
    expect(state.canSave).toBe(true);
  });

  it("drops the error once the Student edits the draft it was about", () => {
    const state = describeNoteEditor({
      draft: "Result types and never",
      savedBody: null,
      saving: false,
      error: "Something went wrong",
      submittedDraft: "Result types",
    });
    expect(state.status).toBe("unsaved");
    expect(state.canSave).toBe(true);
  });
});
