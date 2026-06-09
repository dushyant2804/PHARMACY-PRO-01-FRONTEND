import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatAuthError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "lucide-react";
import { toast } from "sonner";

const steps = ["Email", "OTP", "New password"];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", otp: "", new_password: "", confirm_password: "" });

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (step === 0) {
        await api.post("/auth/forgot-password", { email: form.email });
        toast.success("If the email is registered, a password reset OTP has been sent.");
        setStep(1);
      } else if (step === 1) {
        await api.post("/auth/verify-otp", { email: form.email, otp: form.otp });
        toast.success("OTP verified.");
        setStep(2);
      } else {
        if (form.new_password !== form.confirm_password) {
          toast.error("New passwords do not match.");
          return;
        }
        await api.post("/auth/reset-password", {
          email: form.email,
          otp: form.otp,
          new_password: form.new_password,
        });
        toast.success("Password reset successfully. You can now sign in.");
        navigate("/login", { replace: true });
      }
    } catch (error) {
      toast.error(formatAuthError(error, "Unable to reset password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-sm p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 bg-blue-600 rounded-sm flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <div className="font-heading font-bold text-lg text-slate-900">Reset password</div>
            <div className="text-xs text-slate-500">Step {step + 1} of 3 · {steps[step]}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-7" aria-label="Password reset progress">
          {steps.map((label, index) => (
            <div key={label} className={`h-1 rounded-full ${index <= step ? "bg-blue-600" : "bg-slate-200"}`} />
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5" data-testid="forgot-password-form">
          {step === 0 && (
            <div>
              <Label htmlFor="reset-email">Registered email</Label>
              <Input id="reset-email" type="email" autoComplete="email" required value={form.email} onChange={update("email")} className="mt-1.5 rounded-sm" data-testid="forgot-email" />
            </div>
          )}
          {step === 1 && (
            <div>
              <Label htmlFor="reset-otp">One-time password (OTP)</Label>
              <Input id="reset-otp" inputMode="numeric" autoComplete="one-time-code" required value={form.otp} onChange={update("otp")} className="mt-1.5 rounded-sm font-mono tracking-widest" data-testid="forgot-otp" />
              <p className="text-xs text-slate-500 mt-2">Enter the OTP sent for {form.email}.</p>
            </div>
          )}
          {step === 2 && (
            <>
              <div>
                <Label htmlFor="reset-new-password">New password</Label>
                <Input id="reset-new-password" type="password" autoComplete="new-password" required value={form.new_password} onChange={update("new_password")} className="mt-1.5 rounded-sm" data-testid="forgot-new-password" />
              </div>
              <div>
                <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                <Input id="reset-confirm-password" type="password" autoComplete="new-password" required value={form.confirm_password} onChange={update("confirm_password")} className="mt-1.5 rounded-sm" data-testid="forgot-confirm-password" />
              </div>
            </>
          )}

          <Button type="submit" disabled={loading} className="w-full rounded-sm bg-blue-600 hover:bg-blue-700" data-testid="forgot-password-submit">
            {loading ? "Please wait…" : step === 0 ? "Send OTP" : step === 1 ? "Verify OTP" : "Reset password"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="text-slate-600 hover:text-slate-900">← Back</button> : <span />}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">Return to sign in</Link>
        </div>
      </div>
    </div>
  );
}
