"use server";

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { teamWorkOverview } from "@/server/services/team.service";

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "teamId is required.");
  }
  return await teamWorkOverview(user, teamId);
});
