import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { unlockMonth, formatRegisterError } from "@/lib/register";

// Prepared for backend integration (see docs/REGISTER_BACKEND_SPEC.md,
// `POST /register/{fy}/{month}/unlock`). The dialog is fully functional and
// calls the real endpoint; until the backend implements it, the request will
// fail and the user sees a clear "not connected yet" message instead of a
// fake success.
export default function UnlockDialog({ open, onOpenChange, financialYear, monthKey, monthLabel, onUnlocked }) {
  const [privacyPassword, setPrivacyPassword] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPrivacyPassword("");
    setReason("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!privacyPassword) return toast.error("Enter the privacy password");
    if (reason.trim().length < 5) return toast.error("Enter a short reason (at least 5 characters)");
    setSubmitting(true);
    try {
      // TODO(backend-integration): once live, this returns the updated month
      // status/unlock_expires_at — wire that into the caller's state.
      await unlockMonth(financialYear, monthKey, { privacyPassword, reason });
      toast.success(`${monthLabel} unlocked`);
      reset();
      onOpenChange(false);
      onUnlocked?.();
    } catch (error) {
      toast.error(formatRegisterError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="max-w-md rounded-sm">
        <DialogHeader>
          <DialogTitle>Unlock {monthLabel}</DialogTitle>
          <DialogDescription>
            This month is closed. Enter the privacy password and a reason to temporarily reopen it for editing.
            Every change made during the unlock window is recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">Privacy password</Label>
            <Input
              type="password"
              autoComplete="off"
              value={privacyPassword}
              onChange={(e) => setPrivacyPassword(e.target.value)}
              className="mt-1 rounded-sm"
              data-testid="register-unlock-password"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600">Reason for unlocking</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Correcting a data entry error"
              className="mt-1 rounded-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-sm bg-amber-600 hover:bg-amber-700">
              {submitting ? "Unlocking…" : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
