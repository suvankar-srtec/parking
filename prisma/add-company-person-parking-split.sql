BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS "totalPersons" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "ownerParkingAllocation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "employeeParkingAllocation" INTEGER NOT NULL DEFAULT 0;

-- Preserve existing companies: current people count becomes the minimum known headcount,
-- and existing parking starts as Employee parking until Company/User changes the split.
UPDATE companies c
SET "totalPersons" = GREATEST(
      c."totalPersons",
      COALESCE((SELECT COUNT(*)::INTEGER FROM employees e WHERE e."companyId" = c.id), 0)
    ),
    "employeeParkingAllocation" = CASE
      WHEN c."ownerParkingAllocation" + c."employeeParkingAllocation" = 0 THEN c."parkingAllocation"
      ELSE c."employeeParkingAllocation"
    END
WHERE c."totalPersons" = 0
   OR c."ownerParkingAllocation" + c."employeeParkingAllocation" = 0;

COMMIT;
