export const displayUsernameMaxLength = 50;
export const displayUsernameUnavailableMessage = "That display name isn't available.";

export function getDisplayUsernameLength(displayUsername: string) {
  return Array.from(displayUsername.trim()).length;
}

export function isDisplayUsernameValid(displayUsername: string) {
  const displayUsernameLength = getDisplayUsernameLength(displayUsername);

  return displayUsernameLength > 0 && displayUsernameLength <= displayUsernameMaxLength;
}

export function trimDisplayUsername(displayUsername: string) {
  return displayUsername.trim();
}

export function limitDisplayUsername(displayUsername: string) {
  const displayUsernameCharacters = Array.from(trimDisplayUsername(displayUsername) || "User");

  return displayUsernameCharacters.slice(0, displayUsernameMaxLength).join("").trim() || "User";
}
