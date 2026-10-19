"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { getTeam, updateTeam } from "@/server/services/team.service";
import { z } from "zod";

const TeamUpdateSchema = z.object({
  key: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "teamId is required.");
  }
  return await getTeam(user, teamId);
});

export const PATCH = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "teamId is required.");
    }
    const body = TeamUpdateSchema.parse(await jsonBody(req));
    return await updateTeam(user, teamId, body);
  },
  { csrf: true },
);
