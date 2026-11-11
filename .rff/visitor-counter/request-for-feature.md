# Feature Request: Visitor Counter

- **Date:** 2026-11-11
- **Source:** current session
- **Status:** Ready for implementation

## 1. Summary
Count visits to the GrowTweet site and store them as one row per UTC day, so the site owner can see both the all-time total and daily numbers. A browser counts as one visit for a fixed 30-minute window that starts at the page view that was counted. Once the window ends, the next page view counts as a new visit and starts a new window. The total is shown on an unlinked frontend route `/stats` as plain text: `N total visitors`. The change spans both projects: `growtweet-back` (Express + Prisma) and `growtweet-front` (React SPA, `C:\Devel\growtweet-front`).

## 2. Problem and goals
- **Problem:** the site has no measure of how much it is used.
- **Goals:**
  - Each browser adds at most one visit per 30-minute window (fixed window, not an inactivity timeout).
  - Visits are stored per UTC day, so the number of visits on a given day is available.
  - The all-time total can be seen at `<frontend-host>/stats`.
  - Recent per-day counts can be read through the public API.
- **Non-goals:**
  - Unique-visitor counts, per-user or per-IP tracking, and analytics beyond counting.
  - Strong protection against inflation. Clearing localStorage or calling the API directly bypasses the 30-minute rule, and that is accepted.
  - Showing per-day data in the UI.
  - Automated tests. The user will check the feature by hand.

## 3. Users and use cases
- As a site visitor (anonymous or logged in), my use of the site is counted once per 30-minute window, and I see nothing different.
- As the site owner, I want to open `/stats` and see how many visits the site has had in total.
- As the site owner, I want to call `GET /visits?last=N` to see the visit counts for the most recent days.

## 4. Functional requirements
- **FR-01** A page view is the SPA's initial load or any react-router route change, on every route except `/stats`. That includes `/login`, `/new-account`, `/edit-profile` and all main-layout routes.
- **FR-02** Visit state belongs to the browser and is kept in `localStorage`, so all tabs share it. It does not depend on login state: logging in or out does not start a new visit.
- **FR-03** On each page view the frontend reads the stored timestamp of the last counted visit. If there is none, or at least 30 minutes have passed since it, the frontend calls `POST /visits`. Otherwise it does nothing.
- **FR-04** Page views inside an open window do **not** extend it. The window always ends 30 minutes after the counted page view.
- **FR-05** The frontend saves the new timestamp (the time of that page view) **only after a 2xx response**. If the call fails, nothing is shown to the user, nothing is saved, and the next page view tries again.
- **FR-06** Each tab sends at most one `POST /visits` at a time. While a request is pending, page views in that tab do not send another.
- **FR-07** `POST /visits` is public (no auth). It adds 1 to the row for the current UTC date (`date` taken from the server clock at arrival), creating the row with count 1 if it does not exist. It uses one atomic upsert/increment, so concurrent requests never lose counts. It responds with 201.
- **FR-08** `GET /visits/total` is public and returns `{ total }`, the sum of `count` over all rows (0 when there are none).
- **FR-09** `GET /visits` is public and returns up to `last` day rows, newest first. Each item is `{ date: "YYYY-MM-DD", count }`. Only days that have a row are returned; missing days are not filled with 0.
- **FR-10** The `last` query parameter defaults to 10 and is clamped to [1, max integer]. It never causes a 400.
- **FR-11** The frontend route `/stats` sits outside `MainTemplatePage` (no NavBar, News or mobile nav) and has no link anywhere in the UI. It shows `Loading...` while calling `GET /visits/total`, then `<n> total visitors`, or a short error text if the request fails.
- **FR-12** Opening `/stats` does not count as a visit and does not touch the stored timestamp.
- **FR-13** The number on `/stats` is a plain integer with no thousands separator, and the text never changes for singular/plural (`1 total visitors`).
- **FR-14** All responses use the existing `{ success, message, data }` wrapper through `processAndRespond`.

## 5. Behavior and flows
**Main flow (counting):**
1. The user opens any page except `/stats`, or navigates within the SPA.
2. The visit tracker reads `localStorage` (key e.g. `lastVisitAt`, epoch ms).
3. If the key is missing, or `now - lastVisitAt >= 30 min`, and no request is pending in this tab, the tracker calls `POST /visits`.
4. When a 2xx response arrives, it saves `lastVisitAt = <time of the page view that triggered the call>`.
5. Page views over the next 30 minutes send nothing. The first page view after that starts again at step 3.

