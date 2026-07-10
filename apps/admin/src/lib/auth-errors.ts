const firstWordCharacterPattern = /^\w/;

const authErrorMessages: Record<string, string> = {
  account_not_linked:
    "That sign-in method isn't linked to this Ratio account. Continue with a provider you have already linked.",
  access_denied: "Access was denied by the provider. Try again or choose another provider.",
  invalid_callback_url: "The sign-in redirect URL is invalid.",
  invalid_error_callback_url: "The sign-in error redirect URL is invalid.",
  invalid_origin: "The request came from an invalid origin.",
  invalid_redirect_url: "The sign-in redirect URL is invalid.",
  provider_not_found: "That sign-in provider is not available.",
  session_not_fresh: "Your session needs to be refreshed. Sign out and back in, then try again.",
  signup_disabled:
    "This account does not have a Ratio account. Admin access is available only to existing Ratio accounts.",
  unable_to_link_account: "Could not link that provider to your account. Try again.",
  user_already_exists: "An account already exists for that email.",
  user_already_exists_use_another_email: "An account already exists for that email. Use another email.",
};

export function getAuthErrorMessage(error: string) {
  if (authErrorMessages[error]) return authErrorMessages[error];

  return error
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(firstWordCharacterPattern, (letter) => letter.toUpperCase());
}
