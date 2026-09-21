CREATE TABLE IF NOT EXISTS "user_id_reservations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_id_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_id_reservations_ownerId_idx"
  ON "user_id_reservations"("ownerId");

CREATE INDEX IF NOT EXISTS "user_id_reservations_expiresAt_idx"
  ON "user_id_reservations"("expiresAt");

CREATE INDEX IF NOT EXISTS "user_id_reservations_userId_idx"
  ON "user_id_reservations"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_id_reservations_ownerId_fkey'
  ) THEN
    ALTER TABLE "user_id_reservations"
      ADD CONSTRAINT "user_id_reservations_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
