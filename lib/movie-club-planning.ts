import type { MovieNightPlanningInput } from "@/lib/movie-club-types";

export function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validatePlanningWindow(
  planning: Pick<MovieNightPlanningInput, "targetDate" | "dateWindowStart" | "dateWindowEnd">,
  today = localDateValue()
) {
  const { targetDate, dateWindowStart, dateWindowEnd } = planning;
  if (!targetDate || !dateWindowStart || !dateWindowEnd) {
    return "Choose a target date and a complete showtime search window.";
  }
  if (dateWindowStart < today) {
    return "The showtime window cannot start in the past.";
  }
  if (dateWindowEnd < dateWindowStart) {
    return "The showtime window end must be on or after its start.";
  }
  if (targetDate < dateWindowStart || targetDate > dateWindowEnd) {
    return "The target date must fall inside the showtime search window.";
  }
  return null;
}
