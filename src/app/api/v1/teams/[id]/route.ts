"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { getTeam, updateTeam } from "@/server/services/team.service";
import { z } from "zod";

const TeamUpdateSchema = z.object({
  key: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const GET = withAuth(async (_user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
  const result = await getTeam(_user, teamId);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    const body = TeamUpdateSchema.parse(await jsonBody(req));
    const result = await updateTeam(user, teamId, body);
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);
