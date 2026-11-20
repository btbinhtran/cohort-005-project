import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  describeNoteEditor,
  type NoteEditorState,
} from "~/modules/lesson-note";

export type SavedNote = { body: string; updatedAt: string } | null;

/**
 * The Student's private Note on a Lesson. Laid out like the Questions &
 * Discussion card below it, so the two read as one family.
 */
export function LessonNote({ note }: { note: SavedNote }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const [submittedDraft, setSubmittedDraft] = useState<string>();
  const editor = describeNoteEditor({
    draft,
    savedBody: note?.body ?? null,
    saving: fetcher.state !== "idle",
    error: fetcher.data?.error,
    submittedDraft,
  });

  return (
    <Card className="mb-8 py-0">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Your notes</h2>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3.5" />
            Only you can see these
          </span>
        </div>

        <fetcher.Form
          method="post"
          className="space-y-2"
          onSubmit={() => setSubmittedDraft(draft)}
        >
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            aria-invalid={editor.tooLong || editor.status === "error"}
            className="min-h-32 resize-y"
          />

          <NoteFooter
            editor={editor}
            error={fetcher.data?.error}
            updatedAt={note?.updatedAt}
          />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteFooter({
  editor,
  error,
  updatedAt,
}: {
  editor: NoteEditorState;
  error: string | undefined;
  updatedAt: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={!editor.canSave}>
        {editor.status === "saving" ? "Saving..." : "Save note"}
      </Button>
      <NoteStatus status={editor.status} error={error} updatedAt={updatedAt} />
      <span
        className={cn(
          "ml-auto text-xs",
          editor.tooLong ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {editor.length} / {editor.maxLength}
      </span>
    </div>
  );
}

function NoteStatus({
  status,
  error,
  updatedAt,
}: {
  status: NoteEditorState["status"];
  error: string | undefined;
  updatedAt: string | undefined;
}) {
  if (status === "error") {
    return <span className="text-sm text-destructive">{error}</span>;
  }
  if (status === "unsaved") {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (status === "saved" && updatedAt) {
    return (
      <span suppressHydrationWarning className="text-xs text-muted-foreground">
        Saved · last edited {formatRelativeTime(updatedAt)}
      </span>
    );
  }
  return null;
}
