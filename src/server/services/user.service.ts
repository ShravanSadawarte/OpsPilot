import { db } from "@/lib/db";
import { AppError, ErrorCode, ok } from "@/lib/http";
import { type AuthedUser } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

/**
 * Directory of active users, used to staff teams.
 *
 * Enumerating the user directory is restricted to ADMIN and MANAGER. Managers
 * are team-scoped for work/approval authority but may browse this directory to
 * staff the teams they manage. Team leads can manage members they already see
 * through the team detail endpoint, but cannot browse the whole directory.
 */
export async function listUsers(user: AuthedUser) {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.MANAGER) {
    throw new AppError(
      403,
      ErrorCode.FORBIDDEN,
      "Only administrators and managers can browse the user directory.",
    );
  }

  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return ok({ items: users });
}
