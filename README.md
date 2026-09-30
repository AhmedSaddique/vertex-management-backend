# Vertex Management - Backend (API)

Express 5 + Prisma 6 + PostgreSQL. Standalone API on **port 5000**. The frontend is a separate
app that connects only through this API.

## Run

```bash
npm install
```

Edit `.env`:

```
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/vertexmanagement?schema=public"
PORT=5000
JWT_SECRET="long-random-string"        # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
CORS_ORIGIN="http://localhost:3000"    # frontend URL(s), comma separated
```

Create the database, tables and seed accounts (admin, Uzair, Hamza, Binary/Forex/Crypto):

```bash
npm run db:setup
```

Start:

```bash
npm run dev
```

Health check: http://localhost:5000/api/health

Default logins: admin@vertex.com / admin123 · uzair@vertex.com / teacher123 · hamza@vertex.com / teacher123

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | start with auto-reload |
| `npm run db:setup` | apply migrations (creates DB if missing) + seed |
| `npm run db:migrate` | create a new migration after changing `prisma/schema.prisma` |
| `npm run db:seed:demo` | insert demo students, payments and a payout |
| `npm run db:studio` | open Prisma Studio to browse data |
| `npm run build` / `npm start` | production build and start |

## Structure

```
prisma/schema.prisma          data model
prisma/migrations/            SQL migrations
prisma/seed.ts                seed accounts and subjects
src/index.ts                  server start (PORT)
src/app.ts                    Express app: CORS, JSON, routers, errors
src/config/env.ts             environment variables
src/database/prisma.ts        Prisma client
src/common/middleware/        JWT auth, admin guard, teacher scoping, error handler
src/common/utils/             errors, money helpers, route params
src/modules/<name>/           routes -> controller -> service -> schema
  auth, students, payments, partners, payouts, expenses, installments, teachers, subjects, schedule, settings, dashboard, finance
```

## Class schedule

- A `ClassSlot` is a recurring class: teacher, subject, days of the week, start/end time (24h `HH:MM`), location, and the students who attend.
- A teacher cannot have two active classes that overlap on the same day (the API returns 409).
- Fixed time slots (default 3:00-4:30 PM, 4:30-6:00 PM, ... 9:00-10:30 PM) are stored in the `Setting` table and editable by admin from Settings. They drive the timetable grid rows and the slot picker when adding a class; any custom time is still allowed.
- Each student has `fatherPhone` and `availableSlots` (array of `"HH:MM-HH:MM"` keys matching those slots). The schedule Availability view lists, per slot, which students are free and which are already placed in a class.
- After changing `prisma/schema.prisma`, stop the dev server, then run `npm run db:migrate` (creates + applies a migration and regenerates the client).

## Admission numbers

Each student gets a sequential admission number from a database sequence that starts at 1001
(1001, 1002, 1003 ...). It is generated on insert, unique, and never edited by hand. Searching
students by a number matches the admission number.

## Mode of class

Each student has a `classMode` of PHYSICAL, ONLINE or HYBRID (default PHYSICAL). It is set on the
student form, shown on the students list, student page, class roster and partner tables, and the
students list can be filtered with `GET /api/students?classMode=ONLINE`.

## Email notifications

Two events send email, each as a student copy and a team copy:

| Event | Student receives | Team receives (NOTIFY_EMAILS) |
|---|---|---|
| Student enrolls | "Your admission is confirmed", admission number, course, teacher, mode of class, total fee, amount received, remaining amount and the agreed dates | the same plus phone, father name, **each member percentage and amount**, the company percentage, and a link to the record |
| Payment recorded | amount received, total fee, paid so far, remaining amount, next instalment date | the same plus **each member percentage and amount** and the company share |

- Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM and NOTIFY_EMAILS (see .env.example).
  For Gmail, create an App Password; the normal account password is rejected.
- With SMTP unset, enrolments and payments still save and nothing is sent. `GET /api/health` reports
  whether email is configured, and the Settings page shows the same.
- Sending never fails or delays a save: each message is bounded by MAIL_TIMEOUT_MS (default 9s) and
  errors are logged only. The create responses carry a `notification` object so the UI can say what was sent.
- `MAIL_DRIVER=json` builds the messages and logs them instead of delivering, for local checks.
- A student only gets their copy if their record has an email address.

## Company loans

