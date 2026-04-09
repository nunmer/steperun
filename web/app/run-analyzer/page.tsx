"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Session {
  id: string;
  title: string;
  status: string;
  frame_count: number;
  overall_score: number | null;
  created_at: string;
}

interface Frame {
  id: string;
  idx: number;
  phase: string;
  frame_number: number;
  timestamp_ms: number;
  image_url: string;
  image_path: string;
}

interface AnalysisSection {
  title: string;
  rating: "good" | "warning" | "bad";
  summary: string;
  details: string;
}

interface Recommendation {
  priority: number;
  text: string;
}

interface Analysis {
  sections: AnalysisSection[];
  recommendations: Recommendation[];
  overall_score: number;
}

/* ------------------------------------------------------------------ */
/* Animated loading words                                              */
/* ------------------------------------------------------------------ */

const EXTRACT_WORDS = [
  "initializing", "scanning", "detecting", "mapping",
  "analyzing", "vibing", "extracting", "finishing",
];
const ANALYZE_WORDS = [
  "thinking", "observing", "measuring", "comparing",
  "vibing", "diagnosing", "crafting", "polishing",
];

function AnimatedWord({ words }: { words: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), 2000);
    return () => clearInterval(t);
  }, [words]);
  return (
    <span
      key={idx}
      className="inline-block animate-[fadeUp_0.5s_ease-out]"
      style={{
        background: "linear-gradient(135deg, #00f0ff, #a855f7, #f472b6)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {words[idx]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function RunAnalyzerPage() {
  const supabase = createSupabaseBrowserClient();

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Current session data
  const [frames, setFrames] = useState<Frame[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // UI state
  const [step, setStep] = useState<"upload" | "frames" | "results">("upload");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"extract" | "analyze">("extract");
  const [provider, setProvider] = useState("aws");
  const [error, setError] = useState<string | null>(null);

  // Frame viewer
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(500);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Expanded analysis items
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  /* ----- Auth ----- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ----- Load sessions ----- */
  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/run-analyzer/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions || []);
    }
  }, []);

  useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  /* ----- Load a session ----- */
  const loadSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setError(null);
    setSessionError(null);

    const res = await fetch(`/api/run-analyzer/sessions/${id}`);
    if (!res.ok) return;

    const data = await res.json();
    const s = data.session;
    setSessionStatus(s.status);
    setFrames(data.frames || []);
    setProvider(s.provider || "aws");

    if (s.status === "done" && s.analysis) {
      setAnalysis(s.analysis as Analysis);
      setStep("results");
    } else if (s.status === "extracted" || s.status === "analyzing") {
      setStep("frames");
    } else if (s.status === "error") {
      setSessionError(s.error);
      if (data.frames?.length) setStep("frames");
      else setStep("upload");
    } else {
      setStep("upload");
    }
  }, []);

  /* ----- Auto-play frames ----- */
  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current);
    if (playing && frames.length > 1) {
      playRef.current = setInterval(() => {
        setCurrentFrame((i) => (i + 1) % frames.length);
      }, speed);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, speed, frames.length]);

  /* ----- Sign in ----- */
  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  /* ----- New session + upload ----- */
  async function handleUpload(file: File) {
    setError(null);
    setLoading(true);
    setLoadingType("extract");

    // Create session
    const sessionRes = await fetch("/api/run-analyzer/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name.replace(/\.\w+$/, ""), provider }),
    });

    if (!sessionRes.ok) {
      const err = await sessionRes.json();
      setError(err.error || "Failed to create session");
      setLoading(false);
      return;
    }

    const session = await sessionRes.json();
    setActiveSessionId(session.id);

    // Upload + extract
    const form = new FormData();
    form.append("video", file);
    form.append("session_id", session.id);

    const extractRes = await fetch("/api/run-analyzer/extract", {
      method: "POST",
      body: form,
    });

    setLoading(false);

    if (!extractRes.ok) {
      const err = await extractRes.json();
      setError(err.error || "Extraction failed");
      return;
    }

    const data = await extractRes.json();
    setFrames(data.frames || []);
    setCurrentFrame(0);
    setStep("frames");
    setSessionStatus("extracted");
    loadSessions();
  }

  /* ----- Analyze ----- */
  async function handleAnalyze() {
    if (!activeSessionId) return;
    setError(null);
    setLoading(true);
    setLoadingType("analyze");

    const res = await fetch(`/api/run-analyzer/sessions/${activeSessionId}/analyze`, {
      method: "POST",
    });

    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Analysis failed");
      return;
    }

    const data = await res.json();
    setAnalysis(data);
    setStep("results");
    setSessionStatus("done");
    loadSessions();
  }

  /* ----- New session ----- */
  function startNew() {
    setActiveSessionId(null);
    setFrames([]);
    setAnalysis(null);
    setStep("upload");
    setError(null);
    setSessionError(null);
    setSessionStatus(null);
    setCurrentFrame(0);
    setExpanded(new Set());
  }

  /* ----- Rating helpers ----- */
  const ratingColor = { good: "#00ff88", warning: "#ff9944", bad: "#ff4466" };
  const ratingIcon = { good: "\u2713", warning: "\u26A0", bad: "\u2717" };
  const ratingGlow = {
    good: "0 0 20px rgba(0,255,136,0.3)",
    warning: "0 0 20px rgba(255,153,68,0.3)",
    bad: "0 0 20px rgba(255,68,102,0.3)",
  };

  /* ----- Auth gate ----- */
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center">
        <div
          className="text-4xl font-black"
          style={{
            background: "linear-gradient(135deg, #00f0ff, #a855f7, #f472b6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          RunForm AI
        </div>
        <p className="text-muted-foreground max-w-md">
          AI-powered running technique analysis. Upload your video, get instant biomechanics feedback.
        </p>
        <button
          onClick={signIn}
          className="px-6 py-3 rounded-xl font-semibold text-black"
          style={{ background: "linear-gradient(135deg, #00f0ff, #a855f7)" }}
        >
          Sign in with Google to start
        </button>
        <p className="text-xs text-muted-foreground">2 free analyses per account</p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex min-h-[calc(100vh-10rem)] -mx-4 -my-8">
      {/* ============ SIDEBAR ============ */}
      <aside
        className={`${sidebarOpen ? "w-72" : "w-0"} flex-shrink-0 border-r transition-all duration-300 overflow-hidden`}
        style={{ background: "var(--card)" }}
      >
        <div className="w-72 p-4 flex flex-col h-full">
          <button
            onClick={startNew}
            className="w-full mb-4 py-2.5 rounded-xl font-semibold text-sm text-black"
            style={{ background: "linear-gradient(135deg, #00f0ff, #a855f7)" }}
          >
            + New Analysis
          </button>

          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-mono">
            Sessions ({sessions.length}/2 free)
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                  activeSessionId === s.id
                    ? "bg-accent border border-ring"
                    : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate">{s.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <StatusDot status={s.status} />
                  <span>{s.status}</span>
                  {s.overall_score != null && (
                    <span className="ml-auto font-mono" style={{ color: scoreColor(s.overall_score) }}>
                      {s.overall_score}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mb-4 text-xs text-muted-foreground hover:text-foreground font-mono"
          >
            {sidebarOpen ? "\u25C0 hide sidebar" : "\u25B6 show sessions"}
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-3"
              style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)", color: "#00f0ff" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
              ai-powered biomechanics
            </div>
            <h1
              className="text-4xl font-black mb-2"
              style={{
                background: "linear-gradient(135deg, #00f0ff, #a855f7, #f472b6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              RunForm AI
            </h1>
            <p className="text-sm text-muted-foreground">
              Upload your running video. AI maps your skeleton and analyzes technique.
            </p>
          </div>

          {/* Error banner */}
          {(error || sessionError) && (
            <div className="mb-4 p-3 rounded-xl text-sm border"
              style={{ background: "rgba(255,68,102,0.08)", borderColor: "rgba(255,68,102,0.3)", color: "#ff4466" }}
            >
              {error || sessionError}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Spinner />
              <div className="mt-4 text-lg font-mono">
                <AnimatedWord words={loadingType === "extract" ? EXTRACT_WORDS : ANALYZE_WORDS} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {loadingType === "extract" ? "Extracting key frames..." : "AI is analyzing your form..."}
              </div>
            </div>
          )}

          {/* ========== STEP: UPLOAD ========== */}
          {!loading && step === "upload" && (
            <UploadCard provider={provider} setProvider={setProvider} onUpload={handleUpload} />
          )}

          {/* ========== STEP: FRAMES ========== */}
          {!loading && step === "frames" && frames.length > 0 && (
            <div className="space-y-4 animate-[fadeUp_0.5s_ease-out]">
              <SectionHeader num="02" label="Key Frames" />

              {/* Main viewer */}
              <div className="relative rounded-xl overflow-hidden border" style={{ background: "#000", aspectRatio: "16/9" }}>
                <img
                  src={frames[currentFrame]?.image_url}
                  alt="Key frame"
                  className="w-full h-full object-contain animate-[frameIn_0.2s_ease-out]"
                />
                <div className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-mono"
                  style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #00f0ff", color: "#00f0ff" }}
                >
                  {frames[currentFrame]?.phase.replace(/_/g, " ")}
                </div>
                <div className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-mono text-muted-foreground"
                  style={{ background: "rgba(0,0,0,0.7)" }}
                >
                  {currentFrame + 1} / {frames.length}
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {frames.map((f, i) => (
                  <button
                    key={f.id || i}
                    onClick={() => setCurrentFrame(i)}
                    className={`flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${
                      i === currentFrame ? "border-[#00f0ff] opacity-100" : "border-transparent opacity-40 hover:opacity-70"
                    }`}
                    style={i === currentFrame ? { boxShadow: "0 0 12px rgba(0,240,255,0.3)" } : {}}
                  >
                    <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button onClick={() => setPlaying(!playing)} className="btn-icon">
                  {playing ? "\u23F8" : "\u25B6"}
                </button>
                <button onClick={() => setCurrentFrame((currentFrame - 1 + frames.length) % frames.length)} className="btn-icon">\u25C0</button>
                <button onClick={() => setCurrentFrame((currentFrame + 1) % frames.length)} className="btn-icon">\u25B6</button>
                <span className="text-xs font-mono text-muted-foreground">{speed}ms</span>
                <input
                  type="range" min={200} max={2000} step={100} value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: "#00f0ff" }}
                />
              </div>

              {/* Analyze button */}
              <button
                onClick={handleAnalyze}
                className="w-full py-3 rounded-xl font-semibold text-black relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #00f0ff, #a855f7)" }}
              >
                Analyze Technique with AI
              </button>
            </div>
          )}

          {/* ========== STEP: RESULTS ========== */}
          {!loading && step === "results" && analysis && (
            <div className="space-y-6 animate-[fadeUp_0.5s_ease-out]">
              <SectionHeader num="03" label="Technique Analysis" />

              {/* Score ring */}
              <ScoreRing score={analysis.overall_score} />

              {/* Sections */}
              <div className="space-y-2">
                {analysis.sections.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 border transition-all cursor-pointer"
                    onClick={() => {
                      const next = new Set(expanded);
                      next.has(i) ? next.delete(i) : next.add(i);
                      setExpanded(next);
                    }}
                    style={{
                      background: "var(--card)",
                      borderLeft: `3px solid ${ratingColor[s.rating]}`,
                      borderColor: ratingColor[s.rating],
                      animationDelay: `${i * 0.08}s`,
                      boxShadow: expanded.has(i) ? ratingGlow[s.rating] : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                        style={{ background: `${ratingColor[s.rating]}15`, color: ratingColor[s.rating] }}
                      >
                        {ratingIcon[s.rating]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{s.title}</span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
                            style={{ background: `${ratingColor[s.rating]}15`, color: ratingColor[s.rating] }}
                          >
                            {s.rating}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.summary}</div>
                      </div>
                      <span className="text-muted-foreground text-xs">{expanded.has(i) ? "\u25B2" : "\u25BC"}</span>
                    </div>
                    {expanded.has(i) && (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground leading-relaxed">
                        {s.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-3 flex items-center gap-2"
                  style={{ color: "#a855f7" }}
                >
                  <span className="w-2 h-2 rounded-sm bg-[#a855f7]" /> Top Recommendations
                </div>
                {analysis.recommendations.map((r, i) => (
                  <div
                    key={i}
                    className="flex gap-3 p-3 rounded-xl border mb-2"
                    style={{ background: "var(--card)", animationDelay: `${(analysis.sections.length + i) * 0.08}s` }}
                  >
                    <span
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black"
                      style={{ background: "linear-gradient(135deg, #00f0ff, #a855f7)" }}
                    >
                      {r.priority}
                    </span>
                    <span className="text-sm">{r.text}</span>
                  </div>
                ))}
              </div>

              {/* Back to frames / New */}
              <div className="flex gap-3">
                <button onClick={() => setStep("frames")} className="btn-secondary flex-1">
                  \u25C0 View Frames
                </button>
                <button onClick={startNew} className="btn-secondary flex-1">
                  + New Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ GLOBAL STYLES ============ */}
      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes frameIn {
          from { opacity: 0; transform: scale(1.02); }
          to { opacity: 1; transform: scale(1); }
        }
        .btn-icon {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--card);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; font-size: 14px;
          color: var(--foreground);
        }
        .btn-icon:hover { border-color: #00f0ff; color: #00f0ff; }
        .btn-secondary {
          padding: 0.625rem; border-radius: 0.75rem; border: 1px solid var(--border);
          background: var(--card); font-size: 0.875rem; cursor: pointer;
          transition: all 0.2s; color: var(--foreground);
        }
        .btn-secondary:hover { border-color: #00f0ff; }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <div className="relative w-16 h-16">
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{ border: "2px solid transparent", borderTopColor: "#00f0ff", borderRightColor: "#00f0ff" }}
      />
      <div
        className="absolute rounded-full animate-spin"
        style={{
          inset: "6px", border: "2px solid transparent",
          borderBottomColor: "#a855f7", borderLeftColor: "#a855f7",
          animationDirection: "reverse", animationDuration: "1.5s",
        }}
      />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done" ? "#00ff88" :
    status === "error" ? "#ff4466" :
    status === "extracted" ? "#00f0ff" :
    "#ff9944";
  return <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />;
}

function scoreColor(score: number) {
  return score >= 75 ? "#00ff88" : score >= 50 ? "#ff9944" : "#ff4466";
}

function SectionHeader({ num, label }: { num: string; label: string }) {
  return (
    <div className="text-xs font-mono uppercase tracking-wider flex items-center gap-2 mb-2" style={{ color: "#00f0ff" }}>
      <span className="w-2 h-2 rounded-sm bg-[#00f0ff]" />
      {num} &mdash; {label}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  const circumference = 326.73;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="52" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black font-mono" style={{ color }}>{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">overall</span>
      </div>
    </div>
  );
}

function UploadCard({
  provider,
  setProvider,
  onUpload,
}: {
  provider: string;
  setProvider: (p: string) => void;
  onUpload: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files[0]);
  }

  return (
    <div className="rounded-2xl border p-6" style={{ background: "var(--card)" }}>
      <SectionHeader num="01" label="Upload Video" />

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`mt-4 border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragActive ? "border-[#00f0ff]" : "border-border hover:border-[#00f0ff]"
        }`}
        style={dragActive ? { background: "rgba(0,240,255,0.03)", boxShadow: "0 0 30px rgba(0,240,255,0.1)" } : {}}
      >
        <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,240,255,0.1)", border: "1px solid rgba(0,240,255,0.2)" }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
        </div>
        <div className="text-sm">Drop your video here or <span style={{ color: "#00f0ff" }}>browse</span></div>
        <div className="text-xs text-muted-foreground mt-1">Supports MOV, MP4</div>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
          if (e.target.files?.length) onUpload(e.target.files[0]);
        }} />
      </div>

      <div className="flex gap-2 mt-4 justify-center">
        {(["aws", "openai"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className="px-4 py-2 rounded-lg text-xs font-mono border transition-all"
            style={provider === p
              ? { borderColor: "#a855f7", background: "rgba(168,85,247,0.1)", color: "#a855f7" }
              : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
            }
          >
            {p === "aws" ? "AWS Claude" : "OpenAI GPT-4o"}
          </button>
        ))}
      </div>
    </div>
  );
}
