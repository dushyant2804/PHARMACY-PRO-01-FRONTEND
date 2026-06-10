import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { toast } from "sonner";
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
      <section className="login-visual-panel image-login-panel">
        <div className="image-login-overlay" />
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <header>
            <h2>Welcome Back <span role="img" aria-label="wave">👋</span></h2>
            <p>Login to your account</p>
          </header>

          <form onSubmit={onSubmit} data-testid="login-form">
            <div className="login-field">
              <Label htmlFor="email">Username</Label>
              <div className="login-input-wrap">
                <UserRound aria-hidden="true" />
                <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your username" data-testid="login-email" />
              </div>
            </div>

            <div className="login-field">
              <Label htmlFor="password">Password</Label>
              <div className="login-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" data-testid="login-password" />
                <button type="button" className="password-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
              <Link to="/forgot-password" data-testid="forgot-password-link">Forgot password?</Link>
            </div>

            <Button type="submit" disabled={loading} className="login-primary-button" data-testid="login-submit">{loading ? "Signing in…" : "Login"}</Button>
          </form>

          <div className="login-divider"><span>or</span></div>
          <button type="button" onClick={onDemoLogin} disabled={loading} className="login-demo-button" data-testid="use-demo-login"><UserRound />{loading ? "Signing in…" : "Login with Demo Account"}</button>
          <p className="login-signup">New to PharmacyOS? <Link to="/signup">Create Account</Link></p>
        </div>
      </section>
    </main>
  );
}
