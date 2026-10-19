"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { ArrowLeft, RefreshCw } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(["INCIDENT", "CUSTOMER_ISSUE", "ENGINEERING_TASK", "PAYMENT_INVESTIGATION", "COMPLIANCE_REQUEST", "OPERATIONAL_TASK"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  version: z.number().int(),
});

export default function EditWorkItemPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<number | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", type: "OPERATIONAL_TASK", priority: "MEDIUM", status: "OPEN", assigneeId: undefined, dueDate: undefined, version: 1 },
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/work-items?workItemId=${params.id}`);
    if (!res.ok) { router.push("/work-items"); return; }
    const json = await res.json();
    const item = json.data;
    setServerVersion(item.version);
    form.reset({
      title: item.title,
      description: item.description ?? "",
      type: item.type,
      priority: item.priority,
      status: item.status,
      assigneeId: item.assignee?.id ?? undefined,
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : undefined,
      version: item.version,
    });
  }, [params.id, form, router]);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(values: z.infer<typeof schema>) {
    setLoading(true);
    setConflict(null);
    try {
      const res = await apiFetch(`/api/v1/work-items?workItemId=${params.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setConflict(json.error?.message ?? "This work item was updated by another user. Your edits are preserved—refresh and reapply.");
          toast({ variant: "destructive", title: "Conflict", description: json.error?.message ?? "Version conflict" });
        } else {
          toast({ variant: "destructive", title: "Error", description: json.error?.message ?? "Update failed" });
        }
        return;
      }
      router.push(`/work-items/${params.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  function refreshAndReapply() {
    window.location.reload();
  }

  if (!serverVersion) return null;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild onClick={() => router.push(`/work-items/${params.id}`)} variant="outline" size="sm">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </div>
        <CardTitle>Edit work item</CardTitle>
      </CardHeader>
      {conflict && (
        <div className="p-3 mb-4 rounded-md border border-destructive/50 bg-destructive/50 text-xs text-destructive">
          {conflict}&nbsp;
          <button onClick={refreshAndReapply} className="ml-2 underline">Refresh</button>
          <span className="ml-2 text-normal">— your edits are preserved below.</span>
        </div>
      )}
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} disabled={loading} />
              {form.formState.errors.title && <span className="text-xs text-destructive">{form.formState.errors.title.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select {...form.register("status")} disabled={loading}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea {...form.register("description")} placeholder="…" disabled={loading} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select {...form.register("priority")} disabled={loading}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Select {...form.register("assigneeId")} disabled={loading}>
                <option value="">Unassigned</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due date</label>
              <Input {...form.register("dueDate")} type="datetime-local" disabled={loading} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Version: {form.getValues("version")}</span>
            <Button type="button" variant="ghost" size="sm" onClick={refreshAndReapply} disabled={loading}>
              <RefreshCw className="size-3 mr-1" /> Refresh
            </Button>
          </div>
          <Button type="submit" disabled={loading} className="w-auto">
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
