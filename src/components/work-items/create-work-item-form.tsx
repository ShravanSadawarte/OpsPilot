"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  WORK_ITEM_TYPES,
  TYPE_LABELS,
} from "@/lib/status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, fieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type TeamOption = { id: string; key: string; name: string };

type TeamMember = {
  id: string;
  user: { id: string; name: string | null; email: string; role: string };
  role: string;
};

const schema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Keep the title under 200 characters."),
  description: z.string().max(10000, "Keep the description under 10,000 characters.").optional(),
  type: z.enum(WORK_ITEM_TYPES),
  priority: z.enum(PRIORITIES),
  teamId: z.string().uuid("Select a team."),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

type CreateValues = z.infer<typeof schema>;

export function CreateWorkItemForm({ teams }: { teams: TeamOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [refreshMembersKey, setRefreshMembersKey] = useState(0);
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  const form = useForm<CreateValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      type: "OPERATIONAL_TASK",
      priority: "MEDIUM",
      teamId: teams.length === 1 ? teams[0].id : "",
      assigneeId: "",
      dueDate: "",
    },
  });

  const selectedTeamId = form.watch("teamId");
  const title = form.watch("title");

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      setMembersError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadMembers() {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const response = await apiFetch(
          `/api/v1/teams?teamId=${encodeURIComponent(selectedTeamId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const parsed = await readApiError(response, "Unable to load team members.");
          throw new Error(parsed.message);
        }
        const body = (await response.json()) as {
          data?: { team?: { memberships?: TeamMember[] } };
        };
        if (active) setMembers(body.data?.team?.memberships ?? []);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setMembers([]);
        setMembersError(
          loadError instanceof Error ? loadError.message : "Unable to load team members.",
        );
      } finally {
        if (active) setMembersLoading(false);
      }
    }

    void loadMembers();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedTeamId, refreshMembersKey]);

  async function onSubmit(values: CreateValues) {
    if (submittingRef.current) return;

    let dueDate: string | null = null;
    if (values.dueDate) {
      const parsed = new Date(values.dueDate);
      if (Number.isNaN(parsed.getTime())) {
        form.setError("dueDate", { message: "Enter a valid due date." });
        return;
      }
      dueDate = parsed.toISOString();
    }

    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() ? values.description.trim() : undefined,
      type: values.type,
      priority: values.priority,
      teamId: values.teamId,
      assigneeId: values.assigneeId || null,
      dueDate,
    };

    const signature = JSON.stringify(payload);
    if (!idempotencyRef.current || idempotencyRef.current.signature !== signature) {
      idempotencyRef.current = { signature, key: crypto.randomUUID() };
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await apiFetch("/api/v1/work-items", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyRef.current.key },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const parsedError = await readApiError(response, "Unable to create the work item.");
        if (parsedError.details) {
          for (const [field, messages] of Object.entries(parsedError.details)) {
            const key = field.split(".")[0] as keyof CreateValues;
            if (key in form.getValues()) {
              form.setError(key, { message: messages[0] ?? "Check this field." });
            }
          }
        }
        setFormError(parsedError.message);
        toast({
          variant: "destructive",
          title: "Work item not created",
          description: parsedError.message,
        });
        return;
      }

      const body = (await response.json()) as { data?: { id?: string; publicKey?: string } };
      const id = body.data?.id;
      toast({
        variant: "success",
        title: "Work item created",
        description: body.data?.publicKey
          ? `${body.data.publicKey} is now in the team queue.`
          : "The item is now in the team queue.",
      });
      if (id) {
        router.push(`/work-items/${id}`);
        router.refresh();
      } else {
        router.push("/work-items");
      }
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn’t reach the server. Your entries are preserved.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const titleError = form.formState.errors.title?.message;
  const descriptionError = form.formState.errors.description?.message;
  const teamError = form.formState.errors.teamId?.message;
  const dueDateError = form.formState.errors.dueDate?.message;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/work-items"
        backLabel="Work items"
        eyebrow={
          <>
            <Plus className="size-3.5" aria-hidden="true" />
            New work item
          </>
        }
        title="Create work item"
        description="Capture the work, route it to the right team, and give the next person enough context to act."
      />

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Work item details</CardTitle>
              <CardDescription>
                Start with a clear summary. Required fields are marked with an asterisk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {formError ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="leading-relaxed">{formError}</p>
                </div>
              ) : null}

              <Field
                id="title"
                label="Title"
                required
                error={titleError}
                description={`${title.length}/200 characters · Make it specific enough to search later.`}
              >
                <Input
                  {...form.register("title")}
                  id="title"
                  placeholder="e.g. Payment investigation for invoice #4829"
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={fieldIds("title", { error: titleError, description: true })}
                  disabled={submitting}
                  autoFocus
                  maxLength={200}
                />
              </Field>

              <Field
                id="description"
                label="Description"
                optional
                error={descriptionError}
                description="Include what happened, what you have checked, and what a good outcome looks like."
              >
                <Textarea
                  {...form.register("description")}
                  id="description"
                  placeholder="Add context for the team handling this work…"
                  className="min-h-36"
                  aria-invalid={Boolean(descriptionError)}
                  aria-describedby={fieldIds("description", {
                    error: descriptionError,
                    description: true,
                  })}
                  disabled={submitting}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="type" label="Type" required>
                  <Select
                    {...form.register("type")}
                    id="type"
                    disabled={submitting}
                  >
                    {WORK_ITEM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  id="priority"
                  label="Priority"
                  required
                  description="Use critical for active business impact."
                >
                  <Select
                    {...form.register("priority")}
                    id="priority"
                    disabled={submitting}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  id="teamId"
                  label="Team"
                  required
                  error={teamError}
                  description="The item is visible to active members of this team."
                >
                  <Select
                    {...form.register("teamId", {
                      onChange: () => form.setValue("assigneeId", ""),
                    })}
                    id="teamId"
                    aria-invalid={Boolean(teamError)}
                    aria-describedby={fieldIds("teamId", { error: teamError, description: true })}
                    disabled={submitting || teams.length === 0}
                  >
                    <option value="">
                      {teams.length === 0 ? "No assignable teams" : "Select a team"}
                    </option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.key} · {team.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  id="dueDate"
                  label="Due date"
                  optional
                  error={dueDateError}
                  description="Shown in team queues and used for overdue attention."
                >
                  <div className="relative">
                    <CalendarDays
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      {...form.register("dueDate")}
                      id="dueDate"
                      type="datetime-local"
                      className="pl-9"
                      aria-invalid={Boolean(dueDateError)}
                      aria-describedby={fieldIds("dueDate", {
                        error: dueDateError,
                        description: true,
                      })}
                      disabled={submitting}
                    />
                  </div>
                </Field>
              </div>

              <Field
                id="assigneeId"
                label="Assignee"
                optional
                description={
                  selectedTeamId
                    ? "Choose an active member of the selected team, or leave this unassigned."
                    : "Select a team first to see its active members."
                }
                error={membersError ?? undefined}
              >
                <Select
                  {...form.register("assigneeId")}
                  id="assigneeId"
                  disabled={!selectedTeamId || membersLoading || submitting || Boolean(membersError)}
                  aria-invalid={Boolean(membersError)}
                  aria-describedby={fieldIds("assigneeId", {
                    error: membersError,
                    description: true,
                  })}
                >
                  <option value="">
                    {membersLoading
                      ? "Loading team members…"
                      : membersError
                        ? "Members unavailable"
                        : "Unassigned — the team can claim it"}
                  </option>
                  {members.map((membership) => (
                    <option key={membership.user.id} value={membership.user.id}>
                      {membership.user.name ?? membership.user.email}
                      {membership.role ? ` · ${membership.role.replaceAll("_", " ").toLowerCase()}` : ""}
                    </option>
                  ))}
                </Select>
                {membersError ? (
                  <button
                    type="button"
                    onClick={() => setRefreshMembersKey((key) => key + 1)}
                    className="mt-1 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Retry loading members
                  </button>
                ) : null}
              </Field>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button asChild variant="outline" className="sm:w-auto">
              <Link href="/work-items">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={submitting || teams.length === 0}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Create work item
                </>
              )}
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardList className="size-4 text-primary" aria-hidden="true" />
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  icon: Plus,
                  title: "Added to the team queue",
                  description: "The item receives a public key and starts in Open status.",
                },
                {
                  icon: Users,
                  title: "Routed to your team",
                  description: "Active members can view it, comment, and pick up the work.",
                },
                {
                  icon: CheckCircle2,
                  title: "Activity is recorded",
                  description: "Creation is written to the audit trail in the same transaction.",
                },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-xs font-medium">
                <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                Safe submission
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                A per-submission idempotency key prevents duplicate work items if the request is
                retried after a network interruption. Server-side validation remains the source of
                truth.
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Your entries stay in this form if validation or the network fails.
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>
    </div>
  );
}
