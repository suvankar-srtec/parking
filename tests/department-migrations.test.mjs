import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

process.loadEnvFile('.env');
const db = new PrismaClient({ log: [] });
test.after(() => db.$disconnect());
const backfill = readFileSync(new URL('../prisma/add-company-departments.sql', import.meta.url), 'utf8');
const defaults = readFileSync(new URL('../prisma/add-default-company-departments.sql', import.meta.url), 'utf8');

// All migration writes resolve to temporary tables on one transaction connection.
// The configured database's real company/department/employee data is never modified.
test('department build scripts tolerate archived IDs and repeated runs', { timeout: 90000 }, async () => {
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET LOCAL search_path = pg_temp, public');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE companies (id text PRIMARY KEY) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE employees (id text PRIMARY KEY, "companyId" text, department text) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE vehicles (id text PRIMARY KEY, "employeeId" text, department text, "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE company_departments (id text PRIMARY KEY, "companyId" text, name text, "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP, "updatedAt" timestamp, UNIQUE ("companyId", name)) ON COMMIT DROP');
    const tables = await tx.$queryRawUnsafe(`SELECT relname FROM pg_class WHERE relnamespace = pg_my_temp_schema() AND relkind = 'r' ORDER BY relname`);
    assert.deepEqual(tables.map(row => row.relname), ['companies', 'company_departments', 'employees', 'vehicles']);
    await tx.$executeRawUnsafe(`INSERT INTO companies VALUES ('test-archived'), ('test-existing')`);
    await tx.$executeRawUnsafe(`INSERT INTO company_departments (id,"companyId",name,"updatedAt") VALUES ('dept_' || md5('test-archived:DEFAULT'), 'test-archived', '__ARCHIVED_DEFAULT', CURRENT_TIMESTAMP), ('custom-default', 'test-existing', 'default', CURRENT_TIMESTAMP)`);
    await tx.$executeRawUnsafe(`INSERT INTO employees VALUES ('person-1','test-archived','DEFAULT'), ('person-2','test-existing','Finance'), ('person-3','test-existing','Finance')`);

    // Prove the previous scripts reproduce the same primary-key error.
    for (const sql of [defaults.replace(/ON CONFLICT DO NOTHING;/, ';'), backfill.replace(/ON CONFLICT DO NOTHING;/, 'ON CONFLICT ("companyId", "name") DO NOTHING;')]) {
      const insert = sql.slice(sql.lastIndexOf('INSERT INTO') === -1 ? 0 : sql.lastIndexOf('INSERT INTO'));
      const statement = sql.startsWith('WITH') ? sql : insert;
      await tx.$executeRawUnsafe('SAVEPOINT collision');
      await assert.rejects(() => tx.$executeRawUnsafe(statement), error => error.meta?.code === '23505');
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT collision');
    }

    async function run() {
      // These two files contain ordinary SQL statements without procedural blocks.
      for (const sql of [backfill, defaults]) {
        for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      }
    }
    await run();
    const rows = () => tx.$queryRawUnsafe('SELECT id,"companyId",name,"createdAt","updatedAt" FROM company_departments ORDER BY id');
    const first = await rows();
    await run();
    assert.deepEqual(await rows(), first);
    assert.equal(first.find(row => row.name === '__ARCHIVED_DEFAULT')?.companyId, 'test-archived');
    assert.equal(first.filter(row => row.companyId === 'test-existing' && row.name.toLowerCase() === 'default').length, 1);
    assert.equal(first.filter(row => row.name === 'Finance').length, 1);
    assert.equal(first.filter(row => row.name === 'OPERATIONS').length, 2);
    assert.equal(first.filter(row => row.name === 'ADMINISTRATION').length, 2);
  }, { timeout: 60000, maxWait: 10000 });
});
