import { describe, expect, it } from "vitest";
import { avatarAccept, avatarFileTypes, avatarMaxFileSize, getAvatarFileExtension } from "@/lib/avatar";

describe("avatar file policy", () => {
  it("exposes the accepted file types as a comma-separated accept value", () => {
    expect(avatarAccept).toBe(avatarFileTypes.join(","));
  });

  it("limits avatar uploads to 2 MiB", () => {
    expect(avatarMaxFileSize).toBe(2 * 1024 * 1024);
  });

  it("maps supported mime types to object key extensions", () => {
    expect(getAvatarFileExtension("image/avif")).toBe("avif");
    expect(getAvatarFileExtension("image/jpeg")).toBe("jpg");
    expect(getAvatarFileExtension("image/png")).toBe("png");
    expect(getAvatarFileExtension("image/webp")).toBe("webp");
  });

  it("returns undefined for unsupported mime types", () => {
    expect(getAvatarFileExtension("image/gif")).toBeUndefined();
  });
});
