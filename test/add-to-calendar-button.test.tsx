import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddToCalendarButton } from "@/components/movie-club/add-to-calendar-button";

vi.mock("@/lib/movie-club-api", () => ({ downloadMovieNightCalendar: vi.fn() }));

describe("AddToCalendarButton", () => {
  it("renders only for confirmed movie nights", () => {
    const { rerender } = render(<AddToCalendarButton movieNightId="mn-1" status="planning" token="token" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<AddToCalendarButton movieNightId="mn-1" status="confirmed" token="token" />);
    expect(screen.getByRole("button", { name: /add this confirmed movie night/i })).toBeInTheDocument();
  });
});
