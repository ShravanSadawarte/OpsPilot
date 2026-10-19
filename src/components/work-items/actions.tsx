"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { ArrowRight, UserPlus } from "lucide-react";

const transitionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  version: z.number().int(),
});

const assignSchema = z.object({
  assigneeId: z.string().optional(),
  version: z.number().int(),
});

type Status = string;

export function WorkItemActions({ item, user }: { item: any; user: any }) {
  const [openTransition, setOpenTransition] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const { toast } = useToast();

  const transForm = useForm<z.infer<typeof transitionSchema>>({
    resolver: zodResolver(transitionSchema),
    defaultValues: { status: item.status, version: item.version },
  });

  const assignForm = useForm<z.infer<typeof assignSchema>>({
    resolver: zodResolver(assignSchema),
    defaultValues: { assigneeId: item.assignee?.id ?? "", version: item.version },
  });

  async function transition(nextStatus: string) {
    transForm.setValue("status", nextStatus);
    transForm.setValue("version", item.version);
    const valid = await transForm.validate();
    if (valid) {
      setOpenTransition(true);
    }
  }

  async function submitTransition(values: z.infer<typeof transitionSchema>) {
    try {
      const res = await apiFetch(`/api/v1/work-items/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ status: values.status, version: values.version }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setConflict(json.error?.message ?? "Conflict");
          toast({ variant: "destructive", title: "Conflict", description: json.error?.message ?? "Your changes conflict with a newer update. Refresh and reapply." });
        } else {
          toast({ variant: "destructive", title: "Error", description: json.error?.message ?? "Transition failed" });
        }
        return;
      }
      setOpenTransition(false);
      window.location.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  }

  async function submitAssign(values: z.infer<typeof assignSchema>) {
    try {
      const res = await apiFetch(`/api/v1/work-items/${item.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeId: values.assigneeId || null, version: values.version }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({ variant: "destructive", title: "Conflict", description: json.error?.message ?? "Assignment conflict" });
        } else {
          toast({ variant: "destructive", title: "Error", description: json.error?.message ?? "Assignment failed" });
        }
        return;
      }
      setOpenAssign(false);
      window.location.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    }
  }

  const statusOptions: Status[] = ["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((s) => (
          <Button
            key={s}
            onClick={() => transition(s)}
            disabled={s === item.status}
            variant={s === item.status ? "outline" : "default"}
            size="sm"
            className={s === "RESOLVED" || s === "CLOSED" ? "bg-secondary text-secondary-foreground" : undefined}
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
          <DialogDescription>Move "{item.title}" to a new status.</DialogDescription>
          <Form {...transForm}>
            <form onSubmit={transForm.handleSubmit(submitTransition)} className="space-y-4">
              <FormField
                control={transForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        {statusOptions.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transForm.control}
                name="version"
                render={({ field }) => <Input type="hidden" {...field} />}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpenTransition(false)}>
                  Cancel
                </Button>
                <Button type="submit">Transition</Button>
              </div>
            </form>
          </Form>
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
          <DialogDescription>Assign "{item.title}" to a team member.</DialogDescription>
          <Form {...assignForm}>
            <form onSubmit={assignForm.handleSubmit(submitAssign)} className="space-y-4">
              <FormField
                control={assignForm.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <option value="">Unassign</option>
                        <option value="current-user">Me ({user.name})</option>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={assignForm.control}
                name="version"
                render={({ field }) => <Input type="hidden" {...field} />}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpenAssign(false)}>
                  Cancel
                </Button>
                <Button type="submit">Assign</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {conflict && (
        <div className="rounded-md border border-destructive/50 bg-destructive/50 p-3 text-xs text-destructive">
          {conflict}
          <button
            onClick={() => { setConflict(null); window.location.reload(); }}
            className="ml-2 underline text-sm"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
