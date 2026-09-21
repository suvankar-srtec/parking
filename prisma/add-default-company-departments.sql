WITH defaults(name) AS (
  VALUES ('DEFAULT'), ('OPERATIONS'), ('ADMINISTRATION')
)
INSERT INTO "company_departments" ("id", "companyId", "name", "createdAt", "updatedAt")
SELECT
  'dept_' || md5(c."id" || ':' || d.name),
  c."id",
  d.name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
CROSS JOIN defaults d
WHERE NOT EXISTS (
  SELECT 1
  FROM "company_departments" cd
  WHERE cd."companyId" = c."id"
    AND lower(cd."name") = lower(d.name)
);
