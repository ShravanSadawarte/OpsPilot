"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Approval } from "@/types/api";

export function ApprovalDecider({ approval }: { approval: Approval }) {
  const [deciding, setDeciding] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [reason, setReason] = useState("");

  async function decide(status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !reason.trim()) {
      alert("A reason is required for rejection.");
      return;
    }
    setDeciding(status);
    try {
      const res = await fetch(`/api/v1/approvals/${approval.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: status === "REJECTED" ? reason : undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert((json as { error?: { message?: string } })?.error?.message ?? "Decision failed");
        setDeciding(null);
        return;
      }
      window.location.reload();
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "Decision failed");
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
        {deciding === "APPROVED" ? (
          <span className="flex items-center gap-1">Approving…</span>
        ) : (
          "Approve"
        )}
      </Button>
      <Button
        disabled={deciding !== null}
        variant="destructive"
        onClick={() => decide("REJECTED")}
        className="w-auto"
      >
        {deciding === "REJECTED" ? "Rejecting…" : "Reject"}
      </Button>
    </div>
  );
}
