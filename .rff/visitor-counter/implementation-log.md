# Implementation Log

- **Updated:** 2026-11-12

| Step | File | Status | Rounds | Checkpoint | Notes |
|------|------|--------|--------|-----------|-------|
| S01 | [step-01.md](step-01.md) | done | 1 | 79359de | passed first review; concurrency check needs `connection_limit` in DATABASE_URL on Aiven dev DB |
| S02 | [step-02.md](step-02.md) | done | 1 | f4b963a | passed first review; 3 live-DB checks deferred to user |
| S03 | [step-03.md](step-03.md) | done | 1 | b7f2de2 | passed first review; seeded/empty-table live-DB checks deferred to user |
| S04 | [step-04.md](step-04.md) | done | 1 | growtweet-front 6c35f5e | passed first review; real-form login check deferred to user |
| S05 | [step-05.md](step-05.md) | pending | 0 | - | - |

Status: pending | in-progress | done | skipped | blocked

## Deviations
Deviations from a step file's implementation suggestions, as reported by its implementer and accepted by its reviewer.
- (S01) None in design. Added a comment in `VisitDAO_Prisma.increment` that the upsert must stay plain; `migration.sql` kept with LF as Prisma generated it.
- (S02) DAO `total()` uses `const { _sum: sum } = await ...aggregate({ _sum: { count: true } }); return sum.count ?? 0;` instead of `result._sum.count`, so the step's "one `_sum` match" grep check holds; same behavior.
- (S03) None in code; new `GET /visits` route placed after S02's `GET /visits/total` (exact paths, order irrelevant).
- (S04) None in code; the skeleton's inline comments in `App.tsx` were left out. DevTools request blocking/throttling were simulated by patching XHR in the page.

## Checks pending for the user
`needs-human` checks, collected from each step and verified by the user only after the run (section 4).
- (S02) Empty table → total 0: with `npm run dev` on port 3333, back up the rows, run `DELETE FROM daily_visits;`, then `curl -i http://localhost:3333/visits/total` → 200, body `{"success":true,"message":"Visit total found","data":{"total":0}}` — pass
- (S02) Sum 3 + 4 → 7: `INSERT INTO daily_visits (date, count) VALUES ('2026-11-01', 3), ('2026-11-02', 4);`, then the same curl → `data` is `{ "total": 7 }`; then `curl -s -X POST localhost:3333/visits` and GET again → `data.total` is 8. Restore the original rows afterwards (dev DB backup: `C:\Users\sgcas\AppData\Local\Temp\claude\8d60c90c44501847\5b3706dc-80eb-4dac-ac5c-e5bbc65a5c04\scratchpad\daily_visits_backup.json`; the 2026-11-11 row was 67, now 68 after an agent's POST) — pass
- (S02) DB down → 500: stop the DB (or point `DATABASE_URL` at an unreachable host), `curl -i http://localhost:3333/visits/total` → 500 with `success: false`, and the server keeps running — pass
- (S03) Seeded 15 days + `last` parsing: with `npm run dev` on port 3333, back up `daily_visits`, seed 15 consecutive days with the step-03 SQL seed, then `curl -s "localhost:3333/visits?last="<v>` for empty/no param (10 rows, newest first), `3` (3 rows), `0` and `-5` (1 row), `abc` and `2.5` (10 rows), `99999999999` (all 15), `last=5&last=7` (10 rows); every `date` is `YYYY-MM-DD` and descending. Restore the original rows afterwards — pass
- (S03) Empty table → `[]`: with the rows backed up, `DELETE FROM daily_visits;`, then `curl -i localhost:3333/visits` → 200, body `{"success":true,"message":"Visits found","data":[]}`; restore the rows — pass
- (S04) Login/logout keeps the window: in growtweet-front (`npm run dev`, backend on 3333), log out, then in DevTools run `localStorage.setItem('lastVisitAt', String(Date.now() - 10*60*1000))`; log in with the real form, then log out. Expected: no `POST /visits` in the Network tab for either action, and `lastVisitAt` unchanged after logout — pending
