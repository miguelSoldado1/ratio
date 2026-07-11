import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";
import { validateSharedUsernamePolicy } from "./username-policy.shared";

const usernameMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

function isBlockedUsername(username: string) {
  const compactUsername = username.replace(/[_.]/g, "");

  return usernameMatcher.hasMatch(username) || usernameMatcher.hasMatch(compactUsername);
}

export function isUsernameAllowed(username: string) {
  const sharedResult = validateSharedUsernamePolicy(username);

  return sharedResult.valid && !isBlockedUsername(sharedResult.normalizedUsername);
}
