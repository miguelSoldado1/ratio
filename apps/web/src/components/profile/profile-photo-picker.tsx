import { Camera } from "lucide-react";
import { ImageUploadField } from "@/components/image-upload-field";
import { UserAvatar } from "@/components/user-avatar";
import { useObjectUrl } from "@/hooks/use-object-url";
import { imageUploadHint } from "@/lib/image-upload";

interface ProfilePhotoPickerProps {
  avatarUrl: string | undefined;
  disabled: boolean;
  displayName: string;
  file: File | undefined;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  statusLabel: string | undefined;
}

export function ProfilePhotoPicker({
  avatarUrl,
  disabled,
  displayName,
  file,
  onFileSelect,
  onRemove,
  statusLabel,
}: ProfilePhotoPickerProps) {
  const previewUrl = useObjectUrl(file);

  return (
    <ImageUploadField
      cropOutputSize={512}
      cropShape="round"
      disabled={disabled}
      hasImage={Boolean(file || avatarUrl)}
      label="Profile photo"
      onFileSelect={onFileSelect}
      onRemove={onRemove}
      preview={<UserAvatar className="size-16 text-xl" name={displayName} src={previewUrl ?? avatarUrl} />}
      removeLabel="Remove photo"
      statusLabel={statusLabel ?? imageUploadHint}
      uploadIcon={<Camera />}
      uploadLabel="Change photo"
    />
  );
}
