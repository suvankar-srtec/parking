DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users"
    WHERE "userId" = '0909' AND "role" = 'SUPER_ADMIN'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM "users"
      WHERE lower("userId") = 'sa03' AND "userId" <> '0909'
    ) THEN
      RAISE EXCEPTION 'Cannot rename Super Admin 0909 to sa03 because sa03 is already in use.';
    END IF;

    UPDATE "users"
    SET "userId" = 'sa03', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = '0909' AND "role" = 'SUPER_ADMIN';
  END IF;
END $$;
