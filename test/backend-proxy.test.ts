// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/backend/[...path]/route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("authenticated backend PATCH proxy", () => {
  it.each([
    ["clubs", "club", "movie-proposals", "proposal"],
    ["movie-nights", "night"],
  ])("forwards versioned writes for %j", async (...path) => {
    vi.stubEnv("API_HOST", "https://backend.example/v1");
    vi.stubEnv("API_KEY", "server-key");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Stale version" }), { status: 409, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const input = JSON.stringify({ version: 2, reason: "Updated" });
    const request = new NextRequest(`https://club.example/api/backend/${path.join("/")}`, { method: "PATCH", headers: { Authorization: "Bearer member-token", "Content-Type": "application/json" }, body: input });
    const result = await PATCH(request, { params: Promise.resolve({ path }) });
    expect(fetch).toHaveBeenCalledWith(new URL(`https://backend.example/v1/${path.join("/")}`), expect.objectContaining({
      method: "PATCH", body: input, cache: "no-store", headers: expect.objectContaining({ Authorization: "Bearer member-token", "x-api-key": "server-key" }),
    }));
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ error: "Stale version" });
  });
  it("rejects unauthenticated planning edits before forwarding", async () => {
    vi.stubEnv("API_HOST", "https://backend.example/v1"); vi.stubEnv("API_KEY", "server-key");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await PATCH(new NextRequest("https://club.example/api/backend/movie-nights/night", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ path: ["movie-nights", "night"] }) });
    expect(result.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
