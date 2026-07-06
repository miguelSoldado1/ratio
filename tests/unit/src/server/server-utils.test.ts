import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { decodeCursor, encodeCursor, isAdminRole } from "@/server/server-utils";

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  createAuth: vi.fn(),
}));

const cursorSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
});

describe("cursor helpers", () => {
  it("encodes and decodes a cursor payload", () => {
    const cursor = {
      createdAt: "2026-07-04T10:15:00.000Z",
      id: "review_123",
    };

    expect(decodeCursor(encodeCursor(cursor), cursorSchema, "Invalid cursor")).toEqual(cursor);
  });

  it("throws the provided error message for malformed cursor data", () => {
    expect(() => decodeCursor("not a cursor", cursorSchema, "Invalid cursor")).toThrow("Invalid cursor");
  });

  it("throws the provided error message for non-json cursor data", () => {
    const cursor = btoa("not json");

    expect(() => decodeCursor(cursor, cursorSchema, "Invalid cursor")).toThrow("Invalid cursor");
  });

  it("throws the provided error message when the cursor payload fails schema validation", () => {
    const cursor = encodeCursor({ id: "review_123" });

    expect(() => decodeCursor(cursor, cursorSchema, "Invalid cursor")).toThrow("Invalid cursor");
  });
});

describe("isAdminRole", () => {
  it("returns true when admin is present in a comma-separated role list", () => {
    expect(isAdminRole("user, admin")).toBe(true);
    expect(isAdminRole("admin,moderator")).toBe(true);
  });

  it("returns false for missing roles and non-admin role names", () => {
    expect(isAdminRole()).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole("user, moderator")).toBe(false);
    expect(isAdminRole("superadmin")).toBe(false);
  });
});
