import { describe, expect, it } from "vitest";
import {
  getImageUploadFileExtension,
  imageUploadAccept,
  imageUploadFileTypes,
  imageUploadMaxFileSize,
} from "@/lib/image-upload";

describe("image upload file policy", () => {
  it("exposes the accepted file types as a comma-separated accept value", () => {
    expect(imageUploadAccept).toBe(imageUploadFileTypes.join(","));
  });

  it("limits image uploads to 2 MiB", () => {
    expect(imageUploadMaxFileSize).toBe(2 * 1024 * 1024);
  });

  it("maps supported mime types to object key extensions", () => {
    expect(getImageUploadFileExtension("image/avif")).toBe("avif");
    expect(getImageUploadFileExtension("image/jpeg")).toBe("jpg");
    expect(getImageUploadFileExtension("image/png")).toBe("png");
    expect(getImageUploadFileExtension("image/webp")).toBe("webp");
  });

  it("returns undefined for unsupported mime types", () => {
    expect(getImageUploadFileExtension("image/gif")).toBeUndefined();
  });
});
