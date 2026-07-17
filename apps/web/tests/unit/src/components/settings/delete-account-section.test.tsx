import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";

describe("DeleteAccountSection", () => {
  it("opts the confirmation field out of browser and password-manager autofill", () => {
    render(<DeleteAccountSection confirmationHandle="alice" isPending={false} onDeleteAccount={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const confirmationInput = screen.getByLabelText("Type alice to confirm");

    expect(confirmationInput.getAttribute("autocomplete")).toBe("off");
    expect(confirmationInput.getAttribute("data-1p-ignore")).toBe("true");
    expect(confirmationInput.getAttribute("data-bwignore")).toBe("true");
    expect(confirmationInput.getAttribute("data-form-type")).toBe("other");
    expect(confirmationInput.getAttribute("data-lpignore")).toBe("true");
    expect(confirmationInput.getAttribute("name")).toBe("delete-account-confirmation");
  });

  it("keeps delete disabled until the exact confirmation matches", () => {
    const onDeleteAccount = vi.fn();
    render(<DeleteAccountSection confirmationHandle="alice" isPending={false} onDeleteAccount={onDeleteAccount} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    const deleteButton = within(dialog).getByRole("button", { name: "Delete account" });

    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Type alice to confirm"), { target: { value: "Alice" } });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Type alice to confirm"), { target: { value: "alice" } });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("resets confirmation on close", async () => {
    render(<DeleteAccountSection confirmationHandle="alice" isPending={false} onDeleteAccount={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText("Type alice to confirm"), { target: { value: "alice" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Type alice to confirm")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect((screen.getByLabelText("Type alice to confirm") as HTMLInputElement).value).toBe("");
  });

  it("calls delete handler only after confirmation matches", () => {
    const onDeleteAccount = vi.fn();
    render(<DeleteAccountSection confirmationHandle="alice" isPending={false} onDeleteAccount={onDeleteAccount} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
    expect(onDeleteAccount).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Type alice to confirm"), { target: { value: "alice" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
    expect(onDeleteAccount).toHaveBeenCalledWith("alice");
  });
});
