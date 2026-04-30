"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AttendPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent-primary)" }} />
        </div>
      }
    >
      <AttendInner />
    </Suspense>
  );
}

function AttendInner() {
  const params = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const payload = useMemo(() => {
    const event_id = params.get("event_id") || "";
    const otp = params.get("otp") || "";
    const type = params.get("type") as "start" | "end" | null;
    return { event_id, otp, type };
  }, [params]);

  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!payload.event_id || !payload.otp || (payload.type !== "start" && payload.type !== "end")) {
        setState("error");
        setMessage("Invalid attendance link.");
        return;
      }
      try {
        const { data, error } = await supabase.rpc("validate_and_mark_attendance", {
          p_event_id: payload.event_id,
          p_otp_code: payload.otp,
          p_otp_type: payload.type,
        });
        if (error) throw error;
        if (data?.ok === false) {
          setState("error");
          setMessage(data.error || "Invalid or expired OTP.");
          return;
        }
        setState("ok");
        setMessage(data?.message || "✓ Attendance marked successfully!");
        toast.success("✓ Attendance marked successfully!");
        setTimeout(() => router.replace("/member/attendance"), 1200);
      } catch (e: any) {
        setState("error");
        setMessage(e.message || "Attendance failed.");
      }
    }
    run();
  }, [payload.event_id, payload.otp, payload.type]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-md w-full text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: "var(--accent-primary)" }} />
            <h1 className="text-xl font-semibold mt-4" style={{ color: "var(--text-primary)" }}>
              Marking attendance…
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Please wait a moment.
            </p>
          </>
        )}

        {state === "ok" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: "var(--success)" }} />
            <h1 className="text-xl font-semibold mt-4" style={{ color: "var(--text-primary)" }}>
              Success
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="w-12 h-12 mx-auto" style={{ color: "var(--danger)" }} />
            <h1 className="text-xl font-semibold mt-4" style={{ color: "var(--text-primary)" }}>
              Couldn’t mark attendance
            </h1>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
            <button type="button" className="btn-secondary mt-6 w-full" onClick={() => router.replace("/member/attendance")}>
              Go to Mark Attendance
            </button>
          </>
        )}
      </div>
    </div>
  );
}

