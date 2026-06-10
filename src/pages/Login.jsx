import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import BrandLogo from "@/components/BrandLogo";

function MedicineScene() {
  return <div className="medicine-scene" aria-hidden="true"><div className="med-box box-a"><b>AZITHRO</b><span>500 mg · Tablets</span></div><div className="med-box box-b"><b>CALCIVIT</b><span>Calcium + D3</span></div><div className="blister blister-a">{Array.from({length:8}).map((_,i)=><i key={i}/>)}</div><div className="blister blister-b">{Array.from({length:6}).map((_,i)=><i key={i}/>)}</div><span className="capsule cap-a"/><span className="capsule cap-b"/><span className="tablet tab-a"/><span className="tablet tab-b"/></div>;
}

export default function Login() {
  const { login, user, passwordExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@pharmacy.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  React.useEffect(() => { if (user) navigate(passwordExpired ? "/password-expired" : "/"); }, [user, passwordExpired, navigate]);
  const signIn = async (loginEmail, loginPassword) => { setLoading(true); try { const result=await login(loginEmail,loginPassword); if(result?.password_expired===true||result?.passwordExpired===true||result?.user?.password_expired===true||result?.user?.passwordExpired===true){toast.error("Your password has expired. Set a new password to continue.");navigate("/password-expired",{replace:true});}else{toast.success("Welcome back");navigate("/");}} catch(err){toast.error(formatApiError(err));} finally{setLoading(false);} };
  const onSubmit = (e) => { e.preventDefault(); signIn(email, password); };
  const onDemoLogin = () => { const demoEmail="admin@pharmacy.com"; const demoPassword="admin123"; setEmail(demoEmail); setPassword(demoPassword); signIn(demoEmail, demoPassword); };
  return <div className="login-shell min-h-screen grid lg:grid-cols-[1.18fr_.82fr]">
    <section className="relative hidden lg:flex min-h-screen overflow-hidden p-12 xl:p-16 flex-col justify-between text-white">
      <div className="login-grid"/><MedicineScene/><BrandLogo light />
      <div className="relative z-10 max-w-xl pb-14"><div className="premium-kicker">Premium allopathic pharmacy workstation</div><h1 className="mt-5 font-heading text-5xl xl:text-6xl font-extrabold leading-[1.02] tracking-tight">The pharmacy counter.<br/>Precisely controlled.<br/><span className="gold-text">Professionally managed.</span></h1><p className="mt-6 max-w-lg text-base leading-relaxed text-emerald-50/65">A dark, focused workspace built around real medicines, accurate billing, disciplined inventory, and trusted patient service.</p><div className="mt-8 flex gap-5 text-xs text-emerald-50/65"><span className="flex gap-2"><ShieldCheck className="w-4 text-amber-300"/>Secure by design</span><span className="flex gap-2"><CheckCircle2 className="w-4 text-amber-300"/>Built for India</span></div></div>
      <div className="designer-credit relative z-10"><div>Designed by - Dushyant Bishnoi</div><span>Dushyant</span></div>
    </section>
    <section className="relative flex items-center justify-center bg-[#f5f3ed] p-5 sm:p-10"><div className="absolute inset-0 login-paper"/><div className="relative w-full max-w-md rounded-[28px] border border-white/70 bg-white/85 p-7 sm:p-9 shadow-[0_30px_80px_rgba(10,35,29,.14)] backdrop-blur-xl"><div className="lg:hidden mb-8"><BrandLogo /></div><div className="premium-kicker text-emerald-800">Secure console access</div><h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-slate-950">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Enter your credentials to continue to PharmacyOS.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5" data-testid="login-form"><div><Label htmlFor="email" className="field-label">Email address</Label><Input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="premium-input mt-2" data-testid="login-email"/></div><div><div className="flex justify-between"><Label htmlFor="password" className="field-label">Password</Label><Link to="/forgot-password" className="text-xs font-semibold text-emerald-700" data-testid="forgot-password-link">Forgot password?</Link></div><Input id="password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="premium-input mt-2" data-testid="login-password"/></div><Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-emerald-900 hover:bg-emerald-800 shadow-lg shadow-emerald-950/15" data-testid="login-submit">{loading?"Signing in…":<>Sign in securely <ArrowRight className="ml-2 h-4 w-4"/></>}</Button></form>
      <div className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 text-xs text-slate-600"><div className="flex justify-between gap-3"><b className="text-amber-900">Explore demo</b><button type="button" onClick={onDemoLogin} disabled={loading} className="font-semibold text-emerald-700" data-testid="use-demo-login">{loading?"Signing in…":"Use demo account"}</button></div><div className="mt-1 font-mono text-[11px]">admin@pharmacy.com / admin123</div></div><div className="mt-6 text-center text-xs text-slate-500">New to PharmacyOS? <Link to="/signup" className="font-bold text-emerald-700">Create account</Link></div></div></section>
  </div>;
}
