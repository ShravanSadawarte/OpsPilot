"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
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
    if (!teamId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "teamId is required.");
    }
    const body = MemberSchema.parse(await jsonBody(req));
    return await addTeamMember(user, teamId, {
      userId: body.userId,
      role: body.role,
    });
  },
  { csrf: true },
);

export const DELETE = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const userId = searchParams.get("userId");
    if (!teamId || !userId) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        "teamId and userId are required.",
      );
    }
    return await removeTeamMember(user, teamId, userId);
  },
  { csrf: true },
);
