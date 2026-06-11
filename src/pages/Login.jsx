import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { login, user, passwordExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@pharmacy.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  React.useEffect(() => {
    if (user) navigate(passwordExpired ? "/password-expired" : "/");
  }, [user, passwordExpired, navigate]);

  const signIn = async (loginEmail, loginPassword) => {
    setLoading(true);
    try {
      const result = await login(loginEmail, loginPassword);
      if (result?.password_expired === true || result?.passwordExpired === true || result?.user?.password_expired === true || result?.user?.passwordExpired === true) {
        toast.error("Your password has expired. Set a new password to continue.");
        navigate("/password-expired", { replace: true });
      } else {
        toast.success("Welcome back");
        navigate("/");
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    signIn(email, password);
  };

  const onDemoLogin = () => {
    const demoEmail = "admin@pharmacy.com";
    const demoPassword = "admin123";
    setEmail(demoEmail);
    setPassword(demoPassword);
    signIn(demoEmail, demoPassword);
  };

  return (
    <main className="login-shell">
      <section className="login-visual" aria-label="PharmacyOS — smart pharmacy management simplified">
        <div className="login-visual-glow" aria-hidden="true" />
        <div className="login-visual-footer">
          <div className="login-developer-credit">
            <span>Designed &amp; Developed By</span>
            <strong>Dushyant Bishnoi</strong>
          </div>
          <div className="login-visual-note">
            <span><ShieldCheck aria-hidden="true" /> Secure pharmacy workspace</span>
            <p>Manage inventory, billing, and patient care with confidence.</p>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-panel-inner">
          <BrandLogo className="login-brand" />

          <div className="login-card">
            <header>
              <span className="login-eyebrow">Welcome back</span>
              <h1>Sign in to PharmacyOS</h1>
              <p>Enter your credentials to access your pharmacy workspace.</p>
            </header>

            <form onSubmit={onSubmit} data-testid="login-form">
              <div className="login-field">
                <Label htmlFor="email">Username</Label>
                <div className="login-input-wrap">
                  <UserRound aria-hidden="true" />
                  <Input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your username" data-testid="login-email" />
                </div>
              </div>

              <div className="login-field">
                <Label htmlFor="password">Password</Label>
                <div className="login-input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" data-testid="login-password" />
                  <button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
                <Link to="/forgot-password" data-testid="forgot-password-link">Forgot password?</Link>
              </div>

              <Button type="submit" disabled={loading} className="login-primary-button" data-testid="login-submit">{loading ? "Signing in…" : "Sign in"}</Button>
            </form>

            <div className="login-divider"><span>or continue with</span></div>
            <button type="button" onClick={onDemoLogin} disabled={loading} className="login-demo-button" data-testid="use-demo-login"><UserRound />{loading ? "Signing in…" : "Demo account"}</button>
            <p className="login-signup">New to PharmacyOS? <Link to="/signup">Create account</Link></p>
          </div>

          <p className="login-panel-footer"><ShieldCheck aria-hidden="true" /> Your data is protected with enterprise-grade security.</p>
        </div>
      </section>
    </main>
  );
}
