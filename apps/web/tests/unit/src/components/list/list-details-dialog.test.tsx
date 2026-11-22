import { pickCroppedImage } from "@test/image-crop";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListDetailsDialog } from "@/components/list/list-details-dialog";
import type { ComponentProps } from "react";

const cover = new File(["cover"], "cover.png", { type: "image/png" });
const details = { description: null, isRanked: false, title: "Covered" };

function renderDialog(props: Partial<ComponentProps<typeof ListDetailsDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <ListDetailsDialog
      coverStatusLabel={undefined}
      currentCover={{ coverAlbums: [], coverUrl: "https://assets.example.com/list-covers/old.png" }}
      initialValues={{ description: "", isRanked: false, title: "Covered" }}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open
      variant="edit"
      {...props}
    />
  );

  return { onOpenChange, onSubmit };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ListDetailsDialog cover", () => {
  it("hands a picked cover to onSubmit only when the dialog is saved", async () => {
    const { onOpenChange, onSubmit } = renderDialog();

    await pickCroppedImage("Cover", cover);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith({ coverFile: cover, details, removeCover: false });
  });

  it("marks the current cover for removal without saving anything", () => {
    const { onSubmit } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Remove cover" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith({ coverFile: undefined, details, removeCover: true });
  });

  it("drops a pending removal when a new cover is picked", async () => {
    const { onSubmit } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));
    await pickCroppedImage("Cover", cover);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith({ coverFile: cover, details, removeCover: false });
  });
});

describe("ListDetailsDialog reset", () => {
  it("starts fresh from the current values each time it opens", async () => {
    const props = {
      coverStatusLabel: undefined,
      currentCover: { coverAlbums: [], coverUrl: undefined },
      onOpenChange: vi.fn(),
      onSubmit: vi.fn(),
      variant: "edit" as const,
    };
    const { rerender } = render(
      <ListDetailsDialog {...props} initialValues={{ description: "", isRanked: false, title: "Covered" }} open />
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved" } });
    await pickCroppedImage("Cover", cover);
    rerender(
      <ListDetailsDialog
        {...props}
        initialValues={{ description: "", isRanked: false, title: "Covered" }}
        open={false}
      />
    );
    await waitFor(() => expect(screen.queryByLabelText("Title")).toBeNull());
    rerender(
      <ListDetailsDialog {...props} initialValues={{ description: "", isRanked: true, title: "Renamed" }} open />
    );

    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Renamed");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(props.onSubmit).toHaveBeenCalledWith({
      coverFile: undefined,
      details: { description: null, isRanked: true, title: "Renamed" },
      removeCover: false,
    });
  });

  it("keeps a picked cover when a details save updates the values while open", async () => {
    const props = {
      coverStatusLabel: undefined,
      currentCover: { coverAlbums: [], coverUrl: undefined },
      onOpenChange: vi.fn(),
      onSubmit: vi.fn(),
      open: true,
      variant: "edit" as const,
    };
    const { rerender } = render(
      <ListDetailsDialog {...props} initialValues={{ description: "", isRanked: false, title: "Covered" }} />
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Saved" } });
    await pickCroppedImage("Cover", cover);
    rerender(<ListDetailsDialog {...props} initialValues={{ description: "", isRanked: false, title: "Saved" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      coverFile: cover,
      details: { description: null, isRanked: false, title: "Saved" },
      removeCover: false,
    });
  });
});

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
