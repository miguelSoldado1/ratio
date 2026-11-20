import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUploadField } from "@/components/image-upload-field";

const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

const onFileSelect = vi.fn();

beforeEach(() => {
  mockToastError.mockReset();
  onFileSelect.mockReset();
});

function renderField({ hasImage = false } = {}) {
  render(
    <ImageUploadField
      disabled={false}
      hasImage={hasImage}
      label="Cover"
      onFileSelect={onFileSelect}
      onRemove={vi.fn()}
      preview={null}
      removeLabel="Remove cover"
      statusLabel="Status"
      uploadIcon={null}
      uploadLabel="Upload cover"
    />
  );
}

function pickFile(file: File) {
  fireEvent.change(screen.getByLabelText("Cover"), { target: { files: [file] } });
}

describe("ImageUploadField", () => {
  it("passes an accepted image to the caller", () => {
    renderField();
    const file = new File(["image"], "cover.webp", { type: "image/webp" });

    pickFile(file);

    expect(onFileSelect).toHaveBeenCalledWith(file);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("rejects unsupported types and files over 2 MB before the caller sees them", () => {
    renderField();

    pickFile(new File(["image"], "cover.gif", { type: "image/gif" }));
    pickFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "cover.png", { type: "image/png" }));

    expect(onFileSelect).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(2);
  });

  it("only offers removal when there is an image", () => {
    renderField();
    expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull();
  });
});
