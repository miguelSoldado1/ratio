import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProfileBanUserDialogProps {
  isPending: boolean;
  onBan: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function ProfileBanUserDialog({ isPending, onBan, onOpenChange, open }: ProfileBanUserDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-95">
        <DialogHeader className="pr-7">
          <DialogTitle>Ban this user?</DialogTitle>
          <DialogDescription>This will prevent them from using Ratio. You can unban them later.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} onClick={onBan} type="button" variant="destructive">
            Ban user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
