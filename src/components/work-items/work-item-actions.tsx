"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  Pencil,
  UserPlus,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import {
  isKnownStatus,
  STATUS_TRANSITIONS,
  statusLabel,
  type WorkItemStatus,
} from "@/lib/status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/components/ui/toast";

export type ActionMember = {
  id: string;
  user: { id: string; name: string | null; email: string; role: string };
  role: string;
};

type ActionItem = {
  id: string;
  publicKey: string;
  title: string;
  status: string;
  version: number;
  assigneeId: string | null;
};

type Permissions = {
  canEdit: boolean;
  canTransition: boolean;
  canAssign: boolean;
  canRequestApproval: boolean;
  canClaim: boolean;
};

export function WorkItemActions({
  item,
  members,
  permissions,
  pendingApproval,
}: {
  item: ActionItem;
  members: ActionMember[];
  permissions: Permissions;
  pendingApproval: { id: string; requestedBy: { name: string | null; email: string } } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState<"status" | "assign" | "approval" | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transitions: WorkItemStatus[] = isKnownStatus(item.status)
    ? STATUS_TRANSITIONS[item.status]
    : [];

  const initialTransition = transitions[0] ?? "OPEN";
  const [nextStatus, setNextStatus] = useState<WorkItemStatus>(initialTransition);
  const [assigneeId, setAssigneeId] = useState(item.assigneeId ?? "");

  function open(next: "status" | "assign" | "approval") {
    setError(null);
    if (next === "status") setNextStatus(transitions[0] ?? "OPEN");
    if (next === "assign") setAssigneeId(item.assigneeId ?? "");
    setOpenDialog(next);
  }

  async function handleActionError(response: Response, fallback: string) {
    const parsed = await readApiError(response, fallback);
    if (parsed.code === "VERSION_CONFLICT" || parsed.code === "CONFLICT") {
      setOpenDialog(null);
      toast({
        variant: "destructive",
        title: "This item changed",
        description: `${parsed.message} The latest version is loading now.`,
      });
      router.refresh();
      return;
    }
    setError(parsed.message);
  }

  async function submitStatus() {
    if (pendingAction) return;
    setPendingAction("status");
    setError(null);
    try {
      const response = await apiFetch(
        `/api/v1/work-items/${item.id}?workItemId=${encodeURIComponent(item.id)}`,
        {
          method: "POST",
          body: JSON.stringify({ status: nextStatus, version: item.version }),
        },
      );
      if (!response.ok) {
        await handleActionError(response, "Unable to change the status.");
        return;
      }
      setOpenDialog(null);
      toast({
        variant: "success",
        title: "Status updated",
        description: `${item.publicKey} is now ${statusLabel(nextStatus)}.`,
      });
      router.refresh();
    } catch {
      setError("We couldn’t reach the server. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitAssignment() {
    if (pendingAction) return;
    setPendingAction("assign");
    setError(null);
    try {
      const response = await apiFetch(
        `/api/v1/work-items/${item.id}/assign?workItemId=${encodeURIComponent(item.id)}`,
        {
          method: "POST",
          body: JSON.stringify({
            assigneeId: assigneeId || null,
            version: item.version,
          }),
        },
      );
      if (!response.ok) {
        await handleActionError(response, "Unable to update the assignee.");
        return;
      }
      setOpenDialog(null);
      toast({
        variant: "success",
        title: assigneeId ? "Work item assigned" : "Assignment removed",
        description: assigneeId
          ? `${item.publicKey} is now assigned.`
          : `${item.publicKey} is unassigned.`,
      });
      router.refresh();
    } catch {
      setError("We couldn’t reach the server. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function claimItem() {
    if (pendingAction) return;
    setPendingAction("claim");
    try {
      const response = await apiFetch(
        `/api/v1/work-items/${item.id}/claim?workItemId=${encodeURIComponent(item.id)}`,
        {
          method: "POST",
          body: JSON.stringify({ version: item.version }),
        },
      );
      if (!response.ok) {
        await handleActionError(response, "Unable to claim this item.");
        return;
      }
      toast({
        variant: "success",
        title: "Work item claimed",
        description: `${item.publicKey} is now assigned to you.`,
      });
      router.refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Claim failed",
        description: "We couldn’t reach the server. Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function requestApproval() {
    if (pendingAction) return;
    setPendingAction("approval");
    setError(null);
    try {
      const response = await apiFetch("/api/v1/approvals", {
        method: "POST",
        body: JSON.stringify({ workItemId: item.id }),
      });
      if (!response.ok) {
        await handleActionError(response, "Unable to request approval.");
        return;
      }
      setOpenDialog(null);
      toast({
        variant: "success",
        title: "Approval requested",
        description: "The request is now in the approval queue.",
      });
      router.refresh();
    } catch {
      setError("We couldn’t reach the server. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  const hasActions =
    (permissions.canTransition && transitions.length > 0) ||
    permissions.canEdit ||
    (permissions.canAssign && members.length > 0) ||
    permissions.canClaim ||
    permissions.canRequestApproval ||
    Boolean(pendingApproval);

  if (!hasActions) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {permissions.canTransition && transitions.length > 0 ? (
        <Button type="button" onClick={() => open("status")}>
          Change status
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      ) : null}

      {permissions.canAssign && members.length > 0 ? (
        <Button type="button" variant="outline" onClick={() => open("assign")}>
          <UserPlus className="size-4" aria-hidden="true" />
          {item.assigneeId ? "Reassign" : "Assign"}
        </Button>
      ) : null}

      {permissions.canClaim && !item.assigneeId ? (
        <Button
          type="button"
          variant="outline"
          onClick={claimItem}
          disabled={pendingAction !== null}
        >
          {pendingAction === "claim" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
          Claim
        </Button>
      ) : null}

      {permissions.canEdit ? (
        <Button asChild variant="outline">
          <Link href={`/work-items/${item.id}/edit`}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
      ) : null}

      {pendingApproval ? (
        <Button asChild variant="outline" className="border-warning/30 text-warning hover:text-warning">
          <Link href="/approvals">
            <Clock3 className="size-4" aria-hidden="true" />
            Approval pending
          </Link>
        </Button>
      ) : permissions.canRequestApproval ? (
        <Button type="button" variant="outline" onClick={() => open("approval")}>
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Request approval
        </Button>
      ) : null}

      <Dialog open={openDialog === "status"} onOpenChange={(open) => setOpenDialog(open ? "status" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Choose the next status for {item.publicKey}. Only valid workflow transitions are shown.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{error}</p>
            </div>
          ) : null}

          <div role="radiogroup" aria-label="Next status" className="grid gap-2">
            {transitions.map((status) => (
              <label
                key={status}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
                  nextStatus === status
                    ? "border-primary/40 bg-accent/60"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="next-status"
                    value={status}
                    checked={nextStatus === status}
                    onChange={() => setNextStatus(status)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <StatusBadge status={status} />
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {status === "CLOSED" ? "Stop work on this item" : "Move work forward"}
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitStatus} disabled={pendingAction !== null}>
              {pendingAction === "status" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "assign"} onOpenChange={(open) => setOpenDialog(open ? "assign" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update assignee</DialogTitle>
            <DialogDescription>
              Choose an active member of this team, or leave the item unassigned for the team to claim.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{error}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="assignee" className="text-[13px] font-medium">
              Assignee
            </label>
            <Select
              id="assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((membership) => (
                <option key={membership.user.id} value={membership.user.id}>
                  {membership.user.name ?? membership.user.email}
                  {membership.role
                    ? ` · ${membership.role.replaceAll("_", " ").toLowerCase()}`
                    : ""}
                </option>
              ))}
            </Select>
            {assigneeId ? (
              <div className="flex items-center gap-2 pt-1">
                <UserAvatar
                  name={
                    members.find((membership) => membership.user.id === assigneeId)?.user.name ??
                    null
                  }
                  email={
                    members.find((membership) => membership.user.id === assigneeId)?.user.email
                  }
                  size="xs"
                />
                <span className="text-[11px] text-muted-foreground">
                  {members.find((membership) => membership.user.id === assigneeId)?.user.name ??
                    members.find((membership) => membership.user.id === assigneeId)?.user.email}
                </span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitAssignment} disabled={pendingAction !== null}>
              {pendingAction === "assign" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save assignee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog === "approval"}
        onOpenChange={(open) => setOpenDialog(open ? "approval" : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request approval</DialogTitle>
            <DialogDescription>
              This sends {item.publicKey} to the approval queue for a team lead, manager, or
              administrator to decide.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{error}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Only one approval can be pending per work item. The request and the decision are recorded
            in the activity history.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={requestApproval} disabled={pendingAction !== null}>
              {pendingAction === "approval" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
