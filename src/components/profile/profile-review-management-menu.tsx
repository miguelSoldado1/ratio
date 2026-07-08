import { Pin, PinOff } from "lucide-react";
import { ReviewManagementMenu } from "@/components/review-management-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface ProfileReviewManagementMenuProps {
  canAdminDelete: boolean;
  canManageOwnReview: boolean;
  isDeleting: boolean;
  isPinning: boolean;
  onDelete: () => Promise<boolean>;
  onPinToggle: () => void;
  pinDisabled: boolean;
  pinned: boolean;
}

export function ProfileReviewManagementMenu({
  canAdminDelete,
  canManageOwnReview,
  isDeleting,
  isPinning,
  onDelete,
  onPinToggle,
  pinDisabled,
  pinned,
}: ProfileReviewManagementMenuProps) {
  const hasActions = canManageOwnReview || canAdminDelete;
  const pinActionDisabled = isPinning || pinDisabled;

  if (!hasActions) {
    return null;
  }

  return (
    <ReviewManagementMenu
      canDeleteAsAdmin={canAdminDelete}
      canDeleteOwnReview={canManageOwnReview}
      isDeleting={isDeleting}
      onDelete={onDelete}
    >
      {canManageOwnReview ? (
        <DropdownMenuItem
          className="rounded-none"
          disabled={pinActionDisabled}
          onClick={() => {
            if (!pinActionDisabled) onPinToggle();
          }}
        >
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? "Unpin from profile" : "Pin to profile"}
        </DropdownMenuItem>
      ) : null}
    </ReviewManagementMenu>
  );
}
