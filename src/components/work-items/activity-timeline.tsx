"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User } from "lucide-react";

export function ActivityTimeline({ events }: { events: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="size-4" /> Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length ? (
          events.map((e) => (
            <div key={e.id} className="flex gap-3">
              <div className="shrink-0"><User className="size-3.5 text-muted-foreground" /></div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                <p className="text-sm">{e.actor?.name ?? "System"} — {e.type.replace(/_/g, " ")}</p>
                {e.metadata && (
                  <p className="text-xs text-muted-foreground truncate">{JSON.stringify(e.metadata).slice(0, 120)}</p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
