import { describe, expect, it } from "vitest";
import { decideAdminAccess } from "@/server/admin-access";

function session(role: string | null) {
  return { user: { id: "user_1", name: "Ratio User", role } };
}

describe("decideAdminAccess", () => {
  it("maps a missing session to unauthenticated", () => {
    expect(decideAdminAccess(null)).toEqual({ status: "unauthenticated" });
  });

  it("maps an ordinary user to forbidden", () => {
    expect(decideAdminAccess(session("user"))).toMatchObject({ status: "forbidden" });
  });

  it("authorizes the admin role", () => {
    expect(decideAdminAccess(session("admin"))).toMatchObject({ status: "authorized" });
  });

  it("authorizes admin inside a comma-separated role string", () => {
    expect(decideAdminAccess(session("editor, admin, support"))).toMatchObject({ status: "authorized" });
  });

  it("does not authorize similar-looking roles", () => {
    expect(decideAdminAccess(session("superadmin,administrator"))).toMatchObject({ status: "forbidden" });
  });
});
