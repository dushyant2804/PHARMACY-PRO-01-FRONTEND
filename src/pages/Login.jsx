import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@pharmacy.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:block relative bg-slate-900 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1765031092161-a9ebe556117e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMHBoYXJtYWN5JTIwc3RvcmUlMjBpbnRlcmlvcnxlbnwwfHx8fDE3NzczNTI3Nzl8MA&ixlib=rb-4.1.0&q=85"
          alt="Pharmacy"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="absolute inset-0 p-12 flex flex-col justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-sm flex items-center justify-center">
              <Pill className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-heading font-bold text-xl leading-none">MedStock</div>
              <div className="text-xs tracking-[0.2em] uppercase text-slate-400 mt-1">Pharmacy OS</div>
            </div>
          </div>
          <div>
            <h1 className="font-heading text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              Operate your<br />pharmacy with<br /><span className="text-blue-400">precision.</span>
            </h1>
            <p className="mt-6 text-slate-300 text-base max-w-md leading-relaxed">
              Inventory, billing, ledger, and analytics unified in a single fast, GST-compliant control room.
            </p>
          </div>
          <div className="text-xs text-slate-500 tracking-wider uppercase">
            v1.0 · Secure · Offline-friendly
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <div className="text-xs uppercase tracking-[0.15em] text-slate-500 font-semibold">Sign in</div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mt-2 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-600 mt-2">Enter your credentials to access the console.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-slate-600">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-blue-600"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-wider font-semibold text-slate-600">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 rounded-sm border-slate-300 focus-visible:ring-blue-600"
                data-testid="login-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-sm bg-blue-600 hover:bg-blue-700 font-medium h-11"
              data-testid="login-submit"
            >
              {loading ? "Signing in…" : "Sign in →"}
            </Button>
          </form>
          <div className="mt-8 p-4 border border-slate-200 rounded-sm bg-slate-50 text-xs">
            <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Demo Credentials</div>
            <div className="font-mono text-slate-600">admin@pharmacy.com / admin123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
