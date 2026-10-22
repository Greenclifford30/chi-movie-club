import { describe, expect, it } from "vitest";
import { moviePlanningDates, validatePlanningWindow } from "@/lib/movie-club-planning";

const validPlanning = {
  targetDate: "2026-07-20",
  dateWindowStart: "2026-07-19",
  dateWindowEnd: "2026-07-22",
};

describe("validatePlanningWindow", () => {
  it("accepts a future window containing the target date", () => {
    expect(validatePlanningWindow(validPlanning, "2026-07-18")).toBeNull();
  });

  it("rejects missing, stale, inverted, and out-of-window dates", () => {
    expect(validatePlanningWindow({ ...validPlanning, targetDate: "" }, "2026-07-18")).toMatch(/complete/i);
    expect(validatePlanningWindow({ ...validPlanning, dateWindowStart: "2026-07-17" }, "2026-07-18")).toMatch(/past/i);
    expect(validatePlanningWindow({ ...validPlanning, dateWindowEnd: "2026-07-18" }, "2026-07-18")).toMatch(/end/i);
    expect(validatePlanningWindow({ ...validPlanning, targetDate: "2026-07-23" }, "2026-07-18")).toMatch(/inside/i);
  });
});


describe("moviePlanningDates", () => {
  it("uses the release date for all three dates of an upcoming movie", () => {
    expect(moviePlanningDates("2026-12-18", "2026-10-22")).toEqual({ targetDate: "2026-12-18", dateWindowStart: "2026-12-18", dateWindowEnd: "2026-12-18" });
  });

  it.each(["2026-10-22", "2016-11-11", undefined, "", "2026", "invalid", "2027-02-30"])("falls back to today for a released or unknown date: %s", releaseDate => {
    expect(moviePlanningDates(releaseDate, "2026-10-22")).toEqual({ targetDate: "2026-10-22", dateWindowStart: "2026-10-22", dateWindowEnd: "2026-10-22" });
  });

  it("keeps release calendar dates independent of device timezone", () => {
    expect(moviePlanningDates("2026-12-18T00:00:00Z", "2026-10-22").targetDate).toBe("2026-12-18");
  });
});
