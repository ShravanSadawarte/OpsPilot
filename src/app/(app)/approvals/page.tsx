import { listPendingApprovals } from "@/server/services/approval.service";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { ApprovalDecider } from "@/components/approvals/approval-decider";
import type { Approval } from "@/types/api";

export default async function ApprovalsPage() {
  const user = await requireUser();
  const result = await listPendingApprovals(user);
  const approvals = ((await result.json()).data as Approval[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Approval queue</h1>
      <p className="text-sm text-muted-foreground">
        Review and decide on pending approval requests.
      </p>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Clock className="mx-auto size-8 mb-3 opacity-50" />
            <p>No pending approvals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex-1">
                  <CardTitle className="text-sm">{a.workItem.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {a.workItem.publicKey} · requested by {a.requestedBy.name}
                  </p>
                </div>
                <Badge variant="outline">Pending</Badge>
              </CardHeader>
              <CardContent>
                <ApprovalDecider approval={a} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
