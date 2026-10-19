"use server";

import { withAuth } from "@/lib/api-handler";
import { listUsers } from "@/server/services/user.service";

export const GET = withAuth(async (user) => {
  return await listUsers(user);
});
