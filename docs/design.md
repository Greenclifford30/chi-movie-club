# Movie Club Design Specification

## 1. Purpose

This document defines the visual design direction, user experience structure, component patterns, and implementation guidance for the Movie Club web application.

Movie Club should feel like a premium, cinematic planning room: dark, high-contrast, social, and action-oriented. The interface should make it immediately obvious whether the user needs to vote, RSVP, buy a ticket, or simply view the confirmed plan.

The design should support the MVP while leaving room for multi-club navigation, historical movie nights, group movie selection, lightweight comments, and richer admin workflows later.

---

## 2. Product Experience Goals

### Primary UX Goals

1. Make the current movie night status obvious within the first few seconds.
2. Make ranked-choice voting feel simple, not technical.
3. Make admin actions feel controlled and deliberate.
4. Make confirmed plans feel final, shareable, and easy to understand.
5. Keep the app social without making it noisy.
6. Use a dark cinematic theme with strong contrast and vivid accent colors.

### MVP User Actions

The interface should clearly guide users toward one of these actions:

- **Admin:** create a movie night, select a movie, add showtimes, open voting, confirm final plan.
- **Friend / Guest:** review the movie, rank showtimes, edit vote before close, RSVP, mark ticket status.
- **Everyone:** view confirmed details and browse history.

---

## 3. Brand Personality

Movie Club should feel:

- **Cinematic:** inspired by theaters, posters, trailers, night lights, and marquees.
- **Premium but friendly:** polished, not corporate.
- **Social:** designed for friend groups, clubs, and casual collaboration.
- **Clear:** voting and RSVP flows should be obvious and low-friction.
- **Modern:** clean cards, soft glows, strong spacing, subtle motion.

Avoid:

- Flat gray admin-dashboard styling.
- Overly playful colors that reduce readability.
- Cluttered layouts with too many competing CTAs.
- Pure black backgrounds everywhere.
- Low-contrast text on dark panels.

---

## 4. Visual Direction

### Theme Concept

Use a dark theater-inspired theme with layered deep navy / charcoal surfaces and vivid accents.

The background should feel dark and immersive, while cards should be slightly elevated with subtle gradients, borders, and glows.

### Suggested Mood

- Deep midnight background.
- Soft purple and blue glow accents.
- Warm amber highlights for important movie-night details.
- Green success states for confirmed / purchased.
- Rose or red states for closing soon / cancelled / destructive actions.

### Visual Motifs

Use these sparingly:

- Poster-card layouts.
- Theater marquee-inspired labels.
- Glow rings around active selections.
- Gradient overlays behind movie posters.
- Pill badges for formats like IMAX, Dolby, 70mm, Subtitles.
- Timeline/status indicators for Draft → Voting → Confirmed → Completed.

---

## 5. Color System

The app should use semantic color tokens instead of hardcoded one-off colors.

### Core Palette

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#070A12` | App background |
| `background-soft` | `#0B1020` | Page gradient base |
| `surface` | `#111827` | Main card background |
| `surface-raised` | `#172033` | Elevated cards, modals |
| `surface-muted` | `#1F2937` | Secondary panels |
| `border` | `#2D3748` | Default borders |
| `border-strong` | `#475569` | Active card borders |
| `text-primary` | `#F8FAFC` | Primary text |
| `text-secondary` | `#CBD5E1` | Body text |
| `text-muted` | `#94A3B8` | Metadata, helper text |
| `text-disabled` | `#64748B` | Disabled text |

### Accent Palette

| Token | Hex | Usage |
| --- | --- | --- |
| `accent-primary` | `#8B5CF6` | Primary actions, active vote selection |
| `accent-primary-hover` | `#7C3AED` | Primary hover |
| `accent-secondary` | `#22D3EE` | Informational highlights, links |
| `accent-warm` | `#F59E0B` | Showtime/date highlights |
| `accent-rose` | `#F43F5E` | Urgency, voting closing soon |
| `success` | `#22C55E` | Confirmed, going, purchased |
| `warning` | `#FBBF24` | Maybe, pending ticket |
| `danger` | `#EF4444` | Cancelled, destructive |
| `info` | `#38BDF8` | Info banners |

