import { hasProfanity } from "@/lib/moderation/profanity.server";
import { validateSharedUsernamePolicy } from "./username-policy.shared";

function isBlockedUsername(username: string) {
  const compactUsername = username.replace(/[_.]/g, "");

  return hasProfanity(username) || hasProfanity(compactUsername);
}

export function isUsernameAllowed(username: string) {
  const sharedResult = validateSharedUsernamePolicy(username);

  return sharedResult.valid && !isBlockedUsername(sharedResult.normalizedUsername);
}
