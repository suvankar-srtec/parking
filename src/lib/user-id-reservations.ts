import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEntityName, userIdCode, type EntityKind } from "./entity-identity";

export class UserIdError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

type IdentityRequest = { ownerId: string; kind: EntityKind; scopeId: string; name: string; previousReservationId?: string };
const RESERVATION_MS = 15 * 60 * 1000;

async function nextAvailableUserId(tx: Prisma.TransactionClient, kind: EntityKind) {
  const prefix = userIdCode(kind);
  // Only saved accounts use a number. Drafts, cancelled forms, and failed saves do not.
  const candidates = await tx.$queryRaw<Array<{ userId: string }>>`
    SELECT ${prefix} || lpad(n::text, 2, '0') AS "userId"
    FROM generate_series(1, 99) n
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE upper(u."userId") = ${prefix} || lpad(n::text, 2, '0'))
      AND NOT EXISTS (SELECT 1 FROM employees e WHERE upper(e."userId") = ${prefix} || lpad(n::text, 2, '0'))
    ORDER BY n LIMIT 1
  `;
  if (!candidates[0]) throw new UserIdError("All User IDs for this account type are in use.");
  return candidates[0].userId;
}

export async function reserveUserId(input: IdentityRequest) {
  const nameKey = normalizeEntityName(input.name).toLowerCase();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72015001)::text`;
    await tx.userIdReservation.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    if (input.previousReservationId) {
      await tx.userIdReservation.deleteMany({
        where: { id: input.previousReservationId, ownerId: input.ownerId, kind: input.kind, scopeId: input.scopeId },
      });
    }
    const userId = await nextAvailableUserId(tx, input.kind);
    const existing = await tx.userIdReservation.findFirst({
      where: { ownerId: input.ownerId, kind: input.kind, scopeId: input.scopeId, nameKey },
    });
    const expiresAt = new Date(Date.now() + RESERVATION_MS);
    if (existing) {
      return tx.userIdReservation.update({ where: { id: existing.id }, data: { userId, expiresAt } });
    }
    // This record binds the preview to its user, name, and scope; it does not reserve a number.
    return tx.userIdReservation.create({
      data: { userId, ownerId: input.ownerId, kind: input.kind, scopeId: input.scopeId, nameKey, expiresAt },
    });
  }, { maxWait: 10000, timeout: 15000 });
}

export async function claimUserId(tx: Prisma.TransactionClient, input: IdentityRequest & { reservationId: string }) {
  // Acquire before locking the preview row, in the same order as preview generation.
  // Keep this lock until the account transaction commits to serialize concurrent saves.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(72015001)::text`;
  const rows = await tx.$queryRaw<Array<{
    id: string; userId: string; ownerId: string; kind: string; scopeId: string; nameKey: string; expiresAt: Date;
  }>>`SELECT * FROM user_id_reservations WHERE id = ${input.reservationId} FOR UPDATE`;
  const reservation = rows[0];
  if (!reservation || reservation.expiresAt <= new Date()) {
    throw new UserIdError("Your generated User ID has expired. Refresh the User ID and try again.");
  }
  if (reservation.ownerId !== input.ownerId || reservation.kind !== input.kind || reservation.scopeId !== input.scopeId) {
    throw new UserIdError("This generated User ID does not belong to this form.", 403);
  }
  if (reservation.nameKey !== normalizeEntityName(input.name).toLowerCase()) {
    throw new UserIdError("The name changed. Refresh the User ID and try again.");
  }
  if (reservation.userId !== await nextAvailableUserId(tx, input.kind)) {
    throw new UserIdError("The next available User ID has changed. Refresh the User ID and try again.");
  }
  await tx.userIdReservation.delete({ where: { id: reservation.id } });
  return reservation.userId;
}
