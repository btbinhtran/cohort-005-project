import { useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { StarRatingInput } from "~/components/star-rating";

export function RateCourse({ userRating }: { userRating: number | null }) {
  const fetcher = useFetcher<{ ok: boolean; error: string | null }>();
  const isSubmitting = fetcher.state !== "idle";

  // Show the star the user just clicked while the request is in flight.
  const pendingRating = fetcher.formData?.get("rating");
  const displayedRating =
    pendingRating !== null && pendingRating !== undefined
      ? Number(pendingRating)
      : userRating;

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <div className="border-t pt-4">
      <p className="mb-2 text-sm font-medium">
        {userRating ? "Your rating" : "Rate this course"}
      </p>
      <fetcher.Form method="post">
        <StarRatingInput value={displayedRating} disabled={isSubmitting} />
      </fetcher.Form>
      {userRating && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Click a star to change your rating.
        </p>
      )}
    </div>
  );
}
