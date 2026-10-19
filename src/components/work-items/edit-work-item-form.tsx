"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { readApiError } from "@/lib/api-errors";
import { PRIORITIES, PRIORITY_LABELS, WORK_ITEM_TYPES, TYPE_LABELS } from "@/lib/status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, fieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export type EditMember = {
  id: string;
  user: { id: string; name: string | null; email: string; role: string };
  role: string;
};

type EditItem = {
  id: string;
  publicKey: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  assigneeId: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  dueDate: string | null;
  version: number;
  team: { id: string; key: string; name: string };
};

const schema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200, "Keep the title under 200 characters."),
  description: z.string().max(10000, "Keep the description under 10,000 characters."),
  type: z.enum(WORK_ITEM_TYPES),
  priority: z.enum(PRIORITIES),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

type EditValues = z.infer<typeof schema>;

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function EditWorkItemForm({
  item,
  members,
}: {
  item: EditItem;
  members: EditMember[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const submittingRef = useRef(false);

  const assigneeOptions = [...members];
  const currentAssignee = item.assignee;
  if (
    currentAssignee &&
    !assigneeOptions.some((membership) => membership.user.id === currentAssignee.id)
  ) {
    assigneeOptions.unshift({
      id: `inactive-${currentAssignee.id}`,
      user: { ...currentAssignee, role: "INACTIVE" },
      role: "INACTIVE",
    });
  }

  const form = useForm<EditValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      title: item.title,
      description: item.description ?? "",
      type: item.type as EditValues["type"],
      priority: item.priority as EditValues["priority"],
      assigneeId: item.assigneeId ?? "",
      dueDate: "",
    },
  });

  useEffect(() => {
    form.setValue("dueDate", toDateTimeLocal(item.dueDate));
  }, [form, item.dueDate]);

  const title = form.watch("title");
  const isDirty = form.formState.isDirty;

  async function onSubmit(values: EditValues) {
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

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await apiFetch(
        `/api/v1/work-items/${item.id}?workItemId=${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: values.title.trim(),
            description: values.description?.trim() ?? "",
            type: values.type,
            priority: values.priority,
            assigneeId: values.assigneeId || null,
            dueDate,
            version: item.version,
          }),
        },
      );

      if (!response.ok) {
        const parsedError = await readApiError(response, "Unable to save your changes.");
        if (parsedError.details) {
          for (const [field, messages] of Object.entries(parsedError.details)) {
            const key = field.split(".")[0] as keyof EditValues;
            if (key in form.getValues()) {
              form.setError(key, { message: messages[0] ?? "Check this field." });
            }
          }
        }
        if (parsedError.code === "VERSION_CONFLICT" || parsedError.code === "CONFLICT") {
          setConflict(true);
          toast({
            variant: "warning",
            title: "A newer version exists",
            description: "Your edits are preserved here. Review the latest version before saving.",
          });
          return;
        }
        setFormError(parsedError.message);
        toast({
          variant: "destructive",
          title: "Changes not saved",
          description: parsedError.message,
        });
        return;
      }

      toast({
        variant: "success",
        title: "Work item updated",
        description: `${item.publicKey} now reflects your changes.`,
      });
      router.push(`/work-items/${item.id}`);
      router.refresh();
    } catch {
      setFormError("We couldn’t reach the server. Your changes are preserved here.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const titleError = form.formState.errors.title?.message;
  const descriptionError = form.formState.errors.description?.message;
  const dueDateError = form.formState.errors.dueDate?.message;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="space-y-6">
        {conflict ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.07] p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Someone else updated this item
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your changes are still in this form. Open the latest version to compare, then
                  decide whether to reload or adjust your edits.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/work-items/${item.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Open latest
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmReload(true)}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Reload
              </Button>
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Work item details</CardTitle>
              <CardDescription>Changes are written atomically with a version check.</CardDescription>
            </div>
            {isDirty && !submitting ? (
              <span className="shrink-0 rounded-full border border-warning/25 bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning">
                Unsaved changes
              </span>
            ) : null}
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
              description={`${title.length}/200 characters`}
            >
              <Input
                {...form.register("title")}
                id="title"
                aria-invalid={Boolean(titleError)}
                aria-describedby={fieldIds("title", { error: titleError, description: true })}
                disabled={submitting}
                maxLength={200}
              />
            </Field>

            <Field
              id="description"
              label="Description"
              optional
              error={descriptionError}
              description="What happened, what has been checked, and what a good outcome looks like."
            >
              <Textarea
                {...form.register("description")}
                id="description"
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
                <Select {...form.register("type")} id="type" disabled={submitting}>
                  {WORK_ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field id="priority" label="Priority" required>
                <Select {...form.register("priority")} id="priority" disabled={submitting}>
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
                id="assigneeId"
                label="Assignee"
                optional
                description="Only active members of this team can be assigned."
              >
                <Select
                  {...form.register("assigneeId")}
                  id="assigneeId"
                  disabled={submitting}
                >
                  <option value="">Unassigned — the team can claim it</option>
                  {assigneeOptions.map((membership) => (
                    <option key={membership.user.id} value={membership.user.id}>
                      {membership.user.name ?? membership.user.email}
                      {membership.role === "INACTIVE"
                        ? " · inactive member"
                        : membership.role
                          ? ` · ${membership.role.replaceAll("_", " ").toLowerCase()}`
                          : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                id="dueDate"
                label="Due date"
                optional
                error={dueDateError}
                description="Leave empty to remove the due date."
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
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link href={`/work-items/${item.id}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Concurrency protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              This item is at revision{" "}
              <span className="font-mono font-medium text-foreground">v{item.version}</span>. Saving
              only succeeds if the server still has that revision, so two people cannot silently
              overwrite each other.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              If a conflict happens, your entries stay in the form and you can compare against the
              latest version before deciding what to keep.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Item context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Work item</span>
              <span className="font-mono font-medium">{item.publicKey}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Team</span>
              <span className="font-medium">
                {item.team.key} · {item.team.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Status</span>
              <Link
                href={`/work-items/${item.id}`}
                className="font-medium underline-offset-4 hover:text-primary hover:underline"
              >
                Managed in workflow actions
              </Link>
            </div>
          </CardContent>
        </Card>
      </aside>

      <Dialog open={confirmReload} onOpenChange={setConfirmReload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard your edits?</DialogTitle>
            <DialogDescription>
              Reloading fetches the latest version and replaces everything currently in this form.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmReload(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Reload latest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
