"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { teamWorkOverview } from "@/server/services/team.service";

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
  const result = await teamWorkOverview(user, teamId);
  return NextResponse.json(result, { status: 200 });
});
