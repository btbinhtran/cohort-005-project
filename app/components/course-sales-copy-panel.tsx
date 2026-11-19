import type { useFetcher } from "react-router";
import { Save } from "lucide-react";
import { MonacoMarkdownEditor } from "~/components/monaco-markdown-editor";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export type CourseSalesCopyPanelProps = {
  // The draft lives in the page, so unsaved changes survive a tab switch.
  salesCopy: string;
  setSalesCopy: (value: string) => void;
  handleSalesCopySave: () => void;
  salesCopyHasChanges: boolean;
  salesCopyIsEmpty: boolean;
  salesCopyFetcher: ReturnType<typeof useFetcher>;
};

/** The Markdown editor for the course's sales copy. */
export function CourseSalesCopyPanel({
  salesCopy,
  setSalesCopy,
  handleSalesCopySave,
  salesCopyHasChanges,
  salesCopyIsEmpty,
  salesCopyFetcher,
}: CourseSalesCopyPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Sales Copy</h2>
        <p className="text-sm text-muted-foreground">
          Write the course sales copy in Markdown. This is shown on the public
          course page. Press Ctrl+S to format and save.
        </p>
      </CardHeader>
      <CardContent>
        <MonacoMarkdownEditor
          value={salesCopy}
          onChange={setSalesCopy}
          onSave={handleSalesCopySave}
        />
        <div className="mt-4 flex items-center gap-4">
          <Button
            onClick={handleSalesCopySave}
            disabled={
              !salesCopyHasChanges ||
              salesCopyIsEmpty ||
              salesCopyFetcher.state !== "idle"
            }
          >
            <Save className="mr-1.5 size-4" />
            {salesCopyFetcher.state !== "idle"
              ? "Saving..."
              : "Save Sales Copy"}
          </Button>
          {salesCopyIsEmpty ? (
            <span className="text-sm text-destructive">
              Sales copy cannot be empty.
            </span>
          ) : (
            salesCopyHasChanges && (
              <span className="text-sm text-muted-foreground">
                You have unsaved changes.
              </span>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