### Gradient Suggestions

Use gradients to add depth but keep readability high.

```css
--gradient-page: radial-gradient(circle at top left, rgba(139, 92, 246, 0.18), transparent 32%),
                 radial-gradient(circle at top right, rgba(34, 211, 238, 0.12), transparent 30%),
                 linear-gradient(180deg, #070A12 0%, #0B1020 100%);

--gradient-card: linear-gradient(145deg, rgba(23, 32, 51, 0.96), rgba(17, 24, 39, 0.96));

--gradient-hero: linear-gradient(90deg, rgba(7, 10, 18, 0.96) 0%, rgba(7, 10, 18, 0.72) 52%, rgba(7, 10, 18, 0.38) 100%);
```

### Contrast Rules

- Body text should use `text-secondary` or brighter.
- Muted text should never be used below `text-sm` unless paired with strong visual grouping.
- Primary CTA text should be white on `accent-primary`.
- Avoid placing rose, purple, or cyan text on similarly saturated dark backgrounds without a high-contrast container.
- Focus states should be bright and visible on all dark surfaces.

---

## 6. Tailwind Theme Guidance

Use CSS variables so the theme can be adjusted later without refactoring components.

### Suggested `app/globals.css`

```css
:root {
  --background: 7 10 18;
  --background-soft: 11 16 32;

  --surface: 17 24 39;
  --surface-raised: 23 32 51;
  --surface-muted: 31 41 55;

  --border: 45 55 72;
  --border-strong: 71 85 105;

  --text-primary: 248 250 252;
  --text-secondary: 203 213 225;
  --text-muted: 148 163 184;
  --text-disabled: 100 116 139;

  --accent-primary: 139 92 246;
  --accent-primary-hover: 124 58 237;
  --accent-secondary: 34 211 238;
  --accent-warm: 245 158 11;
  --accent-rose: 244 63 94;

  --success: 34 197 94;
  --warning: 251 191 36;
  --danger: 239 68 68;
  --info: 56 189 248;
}

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(139, 92, 246, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(34, 211, 238, 0.12), transparent 30%),
    linear-gradient(180deg, rgb(var(--background)) 0%, rgb(var(--background-soft)) 100%);
  color: rgb(var(--text-primary));
}
```

### Tailwind Class Patterns

Use these patterns consistently:

```tsx
// Page shell
"min-h-screen bg-transparent text-slate-50"

// Main content container
"mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"

// Standard card
"rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30 backdrop-blur"

// Raised card
"rounded-2xl border border-violet-400/20 bg-slate-900/90 shadow-xl shadow-violet-950/20"

// Primary button
"rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-cyan-300"

// Secondary button
"rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"

// Muted metadata
"text-sm text-slate-400"
```

---

## 7. Typography

### Font Direction

Use a modern sans-serif for the full app. The typography should feel crisp and readable in dark mode.

Recommended options:

- `Inter`
- `Geist Sans`
- `Manrope`

### Type Scale

| Element | Size | Tailwind |
| --- | --- | --- |
| Hero title | 40–56px | `text-4xl md:text-6xl` |
| Page title | 30–36px | `text-3xl md:text-4xl` |
| Section title | 22–26px | `text-2xl` |
| Card title | 18–22px | `text-lg md:text-xl` |
| Body | 16px | `text-base` |
| Helper text | 14px | `text-sm` |
| Metadata / labels | 12px | `text-xs` |

### Typography Rules

- Use strong, concise headings.
- Avoid long paragraphs in cards.
- Metadata should appear as badges, compact rows, or muted text.
- CTAs should use sentence case, not all caps.
- Use tabular numbers for times, vote scores, countdowns, and attendance counts.

---

## 8. Information Architecture

### Primary Navigation

MVP navigation should include:

- Active Movie Night
- Admin
- History
- Club Switcher
- Profile / Sign out

### Recommended App Shell

Desktop:

- Top navigation bar with Movie Club logo, club switcher, page links, user menu.
- Main content centered with max width.
- Optional right rail for status, vote summary, RSVP summary, or admin actions.

Mobile:

