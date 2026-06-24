export const avatarMaxFileSize = 2 * 1024 * 1024;

export const avatarFileTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export const avatarAccept = avatarFileTypes.join(",");

export type AvatarFileType = (typeof avatarFileTypes)[number];

const avatarFileExtensions = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} satisfies Record<AvatarFileType, string>;

export function getAvatarFileExtension(fileType: string) {
  return avatarFileExtensions[fileType as AvatarFileType];
}
