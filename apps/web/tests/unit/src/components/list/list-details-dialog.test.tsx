import { fireEvent, render, screen } from "@testing-library/react";
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
  it("hands a picked cover to onSubmit only when the dialog is saved", () => {
    const { onOpenChange, onSubmit } = renderDialog();

    fireEvent.change(screen.getByLabelText("Cover"), { target: { files: [cover] } });
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

  it("drops a pending removal when a new cover is picked", () => {
    const { onSubmit } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));
    fireEvent.change(screen.getByLabelText("Cover"), { target: { files: [cover] } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith({ coverFile: cover, details, removeCover: false });
  });
});

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
