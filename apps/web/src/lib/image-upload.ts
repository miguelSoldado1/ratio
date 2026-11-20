export const imageUploadMaxFileSize = 2 * 1024 * 1024;

export const imageUploadFileTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export const imageUploadAccept = imageUploadFileTypes.join(",");

export type ImageUploadFileType = (typeof imageUploadFileTypes)[number];

const imageUploadFileExtensions = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} satisfies Record<ImageUploadFileType, string>;

export function getImageUploadFileExtension(fileType: string) {
  return imageUploadFileExtensions[fileType as ImageUploadFileType];
}

export const imageUploadHint = "JPG, PNG, WebP, or AVIF up to 2 MB.";

export function isAcceptedImageUpload(file: File) {
  return Boolean(getImageUploadFileExtension(file.type)) && file.size <= imageUploadMaxFileSize;
}
