import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InviteList,
  MemberList,
  inviteShareData,
  shareInviteNatively,
} from "@/app/clubs/[clubId]/admin/page";
import type { ClubInvite } from "@/lib/movie-club-types";

const invite: ClubInvite = {
  clubId: "club-1",
  clubName: "Chicago Movie Club",
  inviteId: "invite-1",
  email: "friend@example.com",
  role: "friend",
  status: "pending",
  expiresAt: "2026-07-26T00:00:00Z",
  inviteUrl: "https://movies.example.com/invites/token",
};

const shareLinkInvite: ClubInvite = {
  ...invite,
  inviteId: "invite-share-link",
  email: undefined,
  inviteType: "share_link",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

describe("native invite sharing", () => {
  it("builds club-specific share content", () => {
    expect(inviteShareData(invite)).toEqual({
      title: "Join Chicago Movie Club",
      text: "You're invited to join Chicago Movie Club for movie nights.",
      url: invite.inviteUrl,
    });
  });

  it("passes the invite to the native share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    await expect(shareInviteNatively(invite)).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith(inviteShareData(invite));
  });

  it("uses the same friendly message for a reusable share link", () => {
    expect(inviteShareData(shareLinkInvite).text).toBe("You're invited to join Chicago Movie Club for movie nights.");
  });

  it("treats share-sheet cancellation as a non-error", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    await expect(shareInviteNatively(invite)).resolves.toBe(false);
  });

  it("surfaces unexpected native sharing failures", async () => {
    const shareError = new Error("Sharing unavailable");
    const share = vi.fn().mockRejectedValue(shareError);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    await expect(shareInviteNatively(invite)).rejects.toBe(shareError);
  });

  it("shows Share only when supported and always retains Copy", () => {
    const onShare = vi.fn();
    const onCopy = vi.fn();
    const onRevoke = vi.fn();
    const { rerender } = render(
      <InviteList
        invites={[invite]}
        copiedInviteId={null}
        supportsNativeShare={false}
        onCopy={onCopy}
        onShare={onShare}
        onRevoke={onRevoke}
        isRevoking={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /share invite/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy invite link/i }));
    expect(onCopy).toHaveBeenCalledWith(invite);

    rerender(
      <InviteList
        invites={[invite]}
        copiedInviteId={null}
        supportsNativeShare
        onCopy={onCopy}
        onShare={onShare}
        onRevoke={onRevoke}
        isRevoking={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /share invite/i }));
    expect(onShare).toHaveBeenCalledWith(invite);
    expect(screen.getByRole("button", { name: /copy invite link/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /revoke invite/i }));
    expect(onRevoke).toHaveBeenCalledWith(invite);
  });

  it("renders current club members and an empty state", () => {
    const { rerender } = render(<MemberList members={[]} />);
    expect(screen.getByText(/no active members/i)).toBeInTheDocument();

    rerender(<MemberList members={[{ clubId: "club-1", userId: "user-1", name: "Alex Rivera", email: "alex@example.com", role: "admin", status: "active" }]} />);
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com · active membership")).toBeInTheDocument();
  });
});
