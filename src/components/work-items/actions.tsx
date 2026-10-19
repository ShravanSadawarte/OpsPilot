"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { ArrowRight, UserPlus } from "lucide-react";

type Item = {
  id: string;
  publicKey: string;
  title: string;
  status: string;
  version: number;
  assignee: { id: string; name: string } | null;
};

export function WorkItemActions({ item, user }: { item: Item; user: any }) {
  const [openTransition, setOpenTransition] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const { toast } = useToast();

  const transForm = useForm<{ status: string; version: number }>({
    defaultValues: { status: item.status, version: item.version },
  });
  const assignForm = useForm<{ assigneeId: string; version: number }>({
    defaultValues: { assigneeId: item.assignee?.id ?? "", version: item.version },
  });

  async function submitTransition(values: { status: string; version: number }) {
    try {
      const res = await apiFetch(`/api/v1/work-items/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ status: values.status, version: values.version }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          const json = await res.json();
          toast({ variant: "destructive", title: "Conflict", description: json.error?.message ?? "Version conflict" });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Transition failed" });
        }
        return;
      }
      setOpenTransition(false);
      window.location.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  }

  async function submitAssign(values: { assigneeId: string; version: number }) {
    try {
      const res = await apiFetch(`/api/v1/work-items/${item.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeId: values.assigneeId || null, version: values.version }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          const json = await res.json();
          toast({ variant: "destructive", title: "Conflict", description: json.error?.message ?? "Assignment conflict" });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Assignment failed" });
        }
        return;
      }
      setOpenAssign(false);
      window.location.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  }

  const statusOptions = ["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((s) => (
          <Button
            key={s}
            onClick={() => {
              transForm.setValue("status", s);
              transForm.setValue("version", item.version);
              setOpenTransition(true);
            }}
            disabled={s === item.status}
            variant={s === item.status ? "outline" : "default"}
            size="sm"
          >
            {s}
          </Button>
        ))}
      </div>

      <Dialog open={openTransition} onOpenChange={setOpenTransition}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowRight className="size-4 mr-2" /> Change status
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Transition status</DialogTitle>
          <DialogDescription>Move &quot;{item.title}&quot; to a new status.</DialogDescription>
          <form onSubmit={transForm.handleSubmit(submitTransition)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">Status</label>
              <Select
                onChange={(e) => transForm.setValue("status", e.target.value)}
                value={transForm.getValues("status")}
              >
                {statusOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
              <Input type="hidden" {...transForm.register("version")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenTransition(false)}>
                Cancel
              </Button>
              <Button type="submit">Transition</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openAssign} onOpenChange={setOpenAssign}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <UserPlus className="size-4 mr-2" /> Assign
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Assign owner</DialogTitle>
          <DialogDescription>Assign &quot;{item.title}&quot; to a team member.</DialogDescription>
          <form onSubmit={assignForm.handleSubmit(submitAssign)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium block">Assignee</label>
              <Select
                onChange={(e) => assignForm.setValue("assigneeId", e.target.value)}
                value={assignForm.getValues("assigneeId")}
              >
                <option value="">Unassigned</option>
                <option value="current-user">Me ({user.name})</option>
              </Select>
              <Input type="hidden" {...assignForm.register("version")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenAssign(false)}>
                Cancel
              </Button>
              <Button type="submit">Assign</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
