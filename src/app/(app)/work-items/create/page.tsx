"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(["INCIDENT", "CUSTOMER_ISSUE", "ENGINEERING_TASK", "PAYMENT_INVESTIGATION", "COMPLIANCE_REQUEST", "OPERATIONAL_TASK"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  teamId: z.string().uuid("Select a team"),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

type Team = { id: string; key: string; name: string };

export default function CreateWorkItemPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  const form = useForm<z.infer<typeof schema>>({
    defaultValues: { title: "", description: "", type: "OPERATIONAL_TASK", priority: "MEDIUM", teamId: "", assigneeId: undefined, dueDate: undefined },
  });

  async function loadTeams() {
    const res = await fetch("/api/v1/teams");
    if (res.ok) {
      const json = await res.json();
      setTeams(json.data?.items ?? []);
    }
  }

  // Load teams lazily
  if (teams.length === 0) loadTeams();

  async function onSubmit(values: z.infer<typeof schema>) {
    setLoading(true);
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await apiFetch("/api/v1/work-items", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
          "Idempotency-Fingerprint": JSON.stringify(values),
        },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({ variant: "destructive", title: "Duplicate submission", description: json.error?.message ?? "This request was already processed." });
        } else {
          toast({ variant: "destructive", title: "Error", description: json.error?.message ?? "Create failed" });
        }
        return;
      }
      const item = json.data;
      router.push(`/work-items/${item.id ?? item.publicKey}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Plus className="size-4" /> Create work item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} placeholder="e.g. Payment investigation for invoice #4829" />
              {form.formState.errors.title && <span className="text-xs text-destructive">{form.formState.errors.title.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select {...form.register("teamId")}>
                <option value="">Select a team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.key} — {t.name}</option>)}
              </Select>
              {form.formState.errors.teamId && <span className="text-xs text-destructive">{form.formState.errors.teamId.message}</span>}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea {...form.register("description")} placeholder="Describe the work to be done…" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select {...form.register("type")}>
                <option value="INCIDENT">Incident</option>
                <option value="CUSTOMER_ISSUE">Customer Issue</option>
                <option value="ENGINEERING_TASK">Engineering Task</option>
                <option value="PAYMENT_INVESTIGATION">Payment Investigation</option>
                <option value="COMPLIANCE_REQUEST">Compliance Request</option>
                <option value="OPERATIONAL_TASK">Operational Task</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select {...form.register("priority")}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due date</label>
              <Input {...form.register("dueDate")} type="datetime-local" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-auto">
            {loading ? "Creating…" : "Create work item"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Idempotency: a unique Idempotency-Key is sent with each submission so retries are safe.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
