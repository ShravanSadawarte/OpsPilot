import { dashboardMetrics } from "@/server/services/dashboard.service";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await requireUser();
  const result = await dashboardMetrics(user);
  const data = result.data as any;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Open work" value={data.openWork} subtitle="Not resolved or closed" />
        <MetricCard title="Critical & high" value={data.criticalHighWork} subtitle="High priority open work" variant="destructive" />
        <MetricCard title="Overdue" value={data.overdueWork} subtitle="Due date passed" variant="destructive" />
        <MetricCard title="Unassigned" value={data.unassignedWork} subtitle="Needs an owner" />
        <MetricCard title="My work" value={data.myWork} subtitle="Assigned to you" />
        <MetricCard title="Pending approvals" value={data.pendingApprovals} subtitle="Awaiting decision" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Status summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.statusSummary ?? []).map((s: any) => (
                <div key={s.status} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Priority summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.prioritySummary ?? []).map((p: any) => (
                <div key={p.priority} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{p.priority}</span>
                  <Badge variant={priorityVariant(p.priority)}>{p.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="col-span-1 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Attention required</CardTitle>
              <CardDescription>Open items that are unassigned, overdue, or critical.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.attentionRequired?.length ? (
                <ul className="space-y-3">
                  {(data.attentionRequired as any[]).map((w: any) => (
                    <li key={w.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      <span className="text-xs font-mono text-muted-foreground">{w.publicKey}</span>
                      <span className="flex-1 text-sm">{w.title}</span>
                      <Badge variant={priorityVariant(w.priority)}>{w.priority}</Badge>
                      {w.dueDate ? <span className="text-xs text-muted-foreground">Due {new Date(w.dueDate).toLocaleDateString()}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing requires immediate attention.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentActivity?.length ? (
                <ul className="space-y-3">
                  {(data.recentActivity as any[]).map((e: any) => (
                    <li key={e.id} className="flex items-start gap-3 text-sm">
                      <span className="text-muted-foreground shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
                      <div className="flex-1">
                        <p className="text-sm">{e.actor?.name ?? "System"} — {e.type}</p>
                        {e.workItem && <p className="text-xs text-muted-foreground">{e.workItem.publicKey} — {e.workItem.title}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  variant,
}: {
  title: string;
  value: number;
  subtitle: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Badge variant={variant === "destructive" ? "destructive" : "secondary"}>{value}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function priorityVariant(p: string) {
  switch (p) {
    case "CRITICAL": return "destructive";
    case "HIGH": return "default";
    case "MEDIUM": return "outline";
    default: return "secondary";
  }
}
