import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  const area = { height: 100, width: 100, x: 0, y: 0 };

  function Cropper({ onCropComplete }: { onCropComplete: (area: unknown, areaPixels: unknown) => void }) {
    useEffect(() => onCropComplete(area, area), []);
    return null;
  }

  return { default: Cropper };
});

vi.mock("@/lib/image-crop", () => ({
  cropImageFile: vi.fn(({ file }: { file: File }) => Promise.resolve(file)),
}));

afterEach(() => {
  cleanup();
});
