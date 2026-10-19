import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMovieProposal,
  getMovieNight,
  listMovieNights,
  listMovieProposals,
  MovieClubApiError,
  scheduleMovieProposal,
  updateMovieProposal,
} from "@/lib/movie-club-api";

function reply(body: unknown, status = 200) {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("collaboration API contracts", () => {
  it("encodes proposal pagination and preserves the proxy authentication path", async () => {
    const fetch = reply({ proposals: [], nextCursor: null });
    await listMovieProposals("test-token", "club / 1", "dismissed", { cursor: "opaque+=", limit: 10 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/backend/clubs/club%20%2F%201/movie-proposals?status=dismissed&cursor=opaque%2B%3D&limit=10",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
    );
  });

  it("retains the existing proposal ID from a duplicate conflict", async () => {
    reply({ error: "Already proposed", existingProposalId: "mp-existing" }, 409);
    await expect(createMovieProposal("token", "club", { provider: "tmdb", externalId: "1" })).rejects.toMatchObject({
      name: "MovieClubApiError", status: 409, existingProposalId: "mp-existing",
    } satisfies Partial<MovieClubApiError>);
  });

  it("passes scheduling versions and retry keys without accepting a movie snapshot", async () => {
    const fetch = reply({ proposal: {}, movieNight: {} });
    const input = { version: 3, idempotencyKey: "retry", targetDate: "2099-01-01", dateWindowStart: "2099-01-01", dateWindowEnd: "2099-01-01", zipCode: "60601", radiusMiles: 10 };
    await scheduleMovieProposal("token", "club", "mp/1", input);
    expect(fetch).toHaveBeenCalledWith("/api/backend/clubs/club/movie-proposals/mp%2F1/schedule", expect.objectContaining({
      method: "POST", body: JSON.stringify(input),
    }));
  });

  it("supports versioned dismissal with a moderation reason", async () => {
    const fetch = reply({ proposal: {} });
    const input = { version: 2, status: "dismissed" as const, moderationReason: "Outside club scope" };
    await updateMovieProposal("token", "club", "mp", input);
    expect(fetch).toHaveBeenCalledWith("/api/backend/clubs/club/movie-proposals/mp", expect.objectContaining({ method: "PATCH", body: JSON.stringify(input) }));
  });

  it("lists upcoming nights and loads a directly addressed night", async () => {
    const fetch = reply({ movieNights: [], nextCursor: null });
    await listMovieNights("token", "club", { cursor: "cursor", limit: 2 });
    expect(fetch).toHaveBeenLastCalledWith("/api/backend/clubs/club/movie-nights?scope=upcoming&cursor=cursor&limit=2", expect.anything());
    await getMovieNight("token", "mn/1");
    expect(fetch).toHaveBeenLastCalledWith("/api/backend/movie-nights/mn%2F1", expect.anything());
  });
});
