# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack (runs on http://localhost:3000)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

## Architecture

This is a Next.js 15 movie club application that helps groups coordinate movie outings. The app uses the App Router pattern.

### Core Features
- **Movie Selection**: Admin page (`/admin`) allows selecting a featured movie from TMDB API
- **Showtime Discovery**: Main page displays selected movie and fetches showtimes via SerpAPI
- **Voting System**: Users can rank their preferred theater/time combinations

### Key Integrations
- **TMDB API**: Fetches movie data and posters (requires `NEXT_PUBLIC_TMDB_API_KEY`)
- **SerpAPI**: Searches for movie showtimes in Chicago area (requires `SERP_API_KEY`)
- **shadcn/ui**: Component library with Radix UI primitives and Tailwind CSS

### Data Flow
1. Admin selects movie on `/admin` page → stores movie ID in localStorage
2. Main page reads localStorage → fetches movie details from TMDB
3. Movie title triggers showtime search via `/api/showtimes` endpoint
4. SerpAPI returns theater data which gets parsed for display

### State Management
- Uses localStorage for persisting selected movie between admin and main pages
- Client-side state with React hooks for UI interactions
- No external state management library

### Styling
- Tailwind CSS v4 with custom dark theme (zinc color palette)
- CSS variables for fonts (Geist Sans/Mono from Google Fonts)
- Component styling via class-variance-authority and clsx

### Environment Variables Required
- `NEXT_PUBLIC_TMDB_API_KEY` - TMDB API bearer token (public)
- `SERP_API_KEY` - SerpAPI key for showtime searches (server-only)