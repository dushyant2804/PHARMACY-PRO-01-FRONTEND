import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiError } from "@/lib/api";

function Blister({ className, count = 8, dark = false }) {
  return (
    <div className={`login-blister ${dark ? "login-blister--dark" : ""} ${className}`}>
      {Array.from({ length: count }).map((_, index) => <i key={index}><b /></i>)}
    </div>
  );
}

function MedicineBox({ className, children }) {
  return (
    <div className={`medicine-box ${className}`}>
      <div className="medicine-box__front">{children}</div>
      <i className="medicine-box__top" />
      <i className="medicine-box__side" />
      <i className="medicine-box__shadow" />
    </div>
  );
}

function MedicineScene() {
  return (
    <div className="medicine-workstation" aria-hidden="true">
      <div className="pharmacy-shelves"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="counter-surface" />
      <div className="counter-reflection" />
      <MedicineBox className="medicine-box--revital"><small>Rx</small><strong>REVITAL</strong><span>Multivitamin &amp; Minerals<br />Capsules for Daily Health</span><em>10 × 10 Capsules</em></MedicineBox>
      <MedicineBox className="medicine-box--azithro"><small>Rx</small><strong>Azithromycin</strong><span>Tablets IP 500 mg</span><em>10 × 3 Tablets</em></MedicineBox>
      <MedicineBox className="medicine-box--para"><small>Rx</small><strong>Paracetamol</strong><span>Tablets IP 650 mg</span><em>10 × 15 Tablets</em></MedicineBox>
      <MedicineBox className="medicine-box--amoxi"><small>Rx</small><strong>Amoxicillin &amp;<br />Potassium Clavulanate</strong><span>Tablets IP</span><em>625 mg</em></MedicineBox>
      <Blister className="blister-one" count={10} />
      <Blister className="blister-two" count={8} dark />
      <div className="medicine-bottle"><div className="bottle-label">PHARMACYOS<br /><small>TABLETS IP</small></div></div>
      <div className="bottle-cap" />
      {Array.from({ length: 7 }).map((_, index) => <i key={`pill-${index}`} className={`loose-pill ${index > 4 ? "loose-pill--tablet" : "loose-pill--capsule"} loose-pill--${index + 1}`} />)}
    </div>
  );
}

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
      <section className="login-visual-panel">
        <div className="login-ambient-light" />
        <MedicineScene />
        <BrandLogo light hero className="login-hero-logo" />
        <div className="login-hero-copy">
          <h1>Smart Pharmacy<br />Management <span>Simplified.</span></h1>
          <p>Streamline your pharmacy operations,<br />increase accuracy and <strong>grow</strong> your business.</p>
        </div>
        <div className="designer-credit"><div>Designed by - Dushyant Bishnoi</div><span>Dushyant Bishnoi</span></div>
      </section>

      <section className="login-form-panel">
        <div className="login-mobile-brand"><BrandLogo light hero /></div>
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
