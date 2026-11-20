import { renderWithQueryClient } from "@test/react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockRefetchSession = vi.hoisted(() => vi.fn());
const mockRemoveMyAvatar = vi.hoisted(() => vi.fn());
const mockSetMyAvatar = vi.hoisted(() => vi.fn());
const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockUploadPhoto = vi.hoisted(() => vi.fn());
const serverFns = vi.hoisted(() => ({
  removeMyAvatar: {},
  setMyAvatar: {},
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (serverFn: object) => (serverFn === serverFns.setMyAvatar ? mockSetMyAvatar : mockRemoveMyAvatar),
}));

vi.mock("@better-upload/client", () => ({
  useUploadFile: () => ({ isPending: false, progress: 0, uploadAsync: mockUploadPhoto }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    updateUser: mockUpdateUser,
    useSession: () => ({ refetch: mockRefetchSession }),
  },
}));

vi.mock("@/server/functions/avatar-functions", () => serverFns);

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const photo = new File(["photo"], "photo.png", { type: "image/png" });
const avatarObjectKey = "avatars/user_1/photo.png";

function openDialog(avatarUrl?: string) {
  renderWithQueryClient(<EditProfileDialog avatarUrl={avatarUrl} displayName="Alice" username="alice" />);
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  mockNavigate.mockReset();
  mockRefetchSession.mockReset().mockResolvedValue(undefined);
  mockUploadPhoto.mockReset().mockResolvedValue({ file: { objectInfo: { key: avatarObjectKey } } });
  mockSetMyAvatar.mockReset().mockResolvedValue({
    avatarObjectKey,
    avatarUrl: `https://assets.example.com/${avatarObjectKey}`,
    cleanupFailed: false,
  });
  mockRemoveMyAvatar.mockReset().mockResolvedValue({
    avatarObjectKey: undefined,
    avatarUrl: undefined,
    cleanupFailed: false,
  });
  mockUpdateUser.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditProfileDialog photo", () => {
  it("doesn't upload a picked photo when the dialog is cancelled", () => {
    openDialog();

    fireEvent.change(screen.getByLabelText("Profile photo"), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockUploadPhoto).not.toHaveBeenCalled();
    expect(mockSetMyAvatar).not.toHaveBeenCalled();
  });

  it("uploads and saves a picked photo on Save", async () => {
    openDialog();

    fireEvent.change(screen.getByLabelText("Profile photo"), { target: { files: [photo] } });
    expect(mockUploadPhoto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockSetMyAvatar).toHaveBeenCalledWith({ data: { objectKey: avatarObjectKey } }, expect.anything())
    );
    expect(mockUploadPhoto).toHaveBeenCalledWith(photo);
    expect(mockUpdateUser).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("removes the current photo only on Save", async () => {
    openDialog("https://assets.example.com/avatars/user_1/old.png");

    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(mockRemoveMyAvatar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockRemoveMyAvatar).toHaveBeenCalled());
  });

  it("retries only the name after the photo saved and the name failed", async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: { message: "Something went wrong." } });
    openDialog();

    fireEvent.change(screen.getByLabelText("Display username"), { target: { value: "Alice B" } });
    fireEvent.change(screen.getByLabelText("Profile photo"), { target: { files: [photo] } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Something went wrong.");
    expect(mockUploadPhoto).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(2));
    expect(mockUploadPhoto).toHaveBeenCalledTimes(1);
    expect(mockSetMyAvatar).toHaveBeenCalledTimes(1);
  });
});

class ResizeObserverMock {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}
