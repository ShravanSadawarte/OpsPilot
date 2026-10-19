"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Search,
  ShieldAlert,
  Timer,
  Users,
  X,
} from "lucide-react";
import type { Approval } from "@/types/api";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/toast";

export type ApprovalQueueItem = Approval & {
  canDecide: boolean;
  blockedReason: string | null;
};

type Decision = {
  approval: ApprovalQueueItem;
  mode: "APPROVED" | "REJECTED";
};

export function ApprovalQueue({ initialApprovals }: { initialApprovals: ApprovalQueueItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const approvals = useMemo(
    () => initialApprovals.filter((approval) => !removedIds.includes(approval.id)),
    [initialApprovals, removedIds],
  );

  function markRemoved(approvalId: string) {
    setRemovedIds((current) =>
      current.includes(approvalId) ? current : [...current, approvalId],
    );
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return approvals;
    return approvals.filter((approval) => {
      const teamKey = approval.workItem.team?.key ?? "";
      const teamName = approval.workItem.team?.name ?? "";
      return [
        approval.workItem.publicKey,
        approval.workItem.title,
        approval.requestedBy.name ?? "",
        approval.requestedBy.email,
        teamKey,
        teamName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [approvals, query]);

  function openDecision(approval: ApprovalQueueItem, mode: "APPROVED" | "REJECTED") {
    setDialogError(null);
    setReason("");
    setDecision({ approval, mode });
  }

  async function submitDecision() {
    if (!decision || pendingId) return;
    const trimmedReason = reason.trim();
    if (decision.mode === "REJECTED" && !trimmedReason) {
      setDialogError("A reason is required when rejecting an approval.");
      return;
    }

    setPendingId(decision.approval.id);
    setDialogError(null);
    try {
      const response = await apiFetch(
        `/api/v1/approvals/${decision.approval.id}?approvalId=${encodeURIComponent(
          decision.approval.id,
        )}`,
        {
          method: "POST",
          body: JSON.stringify({
            status: decision.mode,
            reason: decision.mode === "REJECTED" ? trimmedReason : undefined,
          }),
        },
      );

      if (!response.ok) {
        const parsed = await readApiError(response, "Unable to record your decision.");
        if (parsed.code === "CONFLICT") {
          markRemoved(decision.approval.id);
          setDecision(null);
          toast({
            variant: "warning",
            title: "Already decided",
            description: parsed.message,
          });
          router.refresh();
          return;
        }
        setDialogError(parsed.message);
        return;
      }

      markRemoved(decision.approval.id);
      toast({
        variant: "success",
        title: decision.mode === "APPROVED" ? "Approval approved" : "Approval rejected",
        description: `${decision.approval.workItem.publicKey} has been ${
          decision.mode === "APPROVED" ? "approved" : "rejected"
        }.`,
      });
      setDecision(null);
      router.refresh();
    } catch {
      setDialogError("We couldn’t reach the server. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by item, requester, or team…"
            className="pl-9 pr-9"
            aria-label="Search pending approvals"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Clear search"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{approvals.length}</span> pending{" "}
          {pluralize(approvals.length, "request")}
        </p>
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="The approval queue is clear"
          description="Nothing is waiting for a decision. New requests will appear here as soon as they are raised."
          action={
            <Button asChild variant="outline">
              <Link href="/work-items">Open work queue</Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No approvals match that search"
          description="Try a different work item key, title, requester, or team."
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((approval) => (
            <li
              key={approval.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/25 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/work-items/${approval.workItem.id}`}
                      className="font-mono text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                    >
                      {approval.workItem.publicKey}
                    </Link>
                    <StatusBadge status={approval.workItem.status} />
                    {approval.workItem.team ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {approval.workItem.team.key}
                      </Badge>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Timer className="size-3" aria-hidden="true" />
                      <time
                        dateTime={approval.createdAt}
                        title={formatDateTime(approval.createdAt)}
                        suppressHydrationWarning
                      >
                        Requested {formatRelativeTime(approval.createdAt)}
                      </time>
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">
                    <Link
                      href={`/work-items/${approval.workItem.id}`}
                      className="underline-offset-4 hover:text-primary hover:underline"
                    >
                      {approval.workItem.title}
                    </Link>
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <UserAvatar
                        name={approval.requestedBy.name}
                        email={approval.requestedBy.email}
                        size="xs"
                      />
                      Requested by{" "}
                      <span className="font-medium text-foreground">
                        {approval.requestedBy.name ?? approval.requestedBy.email}
                      </span>
                    </span>
                    {approval.workItem.team ? (
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5" aria-hidden="true" />
                        {approval.workItem.team.name}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/work-items/${approval.workItem.id}`}>
                      <ClipboardCheck className="size-3.5" aria-hidden="true" />
                      Review item
                    </Link>
                  </Button>

                  {approval.canDecide ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openDecision(approval, "REJECTED")}
                        disabled={pendingId !== null}
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openDecision(approval, "APPROVED")}
                        disabled={pendingId !== null}
                      >
                        {pendingId === approval.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        )}
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <p className="flex max-w-[240px] items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground lg:text-right">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {approval.blockedReason ?? "You cannot decide this approval."}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open && !pendingId) {
            setDecision(null);
            setReason("");
            setDialogError(null);
          }
        }}
      >
        <DialogContent>
          {decision ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {decision.mode === "APPROVED" ? "Approve this request?" : "Reject this request"}
                </DialogTitle>
                <DialogDescription>
                  {decision.approval.workItem.publicKey} · {decision.approval.workItem.title}
                </DialogDescription>
              </DialogHeader>

              {dialogError ? (
                <div
                  role="alert"
                  className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-2.5 text-xs text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <p className="leading-relaxed">{dialogError}</p>
                </div>
              ) : null}

              {decision.mode === "REJECTED" ? (
                <div className="space-y-1.5">
                  <label htmlFor="rejection-reason" className="text-[13px] font-medium">
                    Reason for rejection
                  </label>
                  <Textarea
                    id="rejection-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain what needs to change before this can be approved…"
                    className="min-h-24"
                    maxLength={1000}
                    aria-invalid={Boolean(dialogError)}
                    disabled={pendingId !== null}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shared with the requester and recorded in the approval history.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  Approving records your decision and removes this request from the pending queue.
                  The work item and its activity history are updated accordingly.
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDecision(null)}
                  disabled={pendingId !== null}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={decision.mode === "REJECTED" ? "destructive" : "default"}
                  onClick={submitDecision}
                  disabled={pendingId !== null || (decision.mode === "REJECTED" && !reason.trim())}
                >
                  {pendingId ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {decision.mode === "APPROVED" ? "Approve request" : "Reject request"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
