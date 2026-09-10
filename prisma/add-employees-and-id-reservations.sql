-- Add employee records and short-ID reservations without changing existing logins.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EMPLOYEE';

CREATE TABLE IF NOT EXISTS "employees" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "employees_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "employees_accountId_key" ON "employees"("accountId");
CREATE INDEX IF NOT EXISTS "employees_companyId_idx" ON "employees"("companyId");

CREATE TABLE IF NOT EXISTS "user_id_reservations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_id_reservations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_id_reservations_format_check" CHECK ("userId" ~ '^[a-z0-9]{2}[0-9]{3}; function file(name){const f=path.resolve(root,name);if(!f.startsWith(path.resolve(root)+path.sep))throw Error('Outside workspace'); return f;} const changes=[];for(const [name,replacements] of Object.entries(p.replace||{})){let s=fs.readFileSync(file(name),'utf8').replace(/
/g,'
');for(const [oldValue,newValue] of replacements){if(!s.includes(oldValue))throw Error('Missing replacement in '+name);s=s.replace(oldValue,newValue);}changes.push([name,s]);}for(const [name,s] of changes){fs.writeFileSync(file(name),s);console.log('Updated '+name);}for(const [name,s] of Object.entries(p.writes||{})){fs.mkdirSync(path.dirname(file(name)),{recursive:true});fs.writeFileSync(file(name),s);console.log('Wrote '+name);}for(const [name,s] of Object.entries(p.append||{})){fs.appendFileSync(file(name),s);console.log('Appended '+name);}),
  CONSTRAINT "user_id_reservations_kind_check" CHECK ("kind" IN ('building','company','employee'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_id_reservations_userId_key" ON "user_id_reservations"("userId");
CREATE INDEX IF NOT EXISTS "user_id_reservations_ownerId_idx" ON "user_id_reservations"("ownerId");
CREATE INDEX IF NOT EXISTS "user_id_reservations_expiresAt_idx" ON "user_id_reservations"("expiresAt");
COMMIT;
