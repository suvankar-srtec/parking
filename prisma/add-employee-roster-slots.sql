BEGIN;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "slotNumber" INTEGER;
CREATE INDEX IF NOT EXISTS "employees_companyId_isPlaceholder_idx" ON employees("companyId", "isPlaceholder");
CREATE UNIQUE INDEX IF NOT EXISTS "employees_companyId_slotNumber_key" ON employees("companyId", "slotNumber") WHERE "slotNumber" IS NOT NULL;
COMMIT;
