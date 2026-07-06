import { describe, expect, it } from "vitest";
import {
  displayUsernameMaxLength,
  getDisplayUsernameLength,
  isDisplayUsernameValid,
  limitDisplayUsername,
  trimDisplayUsername,
} from "@/lib/auth/profile-identity";

describe("display username helpers", () => {
  it("trims display usernames", () => {
    expect(trimDisplayUsername("  Alice  ")).toBe("Alice");
  });

  it("counts trimmed display username characters", () => {
    expect(getDisplayUsernameLength("  Alice  ")).toBe(5);
    expect(getDisplayUsernameLength("  💿  ")).toBe(1);
  });

  it("validates non-empty display usernames up to the max length", () => {
    expect(isDisplayUsernameValid("Alice")).toBe(true);
    expect(isDisplayUsernameValid(" ")).toBe(false);
    expect(isDisplayUsernameValid("a".repeat(displayUsernameMaxLength + 1))).toBe(false);
  });

  it("limits display usernames to the max length", () => {
    expect(limitDisplayUsername(` ${"a".repeat(displayUsernameMaxLength + 1)} `)).toBe(
      "a".repeat(displayUsernameMaxLength)
    );
  });

  it("falls back to User when limiting an empty display username", () => {
    expect(limitDisplayUsername("   ")).toBe("User");
  });
});