Money someone takes out of the company for a while and pays back later. A loan is **not** an
expense: it is money the company is owed, so it lowers cash in hand while it is outstanding and
leaves company income and the company balance untouched. Each loan tracks its repayments and shows
OPEN, PARTIAL or CLEARED, and the page totals who still owes what. Admin only: `GET/POST /api/loans`,
`PUT/DELETE /api/loans/:id`, `POST /api/loans/:id/repayments`, `POST /api/loans/:id/clear`,
`DELETE /api/loans/repayments/:repaymentId`.

## Trading payouts
Income the academy earns from trading, kept separate from student fees. Each payout is split at the
moment it is recorded: by default 25% to each of the three members and 25% to the company. The split
comes from `TradingShareDefault` and can be changed per payout. Member shares add to their payable
balance; the company share adds to company income. Editing an amount re-splits it, deleting reverses it.
Admin only: `GET/POST /api/trading`, `PUT/DELETE /api/trading/:id`, `GET/PUT /api/trading/defaults`.

## Money rules

- Final price = fee - discount. Remaining = final price - payments.
- **Course policy: every member takes 20% of every course and the company keeps 40%.** The split is
  copied to each student on enrollment and can still be changed per student.
- **Partners** are everyone who receives a share of fees: teachers (Hamza, Uzair) and management (Ahmad).
  Each **subject has a default split** (Forex/Crypto: Hamza 30, Uzair 30, Ahmad 20; Binary: Uzair 50, Ahmad 20).
  When a student is added the split is copied to the student and can be changed per student.
  **Whatever is not given to partners stays with the company.**
- Every payment is split at that moment into PaymentShare rows (snapshot), so later changes never rewrite history.
- Partner payable balance = (course share + trading share) - payouts.
- Company income = company share of fees + company share of trading. Company balance = that minus expenses.
- **Installments** are promised fee dates (e.g. 10,000 on the 20th). A payment can be applied to one; if it is
  short, the rest is moved to a new date. The dashboard lists overdue, due-today and upcoming installments.
  Fees should be collected within 15 days of enrollment (courses last 30-40 days).
- **Expenses** are company running costs, deducted from the company share only.

## Deploy on Vercel

Live API: https://vertex-management-backend.vercel.app/api/health

- `api/index.ts` exports the Express app as a serverless function; `vercel.json` rewrites every
  path to it. Local dev still uses `src/index.ts`.
- Project settings: Framework preset **Other**, root directory this repo, build command default
  (runs `npm run vercel-build` = `prisma generate && prisma migrate deploy`), output directory empty.
- Environment variables (Production): `DATABASE_URL` (hosted Postgres, pooled URL),
  `JWT_SECRET`, `NODE_ENV=production`,
  `CORS_ORIGIN=https://vertexmanagement.vercel.app,https://vertex-management-frontend-*.vercel.app`.
- Seed the production database once from your machine:
  `DATABASE_URL="<prod url>" npm run db:seed` (PowerShell: `$env:DATABASE_URL="<prod url>"; npm run db:seed`).
- `GET /api/health` reports whether DATABASE_URL and JWT_SECRET are configured and which origins are allowed.

## API

All routes under `/api`; send `Authorization: Bearer <token>` (from `/api/auth/login`).

| Method | Route | Who |
|--------|-------|-----|
| POST | /auth/login, /auth/change-password · GET /auth/me | all |
| GET | /students, /students/:id | admin: all, teacher: own |
| POST/PUT/DELETE | /students, /students/:id | admin |
| GET/POST | /payments · PUT/DELETE /payments/:id | read scoped, write admin |
| GET | /teachers, /teachers/:id, /teachers/:id/summary | admin: all, teacher: own |
| GET | /partners, /partners/:id, /partners/:id/summary · POST/PUT/DELETE /partners | read: own/all, write: admin |
| GET/POST/PUT/DELETE | /expenses | admin |
| GET | /installments/due?days=7 · GET /installments?studentId= · POST/PUT/DELETE /installments | read: scoped, write: admin |
| PUT | /subjects/:id/share-defaults | admin |
| POST/PUT/DELETE | /teachers | admin |
| GET/POST | /payouts · PUT/DELETE /payouts/:id | read scoped, write admin |
| GET/POST/PUT/DELETE | /subjects | read all, write admin |
| GET | /schedule, /schedule/:id | admin: all, teacher: own classes (with student contacts) |
| POST/PUT/DELETE | /schedule, /schedule/:id · PUT /schedule/:id/students | admin |
| GET | /settings/time-slots · PUT /settings/time-slots | read: all, write: admin |
| GET | /dashboard | admin |
#   v e r t e x - m a n a g e m e n t - b a c k e n d  
 