- Top bar with logo and club selector.
- Main action button visible near top of page.
- Use stacked cards.
- Use bottom sticky CTA for vote submission or RSVP on key flows.

### Route Suggestions

```txt
app/
  layout.tsx
  page.tsx
  sign-in/page.tsx
  clubs/page.tsx
  clubs/[clubId]/page.tsx
  clubs/[clubId]/history/page.tsx
  clubs/[clubId]/admin/page.tsx
  movie-nights/[movieNightId]/page.tsx
  movie-nights/[movieNightId]/vote/page.tsx
  movie-nights/[movieNightId]/rsvp/page.tsx
```

---

## 9. Page Designs

## 9.1 Signed-Out Landing / Sign-In Page

### Purpose

Introduce the app and prompt sign-in through Cognito.

### Layout

- Full-screen dark gradient.
- Centered auth card.
- Left or top brand panel with short app value proposition.
- Optional background poster-collage treatment with heavy dark overlay.

### Required Elements

- Movie Club logo / name.
- Short tagline: “Plan movie nights without the group-chat chaos.”
- Cognito sign-in / sign-up UI.
- Guest invite-code entry can be added later.

### Design Notes

Use a compact, polished auth card. Avoid making the sign-in page feel like a generic AWS Amplify default screen. If using Amplify Authenticator, wrap it in a custom themed container.

---

## 9.2 Club Dashboard

### Purpose

Let users choose or view their club context.

### Layout

- Page title: “Your Clubs”
- Grid of club cards.
- Each club card shows:
  - Club name.
  - Active movie night status.
  - Next action: Vote, RSVP, View Plan, Admin Setup.
  - Member count if available.
- Admin-only “Create Club” CTA.

### Empty State

For new users:

- “You are not in any movie clubs yet.”
- CTA: “Create a club” or “Join with invite.”

---

## 9.3 Active Movie Night Page

### Purpose

This is the core user-facing page.

It should adapt based on movie night status:

- Draft / setup.
- Voting open.
- Voting closed.
- Confirmed.
- Completed.
- Cancelled.

### Desktop Layout

Use a two-column responsive layout:

```txt
+------------------------------------------------------+
| Status Banner / Next Action                          |
+-------------------------------+----------------------+
| Movie Hero / Details          | Action Panel         |
| Poster, title, metadata       | Vote / RSVP / Admin  |
+-------------------------------+----------------------+
| Showtime Candidates / Results / Comments             |
+------------------------------------------------------+
```

### Mobile Layout

Stack in this order:

1. Status banner.
2. Movie poster/title.
3. Primary action panel.
4. Showtime list / voting picker.
5. Group summary.
6. Comments or history link.

### Movie Hero

The hero should include:

- Poster.
- Title.
- Year.
- Runtime.
- Genres.
- Rating/popularity metadata if available.
- Overview.
- Current status badge.

Design:

- Poster card with rounded corners and glow.
- Dark gradient panel beside poster.
- Background may use blurred poster art when available, but text must remain readable.

### Status Banner

Examples:

- Draft: “Admin is setting up this movie night.”
- Voting: “Voting is open. Rank your top 3 showtimes.”
- Voting closing soon: “Voting closes tomorrow at 6:00 PM.”
- Voting closed: “Voting has closed. Waiting for admin confirmation.”
- Confirmed: “Movie night confirmed.”
- Completed: “This movie night is complete.”
- Cancelled: “This movie night was cancelled.”

Use color:

- Voting: violet / cyan.
- Closing soon: amber / rose.
- Confirmed: green.
- Completed: slate / cyan.
- Cancelled: red.

---

## 9.4 Voting State

### Purpose

Help users rank their top 3 theater + showtime combinations.

### Design Principles

- Do not expose scoring complexity too heavily.
- Make each ranking slot visually distinct.
- Prevent duplicate selections.
- Show saved vote clearly.
- Make edit behavior obvious before voting closes.

### Recommended Interaction

Use a ranked-choice panel with three slots:

1. First choice — 3 points.
2. Second choice — 2 points.
3. Third choice — 1 point.

Each slot should use either:

- Select dropdown populated with available showtimes, or
- Drag-and-drop cards from a candidate list.

