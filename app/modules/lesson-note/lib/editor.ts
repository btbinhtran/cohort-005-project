import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteEditorInput = {
  /** What is in the textarea right now. */
  draft: string;
  /** The body last saved, or null when the Student has no Note yet. */
  savedBody: string | null;
  saving: boolean;
  /** The error the last save came back with, if it failed. */
  error: string | undefined;
};

export type NoteEditorStatus =
  | "saving"
  | "error"
  | "unsaved"
  | "saved"
  | "empty";

export type NoteEditorState = {
  status: NoteEditorStatus;
  canSave: boolean;
  tooLong: boolean;
  length: number;
  maxLength: number;
};

export function describeEditor({
  draft,
  savedBody,
  saving,
  error,
}: NoteEditorInput): NoteEditorState {
  const trimmed = draft.trim();
  const tooLong = trimmed.length > MAX_NOTE_LENGTH;
  // The server trims before it stores, so whitespace alone is not a change.
  const changed = trimmed !== (savedBody ?? "");

  return {
    status: statusOf({ saving, error, changed, hasSaved: savedBody !== null }),
    canSave: !saving && changed && trimmed.length > 0 && !tooLong,
    tooLong,
    length: trimmed.length,
    maxLength: MAX_NOTE_LENGTH,
  };
}

function statusOf({
  saving,
  error,
  changed,
  hasSaved,
}: {
  saving: boolean;
  error: string | undefined;
  changed: boolean;
  hasSaved: boolean;
}): NoteEditorStatus {
  if (saving) return "saving";
  if (error) return "error";
  if (changed) return "unsaved";
  if (hasSaved) return "saved";
  return "empty";
}
