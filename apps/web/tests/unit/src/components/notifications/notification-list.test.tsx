import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationItem } from "@/server/services/notification-service";

const authorReplyName = /Carly replied to your review\./;
const groupedReplyLikeName = /Carly and 1 other liked your reply/;
const groupedReplyLikeWithPeriodName = /Carly and 1 other liked your reply\./;
const participantReplyName = /Carly also replied to Alice's review\./;
const replyLikedName = /Carly liked your reply/;
const replyLikedWithPeriodName = /Carly liked your reply\./;

describe("NotificationList", () => {
  it("renders exact reply notification copy", () => {
    const authorItem = createReviewRepliedItem();
    const participantItem = createReviewRepliedItem({
      key: "review_replied:participant",
      recipientOwnsReview: false,
    });
    const replyLikedItem = createReplyLikedItem();

    renderList([authorItem, participantItem, replyLikedItem]);

    expect(screen.getByRole("button", { name: authorReplyName })).toBeTruthy();
    expect(screen.getByRole("button", { name: participantReplyName })).toBeTruthy();
    expect(screen.getByRole("button", { name: replyLikedName })).toBeTruthy();
    expect(screen.queryByRole("button", { name: replyLikedWithPeriodName })).toBeNull();
  });

  it("keeps grouped like copy valid if a source changes between hydration queries", () => {
    const item = createReplyLikedItem({ actorCount: 2 });

    renderList([item]);

    expect(screen.getByRole("button", { name: groupedReplyLikeName })).toBeTruthy();
    expect(screen.queryByRole("button", { name: groupedReplyLikeWithPeriodName })).toBeNull();
  });
});

function renderList(items: NotificationItem[], onNotificationClick = vi.fn()) {
  return render(
    <NotificationList
      isError={false}
      isLoading={false}
      items={items}
      onNotificationClick={onNotificationClick}
      variant="list"
    />
  );
}

function createReviewRepliedItem(
  overrides: Partial<Extract<NotificationItem, { type: "review_replied" }>> = {}
): Extract<NotificationItem, { type: "review_replied" }> {
  return {
    actor: createActor("carly", "Carly"),
    albumId: "album-a",
    albumTitle: "Blue Train",
    href: "/review/review-a",
    key: "review_replied:review-a",
    latestCreatedAt: new Date(),
    recipientOwnsReview: true,
    replyId: "reply-a",
    reviewAuthor: createActor("alice", "Alice"),
    reviewId: "review-a",
    seen: false,
    text: "Carly replied to your review.",
    type: "review_replied",
    ...overrides,
  };
}

function createReplyLikedItem(
  overrides: Partial<Extract<NotificationItem, { type: "reply_liked" }>> = {}
): Extract<NotificationItem, { type: "reply_liked" }> {
  return {
    actorCount: 1,
    actors: [createActor("carly", "Carly")],
    albumId: "album-a",
    albumTitle: "Blue Train",
    href: "/review/review-a",
    key: "reply_liked:reply-a",
    latestCreatedAt: new Date(),
    replyId: "reply-a",
    reviewId: "review-a",
    seen: false,
    text: "Carly liked your reply",
    type: "reply_liked",
    ...overrides,
  };
}

function createActor(username: string, displayUsername: string) {
  return {
    avatarUrl: null,
    displayUsername,
    id: `user-${username}`,
    username,
  };
}
