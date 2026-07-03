export const usernameUnavailableMessage = "That username isn't available.";

const usernameMinLength = 3;
const usernameMaxLength = 30;

const usernamePattern = /^[a-z0-9_.]+$/;

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "api",
  "auth",
  "help",
  "login",
  "me",
  "mod",
  "moderator",
  "null",
  "official",
  "profile",
  "ratio",
  "root",
  "security",
  "settings",
  "signup",
  "staff",
  "support",
  "system",
  "undefined",
  "coon",
]);

type UsernamePolicyFailureReason = "invalid-format" | "reserved";

interface UsernamePolicyResult {
  normalizedUsername: string;
  reason?: UsernamePolicyFailureReason;
  valid: boolean;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isReservedUsername(username: string) {
  return reservedUsernames.has(normalizeUsername(username));
}

export function validateSharedUsernamePolicy(username: string): UsernamePolicyResult {
  const normalizedUsername = normalizeUsername(username);

  if (
    normalizedUsername.length < usernameMinLength ||
    normalizedUsername.length > usernameMaxLength ||
    !usernamePattern.test(normalizedUsername)
  ) {
    return { normalizedUsername, reason: "invalid-format", valid: false };
  }

  if (isReservedUsername(normalizedUsername)) {
    return { normalizedUsername, reason: "reserved", valid: false };
  }

  return { normalizedUsername, valid: true };
}

export function isUsernameFormatValid(username: string) {
  return validateSharedUsernamePolicy(username).valid;
}
