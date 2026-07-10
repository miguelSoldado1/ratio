import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "@/lib/auth-errors";

describe("getAuthErrorMessage", () => {
  it("explains when the selected provider is not linked to the Ratio account", () => {
    expect(getAuthErrorMessage("account_not_linked")).toBe(
      "That sign-in method isn't linked to this Ratio account. Continue with a provider you have already linked."
    );
  });

  it("explains when the provider account has no existing Ratio account", () => {
    expect(getAuthErrorMessage("signup_disabled")).toBe(
      "This account does not have a Ratio account. Admin access is available only to existing Ratio accounts."
    );
  });

  it("formats unrecognised OAuth errors for display", () => {
    expect(getAuthErrorMessage("oauth-provider-failed")).toBe("Oauth provider failed");
  });
});
