"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, KeyRound, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function StudentQuizLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/quiz/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");

      // Store the Quiz JWT in local storage for the live session
      localStorage.setItem("quiz_token", json.token);
      localStorage.setItem("quiz_user", JSON.stringify(json.user));
      
      toast.success(`Welcome ${json.user.name}! Accessing live quiz...`);
      router.push("/quiz/live");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-slide-up">
        <div className="text-center">
          <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-xl shadow-[#00bfff]/5">
            <Lock className="w-10 h-10 text-[#00bfff]" />
          </div>
          <h1 className="text-4xl font-heading tracking-wide text-white mb-2">Quiz Gateway</h1>
          <p className="text-gray-400">Enter your official email and the OTP sent by your host.</p>
        </div>

        <form onSubmit={handleVerify} className="glass-card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                <Mail className="w-3 h-3" /> Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rollnumber@bitsathy.ac.in"
                className="input-field py-3 text-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-2">
                <KeyRound className="w-3 h-3" /> 6-Digit OTP
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="0 0 0 0 0 0"
                className="input-field py-3 text-2xl font-mono tracking-[0.8em] text-center"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
          >
            {loading ? "Verifying..." : (
              <>
                Unlock Quiz <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 uppercase tracking-widest">
          Secure Multi-Host Isolation Powered by Bcrypt
        </p>
      </div>
    </div>
  );
}