For MVP, dropdown or tap-to-rank is easier and more reliable than drag-and-drop.

### Voting Panel Elements

- Heading: “Rank your top showtimes”
- Helper text: “Pick up to 3. You can edit until voting closes.”
- Three ranking controls.
- Submit button.
- Saved-state confirmation.
- Locked-state message after close.

### Showtime Candidate Card

Each card should show:

- Theater name.
- Neighborhood / address summary.
- Date.
- Start time.
- Screen format badge.
- Source provider badge if useful.
- Vote score or rank only where appropriate.

Example layout:

```txt
AMC River East 21       IMAX
Friday, June 14         7:30 PM
322 E Illinois St       3 first-place votes
```

### Voting Results Preview

For regular members, consider hiding detailed results until confirmation unless product direction changes.

For admins, show:

- Total points.
- First-place vote count.
- Second-place vote count.
- Third-place vote count.
- Tie-breaker indicator.
- Suggested winner.

---

## 9.5 Confirmed State

### Purpose

Make the final plan impossible to miss.

### Layout

Use a strong confirmed-plan card near the top.

### Confirmed Plan Card

Required content:

- Movie title.
- Theater.
- Date.
- Time.
- Screen format.
- RSVP summary.
- User RSVP status.
- User ticket status.

### Visual Treatment

- Green/cyan status glow.
- Strong “Confirmed” badge.
- The final time and theater should be larger than surrounding metadata.
- Use a single primary CTA: “Update RSVP” or “Mark ticket purchased.”

### RSVP Controls

States:

- Going.
- Maybe.
- Not going.
- No response.

Use segmented controls or radio-card buttons.

### Ticket Status Controls

States:

- Not purchased.
- Purchased.
- Need help / pending.

Use compact cards or segmented controls.

### Attendance Summary

Admin should see:

- Going count.
- Maybe count.
- Not going count.
- No response count.
- Purchased count.
- Need help count.

Members can see a simpler summary depending on privacy decision.

---

## 9.6 Admin Page

### Purpose

Give admins a command center for creating and managing the movie night.

### Design

Use a step-based layout rather than a dense settings dashboard.

Recommended steps:

1. Movie.
2. Showtimes.
3. Voting.
4. Results.
5. Confirmation.
6. Attendance.

### Admin Header

Show:

- Club name.
- Movie night status.
- Last updated.
- Admin-only badge.

### Admin Sections

#### Create / Edit Movie Night

- Movie night title.
- Movie selection mode:
  - Admin selected.
  - Group vote, future.
- Voting close date/time.
- Status controls.

#### Movie Search

- Search input.
- Result grid with poster cards.
- Selected movie preview.
- Save selected movie action.

#### Showtime Management

- Manual showtime entry form.
- Import showtimes button / source selector.
- Candidate showtime table/cards.
- Include screen format field prominently.
- Allow remove/edit before voting opens.

#### Voting Management

- Open voting CTA.
- Close voting CTA if needed.
- Lock warning once voting closes.
- Vote totals.

#### Confirm Showtime

- Suggested winner card.
- Tie-breaker notes.
- Manual override option.
- Destructive confirmation guard:
  - “Confirming will lock voting and move this event to RSVP mode.”

#### RSVP / Ticket Summary

- Attendance summary cards.
- Member list table.
- Ticket status badges.

---

## 9.7 History Page

### Purpose

Let members view past movie nights.

### Layout

- Timeline or card grid.
- Filters can be added later.
- Each history card shows:
  - Poster thumbnail.
  - Movie title.
  - Date.
  - Theater.
  - Screen format.
  - Attendance count.
  - User RSVP status if available.

### Empty State

“Your club has not completed any movie nights yet.”

---

## 9.8 Comments / Lightweight Chat

### MVP Optional

Use comments instead of real-time chat.

### Design

- Simple comment thread below the main movie night content.
- Input fixed to card bottom, not viewport.
- Show display name, timestamp, and body.
- Admin comments may have an admin badge.

### Avoid

- Real-time presence indicators in MVP.
- Complex threaded replies.
- Reactions unless very easy to implement.

---

## 10. Component System

## 10.1 Core Components

