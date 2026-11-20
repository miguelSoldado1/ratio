import { describe, expect, it, vi } from "vitest";
import { isListCoverObjectKey, isUserAvatarObjectKey } from "@/server/image-storage";

vi.mock("@/env", () => ({
  env: {
    CLOUDFLARE_ACCESS_KEY_ID: "access-key",
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_R2_BUCKET_NAME: "bucket",
    CLOUDFLARE_R2_PUBLIC_URL: "https://assets.example.com",
    CLOUDFLARE_SECRET_ACCESS_KEY: "secret",
  },
}));

const userId = "user_123";
const validObjectName = "123e4567-e89b-12d3-a456-426614174000.jpg";

describe("isUserAvatarObjectKey", () => {
  it("accepts valid avatar object keys for the requested user", () => {
    expect(isUserAvatarObjectKey(`avatars/${userId}/${validObjectName}`, userId)).toBe(true);
  });

  it("rejects keys outside the requested user's avatar prefix", () => {
    expect(isUserAvatarObjectKey(`avatars/other_user/${validObjectName}`, userId)).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}-copy/${validObjectName}`, userId)).toBe(false);
  });

  it("rejects invalid object names under the user's avatar prefix", () => {
    expect(isUserAvatarObjectKey(`avatars/${userId}/not-a-uuid.jpg`, userId)).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}/123e4567-e89b-12d3-a456-426614174000.gif`, userId)).toBe(false);
    expect(isUserAvatarObjectKey(`avatars/${userId}/${validObjectName}/extra`, userId)).toBe(false);
  });
});

describe("isListCoverObjectKey", () => {
  const listId = "0b6f3c1e-5d4a-4f8e-9c2b-7a1d3e5f6a7b";

  it("accepts valid cover object keys for the requested list", () => {
    expect(isListCoverObjectKey(`list-covers/${listId}/${validObjectName}`, listId)).toBe(true);
  });

  it("rejects keys for another list or another image kind", () => {
    expect(isListCoverObjectKey(`list-covers/other-list/${validObjectName}`, listId)).toBe(false);
    expect(isListCoverObjectKey(`avatars/${listId}/${validObjectName}`, listId)).toBe(false);
    expect(isListCoverObjectKey(`list-covers/${listId}/not-a-uuid.png`, listId)).toBe(false);
  });
});
