import { listPendingApprovals } from "@/server/services/approval.service";
import { requireUser } from "@/lib/auth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireUser();
  const result = await listPendingApprovals(user);
  const approvals = (result.data as any) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Approval queue</h1>
      <p className="text-sm text-muted-foreground">Review and decide on pending approval requests.</p>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <Clock className="mx-auto size-8 mb-3 opacity-50" />
            <p>No pending approvals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((a: any) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex-1">
                  <CardTitle className="text-sm">{a.workItem.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{a.workItem.publicKey} · requested by {a.requestedBy.name}</p>
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

function ApprovalDecider({ approval }: { approval: any }) {
  const [deciding, setDeciding] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [reason, setReason] = useState("");

  async function decide(status: "APPROVED" | "REJECTED") {
    setDeciding(status);
    try {
      const res = await fetch(`/api/v1/approvals/${approval.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: status === "REJECTED" ? reason : undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error?.message ?? "Decision failed");
        setDeciding(null);
        return;
      }
      window.location.reload();
    } catch (e: any) {
      alert(e?.message);
      setDeciding(null);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 space-y-2">
        {deciding === "REJECTED" && (
          <div>
            <label className="text-xs font-medium block">Rejection reason (required)</label>
            <textarea
              className="w-full border rounded p-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
      </div>
      <Button disabled={deciding !== null} onClick={() => decide("APPROVED")} className="w-auto">
        {deciding === "APPROVED" ? <span className="flex items-center gap-1"><Check className="size-4" /> Approving…</span> : <span className="flex items-center gap-1"><Check className="size-4" /> Approve</span>}
      </Button>
      <Button
        disabled={deciding !== null}
        variant="destructive"
        onClick={() => {
          if (!reason.trim()) { alert("A reason is required for rejection."); return; }
          decide("REJECTED");
        }}
        className="w-auto"
      >
        {deciding === "REJECTED" ? <span className="flex items-center gap-1"><X className="size-4" /> Rejecting…</span> : <span className="flex items-center gap-1"><X className="size-4" /> Reject</span>}
      </Button>
    </div>
  );
}

