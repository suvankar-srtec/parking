# SRTEC Access Control

Next.js and Neon PostgreSQL parking management for buildings and companies.

- Dashboard, Personal, and Access Control sidebar groups expand and collapse.
- Create building is the last card in the building portfolio, including an empty portfolio.
- Each building has its own login, owner parking reserve, company parking, and companies.
- Company creation saves the company, parking allocation, and its login together.
- Building management has a single Companies section.
- Access Control → Device configures RFID readers, and Real Time Monitor shows saved card and parking events. Personal, Slot Allocation, Manual In/Out, and Report remain placeholders.

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
- Only Super Admin accounts can create buildings. Building name, username, and password are required. The server generates a unique `BLD01`-style User ID at creation, saves it with the building account in one transaction, and shows it in the confirmation and building card. The field is read-only; the APIs reject client-supplied or edited building User IDs.
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

## RFID readers: local TCP gateway

Requires Node.js 22.18 or later. The Next.js app handles authorization and Neon transactions; a separate, continuously running Node process accepts the physical readers' TCP connections.

Configure the private values shown in `.env.example` in `.env`. Use different random secrets for `RFID_HTTP_TOKEN` and `RFID_GATEWAY_TOKEN`; the app and gateway must use the same respective values. Do not commit credentials.

For an existing database, apply the additive migrations and generate the client while the app is stopped:

```powershell
npm run db:rfid
npm run db:rfid-tcp
npm run prisma:generate
npm run rfid:configure
```

The configure script adds the two approved readers. New readers have no building assignment. It preserves existing building assignments, operating modes and approval settings, and updates the configured IP addresses. Entry/Exit defaults apply only when a reader is first created.

Start the application and gateway in separate terminals:

```powershell
npm run dev
# Separate terminal:
npm run rfid:tcp
```

For production, use `npm run build` followed by `npm start`, and keep the gateway process running on the reader network. The gateway sends authenticated HTTP requests to `RFID_APP_URL` (default `http://127.0.0.1:3000`). Hosting the web app does not start the LAN TCP listener.

| Reader | Device number | Reader IP | Default mode |
| --- | --- | --- | --- |
| Reader 1 | 22110001 | 192.168.0.170 | ENTRY |
| Reader 2 | 22110002 | 192.168.0.188 | EXIT |

Both readers use **TCP Client**, destination **192.168.0.27:8080** on this network. The listener binds **0.0.0.0:8080**. If the server IP changes, update the physical readers' destination. The changing client/source port, such as 42583, is diagnostic only. Windows/network firewall rules must allow these reader IPs to reach TCP 8080.

Sign in as Super Admin, then open **Access Control → Device → Configure reader** to assign each reader to a building. Building Admins can subsequently change the modes of their assigned readers. Changes save in Neon. A reader cannot process parking or registration until it is assigned and enabled.

Green means an active TCP socket reported by the gateway. Red means the gateway reports no socket. Amber means gateway status is unavailable (older than 45 seconds), not confirmed reader disconnection. The gateway uses TCP keepalive probes and reports status every 10 seconds; the UI polls every 5 seconds. Physical link loss is detected when the operating system closes the socket after failed keepalive probes. No synthetic successful scan is sent to make a reader appear connected.

### Cards and parking

1. A Building Admin switches an assigned reader to **Register card** mode.
2. The Company Admin opens an employee's **Add vehicle** or existing vehicle's **Register card** form.
3. Choose the registration reader, press **Scan card**, and present the card.
4. The scanned number appears in the read-only card field. **Register vehicle** or **Save card** saves it atomically in Neon.
5. Restore the reader to **Entry**, **Exit**, or **Entry / Exit** after registering cards.

Registration sessions expire after 10 minutes. A reader handles one registration session at a time. Cards are normalized to uppercase and uniquely assigned across vehicles. A vehicle inside the building must exit before its card can be replaced.

Both documented packets and the observed firmware spelling are accepted:

```text
vgdecoderresult=D9E07D0E&&devicenumber=22110001
vgdecoderesultD9E07D0Edevicenumber22110001otherparams
```

The gateway supports fragmented and combined TCP packets, checks the source IP against `config/readers.json`, and verifies the packet's device number. Responses are plain text:

```text
code=0000&&desc=Parking allowed
code=0000&&desc=Vehicle checked out
code=0001&&desc=RFID card is not registered
code=0001&&desc=Parking allocation is full
```

Only successful processing uses `0000`. Rejected, repeated, malformed, and failed requests use `0001`. Attach the hardware red LED's **SuccessAction** to `0000` only. Hardware LED behavior is separate from the application's connection status colors.

Entry checks the card's building and company/building capacity. Exit updates the saved occupancy. Entry / Exit toggles the saved vehicle state. Transactions serialize conflicting scans, with a three-second debounce to prevent repeated state changes. Scans and registration outcomes are saved in `rfid_events`; vehicles retain current occupancy and last access time.

### HTTP compatibility

`POST /test` accepts the same packet with an `x-reader-token` header. Firmware that only supports URL credentials can use `/api/r/<RFID_HTTP_TOKEN>/<deviceNumber>`. The path and payload device numbers must match. Protect these URLs as credentials. A TCP reader uses the LAN gateway and does not need an HTTP URL.

### RFID verification

```powershell
npm run test:rfid
# With the app running and DATABASE_URL configured:
npm run test:rfid:database
npm run build
```

The protocol suite uses a loopback TCP reader and mock HTTP server. The database/browser suite creates unique temporary fixtures, checks registration, entry/exit, capacity rejection, debounce, permissions and connection state, then deletes only its fixtures. These tests do not send success commands to the physical readers.

## Vercel login configuration

Local `.env` values are not included in GitHub. In Vercel, open the parking project's **Settings → Environment Variables** and add **DATABASE_URL** (the Neon connection string) and **SESSION_SECRET** (a stable random secret) for **Production**. Enter values without shell-style surrounding quotes. Add the RFID secrets too if this deployment receives gateway requests. Redeploy after changing variables; an existing deployment keeps its previous environment.

If `POST /api/login` fails, open the deployment's runtime Logs and filter for that request. `LOGIN_CONFIGURATION_MISSING` lists missing variable names. `LOGIN_FAILED` includes a sanitized Prisma code and reason, such as `DATABASE_UNREACHABLE`, `DATABASE_AUTHENTICATION_FAILED`, or `DATABASE_TABLE_MISSING`. Check the connection string, database availability and applied migrations accordingly. Do not put passwords or connection strings in source code or public logs.
