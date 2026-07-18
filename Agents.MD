# Agents.MD

Guidance for AI coding agents working in this repository.

## Project

This is a club-aware Next.js movie club application using the App Router. It helps signed-in users manage movie clubs, create movie nights, import showtimes, rank candidate showtimes, confirm a final plan, RSVP, and review club history.

## Commands

- `npm run dev` - Start the development server with Turbopack at `http://localhost:3000`.
- `npm run build` - Build the production app.
- `npm run start` - Start the production server.
- `npm run lint` - Run ESLint checks.

## Current Architecture

- Auth is client-side Cognito SRP through `lib/auth-context.tsx`.
- Authenticated app pages are wrapped with `AppShell` / `ProtectedPage` in `components/movie-club/app-shell.tsx`.
- Browser code calls local Next.js routes only. Backend calls go through `app/api/backend/[...path]/route.ts`, which attaches the API key server-side and forwards the Cognito bearer token.
- Typed API helpers live in `lib/movie-club-api.ts`.
- Shared domain types live in `lib/movie-club-types.ts`.
- Date, time, poster, and showtime display helpers live in `lib/movie-club-format.ts`.
- Reusable UI primitives live in `components/ui`.
- The dark cinematic visual direction is documented in `docs/design.md`; design reference captures are under `docs/movie_club_design_system/`.

## Main Routes

- `/` redirects to `/clubs`.
- `/sign-in` and `/sign-up` handle Cognito authentication.
- `/clubs` lists clubs from backend membership records and allows platform admins to create clubs.
- `/clubs/[clubId]` shows the active movie night, voting, confirmed plan, RSVP, and ticket controls.
- `/clubs/[clubId]/admin` supports club invites, movie search/selection, movie-night creation, Gracenote refresh/search, showtime import, vote results, and confirmation.
- `/clubs/[clubId]/history` shows past confirmed/completed movie nights.
- `/invites/[token]` loads public invite details and accepts the invite after sign-in.
- `/admin` redirects to `/clubs`.
- Legacy API routes under `/api/admin`, `/api/admin/selection`, and `/api/showtimes` may still exist for compatibility or older flows. Prefer the club-aware routes and `/api/backend` proxy for new work.

## Backend API Pattern

- Add new frontend API wrappers in `lib/movie-club-api.ts`.
- Keep response/request contracts reflected in `lib/movie-club-types.ts`.
- Call `/api/backend/...` from the browser, not the external API Gateway directly.
- Preserve backend authorization as the source of truth. Frontend checks are only for navigation, form state, and UI visibility.
- Keep API keys server-only. Do not expose API Gateway keys, TMDB credentials, Gracenote credentials, or AWS secrets to client code.

## Environment Variables

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID` - Cognito user pool ID.
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` - Cognito app client ID.
- `NEXT_PUBLIC_AWS_REGION` - AWS region used by the deployment.
- `API_HOST` - API Gateway base URL for the Movie Club backend.
- `API_KEY` - API Gateway key, attached only by Next.js server routes.
- `NEXT_PUBLIC_DEFAULT_CLUB_ID` - Optional fallback club ID used by shell navigation when no route club ID is present.
- `NEXT_PUBLIC_DEFAULT_CLUB_NAME` - Optional default display name for local/demo contexts.
- `ADMIN_SELECTION_GATEWAY_URL` and `ADMIN_SELECTION_API_KEY` are legacy fallbacks used by older admin proxy code.

Do not reintroduce `NEXT_PUBLIC_TMDB_API_KEY` for browser movie search. Movie search should go through the backend so provider credentials stay server-side.

## Product Flows

- Club list and club creation use backend membership/platform-admin APIs.
- Club admins can create invites and copy invite links.
- Movie selection uses backend movie search and now-playing endpoints.
- Showtime management can queue Gracenote refreshes, search cached Gracenote showtimes, import cached showtimes, and add manual showtimes where supported by the current UI.
- Voting supports up to three unique ranked showtimes.
- Confirmed movie nights replace voting with RSVP and ticket-status controls.
- History is loaded from the backend per club.

## Design Guidelines

- Follow the existing dark, cinematic interface in `docs/design.md` and current pages before adding new visual patterns.
- Use lucide-react icons where an icon is appropriate.
- Prefer the existing shadcn/Radix-style primitives in `components/ui`.
- Keep cards, panels, forms, and status banners consistent with the current slate/violet/cyan/amber/green/rose palette.
- Do not add marketing landing-page sections unless the task explicitly asks for them; build the working app surface.

## Working Guidelines

- Prefer existing component, styling, and state patterns before introducing new abstractions.
- Keep edits scoped to the requested feature or fix.
- Use `rg` for searching.
- Read the current code before relying on `CLAUDE.md`; that file is stale.
- Treat `docs/nextjs_handoff.md` as useful background, but verify against the live code because the app has continued to evolve.
- Run `npm run lint` and `npm run build` when changes affect application behavior, routing, API handlers, shared types, or shared UI.
- Do not commit secrets or local environment files.
