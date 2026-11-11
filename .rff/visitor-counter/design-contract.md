# Design Contract: Visitor Counter

- **Plan:** [plan.md](plan.md)
- **Updated:** 2026-11-11

## 1. Step status
| Step | Title | Status | File |
|------|-------|--------|------|
| S01 | Count a visit with `POST /visits` | approved | [step-01.md](step-01.md) |
| S02 | Read the all-time total with `GET /visits/total` | approved | [step-02.md](step-02.md) |
| S03 | List recent days with `GET /visits?last=N` | approved | [step-03.md](step-03.md) |
| S04 | Count page views in the SPA (visit tracker) | approved | [step-04.md](step-04.md) |
| S05 | Show the total on the hidden `/stats` page | approved | [step-05.md](step-05.md) |

Status: pending | draft | approved

## 2. Shared items
Names that cross steps: types, interfaces, enums, DTOs, tables, routes, events, config keys.

| Item | Kind | Created by | Used / extended by | Notes |
|------|------|-----------|--------------------|-------|
| `DailyVisit` / `daily_visits` | Prisma model / table | S01 | S02, S03 | `date DATE` PK (UTC day), `count INT DEFAULT 0`; migration `add_daily_visits` |
| `IDailyVisit` / `DailyVisit` (`src/models/daily_visit.ts`) | model | S01 | S03 | `{ date: "YYYY-MM-DD", count: number }` |
| `VisitDAO_Prisma` (`src/daos/prisma/visit_dao.ts`) | DAO class | S01 | S02, S03 | `increment(date: Date): Promise<DailyVisit>`; `total(): Promise<number>` (S02); `listLatest(last: number): Promise<DailyVisit[]>` (S03); others add methods |
| `toDailyVisit` (`visit_dao.ts`) | function | S01 | S03 | `(row: { date: Date; count: number }) => DailyVisit`, UTC `YYYY-MM-DD` |
| `visitDAO` (`src/daos/_setup.ts`) | singleton | S01 | S02, S03 | only access path for services |
| `VisitService` (`src/services/visit_service.ts`) | service class | S01 | S02, S03 | `register(): ServiceResponseAsync<IDailyVisit>` (201); `total(): ServiceResponseAsync<{ total: number }>` (S02); `list(last: number): ServiceResponseAsync<IDailyVisit[]>` (S03, clamps to [1, 2147483647]); others add methods |
| `visit_controller` (`src/controllers/visit_controller.ts`) | Router, registered in `createApp()` | S01 | S02, S03 | default export; public routes, no auth |
| `POST /visits` | route | S01 | S04 | 201, `data: { date, count }` |
| `GET /visits/total` | route | S02 | S05 | 200, `data: { total: number }`; Swagger path `"/visits/total"` → `get` (S02) |
| `GET /visits` | route | S03 | - | 200, `data: IDailyVisit[]`, `last` query param; Swagger `get` on `"/visits"` (S03) |
| Swagger `Visits` tag + `"/visits"` path + `#/components/schemas/DailyVisit` | API doc | S01 | S02, S03 | others add operations / `/visits/...` paths; S01's operation sets `"security": []` (root-level bearer security exists) |
| `ApiVisit` (`growtweet-front/src/api/api-visit.ts`) | API client class | S04 | S05 | extends `ApiConnection`, per call; `register(): Promise<void>`; `total(): Promise<number>` (S05, `GET /visits/total`); others add methods |
| `visit-dtos.ts` (`growtweet-front/src/api/dto/`) | DTO module | S04 | S05 | `DailyVisitDTO = CommonResponse<{ date: string; count: number }>`; `VisitTotalDTO = CommonResponse<{ total: number }>` (S05); others append DTO types |
| `lastVisitAt` | localStorage key (epoch ms) | S04 | - | owned by the tracker only |
| `/stats` | front route path | S05 | S04 (skips the literal path) | path fixed by the RFF; top-level route in `appRouter` rendering `StatsPage` (`src/pages/stats-page.tsx`, S05) |

## 3. Decisions
Decisions approved during a step's review, each about that step's own work only.
- (S01) `POST /visits` success message is `"Visit registered"`.
- (S01) On DB failure the endpoint keeps the existing `processAndRespond` 500 behavior (message includes the error text); no change to `processAndRespond`.
- (S01) The upsert must stay a native Prisma upsert (no `select`, nested writes or extra `where` fields) so it runs as a single atomic `INSERT ... ON CONFLICT DO UPDATE`.
- (S02) `GET /visits/total` success message is `"Visit total found"`; null sum → 0 is handled in the DAO only.
- (S03) `GET /visits` success message is `"Visits found"`.
- (S03) `last` is parsed in the controller with the strict regex `/^-?\d+$/` on a single string (else 10): `+5`, surrounding whitespace, `2.5`, `1e3`, empty, repeated or object params → 10; leading zeros accepted (`007` → 7); `-0` → 1. Clamping to [1, 2147483647] is done in the service; the DAO trusts its input.
- (S03) The Swagger `last` parameter has no `minimum`/`maximum`, so Swagger UI does not block values the API clamps.
- (S04) `visit-tracker.ts` exports only `trackPageView(pathname)`; window check, storage access, `registerVisit` and the in-flight flag are module-private. Wired in `App.tsx` by a separate `useEffect` (initial call + `appRouter.subscribe`, pathname changes only, unsubscribe on cleanup); `app-router.tsx` and the warm-up code are untouched.
- (S04) The `/stats` skip is case-insensitive and ignores a trailing slash.
- (S04) A `lastVisitAt` in the future, or a non-numeric value, counts as an expired/missing window, so the page view is counted.
- (S04) No client-side timeout on `POST /visits` (follows `ApiConnection.post` as is).
- (S04) `ApiVisit.register()` does not catch errors; the tracker swallows them silently and saves `lastVisitAt` only after a 2xx.
- (S05) `StatsPage` shows `Loading...`, then `${String(total)} total visitors`, or `Could not load visitor count.` inline (no toast) when the request fails or `ApiVisit` throws. Any 2xx response is shown as received, with no validation of `total` (user decision). An `active` flag ignores late responses.
- (S05) The existing warm-up toast in `App.tsx` may still appear on `/stats`; left unchanged (user decision).
