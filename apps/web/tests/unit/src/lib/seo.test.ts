import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSeoMeta,
  defaultSeoImage,
  defaultSeoImageHeight,
  defaultSeoImageWidth,
  faviconLinks,
  getAbsoluteAssetUrl,
} from "@/lib/seo";

describe("seo metadata", () => {
  it("uses a conventional crawlable favicon link first for Google-style SERP parsers", () => {
    expect(faviconLinks[0]).toEqual({
      href: "/favicon.ico",
      rel: "icon",
      sizes: "48x48",
      type: "image/x-icon",
    });
  });

  it("uses a full-size default social preview image", () => {
    const meta = createSeoMeta({ path: "/" });

    expect(meta).toContainEqual({
      content: `https://ratiomusic.live${defaultSeoImage}`,
      property: "og:image",
    });
    expect(meta).toContainEqual({
      content: String(defaultSeoImageWidth),
      property: "og:image:width",
    });
    expect(meta).toContainEqual({
      content: String(defaultSeoImageHeight),
      property: "og:image:height",
    });
    expect(meta).toContainEqual({
      content: "summary_large_image",
      name: "twitter:card",
    });
  });

  it("resolves relative asset URLs against the configured site URL", () => {
    expect(getAbsoluteAssetUrl("/favicon.ico")).toBe("https://ratiomusic.live/favicon.ico");
  });

  it("keeps the public preview and favicon assets crawler-compatible", () => {
    expect(readPngSize("public/og-image.png")).toEqual({
      height: defaultSeoImageHeight,
      width: defaultSeoImageWidth,
    });
    expect(readIcoSizes("public/favicon.ico")).toContainEqual({ height: 48, width: 48 });
  });
});

function readPngSize(relativePath: string) {
  const buffer = readFileSync(join(process.cwd(), relativePath));

  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

function readIcoSizes(relativePath: string) {
  const buffer = readFileSync(join(process.cwd(), relativePath));
  const imageCount = buffer.readUInt16LE(4);
  const sizes: Array<{ height: number; width: number }> = [];

  for (let index = 0; index < imageCount; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = buffer[entryOffset] === 0 ? 256 : buffer[entryOffset];
    const height = buffer[entryOffset + 1] === 0 ? 256 : buffer[entryOffset + 1];

    sizes.push({ height, width });
  }

  return sizes;
}
