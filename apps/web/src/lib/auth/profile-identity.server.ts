import { hasProfanity } from "@/lib/moderation/profanity.server";
import { isReservedUsername } from "@/lib/users/username-policy.shared";
import { isDisplayUsernameValid, trimDisplayUsername } from "./profile-identity";

const displayUsernameComponentPattern = /[\p{L}\p{N}_.-]+/gu;
const displayUsernameSeparatorPattern = /[_.-]/g;

export function isDisplayUsernameAllowed(displayUsername: string) {
  const trimmedDisplayUsername = trimDisplayUsername(displayUsername);

  if (!isDisplayUsernameValid(trimmedDisplayUsername)) {
    return false;
  }

  if (hasReservedDisplayUsernameComponent(trimmedDisplayUsername)) {
    return false;
  }

  const compactDisplayUsername = trimmedDisplayUsername.replace(displayUsernameSeparatorPattern, "");

  return !(hasProfanity(trimmedDisplayUsername.toLowerCase()) || hasProfanity(compactDisplayUsername.toLowerCase()));
}

export function getAllowedDisplayUsername(displayUsername: string, fallback = "User") {
  const trimmedDisplayUsername = trimDisplayUsername(displayUsername);

  if (isDisplayUsernameAllowed(trimmedDisplayUsername)) {
    return trimmedDisplayUsername;
  }

  return fallback;
}

function hasReservedDisplayUsernameComponent(displayUsername: string) {
  const components = displayUsername.match(displayUsernameComponentPattern) ?? [];

  return components.some((component) => {
    const compactComponent = component.replace(displayUsernameSeparatorPattern, "");

    return isReservedUsername(component) || isReservedUsername(compactComponent);
  });
}
