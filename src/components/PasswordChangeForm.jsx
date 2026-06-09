import React, { useState } from "react";
import api, { formatAuthError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function PasswordChangeForm({ mandatory = false, onSuccess }) {
  const [form, setForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (form.new_password !== form.confirm_password) {
      toast.error("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setForm({ old_password: "", new_password: "", confirm_password: "" });
      toast.success("Password changed successfully.");
      await onSuccess?.();
    } catch (error) {
      toast.error(formatAuthError(error, "Unable to change password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid={mandatory ? "expired-password-form" : "change-password-form"}>
      <div>
        <Label htmlFor={mandatory ? "expired-old-password" : "old-password"}>Old password</Label>
        <Input
          id={mandatory ? "expired-old-password" : "old-password"}
          type="password"
          autoComplete="current-password"
          required
          value={form.old_password}
          onChange={update("old_password")}
          className="mt-1.5 rounded-sm"
          data-testid="old-password"
        />
      </div>
      <div>
        <Label htmlFor={mandatory ? "expired-new-password" : "new-password"}>New password</Label>
        <Input
          id={mandatory ? "expired-new-password" : "new-password"}
          type="password"
          autoComplete="new-password"
          required
          value={form.new_password}
          onChange={update("new_password")}
          className="mt-1.5 rounded-sm"
          data-testid="new-password"
        />
      </div>
      <div>
        <Label htmlFor={mandatory ? "expired-confirm-password" : "confirm-new-password"}>Confirm new password</Label>
        <Input
          id={mandatory ? "expired-confirm-password" : "confirm-new-password"}
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm_password}
          onChange={update("confirm_password")}
          className="mt-1.5 rounded-sm"
          data-testid="confirm-new-password"
        />
      </div>
      <Button type="submit" disabled={loading} className="rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="change-password-submit">
        {loading ? "Changing password…" : mandatory ? "Set new password" : "Change password"}
      </Button>
    </form>
  );
}
