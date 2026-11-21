import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

export async function pickCroppedImage(label: string, file: File) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });

  const apply = await screen.findByRole("button", { name: "Apply" });
  await waitFor(() => expect(apply).toHaveProperty("disabled", false));
  fireEvent.click(apply);

  await waitFor(() => expect(screen.queryByRole("button", { name: "Apply" })).toBeNull());
}
