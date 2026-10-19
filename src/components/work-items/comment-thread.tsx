"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { MessageCircle, Clock, User } from "lucide-react";

export function CommentThread({ workItemId }: { workItemId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/work-items/${workItemId}/comments?workItemId=${workItemId}`);
    if (res.ok) {
      const json = await res.json();
      setComments(json.data?.items ?? []);
    }
  }, [workItemId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/work-items/${workItemId}/comments?workItemId=${workItemId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast({ variant: "destructive", title: "Error", description: json.error?.message });
        return;
      }
      setBody("");
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircle className="size-4" /> Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {comments.length ? (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 pt-3 border-t border-border">
                <div className="shrink-0">
                  <User className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{c.author?.name ?? "Unknown"} · {new Date(c.createdAt).toLocaleString()}</p>
                  <p className="text-sm">{c.body}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-border pt-4 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="h-24 resize-none"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !body.trim()} className="w-auto">
            Add comment
          </Button>
          {loading && <span className="text-xs text-muted-foreground">Posting…</span>}
        </form>
      </CardContent>
    </Card>
  );
}
