CREATE TABLE IF NOT EXISTS "gates" (
  "id" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "gateNumber" INTEGER NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'ENTRY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gates_buildingId_gateNumber_key"
ON "gates"("buildingId", "gateNumber");

CREATE INDEX IF NOT EXISTS "gates_buildingId_idx"
ON "gates"("buildingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gates_buildingId_fkey'
  ) THEN
    ALTER TABLE "gates"
    ADD CONSTRAINT "gates_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "buildings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
