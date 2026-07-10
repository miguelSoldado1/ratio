import { describe, expect, it } from "vitest";
import { getSafeAuthRedirect, getSignInHref } from "@/lib/auth-redirect";

describe("getSafeAuthRedirect", () => {
  it("preserves internal paths with search and hash values", () => {
    expect(getSafeAuthRedirect("/users?status=banned#details")).toBe("/users?status=banned#details");
  });

  it("falls back to the dashboard for external URLs", () => {
    expect(getSafeAuthRedirect("https://example.com/users")).toBe("/");
    expect(getSafeAuthRedirect("//example.com/users")).toBe("/");
  });

  it("does not redirect back into public auth or API routes", () => {
    expect(getSafeAuthRedirect("/sign-in")).toBe("/");
    expect(getSafeAuthRedirect("/access-denied?redirect=/users")).toBe("/");
    expect(getSafeAuthRedirect("/api/auth/sign-in/social")).toBe("/");
  });

  it("falls back to the dashboard for missing and malformed values", () => {
    expect(getSafeAuthRedirect(undefined)).toBe("/");
    expect(getSafeAuthRedirect("https://%zz")).toBe("/");
  });
});

describe("getSignInHref", () => {
  it("encodes the validated destination", () => {
    expect(getSignInHref("/users?status=banned")).toBe("/sign-in?redirect=%2Fusers%3Fstatus%3Dbanned");
  });
});