### `AppShell`

Top-level shell with:

- Header.
- Club switcher.
- Main nav.
- Auth/profile menu.
- Responsive mobile menu.

### `PageHeader`

Reusable page title block with:

- Eyebrow.
- Title.
- Description.
- Optional primary action.

### `StatusBanner`

Reusable event-state banner.

Props:

```ts
type StatusVariant =
  | "draft"
  | "voting"
  | "closing-soon"
  | "voting-closed"
  | "confirmed"
  | "completed"
  | "cancelled";

type StatusBannerProps = {
  variant: StatusVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
};
```

### `MovieHeroCard`

Displays movie metadata and poster.

Props:

```ts
type MovieHeroCardProps = {
  title: string;
  overview?: string;
  posterUrl?: string;
  releaseDate?: string;
  runtimeMinutes?: number;
  genres?: string[];
  rating?: number;
  status?: string;
};
```

### `ShowtimeCard`

Displays one theater + showtime option.

Props:

```ts
type ShowtimeCardProps = {
  theaterName: string;
  theaterLocation?: string;
  startsAt: string;
  screenFormat?: string;
  selected?: boolean;
  disabled?: boolean;
  score?: number;
  rankLabel?: string;
  onSelect?: () => void;
};
```

### `RankedChoicePicker`

Allows top-3 ranked voting.

Props:

```ts
type RankedChoicePickerProps = {
  showtimes: ShowtimeOption[];
  value: string[];
  disabled?: boolean;
  votingClosesAt?: string;
  onChange: (rankings: string[]) => void;
  onSubmit: () => Promise<void>;
};
```

### `VoteResultsCard`

Admin-facing results card.

Props:

```ts
type VoteResult = {
  showtimeId: string;
  theaterName: string;
  startsAt: string;
  screenFormat?: string;
  totalPoints: number;
  firstPlaceVotes: number;
  secondPlaceVotes: number;
  thirdPlaceVotes: number;
  isSuggestedWinner?: boolean;
};
```

### `ConfirmedPlanCard`

Displays final plan after admin confirmation.

Props:

```ts
type ConfirmedPlanCardProps = {
  movieTitle: string;
  theaterName: string;
  theaterLocation?: string;
  startsAt: string;
  screenFormat?: string;
  rsvpSummary?: RsvpSummary;
  ticketSummary?: TicketSummary;
};
```

### `RsvpControl`

Segmented RSVP selector.

### `TicketStatusControl`

Segmented ticket status selector.

### `AdminStepCard`

Admin workflow section card with step number, title, description, status, and content.

### `FormatBadge`

Badge for IMAX, Dolby, 70mm, standard, subtitles, etc.

### `RoleBadge`

Badge for Admin, Friend, Guest.

---

## 11. Component Styling Rules

### Cards

Cards should use:

- `rounded-2xl`
- `border border-white/10`
- `bg-slate-900/80`
- `shadow-xl` or `shadow-2xl`
- `backdrop-blur` where appropriate

Use stronger border colors for selected state:

- Selected vote: `border-violet-400 shadow-violet-950/40`
- Confirmed plan: `border-emerald-400/40 shadow-emerald-950/30`
- Warning: `border-amber-400/40 shadow-amber-950/20`

### Buttons

Primary actions:

- Vote submit.
- Confirm showtime.
- Save selected movie.
- RSVP update.

Secondary actions:

- Edit vote.
- Add showtime.
- View history.
- Cancel.

Destructive actions:

- Cancel movie night.
- Remove showtime after warning.
- Delete comment.

### Badges

Badges should be rounded pills with subtle background tint.

Examples:

```tsx
"rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-200"
```

### Forms

- Inputs should be dark, high-contrast, and clearly focused.
- Validation errors should appear close to the field.
- Forms should have clear submit state and optimistic feedback where safe.

---

## 12. Interaction Design

### Loading States

Use skeletons rather than spinners for main page content.

Skeleton examples:

- Movie poster rectangle.
- Movie title line.
- Showtime card placeholders.
- Vote panel placeholders.

### Empty States

Each empty state should include:

- Clear explanation.
- One suggested next action.
- Optional admin-only CTA.