**Example:** a page view at 10:00 is counted. Page views at 10:10 and 10:29 are not counted. A page view at 10:31 is counted and starts a new window that ends at 11:01.

**Alternative flows / edge cases:**
- *Server cold or down (Render free tier):* the POST fails or times out. Nothing is saved, no error is shown, and the next page view retries.
- *Response lost after the server saved the visit:* the visit can be counted twice on retry. Accepted.
- *Two tabs open at the same moment:* both may POST before either saves a timestamp, which can count twice. Accepted.
- *Fast navigation in one tab:* the in-flight guard stops duplicate POSTs.
- *localStorage cleared:* the 401 handler in `api-connection.ts` and logout call `localStorage.clear()`, which also removes `lastVisitAt`, so the next page view starts a new visit. Assumption: this is accepted and needs no special handling.
- *localStorage unavailable or throwing:* Assumption: the tracker catches the error and does not count, so it never breaks the page.
- *Visit near midnight UTC:* the server's UTC date at arrival decides which row is incremented.

**`GET /visits` with `last`:**
- Missing → 10. Assumption: a non-numeric or non-integer value also falls back to 10.
- `< 1` → 1. `> 2147483647` → 2147483647. Assumption: "max integer" means the 32-bit signed max, which matches Postgres `INT`.

**Empty states:** with no rows, `GET /visits/total` returns `{ total: 0 }` (so `/stats` shows `0 total visitors`) and `GET /visits` returns `[]`.

## 6. UI / UX
- `/stats` is a bare page: one line of text on the app background (styling is up to the developer, using existing CSS variables). It has no navigation and is not linked from anywhere.
- States: `Loading...` → `<n> total visitors` | short error text (e.g. `Could not load visitor count.`).
- Counting is invisible to users: no UI changes and no toasts.

## 7. Data model
New Prisma model, snake_case columns via `@map` as in the rest of the schema:

```prisma
model DailyVisit {
  date  DateTime @id @db.Date   // UTC calendar day
  count Int      @default(0)

  @@map("daily_visits")
}
```
- Assumption: the model and table names (`DailyVisit` / `daily_visits`) can be changed. The date is the primary key, so there is one row per day.
- Migration: `npx prisma migrate dev --name add_daily_visits`.
- Increment: `prisma.dailyVisit.upsert({ where: { date }, create: { date, count: 1 }, update: { count: { increment: 1 } } })`, where `date` is the current UTC date at 00:00.
- Total: `aggregate({ _sum: { count: true } })`, with null → 0.
- List: `findMany({ orderBy: { date: 'desc' }, take: last })`, with dates formatted as `YYYY-MM-DD` (UTC).

