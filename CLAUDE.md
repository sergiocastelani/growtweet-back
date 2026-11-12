# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Backend (Express + TypeScript + Prisma/PostgreSQL) for GrowTweet, a Twitter-like SPA from Growdev's Full Stack Web Starter course. Server listens on port 3333; Swagger UI is served at `/docs` (spec in `src/docs/swagger.json`, maintained by hand — update it when adding/changing endpoints).

## Commands

- `npm run dev` — run with ts-node-dev (auto-restart)
- `npm run build` — `tsc` to `dist/` **and** `prisma migrate deploy` (requires a reachable DB)
- `npm start` — run compiled output (`dist/src/index.js`; `src/` and `tests/` are both compiled, hence the nested path)
- `npm test` — Jest, silent; `npm run test:verbose` for full output; `npm run test:coverage`
- Single test file: `npx jest tests/services/tweet_service.test.ts`; single test: `npx jest -t "listPage"`
- DB migrations: `npx prisma migrate dev --name <name>`; regenerate client: `npx prisma generate`

Environment: copy `.env.sample` to `.env` (`DATABASE_URL`, `JWT_PASSWORD`, `AUTH_TOKEN_NAME`). Jest loads `.env` via `dotenv/config`, so tests that touch auth need it present.

## Architecture

Layered: **controllers → services → DAOs → Prisma**.

- `src/create_server.ts` builds the Express app (used by `src/index.ts` and by API tests via supertest); `index.ts` adds Swagger and starts listening.
- **Controllers** (`src/controllers/*`) are Express `Router`s. Every handler wraps its work in `processAndRespond(res, async () => ...)` (`controller_utils.ts`), which serializes a `{statusCode, success, message, data}` result and converts thrown `ApiError(statusCode, message)` into the matching HTTP error (anything else → 500).
- **Services** (`src/services/*`) are instantiated per request (`new TweetService()`) and return `ServiceResponse<T>` built with `SuccessResult` / `ErrorResult`, or throw `ApiError` (`services_types.ts`).
- **DAOs** are singletons exported from `src/daos/_setup.ts` (`userDAO`, `tweetDAO`, `likeDAO`); the Prisma implementations live in `src/daos/prisma/`, sharing the `PrismaClient` from `src/daos/prisma/_setup.ts`. Services must import DAOs from `daos/_setup`, not the Prisma classes directly (tests mock that module).
- **Models** (`src/models/*`) are interface + class pairs (`ITweet`/`Tweet`). `*Display` models are read-side projections (e.g. `TweetDisplay` with like/reply counts, `liked` flag, embedded `UserDisplay`); `UserSecureInfo` is the user without password and is the JWT payload.

### Auth

- JWT signed with `JWT_PASSWORD`, 1-day expiry, read from the header named by `AUTH_TOKEN_NAME` (an optional `Bearer ` prefix is stripped in `authMiddleware`).
- `authMiddleware` requires a valid token and puts the user in `res.locals.user`; `loggedUserMiddleware` sets it only if a valid token is present (used by listing endpoints to compute the `liked` flag).
- Passwords are stored as bcrypt hashes (`bcryptjs`, via `src/services/password_utils.ts`). `UserService` hashes on create/update; `AuthService.login` and the update's `currentPassword` check verify against the hash. Never return `User` (with `password`) from a controller — map to `UserSecureInfo`.

### Data model

`User`, `Tweet` (self-relation via `repliedId` for replies), `Like` (composite PK `tweetId`+`userId`). DB columns are snake_case via `@map`.

## Testing

Tests live in `tests/` (Jest `roots`), not alongside source.

- `tests/config/prisma.mock.ts` runs for every test (`setupFilesAfterEnv`): it replaces the Prisma client with a `jest-mock-extended` deep mock (`prismaMock`) reset before each test. No real DB is used.
- **Service tests** (`tests/services/`) mock the DAO layer: `jest.mock('../../src/daos/_setup')` and cast e.g. `tweetDAO as jest.Mocked<typeof tweetDAO>`.
- **API tests** (`tests/api/`) use supertest against `createApp()` and stub DB calls through `prismaMock` (e.g. `prismaMock.user.findUnique.mockResolvedValue(...)`).
- Coverage excludes `src/daos`.
- **Manual/browser checks** that need a logged-in user must use the test user `test@nowhere.com`, password `1234` (dev DB). Do not log in as any other account.
