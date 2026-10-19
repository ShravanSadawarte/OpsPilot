"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import {
  getWorkItem,
  updateWorkItem,
  transitionWorkItem,
} from "@/server/services/workItem.service";
import { UpdateWorkItemSchema } from "@/lib/validation";
import { z } from "zod";

const transitionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  version: z.number().int().nonnegative(),
});

export const GET = withAuth(async (user, req: NextRequest) => {
  const workItemId = new URL(req.url).searchParams.get("workItemId");
  if (!workItemId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
  }
  return await getWorkItem(user, workItemId);
});

export const PATCH = withAuth(
  async (user, req: NextRequest) => {
    const workItemId = new URL(req.url).searchParams.get("workItemId");
    if (!workItemId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
    }
    const body = UpdateWorkItemSchema.parse(await jsonBody(req));
    return await updateWorkItem(user, workItemId, body);
  },
  { csrf: true },
);

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const workItemId = new URL(req.url).searchParams.get("workItemId");
    if (!workItemId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
    }
    const body = transitionSchema.parse(await jsonBody(req));
    return await transitionWorkItem(user, workItemId, body);
  },
  { csrf: true },
);
