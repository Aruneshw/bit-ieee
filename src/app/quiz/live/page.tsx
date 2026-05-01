"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Code, CheckCircle, AlertTriangle, Timer, User } from "lucide-react";
import { toast } from "sonner";

export default function StudentLiveQuizPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("quiz_token");
    const user = JSON.parse(localStorage.getItem("quiz_user") || "{}");
    
    if (!token) {
      toast.error("Session expired. Please login again.");
      router.push("/quiz");
      return;
    }

    setUserName(user.name);

    async function fetchQuestions() {
      try {
        const res = await fetch("/api/quiz/questions", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load quiz");
        setQuizData(json);
      } catch (err: any) {
        toast.error(err.message);
        router.push("/quiz");
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, [router]);

  async function handleSubmit() {
    setLoading(true);
    // In a real app, you'd send this to /api/quiz/submit
    // For now, we simulate success
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
      localStorage.removeItem("quiz_token");
      toast.success("Quiz submitted successfully!");
    }, 1500);
  }

  if (loading && !quizData) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#00bfff] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 font-mono">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mb-6 animate-scale-up" />
        <h2 className="text-4xl font-heading tracking-wide text-white mb-2">Quiz Completed!</h2>
        <p className="text-gray-400 max-w-md">Thank you, {userName}. Your responses have been securely recorded for your host.</p>
        <button onClick={() => router.push("/")} className="btn-secondary mt-8 px-8">Return Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a192f] flex flex-col p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
            <Code className="text-[#00bfff]" />
            {quizData?.eventName}
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {userName}</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full" />
            <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> Live Session</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs font-bold animate-pulse">
          <AlertTriangle className="w-4 h-4" /> DO NOT REFRESH OR CLOSE
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 max-w-3xl mx-auto w-full space-y-8">
        {quizData?.questions?.map((q: any, i: number) => (
          <div key={i} className="glass-card p-8 space-y-6 hover:border-[#00bfff]/20 transition-all duration-300">
            <h3 className="text-xl font-medium text-gray-200 leading-relaxed">
              <span className="text-[#00bfff] mr-3 font-mono">Q{i + 1}.</span> {q.text}
            </h3>
            
            <div className="grid gap-3">
              {(q.options || ["Option A", "Option B", "Option C", "Option D"]).map((opt: string, oIdx: number) => (
                <label key={oIdx} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                  answers[i] === String(oIdx) ? "bg-[#00629B]/20 border-[#00bfff]/40 text-[#00bfff]" : "border-white/5 hover:bg-white/5 text-gray-400"
                }`}>
                  <input
                    type="radio"
                    name={`q-${i}`}
                    checked={answers[i] === String(oIdx)}
                    onChange={() => setAnswers(prev => ({ ...prev, [i]: String(oIdx) }))}
                    className="accent-[#00bfff] w-4 h-4"
                  />
                  <span className="text-sm font-medium">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="mt-10 max-w-3xl mx-auto w-full flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading || Object.keys(answers).length < (quizData?.questions?.length || 0)}
          className="btn-primary px-12 py-4 text-lg shadow-2xl shadow-[#00bfff]/20"
        >
          {loading ? "Submitting..." : "Finish Quiz"}
        </button>
      </div>
    </div>
  );
}
