import { describe, expect, it } from "vitest";
import { hasAdminRole, parseRoles, withAdminRole, withoutAdminRole } from "@/lib/roles";

describe("role helpers", () => {
  it("defaults missing and empty roles to user", () => {
    expect(parseRoles(null)).toEqual(["user"]);
    expect(parseRoles(" , ")).toEqual(["user"]);
  });

  it("matches admin as a complete comma-separated role", () => {
    expect(hasAdminRole("user, admin")).toBe(true);
    expect(hasAdminRole("superadmin")).toBe(false);
  });

  it("adds admin once while preserving unknown roles", () => {
    expect(withAdminRole("support,user,support")).toEqual(["support", "user", "admin"]);
    expect(withAdminRole("user,admin")).toEqual(["user", "admin"]);
  });

  it("removes only admin and always leaves at least one role", () => {
    expect(withoutAdminRole("support,admin")).toEqual(["support"]);
    expect(withoutAdminRole("admin")).toEqual(["user"]);
  });
});
