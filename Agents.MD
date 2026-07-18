# Agents.MD

Guidance for AI coding agents working in this repository.

## Project

This is a Next.js 15 movie club application using the App Router. It helps a group coordinate movie outings by selecting a movie, discovering Chicago-area showtimes, and collecting ranked voting preferences.

## Commands

- `npm run dev` - Start the development server with Turbopack at `http://localhost:3000`.
- `npm run build` - Build the production app.
- `npm run start` - Start the production server.
- `npm run lint` - Run ESLint checks.

## Architecture Notes

- Admin movie selection lives under `/admin`.
- Showtime lookup is handled through the `/api/showtimes` endpoint.
- The app uses client-side React state and `localStorage` for selected movie persistence.
- TMDB is used for movie data and posters.
- SerpAPI is used for showtime search.
- Styling uses Tailwind CSS v4, shadcn/ui, Radix UI primitives, and class-variance-authority.

## Environment Variables

- `NEXT_PUBLIC_TMDB_API_KEY` - TMDB API bearer token.
- `SERP_API_KEY` - SerpAPI key for server-side showtime searches.

## Working Guidelines

- Prefer existing component, styling, and state patterns before introducing new abstractions.
- Keep edits scoped to the requested feature or fix.
- Use `rg` for searching.
- Run `npm run lint` and `npm run build` when changes affect application behavior, routing, API handlers, or shared UI.
- Do not commit secrets or local environment files.
