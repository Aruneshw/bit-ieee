"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getRoleDashboardPath, needsProfileCompletion } from "@/lib/types";
import type { UserRole } from "@/lib/types";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  unauthorized_domain: "Only @bitsathy.ac.in email addresses are allowed.",
  not_registered: "Your account is not registered. Contact your IEEE admin.",
  auth_failed: "Authentication failed. Please try again.",
};

function getAuthErrorMessage(error: string | null) {
  return error ? AUTH_ERROR_MESSAGES[error] ?? "Authentication failed. Please try again." : "";
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const searchParams = useSearchParams();
  const [error, setError] = useState(() => getAuthErrorMessage(searchParams.get("error")));

  const supabase = createClient();

  const ALLOWED_DOMAIN = "bitsathy.ac.in";
  const ADMIN_EMAILS = [
    "bitieeehubadmin1@gmail.com",
    "bitieeehubadmin2@gmail.com",
    "aruneshownsty1@gmail.com",
    "bitieeehubadmin3@gmail.com",
    "bitieeehubadmin4@gmail.com",
  ];

  function validateEmail(email: string): boolean {
    const normalizedEmail = email.toLowerCase();
    return normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`) || ADMIN_EMAILS.includes(normalizedEmail);
  }

  /**
   * Post-login auth guard — runs after any successful authentication.
   * Checks if user exists in DB, profile completion status, and routes accordingly.
   */
  async function postLoginGuard(userEmail: string) {
    const { data: profile, error: dbError } = await supabase
      .from("users")
      .select("role, society_id, profile_completed")
      .eq("email", userEmail.toLowerCase())
      .single();

    if (dbError || !profile) {
      // User not pre-registered by admin
      await supabase.auth.signOut();
      setError("Your account is not registered. Contact your IEEE admin.");
      return;
    }

    const role = profile.role as UserRole;

    if (needsProfileCompletion(role) && !profile.profile_completed) {
      window.location.href = "/profile-setup";
      return;
    }

    // Profile complete → go to role-specific dashboard
    window.location.href = getRoleDashboardPath(role);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            hd: ALLOWED_DOMAIN,
          },
        },
      });
      if (error) {
        setError(error.message);
        toast.error("Google sign-in failed");
      }
    } catch {
      setError("An error occurred during Google sign-in");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!validateEmail(email)) {
      setError("Only @bitsathy.ac.in email addresses are allowed.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user?.email) {
        await postLoginGuard(data.user.email);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00bfff]/8 blur-[150px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00629B]/10 blur-[150px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00629B] to-[#00bfff] flex items-center justify-center shadow-lg shadow-[#00bfff]/20 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-wide text-white">BIT IEEE HUB</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Secure Portal</p>
            </div>
          </Link>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 shadow-2xl">
          <h1 className="text-3xl font-heading tracking-wide text-center mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            Access restricted to <span className="text-[#00bfff] font-medium">@bitsathy.ac.in</span> accounts
          </p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white rounded-xl font-semibold text-gray-900 shadow-lg hover:shadow-white/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {googleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {googleLoading ? "Authenticating..." : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@bitsathy.ac.in"
                required
                className="input-field pl-10"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="input-field pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 btn-primary text-center"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </div>
              ) : "Sign In"}
            </button>
          </form>
        </div>

        {/* Domain Notice */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Only @bitsathy.ac.in and authorized admin emails may access this portal.
          <br />
          <span className="text-gray-500 mt-1 block">Self-registration is not available. Contact your IEEE admin.</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#00bfff] border-t-white rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
