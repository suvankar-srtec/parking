BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "entity_identities" DROP CONSTRAINT IF EXISTS "entity_identities_userId_fkey";

-- Move all building-admin IDs out of the generated namespace first so updates cannot collide.
UPDATE "entity_identities" ei
SET "userId" = 'MIG' || u."id"
FROM "users" u
WHERE ei."userId" = u."userId" AND u."role" = 'BUILDING_ADMIN';

UPDATE "users"
SET "userId" = 'MIG' || "id"
WHERE "role" = 'BUILDING_ADMIN';

WITH ranked AS (
  SELECT u."id", 'BLD' || lpad(row_number() OVER (ORDER BY b."createdAt", b."id")::text, 2, '0') AS "newUserId"
  FROM "users" u
  JOIN "buildings" b ON b."id" = u."buildingId"
  WHERE u."role" = 'BUILDING_ADMIN'
)
UPDATE "users" u
SET "userId" = ranked."newUserId"
FROM ranked
WHERE u."id" = ranked."id";

UPDATE "entity_identities" ei
SET "userId" = u."userId"
FROM "users" u
WHERE ei."entityType" = 'building'
  AND ei."entityId" = u."buildingId"
  AND u."role" = 'BUILDING_ADMIN';

ALTER TABLE "entity_identities"
  ADD CONSTRAINT "entity_identities_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE;

COMMIT;
