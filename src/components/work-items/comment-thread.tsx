"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, MessageSquare, Send } from "lucide-react";
import type { Comment } from "@/types/api";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/toast";

function chronological(comments: Comment[]) {
  return [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function CommentThread({
  workItemId,
  initialComments,
  total,
}: {
  workItemId: string;
  initialComments: Comment[];
  total: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [posted, setPosted] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = useMemo(() => {
    const serverIds = new Set(initialComments.map((comment) => comment.id));
    return chronological([
      ...initialComments,
      ...posted.filter((comment) => !serverIds.has(comment.id)),
    ]);
  }, [initialComments, posted]);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = body.trim();
    if (!value || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/v1/work-items/${workItemId}/comments?workItemId=${encodeURIComponent(workItemId)}`,
        {
          method: "POST",
          body: JSON.stringify({ body: value }),
        },
      );

      if (!response.ok) {
        const parsed = await readApiError(response, "Unable to post your comment.");
        setError(parsed.message);
        toast({
          variant: "destructive",
          title: "Comment not posted",
          description: parsed.message,
        });
        return;
      }

      const payload = (await response.json()) as { data?: Comment };
      if (payload.data) {
        setPosted((current) => [...current, payload.data as Comment]);
      }
      setBody("");
      toast({ variant: "success", title: "Comment posted" });
      router.refresh();
    } catch {
      setError("We couldn’t reach the server. Your comment is still here and can be retried.");
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = 5000 - body.length;

  return (
    <div className="space-y-5">
      {comments.length ? (
        <ul className="divide-y divide-border/70">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              <UserAvatar
                name={comment.author.name}
                email={comment.author.email}
                size="md"
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-[13px] font-semibold text-foreground">
                    {comment.author.name ?? comment.author.email}
                  </p>
                  <time
                    dateTime={comment.createdAt}
                    title={formatDateTime(comment.createdAt)}
                    className="text-[11px] text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {formatRelativeTime(comment.createdAt)}
                  </time>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Start the conversation with the context your teammates will need."
          compact
        />
      )}

      <form onSubmit={submitComment} className="space-y-3 border-t border-border/70 pt-5">
        <label htmlFor="comment-body" className="text-[13px] font-medium text-foreground">
          Add a comment
        </label>
        {error ? (
          <div
            role="alert"
            className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-2.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{error}</p>
          </div>
        ) : null}
        <Textarea
          id="comment-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Share an update, blocker, decision, or next step…"
          className="min-h-24"
          maxLength={5000}
          disabled={submitting}
          aria-invalid={Boolean(error)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Visible to active team members · recorded in activity
            {remaining < 500 ? (
              <span className={cn("ml-2 tabular-nums", remaining < 100 && "font-medium text-destructive")}>
                {remaining} characters left
              </span>
            ) : null}
          </p>
          <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Posting…
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden="true" />
                Post comment
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="sr-only" aria-live="polite">
        {Math.max(total, comments.length)} comments
      </p>
    </div>
  );
}
