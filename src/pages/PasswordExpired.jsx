import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useAuth } from "@/contexts/AuthContext";

export default function PasswordExpired() {
  const { user, loading, passwordExpired, completePasswordChange } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!passwordExpired) return <Navigate to="/" replace />;

  const completed = async () => {
    await completePasswordChange();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-sm border border-slate-200 p-6 md:p-8 shadow-xl">
        <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">Password change required</h1>
        <p className="text-sm text-slate-600 mt-2 mb-6">
          Your password has expired. Set a new password before continuing to PharmacyOS.
        </p>
        <PasswordChangeForm mandatory onSuccess={completed} />
      </div>
    </div>
  );
}
