import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUploadField } from "@/components/image-upload-field";
import { cropImageFile } from "@/lib/image-crop";

const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

const onFileSelect = vi.fn();
const picked = new File([new Uint8Array(5 * 1024 * 1024)], "cover.jpg", { type: "image/jpeg" });
const croppedFile = new File(["cropped"], "image.webp", { type: "image/webp" });

beforeEach(() => {
  mockToastError.mockReset();
  onFileSelect.mockReset();
});

function renderField({ hasImage = false } = {}) {
  render(
    <ImageUploadField
      cropOutputSize={1024}
      cropShape="rect"
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

async function findEnabledApply() {
  const apply = await screen.findByRole("button", { name: "Apply" });
  await waitFor(() => expect(apply).toHaveProperty("disabled", false));
  return apply;
}

describe("ImageUploadField", () => {
  it("passes the cropped image to the caller only after Apply", async () => {
    vi.mocked(cropImageFile).mockResolvedValueOnce(croppedFile);
    renderField();

    pickFile(picked);
    fireEvent.click(await findEnabledApply());

    await waitFor(() => expect(onFileSelect).toHaveBeenCalledWith(croppedFile));
    expect(cropImageFile).toHaveBeenCalledWith(expect.objectContaining({ file: picked, size: 1024 }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Apply" })).toBeNull());
  });

  it("drops the picked image when the crop step is cancelled", async () => {
    renderField();

    pickFile(picked);
    await findEnabledApply();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Apply" })).toBeNull());
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("keeps the crop step open and reports an export failure", async () => {
    vi.mocked(cropImageFile).mockRejectedValueOnce(new Error("encode failed"));
    renderField();

    pickFile(picked);
    fireEvent.click(await findEnabledApply());

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Couldn't crop that image", { description: "Try a different file." })
    );
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("rejects unsupported types and files over 20 MB before cropping", () => {
    renderField();

    pickFile(new File(["image"], "cover.gif", { type: "image/gif" }));
    pickFile(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "cover.png", { type: "image/png" }));

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(2);
  });

  it("only offers removal when there is an image", () => {
    renderField();
    expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull();
  });
});
