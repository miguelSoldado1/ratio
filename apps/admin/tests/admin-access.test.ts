import { describe, expect, it } from "vitest";
import { decideAdminAccess } from "@/server/admin-access";

function session(role: string | null) {
  return {
    user: {
      displayUsername: "Ratio Display Name",
      id: "user_1",
      image: "https://cdn.example.com/avatar.webp",
      name: "Provider Name",
      role,
      username: "ratio_user",
    },
  };
}

describe("decideAdminAccess", () => {
  it("maps a missing session to unauthenticated", () => {
    expect(decideAdminAccess(null)).toEqual({ status: "unauthenticated" });
  });

  it("maps an ordinary user to forbidden", () => {
    expect(decideAdminAccess(session("user"))).toMatchObject({ status: "forbidden" });
  });

  it("authorizes the admin role", () => {
    expect(decideAdminAccess(session("admin"))).toEqual({
      status: "authorized",
      user: {
        avatarUrl: "https://cdn.example.com/avatar.webp",
        displayName: "Ratio Display Name",
        id: "user_1",
      },
    });
  });

  it("falls back through the same display-name fields as the web app", () => {
    expect(
      decideAdminAccess({
        user: { displayUsername: null, id: "user_1", name: "Provider Name", role: "admin", username: "ratio_user" },
      })
    ).toMatchObject({ user: { displayName: "ratio_user" } });

    expect(
      decideAdminAccess({
        user: { displayUsername: null, id: "user_1", name: "Provider Name", role: "admin", username: null },
      })
    ).toMatchObject({ user: { displayName: "Provider Name" } });
  });

  it("authorizes admin inside a comma-separated role string", () => {
    expect(decideAdminAccess(session("editor, admin, support"))).toMatchObject({ status: "authorized" });
  });

  it("does not authorize similar-looking roles", () => {
    expect(decideAdminAccess(session("superadmin,administrator"))).toMatchObject({ status: "forbidden" });
  });
});
