"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Cpu, Upload, CheckCircle, AlertTriangle, Timer, User,
  Image as ImageIcon, Zap, Award, ArrowRight, X, Loader2
} from "lucide-react";
import { toast } from "sonner";

interface SessionData {
  id: string;
  questionText: string;
  tinkercadUrl: string;
  active: boolean;
  expiresAt: string;
}

interface ResultEntry {
  userId: string;
  userName: string;
  aiScore: number;
  aiFeedback: string | null;
  graded: boolean;
}

export default function StudentCircuitPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a192f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Cpu className="w-12 h-12 text-[#00bfff] animate-spin" />
          <p className="text-gray-500 font-mono text-sm">Loading Circuit Challenge...</p>
        </div>
      </div>
    }>
      <StudentCircuitPage />
    </Suspense>
  );
}

function StudentCircuitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [myResult, setMyResult] = useState<ResultEntry | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Fetch session data
  useEffect(() => {
    if (!sessionId) {
      toast.error("No session ID provided");
      router.push("/quiz");
      return;
    }

    async function fetchSession() {
      try {
        const token = localStorage.getItem("quiz_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/circuit/results?sessionId=${sessionId}`, { headers });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);

        setSession(json.session);
        if (json.results.length > 0) {
          setResults(json.results);
          const me = json.results.find((r: ResultEntry) => r.graded);
          if (me) setMyResult(me);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load session";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId, router]);

  // Poll for results after upload
  useEffect(() => {
    if (!uploaded || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("quiz_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/circuit/results?sessionId=${sessionId}`, { headers });
        const json = await res.json();
        if (json.results) {
          setResults(json.results);
          const graded = json.results.find((r: ResultEntry) => r.graded);
          if (graded) {
            setMyResult(graded);
            clearInterval(interval);
          }
        }
      } catch { /* silent */ }
    }, 5000);

    setPollInterval(interval);
    return () => clearInterval(interval);
  }, [uploaded, sessionId]);

  // File selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  // Upload screenshot
  async function handleUpload() {
    if (!selectedFile || !sessionId) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("screenshot", selectedFile);

      const token = localStorage.getItem("quiz_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/circuit/submit", {
        method: "POST",
        headers,
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setUploaded(true);
      setShowPopup(true);
      toast.success("Screenshot uploaded successfully!");

      // Auto-hide popup after 3 seconds
      setTimeout(() => setShowPopup(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // Normalize tinkercad url to embed format
  function getEmbedUrl(url: string): string {
    if (url.includes("/embed/")) return url;
    // Convert /things/xxx to /embed/xxx
    const match = url.match(/tinkercad\.com\/things\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.tinkercad.com/embed/${match[1]}`;
    return url;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Cpu className="w-12 h-12 text-[#00bfff] animate-spin" />
          <p className="text-gray-500 font-mono text-sm">Loading Circuit Challenge...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-heading text-white mb-2">Session Not Found</h2>
        <p className="text-gray-400 mb-6">This circuit challenge session may have expired or been ended.</p>
        <button onClick={() => router.push("/quiz")} className="btn-primary px-8">
          Return to Quiz
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a192f] flex flex-col">
      {/* Success Popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-[#0f1d32] border border-green-500/30 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl shadow-green-500/10 text-center animate-slide-up">
            <button onClick={() => setShowPopup(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-3xl font-heading text-white mb-2">Uploaded!</h3>
            <p className="text-gray-400 text-sm">Your circuit solution has been submitted successfully. Results will appear once the host triggers AI grading.</p>
            <div className="mt-6 flex justify-center">
              <div className="h-1 w-32 bg-green-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full animate-[shrink_3s_linear_forwards]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10 bg-[#0a192f]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00bfff]/10 rounded-xl flex items-center justify-center border border-[#00bfff]/20">
              <Cpu className="w-5 h-5 text-[#00bfff]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Circuit Challenge</h1>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <Timer className="w-3 h-3" /> Live Session
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4" /> DO NOT REFRESH OR CLOSE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">

        {/* TinkerCAD Embed */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 text-[#00bfff]" /> Reference Circuit
          </div>
          <div className="glass-card overflow-hidden border-[#00bfff]/10" style={{background: '#0f1d32'}}>
            <iframe
              src={getEmbedUrl(session.tinkercadUrl)}
              width="100%"
              height="450"
              className="border-0 w-full"
              allow="fullscreen"
              title="TinkerCAD Circuit"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </section>

        {/* Question */}
        <section className="glass-card p-6 space-y-3" style={{background: '#0f1d32', borderColor: 'rgba(255,255,255,0.08)'}}>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-[#00bfff] font-mono text-sm bg-[#00bfff]/10 px-2 py-0.5 rounded">Q</span>
            Challenge Question
          </h3>
          <p className="text-gray-300 leading-relaxed text-base">{session.questionText}</p>
        </section>

        {/* Upload Section */}
        {!myResult && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <Upload className="w-3.5 h-3.5 text-[#00bfff]" /> Upload Your Solution
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`glass-card p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[200px] ${
                dragOver
                  ? "border-[#00bfff] bg-[#00bfff]/5 scale-[1.01]"
                  : "border-dashed border-white/10 hover:border-[#00bfff]/30 hover:bg-white/[0.02]"
              }`}
              style={{background: '#0f1d32'}}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              {previewUrl ? (
                <div className="space-y-4 w-full max-w-md text-center">
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-48 rounded-xl border border-white/10 shadow-xl"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-400 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-400">{selectedFile?.name}</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-[#00bfff]/5 rounded-2xl flex items-center justify-center border border-[#00bfff]/10 mb-4">
                    <ImageIcon className="w-8 h-8 text-[#00bfff]/50" />
                  </div>
                  <p className="text-gray-400 text-sm font-medium">
                    Drag & drop your circuit screenshot here
                  </p>
                  <p className="text-gray-600 text-xs mt-1">or click to browse · PNG, JPG · Max 5MB</p>
                </>
              )}
            </div>

            {/* Upload Button */}
            {selectedFile && !uploaded && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 shadow-2xl shadow-[#00bfff]/20"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" /> Upload Solution <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}

            {uploaded && !myResult && (
              <div className="glass-card p-6 text-center space-y-3" style={{background: '#0f1d32', borderColor: 'rgba(0,191,255,0.15)'}}>
                <Loader2 className="w-8 h-8 text-[#00bfff] animate-spin mx-auto" />
                <p className="text-gray-400 text-sm">Waiting for AI grading...</p>
                <p className="text-gray-600 text-xs">Results will appear automatically once the host triggers grading</p>
              </div>
            )}
          </section>
        )}

        {/* Results Section */}
        {myResult && (
          <section className="space-y-4 animate-slide-up">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <Award className="w-3.5 h-3.5 text-[#00bfff]" /> Your Result
            </div>

            <div className="glass-card p-8 text-center space-y-6" style={{background: '#0f1d32', borderColor: myResult.aiScore >= 70 ? 'rgba(34,197,94,0.2)' : myResult.aiScore >= 40 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}}>
              {/* Score Circle */}
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={myResult.aiScore >= 70 ? "#22c55e" : myResult.aiScore >= 40 ? "#eab308" : "#ef4444"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(myResult.aiScore / 100) * 327} 327`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{myResult.aiScore}</span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>

              {/* Feedback */}
              {myResult.aiFeedback && (
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-left max-w-lg mx-auto">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">AI Feedback</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{myResult.aiFeedback}</p>
                </div>
              )}
            </div>

            <button onClick={() => router.push("/")} className="btn-secondary w-full py-3 mt-4">
              Return Home
            </button>
          </section>
        )}
      </div>

      {/* Custom animation keyframes */}
      <style jsx global>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
