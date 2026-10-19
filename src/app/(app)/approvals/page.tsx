import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canDecideApproval } from "@/lib/permissions";
import { listPendingApprovals } from "@/server/services/approval.service";
import type { Approval } from "@/types/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  ApprovalQueue,
  type ApprovalQueueItem,
} from "@/components/approvals/approval-queue";

export const metadata: Metadata = {
  title: "Approvals",
};

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireUser();
  const result = await listPendingApprovals(user);
  const approvals = ((await result.json()).data as Approval[]) ?? [];

  const items: ApprovalQueueItem[] = await Promise.all(
    approvals.map(async (approval) => {
      const isOwnRequest = approval.requestedBy.id === user.id;
      const canDecide = await canDecideApproval(user, {
        workItem: { teamId: approval.workItem.teamId ?? "" },
        requestedById: approval.requestedBy.id,
      });

      return {
        ...approval,
        canDecide,
        blockedReason: canDecide
          ? null
          : isOwnRequest
            ? "You requested this approval. Another team lead, manager, or administrator must decide."
            : "Your role can view this queue, but only team leads, managers, and administrators can decide.",
      };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Approval queue"
        description="Requests waiting on a decision. Approvals and rejections are recorded against the work item’s activity history."
        actions={
          <Button asChild variant="outline">
            <Link href="/work-items">Open work queue</Link>
          </Button>
        }
      />
      <ApprovalQueue initialApprovals={items} />
    </div>
  );
}
