const firstWordCharacterPattern = /^\w/;

const authErrorMessages: Record<string, string> = {
  account_not_linked: "An account already exists for that email. Continue with the provider you used before.",
  access_denied: "Access was denied by the provider. Try again or choose another provider.",
  invalid_callback_url: "The sign-in redirect URL is invalid.",
  invalid_error_callback_url: "The sign-in error redirect URL is invalid.",
  invalid_origin: "The request came from an invalid origin.",
  invalid_redirect_url: "The sign-in redirect URL is invalid.",
  provider_not_found: "That sign-in provider is not available.",
  session_not_fresh: "Your session needs to be refreshed. Sign out and back in, then try again.",
  unable_to_link_account: "Could not link that provider to your account. Try again.",
  user_already_exists: "An account already exists for that email.",
  user_already_exists_use_another_email: "An account already exists for that email. Use another email.",
};

const unmessagedAuthErrorCodes = [
  "account_already_linked_to_different_user",
  "email_not_found",
  "internal_server_error",
  "invalid_callback_request",
  "invalid_code",
  "invalid_request",
  "invalid_scope",
  "network_error",
  "no_callback_url",
  "no_code",
  "oauth_provider_not_found",
  "server_error",
  "sign_in_request_failed",
  "signup_disabled",
  "state_generation_error",
  "state_invalid",
  "state_mismatch",
  "state_not_found",
  "temporarily_unavailable",
  "unable_to_create_session",
  "unable_to_create_user",
  "unable_to_get_user_info",
];

export const knownAuthErrorCodes = new Set([...Object.keys(authErrorMessages), ...unmessagedAuthErrorCodes]);

export function getAuthErrorMessage(error: string) {
  if (authErrorMessages[error]) return authErrorMessages[error];

  return error
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(firstWordCharacterPattern, (letter) => letter.toUpperCase());
}