## 8. Integration and technical notes
**Backend (`growtweet-back`):** follow controllers → services → DAOs → Prisma.
- `prisma/schema.prisma`: the new model plus a migration.
- `src/daos/prisma/visit_dao.ts` (`VisitDAO_Prisma`), registered as a `visitDAO` singleton in `src/daos/_setup.ts`.
- `src/services/visit_service.ts`: `register()`, `total()`, `list(last)`, returning `ServiceResponse` via `SuccessResult`. It imports the DAO from `daos/_setup`.
- `src/controllers/visit_controller.ts`: a `Router` with `POST /visits`, `GET /visits/total` and `GET /visits`, each using `processAndRespond`. No auth middleware. Register it in `src/create_server.ts`.
- Optionally a model/display type for the day item (`src/models/`).
- `src/docs/swagger.json`: document the three endpoints (required by the project's CLAUDE.md).
- Route order: make sure `/visits/total` is not taken as a parameter. There is no `/visits/:id`, so there is no conflict.

**Frontend (`growtweet-front`):**
- `src/api/api-visit.ts`: `ApiVisit extends ApiConnection` with `register()` and `total()`, plus DTOs in `src/api/dto/visit-dtos.ts`. Instantiate it per call, following the existing convention.
- The visit tracker runs on every route change. With `createBrowserRouter`, a simple option is a small root layout route wrapping all routes, using `useLocation()` in a `useEffect`, or `appRouter.subscribe(...)` plus an initial check. It skips `/stats`, keeps the per-tab in-flight flag in a module or ref, and uses the 30-minute fixed window from FR-03 to FR-05.
- `src/pages/stats-page.tsx` plus a top-level `/stats` route in `src/app-router.tsx`, outside `MainTemplatePage`.
- The tracker must not depend on `ApiAuth` or the logged-in user. Sending the existing `authorization` header is harmless because the endpoints ignore it. Assumption: a 401 cannot happen on these endpoints, so the global 401 redirect is not a concern.
- Interaction with the warm-up ping in `App.tsx`: when the server is cold, the first POST may fail. The app's reload after warm-up then triggers a retry.

## 9. Non-functional requirements
- **Security/permissions:** all three endpoints are public. No personal data is stored (no IP, no user id). Inflation by direct API calls is an accepted risk.
- **Performance:** one small POST at most every 30 minutes per browser. The POST is a single atomic upsert, and `GET /visits` is bounded by `last`.
- **Logging/i18n:** none. The UI text is English, like the rest of the app.

## 10. Acceptance criteria
- [ ] **Given** a browser with no `lastVisitAt`, **when** it loads any page except `/stats`, **then** `POST /visits` is sent once, today's UTC row grows by 1, and `lastVisitAt` is saved after the 2xx.
- [ ] **Given** a visit counted at T, **when** the user navigates at T+10 min and T+29 min, **then** no POST is sent and `lastVisitAt` stays T.
- [ ] **Given** a visit counted at T, **when** the user navigates at T+31 min, **then** one POST is sent and `lastVisitAt` becomes T+31.
- [ ] **Given** the API is unreachable, **when** a page view triggers a POST, **then** no error is shown, `lastVisitAt` is unchanged, and the next page view tries again.
- [ ] **Given** a POST is pending in a tab, **when** the user navigates again in that tab, **then** no second POST is sent.
- [ ] **Given** two concurrent `POST /visits` requests on the same UTC day, **when** both complete, **then** the day's count has grown by exactly 2.
- [ ] **Given** no rows, **when** `GET /visits/total` is called, **then** it returns `total: 0`, and `/stats` shows `0 total visitors`.
- [ ] **Given** rows for 15 days, **when** `GET /visits` is called without `last`, **then** it returns the 10 newest days, newest first, as `{ date: "YYYY-MM-DD", count }`.
- [ ] **Given** `GET /visits?last=0` or `?last=-5`, **then** it returns 1 row. **Given** `?last=99999999999`, **then** it returns all rows (clamped) without error.
- [ ] **Given** a user opens `/stats`, **then** it shows `Loading...` and then `<n> total visitors`, with no nav bars, no POST is sent, and `lastVisitAt` is not changed.
- [ ] **Given** the total request fails, **when** `/stats` is open, **then** it shows a short error text.
- [ ] Swagger at `/docs` lists `POST /visits`, `GET /visits/total` and `GET /visits`.

## 11. Decisions log
| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Feature name | `visitor-counter` | Matches the request wording |
| 2 | Window semantics | Fixed 30 min from the counted page view; views inside it don't extend it | Literal reading of the request |
| 3 | Who enforces the rule | Frontend, with a localStorage timestamp | Simple, no identity data; bypass accepted |
| 4 | Visitor identity | The browser (shared across tabs), independent of login | Simplest |
| 5 | What is a page view | Initial load plus every route change | Long SPA sessions must re-count |
| 6 | Which pages count | All routes (except `/stats`, see #12) | Count anonymous visitors too |
| 7 | Metric | All-time total shown | Simplest display |
| 8 | Storage | One row per UTC day (date + count) | User wants visits per day available |
| 9 | Display location | Hidden page, no link | User choice |
| 10 | Visibility | Public endpoints, no auth | User choice |
| 11 | Stats page form | React route `/stats` (not a `stats.html` file) | User correction |
| 12 | Does `/stats` count | No | Viewing stats shouldn't inflate the count |
| 13 | Day boundary | UTC, assigned by the server | Deterministic |
| 14 | POST failure | Save the timestamp only after a 2xx; fail silently; retry on the next view | Don't lose visits; rare double count accepted |
| 15 | API shape | `POST /visits`, `GET /visits/total`, `GET /visits` (daily list) | User wants the daily list exposed now |
| 16 | `/stats` UI | Bare text outside the layout; loading and error states | Simple page |
| 17 | Daily list params | `?last=N` rows, newest first, default 10; no zero-filled days | User choice |
| 18 | Concurrency | Per-tab in-flight guard plus atomic upsert/increment | No lost counts; rare cross-tab double count accepted |
| 19 | Number format | Plain integer, fixed text `<n> total visitors` | Exactly as requested |
| 20 | `last` validation | Clamp to [1, max integer]; never 400 | User choice |
| 21 | Tests | None required; manual verification | User choice |

## 13. Future ideas
- Show per-day counts (e.g. a chart) on `/stats` using `GET /visits`.
- Server-side deduplication (visitor id) if inflation becomes a problem.