Examples:

- No active movie night.
- No showtimes added yet.
- No votes submitted yet.
- No history yet.

### Error States

Errors should be specific and actionable.

Examples:

- “We could not load this movie night. Try refreshing.”
- “Voting has already closed.”
- “You must sign in before voting.”
- “Only club admins can confirm a showtime.”

### Optimistic UI

Use optimistic updates for:

- Vote save.
- RSVP update.
- Ticket status update.
- Comment submission.

Avoid optimistic updates for:

- Admin confirmation.
- Event cancellation.
- Role/membership changes.

### Confirmation Dialogs

Require confirmation for:

- Confirm final showtime.
- Close voting early.
- Cancel movie night.
- Remove candidate showtime after votes exist.

---

## 13. Accessibility

### Contrast

- Maintain WCAG AA contrast for all body text.
- Keep focus rings highly visible on dark backgrounds.
- Do not rely on color alone for status; pair with labels/icons.

### Keyboard Support

All core actions must be keyboard accessible:

- Club switcher.
- Movie search results.
- Showtime ranking controls.
- RSVP segmented controls.
- Admin confirmation dialogs.

### Screen Readers

Use semantic elements:

- `main`, `section`, `header`, `nav`.
- Proper form labels.
- `aria-live` for save success/error messages.
- Descriptive alt text for movie posters.

Poster alt text example:

```txt
Poster for Dune: Part Two
```

### Reduced Motion

Respect `prefers-reduced-motion`.

Motion should enhance state transitions but never be required to understand the UI.

---

## 14. Responsive Design

### Breakpoints

Use Tailwind defaults:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Mobile Priorities

On mobile, prioritize:

1. Current status.
2. Primary action.
3. Movie details.
4. Voting / RSVP controls.
5. Showtime details.
6. Social/admin summaries.

### Desktop Priorities

On desktop, use side-by-side layouts:

- Movie hero left, action panel right.
- Admin workflow left, preview/results right.
- History grid with poster-heavy cards.

### Sticky Actions

Use sticky bottom action bars on mobile for:

- Submit vote.
- Save RSVP.
- Confirm admin action only after explicit review.

---

## 15. Motion and Microinteractions

Use subtle motion:

- Card hover lift: `translate-y-[-2px]`.
- Selected showtime glow.
- Saved vote success check animation.
- Status banner fade-in.
- Admin step completion transition.

Avoid:

- Large page animations.
- Distracting neon pulsing.
- Animation on every card at once.
- Motion that delays primary actions.

Recommended transition:

```tsx
"transition duration-200 ease-out"
```

---

## 16. Data Display Rules

### Date and Time

Show dates in a friendly format:

- `Fri, Jun 14`
- `7:30 PM`
- For confirmed plan: `Friday, June 14 at 7:30 PM`

### Voting Deadline

Show both relative and exact where useful:

- `Closes tomorrow at 6:00 PM`
- `Voting closes Fri, Jun 13 at 6:00 PM`

### Screen Format

Always surface format where available:

- IMAX
- Dolby Cinema
- 70mm
- Standard
- Subtitles
- Open Caption
- Recliner seating, optional

### Vote Results

Admin results should show enough detail to explain the winner:

```txt
1. AMC River East 21 — 7:30 PM
   14 points · 4 first-place votes · Suggested winner
```

### RSVP

Use plain language:

- Going
- Maybe
- Not going
- No response

### Ticket Status

Use plain language:

- Not purchased
- Purchased
- Need help

---

## 17. Design Acceptance Criteria

The design is successful when:

- The app is visually dark, cinematic, and readable.
- Users can tell the movie night status immediately.
- Voting can be completed without reading a long explanation.
- Duplicate showtime rankings are visually prevented or clearly invalid.
- Admins can understand the winner and confirm the final showtime.
- Confirmed movie details are prominent and easy to share verbally.
- RSVP and ticket status updates feel fast and obvious.
- The layout works well on mobile and desktop.
- All core interactions are accessible by keyboard.
- Color contrast remains strong across all UI states.

---

## 18. Suggested MVP Screen List

Build these screens first:

1. Signed-in active movie night page.
2. Voting-open state.
3. Confirmed state with RSVP and ticket status.
4. Admin movie night setup page.
5. Admin showtime management section.
6. Admin vote results and confirm section.
7. Club dashboard.
8. History page.
9. Signed-out auth page.

---

## 19. Implementation Notes for Next.js 15

### Recommended Component Organization

```txt
components/
  app-shell/
    app-shell.tsx
    club-switcher.tsx
    user-menu.tsx
  movie-night/
    movie-hero-card.tsx
    status-banner.tsx
    showtime-card.tsx
    ranked-choice-picker.tsx
    confirmed-plan-card.tsx
    rsvp-control.tsx
    ticket-status-control.tsx
  admin/
    admin-step-card.tsx
    movie-search-panel.tsx
    showtime-manager.tsx
    vote-results-card.tsx
  history/
    history-card.tsx
  ui/
    button.tsx
    card.tsx
    badge.tsx
    dialog.tsx
    input.tsx
    select.tsx
```

### Server and Client Component Guidance

Use React Server Components for:

- Loading active movie night data.
- Loading history.
- Loading admin page initial data.
- Fetching denormalized movie metadata.

Use Client Components for:

- Ranked-choice picker.
- RSVP control.
- Ticket status control.
- Movie search input.
- Admin forms.
- Dialogs and interactive menus.

### Server Actions

Use server actions for:

- Submit/update vote.
- Update RSVP.
- Update ticket status.
- Add/edit/remove showtimes.
- Confirm showtime.
- Create movie night.

Each server action must enforce authorization server-side.

### shadcn/ui Guidance

Good candidates for shadcn/ui:

- Button
- Card
- Dialog
- Select
- Input
- Textarea
- Tabs
- Dropdown Menu
- Badge
- Skeleton
- Toast / Sonner

Theme shadcn components to match the dark cinematic style. Do not leave defaults that clash with the app theme.

---

## 20. Copywriting Guidelines

### Voice

Use clear, friendly language.

Examples:

- “Rank your top 3 showtimes.”
- “You can edit your vote until voting closes.”
- “Movie night confirmed.”
- “Mark ticket purchased.”
- “Waiting for admin confirmation.”

Avoid:

- “Submit ballot payload.”
- “Event entity locked.”
- “Mutation failed.”
- “Ranked-choice algorithm completed.”

### Admin Confirmation Copy

Use clear warnings:

```txt
Confirm this showtime?
Voting will be locked and members will see this as the final movie night plan.
```

### Vote Save Success

```txt
Vote saved. You can edit it until voting closes.
```

### Voting Closed

```txt
Voting is closed. The admin will confirm the final showtime soon.
```

---

## 21. Design Tokens Summary

```ts
export const movieClubTheme = {
  colors: {
    background: "#070A12",
    backgroundSoft: "#0B1020",
    surface: "#111827",
    surfaceRaised: "#172033",
    surfaceMuted: "#1F2937",
    border: "#2D3748",
    borderStrong: "#475569",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    accentPrimary: "#8B5CF6",
    accentSecondary: "#22D3EE",
    accentWarm: "#F59E0B",
    accentRose: "#F43F5E",
    success: "#22C55E",
    warning: "#FBBF24",
    danger: "#EF4444",
    info: "#38BDF8",
  },
  radius: {
    card: "1rem",
    panel: "1.25rem",
    modal: "1.5rem",
  },
  shadow: {
    card: "0 24px 80px rgba(0, 0, 0, 0.35)",
    glowViolet: "0 0 32px rgba(139, 92, 246, 0.24)",
    glowCyan: "0 0 32px rgba(34, 211, 238, 0.18)",
    glowGreen: "0 0 32px rgba(34, 197, 94, 0.18)",
  },
};
```

---

## 22. First Prototype Direction

The first visual prototype should focus on the active movie night page.

Prototype these states:

1. Voting open with top-3 ranking.
2. Vote saved state.
3. Voting closed waiting for admin confirmation.
4. Confirmed state with RSVP and ticket controls.
5. Admin view with vote results and confirm action.

The visual test is simple: when someone opens the page, they should immediately know the movie, the current status, and the one action they should take next.
