"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import {
  listTeams,
  getTeam,
  createTeam,
} from "@/server/services/team.service";
import { validateInput, TeamSchema } from "@/lib/validation";

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("teamId")) {
    const result = await getTeam(user, searchParams.get("teamId")!);
    return NextResponse.json(result, { status: 200 });
  }
  const result = await listTeams(user);
  return NextResponse.json(result, { status: 200 });
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const body = validateInput(TeamSchema, await jsonBody(req));
    const result = await createTeam(user, body);
    return NextResponse.json(result, { status: 201 });
  },
  { csrf: true },
);
