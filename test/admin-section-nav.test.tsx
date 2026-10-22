import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSectionNav, type AdminSection } from "@/components/movie-club/admin-section-nav";

afterEach(cleanup);

describe("AdminSectionNav", () => {
  it("links each tab to its panel and exposes the selected section", () => {
    const onChange = vi.fn();
    render(<AdminSectionNav active="showtimes" onChange={onChange} summaries={{ showtimes: "3 approved" }} />);
    const active = screen.getByRole("tab", { name: /showtimes/i });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveAttribute("aria-controls", "admin-panel-showtimes");
    expect(active).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /setup/i })).toHaveAttribute("tabindex", "-1");
    fireEvent.click(screen.getByRole("tab", { name: /people/i }));
    expect(onChange).toHaveBeenCalledWith("people");
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("moves focus and selection with arrows, Home, and End, wrapping at the edges", () => {
    function Workspace() {
      const [active, setActive] = useState<AdminSection>("setup");
      return <AdminSectionNav active={active} onChange={setActive} />;
    }
    render(<Workspace />);
    const setup = screen.getByRole("tab", { name: /setup/i });
    setup.focus();
    fireEvent.keyDown(setup, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /people/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(setup).toHaveFocus();
    fireEvent.keyDown(setup, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /showtimes/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(screen.getByRole("tab", { name: /people/i })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(setup).toHaveFocus();
  });
});
