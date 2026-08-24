import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmedPlanCard } from "@/components/movie-club/confirmed-plan-card";

afterEach(cleanup);

describe("ConfirmedPlanCard", () => {
  it("makes a confirmed ticket link a clear external action", () => {
    render(
      <ConfirmedPlanCard
        showtime={{
          movieNightId: "night-1",
          showtimeId: "show-1",
          theaterName: "Music Box Theatre",
          startsAtUtc: "2026-07-20T01:30:00Z",
          ticketURI: "https://tickets.example/show-1",
        }}
      />
    );

    expect(screen.getByRole("link", { name: "Buy tickets" })).toHaveAttribute("href", "https://tickets.example/show-1");
    expect(screen.getByRole("link", { name: "Buy tickets" })).toHaveAttribute("target", "_blank");
  });

  it("does not show a ticket action without a ticket URL", () => {
    render(
      <ConfirmedPlanCard
        showtime={{
          movieNightId: "night-1",
          showtimeId: "show-1",
          theaterName: "Music Box Theatre",
          startsAtUtc: "2026-07-20T01:30:00Z",
        }}
      />
    );

    expect(screen.queryByRole("link", { name: "Buy tickets" })).not.toBeInTheDocument();
  });
});
