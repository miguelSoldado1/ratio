const firstWordCharacterPattern = /^\w/;

export function getAuthErrorMessage(error: string) {
  return error
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(firstWordCharacterPattern, (letter) => letter.toUpperCase());
}
