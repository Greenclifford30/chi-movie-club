# Next.js MVP Integration Handoff

## Current State

The Next.js app has been migrated from the prototype `/api/showtimes` and `/api/admin` flow to club-aware MVP routes backed by API Gateway. Browser code calls local Next.js routes only; the API key is attached server-side by `app/api/backend/[...path]/route.ts`.

The app now includes:

- Cognito SRP sign-in at `/sign-in`.
- Seeded club selection at `/clubs`.
- Active movie night at `/clubs/[clubId]`.
- Admin setup at `/clubs/[clubId]/admin`.
- Club history at `/clubs/[clubId]/history`.
- Shared API/domain helpers in `lib/movie-club-api.ts`, `lib/movie-club-types.ts`, and `lib/movie-club-format.ts`.

## Environment

Required:

```txt
NEXT_PUBLIC_COGNITO_USER_POOL_ID=
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=
NEXT_PUBLIC_AWS_REGION=
API_HOST=
API_KEY=
```

Optional local defaults:

```txt
NEXT_PUBLIC_DEFAULT_CLUB_ID=the-cinephiles
NEXT_PUBLIC_DEFAULT_CLUB_NAME=The Cinephiles
```

`NEXT_PUBLIC_TMDB_API_KEY` is no longer used by the frontend. Movie search must go through the backend `GET /movies/search` route so TMDB credentials stay server-side.

## Architecture

Client pages use `useAuth()` from `lib/auth-context.tsx` to get the Cognito ID token. API helpers call `/api/backend/...` with `Authorization: Bearer <id-token>`.

The Next.js backend proxy:

- Reads `API_HOST` and `API_KEY`.
- Preserves query parameters.
- Forwards the Cognito bearer token.
- Adds `x-api-key` server-side.
- Returns the upstream status and body unchanged.

Admin-only enforcement is still the backend's responsibility. Frontend checks are only for navigation and UI visibility.

## API Surface

The frontend wrappers target these API Gateway routes:

- `GET /movies/search?query={query}&page={page}`
- `POST /clubs/{clubId}/movie-nights`
- `GET /clubs/{clubId}/movie-nights/active`
- `POST /movie-nights/{movieNightId}/showtimes`
- `POST /admin/showtimes/gracenote/refresh`
- `PUT /movie-nights/{movieNightId}/vote`
- `GET /movie-nights/{movieNightId}/vote-results`
- `POST /movie-nights/{movieNightId}/confirm`
- `PUT /movie-nights/{movieNightId}/rsvp`
- `GET /clubs/{clubId}/movie-nights/history`

Typed contracts live in `lib/movie-club-types.ts`.

## Route Behavior

- `/` redirects to `/clubs`.
- `/admin` redirects to `/clubs` because admin now requires club context.
- `/sign-in` performs Cognito SRP sign-in with the configured user pool/client.
- `/clubs` currently shows the seeded MVP club. Replace this with a real club-list endpoint when available.
- `/clubs/[clubId]` renders no-active-night, planning, voting, confirmed, completed, and cancelled states.
- `/clubs/[clubId]/admin` supports backend movie search, movie-night creation, manual showtime entry, Gracenote refresh queueing, vote results, and final showtime confirmation.
- `/clubs/[clubId]/history` renders completed/confirmed movie nights returned by the backend.

## Known Backend Coupling

- The current backend does not expose a club-list endpoint, so the frontend uses `NEXT_PUBLIC_DEFAULT_CLUB_ID`.
- The backend's `update-rsvp-lambda` currently accepts `ticketStatus` values `not_purchased` and `purchased`; `need_help` is intentionally not sent yet.
- Manual showtime entry sends `startsAtUtc` from a `datetime-local` control. If the backend tightens UTC validation, convert this value to an ISO UTC string before submission.
- Gracenote cache selection/import UI is not complete because no cache search/list endpoint is exposed. The admin page can queue refreshes and manually add showtimes.

## Verification

Run:

```sh
npm run build
```

Manual checks:

- Signed-out users are redirected from `/clubs` pages to `/sign-in`.
- Sign-in succeeds with a seeded Cognito user.
- Admin can search movies, create a movie night, add a showtime, queue Gracenote refresh, see vote results, and confirm a winner.
- Member can rank up to three unique showtimes and save a vote.
- Confirmed movie nights hide voting and show RSVP/ticket controls.
- History page renders backend results or a clean empty state.
- Missing API/Cognito env vars produce useful error states.
