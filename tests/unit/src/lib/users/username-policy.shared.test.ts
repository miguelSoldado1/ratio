import { describe, expect, it } from "vitest";
import {
  isReservedUsername,
  isUsernameFormatValid,
  normalizeUsername,
  validateSharedUsernamePolicy,
} from "@/lib/users/username-policy.shared";

describe("normalizeUsername", () => {
  it("trims whitespace and lowercases usernames", () => {
    expect(normalizeUsername("  Ratio_User.01  ")).toBe("ratio_user.01");
  });
});

describe("isReservedUsername", () => {
  it("matches reserved names after normalization", () => {
    expect(isReservedUsername(" Admin ")).toBe(true);
    expect(isReservedUsername("regular_user")).toBe(false);
  });
});

describe("validateSharedUsernamePolicy", () => {
  it("accepts normalized usernames with letters, numbers, underscores, and dots", () => {
    expect(validateSharedUsernamePolicy(" Music_Fan.42 ")).toEqual({
      normalizedUsername: "music_fan.42",
      valid: true,
    });
  });

  it("rejects usernames outside the length limits", () => {
    expect(validateSharedUsernamePolicy("ab")).toEqual({
      normalizedUsername: "ab",
      reason: "invalid-format",
      valid: false,
    });

    expect(validateSharedUsernamePolicy("a".repeat(31))).toEqual({
      normalizedUsername: "a".repeat(31),
      reason: "invalid-format",
      valid: false,
    });
  });

  it("rejects unsupported characters", () => {
    expect(validateSharedUsernamePolicy("music-fan")).toEqual({
      normalizedUsername: "music-fan",
      reason: "invalid-format",
      valid: false,
    });
  });

  it("rejects reserved usernames", () => {
    expect(validateSharedUsernamePolicy("settings")).toEqual({
      normalizedUsername: "settings",
      reason: "reserved",
      valid: false,
    });
  });
});

describe("isUsernameFormatValid", () => {
  it("returns the shared policy validity", () => {
    expect(isUsernameFormatValid("music_fan")).toBe(true);
    expect(isUsernameFormatValid("api")).toBe(false);
    expect(isUsernameFormatValid("music fan")).toBe(false);
  });
});
