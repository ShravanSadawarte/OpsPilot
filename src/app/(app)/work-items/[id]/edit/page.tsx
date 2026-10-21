import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/http";
import { canAssignWorkItem, canEditWorkItem } from "@/lib/permissions";
import { getWorkItem } from "@/server/services/workItem.service";
import { getTeam } from "@/server/services/team.service";
import type { WorkItem } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  EditWorkItemForm,
  type EditMember,
} from "@/components/work-items/edit-work-item-form";

export const metadata: Metadata = {
  title: "Edit work item",
};

export const dynamic = "force-dynamic";

export default async function EditWorkItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let item: WorkItem;
  try {
    const result = await getWorkItem(user, id);
    item = (await result.json()).data as WorkItem;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const canEdit = await canEditWorkItem(user, item);
  if (!canEdit) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <Card>
          <CardHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-xl border border-border bg-muted text-muted-foreground">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <CardTitle>You can view this item, but not edit it</CardTitle>
            <CardDescription>
              Editing is limited to the reporter, the assignee, team leads, managers, and
              administrators. You can still comment, claim unassigned work, and follow the activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/work-items/${item.id}`}>Back to work item</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/work-items">Open work queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teamResult = await getTeam(user, item.teamId);
  const teamBody = (await teamResult.json()) as {
    data?: { team?: { memberships?: EditMember[] } };
  };
  const members = teamBody.data?.team?.memberships ?? [];
  const canAssign = await canAssignWorkItem(user, { teamId: item.teamId }, null);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/work-items/${item.id}`}
        backLabel={`Back to ${item.publicKey}`}
        eyebrow={<span className="font-mono text-[11px]">Editing {item.publicKey}</span>}
        title="Edit work item"
        description="Update the details your team relies on. Status changes stay in the workflow actions so every move is validated."
      />
      <EditWorkItemForm
        item={{
          id: item.id,
          publicKey: item.publicKey,
          title: item.title,
          description: item.description,
          type: item.type,
          priority: item.priority,
          assigneeId: item.assigneeId,
          assignee: item.assignee,
          dueDate: item.dueDate,
          version: item.version,
          team: item.team,
        }}
        members={members}
        canAssign={canAssign}
      />
    </div>
  );
}
