import { describe, expect, it } from "vitest";
import { validatePlanningWindow } from "@/lib/movie-club-planning";

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
