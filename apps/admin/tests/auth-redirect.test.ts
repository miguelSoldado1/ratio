import { describe, expect, it } from "vitest";
import { getSafeAuthRedirect, getSignInHref } from "@/lib/auth-redirect";

describe("getSafeAuthRedirect", () => {
  it("preserves internal paths with search and hash values", () => {
    expect(getSafeAuthRedirect("/users?status=banned#details")).toBe("/users?status=banned#details");
  });

  it("falls back to the users page for external URLs", () => {
    expect(getSafeAuthRedirect("https://example.com/users")).toBe("/users");
    expect(getSafeAuthRedirect("//example.com/users")).toBe("/users");
  });

  it("does not redirect back into public auth or API routes", () => {
    expect(getSafeAuthRedirect("/sign-in")).toBe("/users");
    expect(getSafeAuthRedirect("/access-denied?redirect=/users")).toBe("/users");
    expect(getSafeAuthRedirect("/api/auth/sign-in/social")).toBe("/users");
  });

  it("falls back to the users page for missing and malformed values", () => {
    expect(getSafeAuthRedirect(undefined)).toBe("/users");
    expect(getSafeAuthRedirect("https://%zz")).toBe("/users");
  });
});

describe("getSignInHref", () => {
  it("encodes the validated destination", () => {
    expect(getSignInHref("/users?status=banned")).toBe("/sign-in?redirect=%2Fusers%3Fstatus%3Dbanned");
  });
});
