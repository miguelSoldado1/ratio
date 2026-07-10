import { describe, expect, it, vi } from "vitest";
import { isUserAvatarObjectKey } from "@/server/avatar-storage";

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
