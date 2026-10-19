import { getWorkItem, listActivity } from "@/server/services/workItem.service";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkItemActions } from "@/components/work-items/actions";
import { CommentThread } from "@/components/work-items/comment-thread";
import { ActivityTimeline } from "@/components/work-items/activity-timeline";

export default async function WorkItemDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const result = await getWorkItem(user, params.id);
  const item = result.data as any;

  const activityResult = await listActivity(user, params.id, { page: 1, pageSize: 50 });
  const activity = activityResult.data as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{item.title}</h1>
          <p className="text-sm text-muted-foreground">{item.publicKey} · {item.type}</p>
        </div>
        <WorkItemActions item={item} user={user} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <p className="text-muted-foreground">Description</p>
                <p className="text-foreground whitespace-pre-wrap">{item.description ?? "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="flex flex-col gap-1"><span>Status</span><span className="text-foreground">{item.status}</span></div>
                <div className="flex flex-col gap-1"><span>Priority</span><span className="text-foreground">{item.priority}</span></div>
                <div className="flex flex-col gap-1"><span>Type</span><span className="text-foreground">{item.type}</span></div>
                <div className="flex flex-col gap-1"><span>Team</span><span className="text-foreground">{item.team.key}</span></div>
                <div className="flex flex-col gap-1"><span>Assignee</span><span className="text-foreground">{item.assignee?.name ?? "Unassigned"}</span></div>
                <div className="flex flex-col gap-1"><span>Reporter</span><span className="text-foreground">{item.reporter.name}</span></div>
                <div className="flex flex-col gap-1"><span>Version</span><span className="text-foreground">v{item.version}</span></div>
              </div>
              {item.dueDate && (
                <div className="pt-3 border-t"><span className="text-xs text-muted-foreground">Due date</span><p className="text-sm">{new Date(item.dueDate).toLocaleDateString()}</p></div>
              )}
            </CardContent>
          </Card>

          <CommentThread workItemId={item.id} />
        </div>

        <div className="lg:col-span-1">
          <ActivityTimeline events={activity.items} />
        </div>
      </div>
    </div>
  );
}
