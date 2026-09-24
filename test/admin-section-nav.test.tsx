import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSectionNav } from "@/components/movie-club/admin-section-nav";

afterEach(cleanup);

describe("AdminSectionNav", () => {
  it("shows the active task and lets admins open every section", () => {
    const onChange = vi.fn();
    render(<AdminSectionNav active="showtimes" onChange={onChange} />);
    expect(screen.getByRole("button", { name: /showtimes/i })).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: /people/i }));
    expect(onChange).toHaveBeenCalledWith("people");
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });
});
