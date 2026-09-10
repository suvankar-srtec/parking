# ParkControl

Next.js and Neon PostgreSQL parking management for buildings and companies.

- Dashboard, Personal, and Access Control sidebar groups expand and collapse.
- Create building is the last card in the building portfolio, including an empty portfolio.
- Each building has its own login, owner parking reserve, company parking, and companies.
- Company creation saves the company, parking allocation, and its login together.
- Building management has a single Companies section.
- The Personal and Access Control submenu entries are existing placeholders; their feature pages are not implemented.

## Run locally

Configure DATABASE_URL and SESSION_SECRET in .env, then:

```powershell
npm install
npm run prisma:generate
npm run dev
```

Open http://localhost:3000.

## Existing database: remove offices

Run the explicit migration before using the new Prisma schema:

```powershell
npm run db:remove-offices
npm run prisma:generate
```

The transactional migration refuses to continue if offices, office administrators, or office account links exist. It removes the empty offices table, unused user officeId column, and OFFICE_ADMIN enum value. It renames buildings.officePool to companyPool in place, retaining all existing parking values, buildings, companies, and login accounts.

Do not use db:push as a substitute for this migration on the previous schema: an inferred drop-and-add column change can lose parking values.

For a brand-new empty database only, run npm run db:push and npm run db:seed.

## Verification

```powershell
npm run build
npm run test:e2e
```

The browser checks use the running development server and an installed Chrome browser. They create a uniquely named temporary building and company, verify persistence in Neon, and remove only those test records afterward.

## Edit building parking

The building management page has editable Total parking, Owner parking, and Company parking fields, with Update parking and Discard changes. The Building login summary card is removed.

All three values are saved together. Owner parking plus Company parking must equal Total parking, and company parking cannot be reduced below existing company allocations. The update API checks Super Admin access. Edits and company creation lock the same building row to prevent concurrent over-allocation.

For an existing database that still uses companyPool, apply the preserving rename and parking constraint:

```powershell
npm run db:parking
npm run prisma:generate
```

Apply this after db:remove-offices if upgrading from the older office-based schema. For a new database, run db:push, then db:parking to add the parking totals constraint. The database column is now buildings.companyParking.

## Feedback, parking calculation, and account identity

- Success and failure messages use shared dismissible popup notifications across sign-in, sign-out, creation forms, parking edits, and page errors.
- Pending requests show animated button indicators and a progress bar; route loading shows a loading animation.
- Editing Owner parking recalculates Company parking, and editing Company parking recalculates Owner parking. Updating Total parking preserves the owner allocation where possible. Update parking saves the complete allocation together.
- Only Super Admin accounts can create buildings. Building name, username, and password are required. The server generates a unique `BLD-` User ID at creation, saves it with the building account in one transaction, and shows it in the confirmation and building card. The field is read-only; the APIs reject client-supplied or edited building User IDs.
- Super Admin cannot create companies. Building Admin accounts manage companies from `/account`, and the company API allows creation only for the administrator's assigned building. Company Admin accounts cannot create buildings or companies.
- User IDs are globally unique. Usernames may repeat across building and company accounts. Sign-in identifies the account by User ID and checks its username and password.
- Existing accounts are preserved; the login route does not reseed or overwrite the Super Admin account.

Apply the username migration to an existing database:

```powershell
npm run db:usernames
npm run prisma:generate
```

This replaces the unique username index with a normal index and leaves the unique User ID index intact.
## ID previews and password visibility

Building, company, and employee forms preview the next unused ID from saved accounts (BLD01, COMP01, EMP01). Opening or abandoning a form does not use a number. Saves validate the preview and allocate the ID within a locked database transaction. If another form saves first, use Refresh User ID before trying again. Existing account IDs stay unchanged.

Apply the preview index migration to an existing database, then regenerate Prisma:

```powershell
npx prisma db execute --file prisma/non-consuming-id-previews.sql --schema prisma/schema.prisma
npm run prisma:generate
```

Login and account-creation password fields include an accessible eye button to show or hide the typed password.
