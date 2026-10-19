"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { addTeamMember, removeTeamMember } from "@/server/services/team.service";
import { z } from "zod";

const MemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "TEAM_LEAD", "TEAM_MEMBER"]),
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });
    const body = MemberSchema.parse(await jsonBody(req));
    const result = await addTeamMember(user, teamId, {
      userId: body.userId,
      role: body.role,
    });
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);

export const DELETE = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  const userId = searchParams.get("userId");
  if (!teamId || !userId)
    return NextResponse.json({ error: "teamId and userId required" }, { status: 400 });
  const result = await removeTeamMember(user, teamId, userId);
  return NextResponse.json(result, { status: 200 });
}, { csrf: true });
