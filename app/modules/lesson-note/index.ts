import {
  describeEditor,
  type NoteEditorInput,
  type NoteEditorState,
} from "./lib/editor";

export type { NoteEditorInput, NoteEditorState };

/**
 * What the Lesson page's note editor shows for a draft: its status line,
 * whether Save is enabled, and the character count.
 */
export function describeNoteEditor(input: NoteEditorInput): NoteEditorState {
  return describeEditor(input);
}
