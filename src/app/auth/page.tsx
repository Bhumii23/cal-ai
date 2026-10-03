"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Flame, LockKeyhole, Mail, UserRound } from "lucide-react";
import { getCurrentUserAsync, login, resetPassword, signInWithGoogle, signup } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type AuthMode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already logged in -> go home instead of showing the form again.
  useEffect(() => {
    void (async () => {
      if (await getCurrentUserAsync()) router.replace("/");
    })();
  }, [router]);

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed.");
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        if (!name.trim() || !email.trim() || !password || !confirmPassword) {
          throw new Error("Please complete every field.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await signup(name, email, password);
        router.replace("/");
        router.refresh();
        return;
      }
      if (mode === "forgot") {
        if (!password || !confirmPassword) {
          throw new Error("Please enter and confirm your new password.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await resetPassword(email, password);
        setSuccess("Password updated. Please log in with your new password.");
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        return;
      }
      await login(email, password);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="hero-band relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-green-950 via-neutral-950 to-black px-5 py-10 text-white selection:bg-green-500/30">
      <div className="pointer-events-none absolute -left-24 top-[-8rem] h-96 w-96 rounded-full bg-green-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-[-5rem] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

      <section className="page-enter relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950/55 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-green-400/80 to-transparent" />

        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-400/30 bg-green-500/15 shadow-[0_0_36px_rgba(34,197,94,0.28)]">
            <Flame className="h-8 w-8 fill-green-500 text-green-400" />
          </span>
          <h1 className="gradient-heading mt-4 text-3xl font-black">Cal AI</h1>
          <p className="mt-2 text-sm font-medium text-neutral-400">Track your nutrition with AI</p>
        </div>

        <div className="mt-7 grid grid-cols-2 rounded-xl border border-white/10 bg-black/25 p-1">
          {(["login", "signup"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchMode(tab)}
              className={`rounded-lg py-2.5 text-sm font-black transition-all duration-300 ${
                mode === tab ? "bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.2)]" : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {tab === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {mode === "signup" && (
            <Field icon={UserRound} label="Full Name" type="text" value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
          )}
          <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <Field
            icon={LockKeyhole}
            label={mode === "forgot" ? "New Password" : "Password"}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            placeholder={mode === "forgot" ? "Enter a new password (min 6 chars)" : "Enter your password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            action={
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="text-neutral-500 transition-colors hover:text-green-400" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          {mode !== "login" && (
            <Field icon={LockKeyhole} label={mode === "forgot" ? "Confirm New Password" : "Confirm Password"} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm your password" autoComplete="new-password" />
          )}

          {mode === "login" && (
            <button type="button" onClick={() => switchMode("forgot")} className="-mt-1 self-end text-xs font-bold text-green-400 transition-colors hover:text-green-300">
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => switchMode("login")} className="-mt-1 self-end text-xs font-bold text-green-400 transition-colors hover:text-green-300">
              Back to login
            </button>
          )}

          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300">{error}</p>}
          {success && <p className="rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2.5 text-sm font-semibold text-green-300">{success}</p>}

          <button type="submit" disabled={isSubmitting} className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3.5 text-sm font-black text-black shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : mode === "signup" ? "Create Account" : "Reset Password"}
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </form>

        {isSupabaseConfigured() ? (
          <>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Or continue with</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <button type="button" onClick={handleGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-bold text-neutral-200 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 active:scale-[0.98]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-blue-600">G</span>
              Continue with Google
            </button>
          </>
        ) : (
          <p className="mt-6 text-center text-[11px] font-medium leading-relaxed text-neutral-600">
            Demo auth: accounts are stored only in this browser with hashed passwords. Add Supabase keys to enable Google login + cloud sync.
          </p>
        )}
      </section>
    </main>
  );
}

interface FieldProps {
  icon: typeof Mail;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  action?: React.ReactNode;
}

function Field({ icon: Icon, label, type, value, onChange, placeholder, autoComplete, action }: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold text-neutral-400">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 transition-colors focus-within:border-green-500/50 focus-within:bg-green-500/5">
        <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-neutral-700" />
        {action}
      </span>
    </label>
  );
}
