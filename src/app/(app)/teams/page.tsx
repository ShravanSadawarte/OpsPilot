import { listTeams, addTeamMember, removeTeamMember } from "@/server/services/team.service";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await requireUser();
  const result = await listTeams(user);
  const teams = (result.data as any)?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Teams</h1>
          <p className="text-sm text-muted-foreground">Team directory and membership management.</p>
        </div>
        <Button><Plus className="size-4 mr-2" /> Create team</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="size-4" /> Team directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Members</TableHead>
                  <TableHead className="w-24">Your role</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length ? (
                  teams.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.key}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-xs">{t.memberCount}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">{t.userRole ?? "member"}</Badge>
                      </TableCell>
                      <TableCell>
                        <TeamMembers teamId={t.id} memberships={t.memberships} currentUserId={user.id} canManage={true} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No teams found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamMembers({ teamId, memberships, currentUserId, canManage }: any) {
  return (
    <div className="flex flex-col gap-1">
      {(memberships ?? []).map((m: any) => (
        <div key={m.id} className="flex items-center gap-2 text-xs">
          <span className="truncate max-w-[100px]">{m.user.name}</span>
          <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
          {canManage && m.userId !== currentUserId && (
            <button
              onClick={() => {
                if (window.confirm(`Remove ${m.user.name} from this team?`)) {
                  fetch(`/api/v1/teams/${teamId}/members?teamId=${teamId}&userId=${m.userId}`, { method: "DELETE" }).then(() => window.location.reload());
                }
              }}
              className="text-destructive hover:bg-destructive/10 rounded p-1"
              title="Remove"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
