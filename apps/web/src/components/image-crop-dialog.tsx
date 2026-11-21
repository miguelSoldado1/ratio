import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useObjectUrl } from "@/hooks/use-object-url";
import { cropImageFile } from "@/lib/image-crop";
import { imageUploadHint } from "@/lib/image-upload";
import { tryCatch } from "@/try-catch";
import type { Area, Point } from "react-easy-crop";

export const preloadImageCropper = () => import("react-easy-crop");

const Cropper = lazy(preloadImageCropper);

const initialCrop: Point = { x: 0, y: 0 };
const minZoom = 1;
const maxZoom = 3;

interface ImageCropDialogProps {
  cropShape: "rect" | "round";
  file: File | undefined;
  onApply: (file: File) => void;
  onClosed: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  outputSize: number;
  title: string;
}

export function ImageCropDialog({
  cropShape,
  file,
  onApply,
  onClosed,
  onOpenChange,
  open,
  outputSize,
  title,
}: ImageCropDialogProps) {
  const sourceUrl = useObjectUrl(file);
  const [isOpenSettled, setIsOpenSettled] = useState(false);
  const [crop, setCrop] = useState(initialCrop);
  const [zoom, setZoom] = useState(minZoom);
  const [area, setArea] = useState<Area>();
  const [isApplying, setIsApplying] = useState(false);

  function handleOpenChangeComplete(isOpen: boolean) {
    setIsOpenSettled(isOpen);

    if (isOpen) return;

    setCrop(initialCrop);
    setZoom(minZoom);
    setArea(undefined);
    onClosed();
  }

  function handleImageError() {
    onOpenChange(false);
    toast.error("Couldn't open that image", { description: imageUploadHint });
  }

  async function handleApply() {
    if (!(file && area)) return;

    setIsApplying(true);
    const { data: croppedFile, error } = await tryCatch(cropImageFile({ area, file, size: outputSize }));
    setIsApplying(false);

    if (error) {
      return toast.error("Couldn't crop that image", { description: "Try a different file." });
    }

    onApply(croppedFile);
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => isApplying || onOpenChange(nextOpen)}
      onOpenChangeComplete={handleOpenChangeComplete}
      open={open}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition. Pinch, scroll, or use the slider to zoom.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square max-h-[calc(100dvh-17rem)] w-full overflow-hidden rounded-xl bg-muted">
          {isOpenSettled && sourceUrl ? (
            <Suspense fallback={null}>
              <Cropper
                aspect={1}
                classes={{ cropAreaClassName: "border-foreground/20 text-popover/75" }}
                crop={crop}
                cropShape={cropShape}
                disableAutomaticStylesInjection
                image={sourceUrl}
                maxZoom={maxZoom}
                mediaProps={{ onError: handleImageError }}
                minZoom={minZoom}
                onCropChange={setCrop}
                onCropComplete={(_, croppedAreaPixels) => setArea(croppedAreaPixels)}
                onZoomChange={setZoom}
                zoom={zoom}
              />
            </Suspense>
          ) : null}
        </div>
        <Slider aria-label="Zoom" max={maxZoom} min={minZoom} onValueChange={setZoom} step={0.01} value={zoom} />
        <DialogFooter>
          <Button disabled={isApplying} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isApplying || !area} onClick={handleApply} type="button">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
