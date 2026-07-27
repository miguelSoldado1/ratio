import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListManagementMenu } from "@/components/list/list-management-menu";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

describe("ListManagementMenu", () => {
  it("requires confirmation before deleting a list", async () => {
    const onDelete = vi.fn();

    render(<ListManagementMenu onDelete={onDelete} onRename={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Open list actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete list" }));

    expect(onDelete).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Delete this list?" })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete list" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
