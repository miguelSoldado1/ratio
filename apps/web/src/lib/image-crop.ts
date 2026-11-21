import { getImageUploadFileExtension } from "@/lib/image-upload";
import type { Area } from "react-easy-crop";

interface CropImageFileOptions {
  area: Area;
  file: File;
  size: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image."))), type, quality);
  });
}

export async function cropImageFile({ area, file, size }: CropImageFileOptions) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const outputSize = Math.min(size, Math.round(area.width));
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Couldn't prepare the image.");
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);
  bitmap.close();

  let blob = await canvasToBlob(canvas, "image/webp", 0.85);

  if (blob.type !== "image/webp") {
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, outputSize, outputSize);
    blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  }

  return new File([blob], `image.${getImageUploadFileExtension(blob.type)}`, { type: blob.type });
}
