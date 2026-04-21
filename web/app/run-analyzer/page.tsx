"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import {
  PanelLeftClose, PanelLeftOpen,
  Play, Pause, SkipBack, SkipForward,
  Upload, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";

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
  is_key_frame?: boolean;
}

interface AnalysisSection {
  title: string;
  relevant_phase?: string;
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
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PHASE_FALLBACK: Record<string, string> = {
  "Foot Strike Pattern": "foot_strike",
  "Cadence & Stride": "mid_stance",
  "Posture": "mid_stance",
  "Arm Mechanics": "mid_stance",
  "Hip & Pelvis": "toe_off",
  "Knee Drive": "flight",
  "Overall Efficiency": "mid_stance",
};

const EXTRACT_WORDS = [
  "initializing", "scanning", "detecting", "mapping",
  "analyzing", "processing", "extracting", "finishing",
];
const ANALYZE_WORDS = [
  "thinking", "observing", "measuring", "comparing",
  "evaluating", "diagnosing", "crafting", "polishing",
];

const RATING_COLOR = { good: "#22c55e", warning: "#eab308", bad: "#ef4444" };
const RATING_ICON = { good: "\u2713", warning: "\u26A0", bad: "\u2717" };

const MOTION_INTERVAL = 300; // ms between motion frames
const ANALYSIS_INTERVAL = 700; // ms between frames in analysis zone (slow)
const SLOW_BEFORE = 2; // frames to start slowing before key frame
const OVERLAY_AFTER = 4; // frames to keep overlay after key frame

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function AnimatedWord({ words }: { words: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), 2000);
    return () => clearInterval(t);
  }, [words]);
  return (
    <span key={idx} className="inline-block animate-[ra-fadeUp_0.5s_ease-out] text-foreground font-semibold">
      {words[idx]}
    </span>
  );
}

/** Build a map: frame index → analysis section index (for key frames that match a section's relevant_phase) */
function buildFrameToSectionMap(frames: Frame[], analysis: Analysis): Map<number, number> {
  const map = new Map<number, number>();
  const usedSections = new Set<number>();

  // For each section, find the first key frame matching its phase
  for (let si = 0; si < analysis.sections.length; si++) {
    const section = analysis.sections[si];
    const phase = section.relevant_phase || PHASE_FALLBACK[section.title];
    if (!phase) continue;

    const fi = frames.findIndex(
      (f) => (f.is_key_frame ?? true) && f.phase === phase && !map.has(frames.indexOf(f)),
    );
    if (fi !== -1) {
      map.set(fi, si);
      usedSections.add(si);
    }
  }

  // Fallback: assign remaining sections to remaining key frames in order
  let nextKeyIdx = 0;
  for (let si = 0; si < analysis.sections.length; si++) {
    if (usedSections.has(si)) continue;
    while (nextKeyIdx < frames.length) {
      if ((frames[nextKeyIdx].is_key_frame ?? true) && !map.has(nextKeyIdx)) {
        map.set(nextKeyIdx, si);
        nextKeyIdx++;
        break;
      }
      nextKeyIdx++;
    }
  }

  return map;
}

function scoreColor(score: number) {
  return score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function RunAnalyzerPage() {
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [frames, setFrames] = useState<Frame[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [step, setStep] = useState<"upload" | "session">("upload");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"extract" | "analyze">("extract");
  const [error, setError] = useState<string | null>(null);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(150);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Analysis player state
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const hasFrames = frames.length > 0;
  const hasAnalysis = analysis !== null;
  const needsAnalysis = hasFrames && !hasAnalysis && sessionStatus !== "done";

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
    if (res.ok) setSessions((await res.json()).sessions || []);
  }, []);

  useEffect(() => { if (user) loadSessions(); }, [user, loadSessions]);

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
    setActiveSectionIdx(0);
    setShowDetails(false);
    setAutoPlaying(false);

    if (s.status === "done" && s.analysis) {
      setAnalysis(s.analysis as Analysis);
    } else {
      setAnalysis(null);
    }

    if (s.status === "error") {
      setSessionError(s.error);
      if (!data.frames?.length) { setStep("upload"); return; }
    }

    setStep(data.frames?.length || s.status === "done" ? "session" : "upload");
  }, []);

  /* ----- Pre-analysis autoplay ----- */
  useEffect(() => {
    if (playRef.current) clearInterval(playRef.current);
    if (playing && frames.length > 1 && !analysis) {
      playRef.current = setInterval(() => setCurrentFrame((i) => (i + 1) % frames.length), speed);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, speed, frames.length, analysis]);


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

  /* ----- Upload ----- */
  async function handleUpload(file: File) {
    setError(null);
    setLoading(true);
    setLoadingType("extract");

    const sessionRes = await fetch("/api/run-analyzer/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name.replace(/\.\w+$/, "") }),
    });
    if (!sessionRes.ok) {
      setError((await sessionRes.json()).error || "Failed to create session");
      setLoading(false);
      return;
    }
    const session = await sessionRes.json();
    setActiveSessionId(session.id);

    const form = new FormData();
    form.append("video", file);
    form.append("session_id", session.id);
    const extractRes = await fetch("/api/run-analyzer/extract", { method: "POST", body: form });
    setLoading(false);
    if (!extractRes.ok) {
      setError((await extractRes.json()).error || "Extraction failed");
      return;
    }
    const data = await extractRes.json();
    setFrames(data.frames || []);
    setAnalysis(null);
    setCurrentFrame(0);
    setStep("session");
    setSessionStatus("extracted");
    loadSessions();
  }

  /* ----- Analyze ----- */
  async function handleAnalyze() {
    if (!activeSessionId) return;
    setError(null);
    setLoading(true);
    setLoadingType("analyze");

    const res = await fetch(`/api/run-analyzer/sessions/${activeSessionId}/analyze`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json()).error || "Analysis failed");
      return;
    }
    const data = await res.json();
    setAnalysis(data);
    setSessionStatus("done");
    setActiveSectionIdx(0);
    setShowDetails(false);
    setAutoPlaying(true);
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
    setActiveSectionIdx(0);
    setShowDetails(false);
    setAutoPlaying(false);
    setExpanded(new Set());
  }

  /* ----- Auth gate ----- */
  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Spinner /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8 text-center px-4">
        <h1 className="text-5xl md:text-[64px] font-black text-foreground" style={{ letterSpacing: "-2px", lineHeight: 1.1 }}>
          RunForm AI
        </h1>
        <p className="text-lg text-muted-foreground max-w-md" style={{ lineHeight: 1.4 }}>
          AI-powered running technique analysis. Upload your video, get instant biomechanics feedback.
        </p>
        <button onClick={signIn} className="px-8 py-3 bg-foreground text-background font-semibold text-base hover:opacity-90 transition-opacity" style={{ borderRadius: "9999px" }}>
          Sign in with Google to start
        </button>
        <p className="text-sm text-muted-foreground opacity-60">2 free analyses per account</p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex min-h-[calc(100vh-10rem)] -mx-4 -my-8">
      {/* ============ SIDEBAR ============ */}
      <aside className={`${sidebarOpen ? "w-72" : "w-0"} flex-shrink-0 transition-all duration-300 overflow-hidden bg-card border-r border-border`}>
        <div className="w-72 p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <button onClick={startNew} className="flex-1 mr-2 py-2.5 font-semibold text-sm bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center gap-2" style={{ borderRadius: "9999px" }}>
              <Plus size={14} /> New Analysis
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Close sidebar">
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
            Sessions ({sessions.filter(s => s.status !== "error").length}/2 free)
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${activeSessionId === s.id ? "bg-accent border-border" : "border-transparent hover:bg-muted"}`}
              >
                <div className="font-semibold text-foreground truncate">{s.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <StatusDot status={s.status} />
                  <span>{s.status}</span>
                  {s.overall_score != null && <span className="ml-auto font-semibold" style={{ color: scoreColor(s.overall_score) }}>{s.overall_score}</span>}
                </div>
                <div className="text-xs text-muted-foreground opacity-60 mt-1">{new Date(s.created_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="mb-4 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Open sidebar">
              <PanelLeftOpen size={18} />
            </button>
          )}

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-4 bg-card border border-border" style={{ borderRadius: "9999px", boxShadow: "rgba(0,0,0,0.08) 0px 3px 6px" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              ai-powered biomechanics
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-3" style={{ letterSpacing: "-2px", lineHeight: 1.1 }}>
              RunForm AI
            </h1>
            <p className="text-base text-muted-foreground" style={{ lineHeight: 1.4 }}>
              Upload your running video. AI maps your skeleton and analyzes technique.
            </p>
          </div>

          {(error || sessionError) && (
            <div className="mb-6 p-4 rounded-lg text-sm border border-destructive/30 bg-destructive/10 text-destructive">
              {error || sessionError}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner />
              <div className="mt-6 text-lg"><AnimatedWord words={loadingType === "extract" ? EXTRACT_WORDS : ANALYZE_WORDS} /></div>
              <div className="text-sm text-muted-foreground mt-1">{loadingType === "extract" ? "Extracting key frames..." : "AI is analyzing your form..."}</div>
            </div>
          )}

          {/* UPLOAD */}
          {!loading && step === "upload" && (
            <UploadCard onUpload={handleUpload} />
          )}

          {/* SESSION */}
          {!loading && step === "session" && (
            <div className="space-y-10 animate-[ra-fadeUp_0.5s_ease-out]">
              {/* Pre-analysis carousel */}
              {hasFrames && !hasAnalysis && (
                <div className="space-y-5">
                  <SectionHeader num="02" label="Key Frames" />
                  <FrameCarousel frames={frames} currentFrame={currentFrame} setCurrentFrame={setCurrentFrame} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />
                  {needsAnalysis && (
                    <button onClick={handleAnalyze} className="w-full py-3.5 font-semibold bg-foreground text-background hover:opacity-90 transition-opacity" style={{ borderRadius: "9999px" }}>
                      Analyze Technique with AI
                    </button>
                  )}
                </div>
              )}

              {/* ===== ANALYSIS PLAYER ===== */}
              {hasAnalysis && (
                <>
                  <AnalysisPlayer
                    analysis={analysis}
                    frames={frames}
                    activeSectionIdx={activeSectionIdx}
                    setActiveSectionIdx={(i) => { setActiveSectionIdx(i); setShowDetails(false); setAutoPlaying(false); }}
                    autoPlaying={autoPlaying}
                    setAutoPlaying={setAutoPlaying}
                    showDetails={showDetails}
                    setShowDetails={setShowDetails}
                  />

                  {/* ===== ANALYSIS CARDS ===== */}
                  <div className="space-y-6">
                    <SectionHeader num="03" label="Detailed Breakdown" />

                    {/* Score */}
                    <ScoreRing score={analysis.overall_score} />

                    {/* Section cards */}
                    <div className="space-y-3">
                      {analysis.sections.map((s, i) => {
                        const isOpen = expanded.has(i);
                        return (
                          <div
                            key={i}
                            className="bg-card border border-border rounded-lg overflow-hidden transition-shadow cursor-pointer"
                            onClick={() => {
                              const next = new Set(expanded);
                              next.has(i) ? next.delete(i) : next.add(i);
                              setExpanded(next);
                              // Also sync video player to this section
                              setActiveSectionIdx(i);
                              setAutoPlaying(false);
                            }}
                            style={{
                              borderLeft: `3px solid ${RATING_COLOR[s.rating]}`,
                              boxShadow: isOpen
                                ? "rgba(0,0,0,0.15) 0px 10px 20px, rgba(0,0,0,0.08) 0px 3px 6px"
                                : "rgba(0,0,0,0.08) 0px 3px 6px, rgba(0,0,0,0.07) 0px 2px 4px",
                            }}
                          >
                            <div className="p-4 flex items-center gap-3">
                              <span
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0"
                                style={{ background: `${RATING_COLOR[s.rating]}20`, color: RATING_COLOR[s.rating] }}
                              >
                                {RATING_ICON[s.rating]}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-foreground">{s.title}</span>
                                  <span
                                    className="px-2 py-0.5 text-[10px] font-semibold uppercase"
                                    style={{
                                      background: `${RATING_COLOR[s.rating]}20`,
                                      color: RATING_COLOR[s.rating],
                                      borderRadius: "9999px",
                                    }}
                                  >
                                    {s.rating}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{s.summary}</div>
                              </div>
                              <span className="text-muted-foreground flex-shrink-0">
                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </div>
                            {isOpen && (
                              <div className="px-4 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-border mt-0 pt-3 mx-4 mb-4">
                                {s.details}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Recommendations */}
                    <div>
                      <div className="text-xs uppercase tracking-wider mb-4 flex items-center gap-2 font-semibold text-foreground">
                        <span className="w-2 h-2 rounded-sm bg-foreground" /> Top Recommendations
                      </div>
                      {analysis.recommendations.map((r, i) => (
                        <div
                          key={i}
                          className="flex gap-3 p-4 mb-2 bg-card border border-border rounded-lg"
                          style={{ boxShadow: "rgba(0,0,0,0.08) 0px 3px 6px, rgba(0,0,0,0.07) 0px 2px 4px" }}
                        >
                          <span
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold bg-foreground text-background"
                            style={{ borderRadius: "9999px" }}
                          >
                            {r.priority}
                          </span>
                          <span className="text-sm text-foreground">{r.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4">
                <button onClick={startNew} className="ra-btn-secondary w-full flex items-center justify-center gap-2">
                  <Plus size={14} /> New Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ra-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ra-slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ra-popIn {
          0% { opacity: 0; transform: scale(0.6); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ra-scoreCount {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes ra-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes ra-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ra-scanLine {
          0% { top: 0%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .ra-btn-icon {
          width: 32px; height: 32px; border-radius: 6px;
          border: 1px solid var(--border); background: var(--card);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: var(--foreground);
        }
        .ra-btn-icon:hover { border-color: var(--foreground); }
        .ra-btn-secondary {
          padding: 0.75rem; border-radius: 9999px; border: 1px solid var(--border);
          background: var(--card); font-size: 0.875rem; cursor: pointer;
          transition: all 0.2s; color: var(--foreground); font-weight: 500;
        }
        .ra-btn-secondary:hover { border-color: var(--foreground); }
        .ra-glass {
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .ra-pulse-dot {
          width: 6px; height: 6px; border-radius: 50%;
          animation: ra-pulse 1.2s ease-in-out infinite;
        }
        @keyframes ra-pulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
          50% { opacity: 0.7; transform: scale(1.4); box-shadow: 0 0 8px currentColor; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Analysis Player — sequential frame playback with analysis overlays  */
/* ------------------------------------------------------------------ */

function AnalysisPlayer({
  analysis,
  frames,
  activeSectionIdx,
  setActiveSectionIdx,
  autoPlaying,
  setAutoPlaying,
  showDetails,
  setShowDetails,
}: {
  analysis: Analysis;
  frames: Frame[];
  activeSectionIdx: number;
  setActiveSectionIdx: (i: number) => void;
  autoPlaying: boolean;
  setAutoPlaying: (v: boolean) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
}) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [preloaded, setPreloaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalSectionRef = useRef<number | null>(null);

  // Preload all frame images into browser cache
  useEffect(() => {
    if (frames.length === 0) return;
    setPreloaded(false);
    let loaded = 0;
    for (const f of frames) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= frames.length) setPreloaded(true);
      };
      img.src = f.image_url;
    }
  }, [frames]);

  // Map frame indices → analysis section indices
  const frameToSection = useMemo(
    () => buildFrameToSectionMap(frames, analysis),
    [frames, analysis],
  );

  // Reverse map: section index → frame index (for clicking cards to jump)
  const sectionToFrame = useMemo(() => {
    const map = new Map<number, number>();
    frameToSection.forEach((si, fi) => {
      if (!map.has(si)) map.set(si, fi);
    });
    return map;
  }, [frameToSection]);

  const currentFrame = frames[frameIdx];

  // Overlay zone: starts AT the key frame, extends OVERLAY_AFTER frames after
  const nearestAnalysis = useMemo(() => {
    const keyFrameIndices = Array.from(frameToSection.keys());
    for (const kfi of keyFrameIndices) {
      const dist = frameIdx - kfi;
      if (dist >= 0 && dist <= OVERLAY_AFTER) {
        return { sectionIdx: frameToSection.get(kfi)!, keyFrameIdx: kfi };
      }
    }
    return null;
  }, [frameIdx, frameToSection]);

  // Slowdown zone: starts SLOW_BEFORE frames before key frame, extends OVERLAY_AFTER after
  const inSlowZone = useMemo(() => {
    const keyFrameIndices = Array.from(frameToSection.keys());
    for (const kfi of keyFrameIndices) {
      const dist = frameIdx - kfi;
      if (dist >= -SLOW_BEFORE && dist <= OVERLAY_AFTER) {
        return true;
      }
    }
    return false;
  }, [frameIdx, frameToSection]);

  const inAnalysisZone = nearestAnalysis !== null;
  const currentSection = nearestAnalysis
    ? analysis.sections[nearestAnalysis.sectionIdx]
    : null;
  const currentSectionIdx = nearestAnalysis?.sectionIdx ?? null;

  // Sync activeSectionIdx when entering an analysis zone
  useEffect(() => {
    if (currentSectionIdx !== null) {
      internalSectionRef.current = currentSectionIdx;
      setActiveSectionIdx(currentSectionIdx);
      setShowDetails(false);
    }
  }, [currentSectionIdx]);

  // React to external section changes (e.g. clicking analysis cards)
  useEffect(() => {
    if (activeSectionIdx !== internalSectionRef.current) {
      const fi = sectionToFrame.get(activeSectionIdx);
      if (fi !== undefined) {
        setFrameIdx(fi);
        internalSectionRef.current = activeSectionIdx;
      }
    }
  }, [activeSectionIdx, sectionToFrame]);

  // Autoplay: slow in analysis zones, fast elsewhere — never stops
  useEffect(() => {
    if (!autoPlaying || !preloaded || frames.length === 0) return;

    // Already at last frame — stop on next tick
    if (frameIdx >= frames.length - 1) {
      setAutoPlaying(false);
      return;
    }

    const delay = inSlowZone ? ANALYSIS_INTERVAL : MOTION_INTERVAL;

    timerRef.current = setTimeout(() => {
      setFrameIdx((prev) => Math.min(prev + 1, frames.length - 1));
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [autoPlaying, preloaded, frameIdx, frames.length, inSlowZone]);

  // Jump to a specific section's key frame
  function goToSection(si: number) {
    const fi = sectionToFrame.get(si);
    if (fi !== undefined) {
      setFrameIdx(fi);
      setActiveSectionIdx(si);
      setAutoPlaying(false);
      setShowDetails(false);
    }
  }

  // Progress percentage
  const progress = frames.length > 1 ? (frameIdx / (frames.length - 1)) * 100 : 0;

  return (
    <div className="space-y-5">
      <SectionHeader num="02" label="Technique Analysis" />

      {/* ---- THE CANVAS ---- */}
      <div
        className="relative overflow-hidden bg-black select-none"
        style={{
          aspectRatio: "16/9",
          borderRadius: "24px",
          boxShadow: inAnalysisZone && currentSection
            ? `0 0 0 2px ${RATING_COLOR[currentSection.rating]}80, 0 0 30px ${RATING_COLOR[currentSection.rating]}30, rgba(0,0,0,0.2) 0px 10px 30px`
            : "rgba(0,0,0,0.2) 0px 10px 30px, rgba(0,0,0,0.1) 0px 3px 8px",
          transition: "box-shadow 0.4s ease-in-out",
        }}
      >
        {/* Loading overlay while preloading images */}
        {!preloaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80">
            <Spinner />
            <span className="text-white/60 text-xs mt-3">Loading frames...</span>
          </div>
        )}

        {/* Frame image */}
        {currentFrame && (
          <img
            key={frameIdx}
            src={currentFrame.image_url}
            alt="Analysis frame"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Vignette + slow-motion indicator when in analysis zone */}
        {inAnalysisZone && currentSection && (
          <>
            {/* Edge vignette to signal slowdown */}
            <div
              className="absolute inset-0 pointer-events-none animate-[ra-fadeIn_0.3s_ease-out]"
              style={{
                background: `radial-gradient(ellipse at center, transparent 50%, ${RATING_COLOR[currentSection.rating]}15 100%)`,
              }}
            />
            {/* Scanning line animation */}
            <div
              key={`scan-${nearestAnalysis?.keyFrameIdx}`}
              className="absolute left-0 right-0 h-[2px] pointer-events-none animate-[ra-scanLine_3.5s_ease-in-out]"
              style={{
                background: `linear-gradient(90deg, transparent, ${RATING_COLOR[currentSection.rating]}60, transparent)`,
                boxShadow: `0 0 12px ${RATING_COLOR[currentSection.rating]}40`,
              }}
            />
          </>
        )}

        {/* Phase pill — top left */}
        {currentFrame && (
          <div
            className="absolute top-3 left-3 ra-glass px-3 py-1 text-xs font-medium text-white"
            style={{
              borderRadius: "9999px",
              border: currentSection
                ? `1px solid ${RATING_COLOR[currentSection.rating]}80`
                : "1px solid transparent",
            }}
          >
            {currentFrame.phase.replace(/_/g, " ")}
          </div>
        )}

        {/* Top right — coaching indicator or frame counter */}
        {inAnalysisZone && currentSection ? (
          <div
            key={`coaching-${currentSectionIdx}`}
            className="absolute top-3 right-3 flex items-center gap-2 ra-glass px-3 py-1.5 animate-[ra-popIn_0.3s_ease-out]"
            style={{
              borderRadius: "9999px",
              border: `1px solid ${RATING_COLOR[currentSection.rating]}60`,
            }}
          >
            <span className="ra-pulse-dot" style={{ background: RATING_COLOR[currentSection.rating] }} />
            <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Coaching</span>
          </div>
        ) : (
          <div className="absolute top-3 right-3 ra-glass px-3 py-1 text-xs text-white/70" style={{ borderRadius: "9999px" }}>
            {frameIdx + 1} / {frames.length}
          </div>
        )}

        {/* ---- RATING BADGE — pops in on analysis frames ---- */}
        {currentSection && (
          <div
            key={`badge-${currentSectionIdx}`}
            className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 ra-glass px-4 py-1.5 animate-[ra-popIn_0.4s_ease-out]"
            style={{
              borderRadius: "9999px",
              border: `1px solid ${RATING_COLOR[currentSection.rating]}40`,
            }}
          >
            <span style={{ color: RATING_COLOR[currentSection.rating] }} className="text-sm font-bold">
              {RATING_ICON[currentSection.rating]}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: RATING_COLOR[currentSection.rating] }}>
              {currentSection.rating}
            </span>
          </div>
        )}

        {/* ---- OVERLAY PANEL — slides up on analysis frames ---- */}
        {currentSection && (
          <div
            key={`overlay-${currentSectionIdx}`}
            className="absolute bottom-0 left-0 right-0 ra-glass animate-[ra-slideUp_0.4s_ease-out]"
            style={{ borderTop: `2px solid ${RATING_COLOR[currentSection.rating]}60` }}
          >
            {/* Zone progress bar — duration = zone size × interval */}
            {autoPlaying && (
              <div className="h-0.5 bg-white/10">
                <div
                  className="h-full bg-white/50"
                  key={`progress-${currentSectionIdx}`}
                  style={{ animation: `ra-progress ${(OVERLAY_AFTER + 1) * ANALYSIS_INTERVAL}ms linear` }}
                />
              </div>
            )}

            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm md:text-base">{currentSection.title}</h3>
                  <p className="text-white/70 text-xs md:text-sm mt-1 leading-relaxed">{currentSection.summary}</p>
                </div>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex-shrink-0 text-white/50 hover:text-white transition-colors text-xs underline underline-offset-2"
                >
                  {showDetails ? "less" : "more"}
                </button>
              </div>

              {showDetails && (
                <p className="text-white/60 text-xs md:text-sm mt-3 pt-3 border-t border-white/10 leading-relaxed animate-[ra-slideUp_0.3s_ease-out]">
                  {currentSection.details}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ---- NAV ARROWS ---- */}
        <button
          onClick={() => { setFrameIdx(Math.max(0, frameIdx - 1)); setAutoPlaying(false); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 ra-glass w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          style={{ display: frameIdx > 0 ? undefined : "none" }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => { setFrameIdx(Math.min(frames.length - 1, frameIdx + 1)); setAutoPlaying(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 ra-glass w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          style={{ display: frameIdx < frames.length - 1 ? undefined : "none" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ---- PLAYBACK CONTROLS ---- */}
      <div className="space-y-3">
        {/* Progress bar with key frame markers */}
        <div className="relative py-2 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            setFrameIdx(Math.round(pct * (frames.length - 1)));
            setAutoPlaying(false);
          }}
        >
          {/* Track */}
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
          {/* Key frame markers — positioned above the track */}
          {Array.from(frameToSection.entries()).map(([fi, si]) => {
            const isActive = nearestAnalysis?.keyFrameIdx === fi && frameIdx >= fi;
            return (
              <div
                key={fi}
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: `${(fi / Math.max(frames.length - 1, 1)) * 100}%`,
                  transform: `translate(-50%, -50%) scale(${isActive ? 1.3 : 1})`,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: RATING_COLOR[analysis.sections[si].rating],
                  border: "2px solid var(--background)",
                  boxShadow: isActive
                    ? `0 0 8px ${RATING_COLOR[analysis.sections[si].rating]}`
                    : `0 0 4px ${RATING_COLOR[analysis.sections[si].rating]}60`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  zIndex: 2,
                }}
                title={analysis.sections[si].title}
              />
            );
          })}
        </div>

        {/* Play button + section pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!autoPlaying && frameIdx >= frames.length - 1) setFrameIdx(0);
              setAutoPlaying(!autoPlaying);
            }}
            className="ra-btn-icon flex-shrink-0"
            title={autoPlaying ? "Pause" : "Play"}
          >
            {autoPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {analysis.sections.map((s, i) => {
              const isActive = i === activeSectionIdx;
              return (
                <button
                  key={i}
                  onClick={() => goToSection(i)}
                  className="flex-1 group relative"
                  title={s.title}
                >
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      background: isActive
                        ? RATING_COLOR[s.rating]
                        : sectionToFrame.has(i) && frameIdx > (sectionToFrame.get(i) ?? 0)
                          ? `${RATING_COLOR[s.rating]}60`
                          : "var(--border)",
                      boxShadow: isActive ? `0 0 8px ${RATING_COLOR[s.rating]}80` : undefined,
                    }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block ra-glass px-2 py-0.5 text-[10px] text-white whitespace-nowrap" style={{ borderRadius: "4px" }}>
                    {s.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared sub-components                                               */
/* ------------------------------------------------------------------ */

function Spinner() {
  return <div className="w-10 h-10 rounded-full animate-spin border-3 border-border" style={{ borderTopColor: "var(--foreground)" }} />;
}

function StatusDot({ status }: { status: string }) {
  const color = status === "done" ? "#22c55e" : status === "error" ? "#ef4444" : status === "extracted" ? "#3b82f6" : "#eab308";
  return <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />;
}

function SectionHeader({ num, label }: { num: string; label: string }) {
  return (
    <div className="text-xs uppercase tracking-wider flex items-center gap-2 mb-3 font-semibold text-muted-foreground">
      <span className="w-2 h-2 rounded-sm bg-foreground" />
      {num} &mdash; {label}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  const circumference = 326.73;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36 mx-auto animate-[ra-scoreCount_0.8s_ease-out]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.5s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">overall</span>
      </div>
    </div>
  );
}

function FrameCarousel({ frames, currentFrame, setCurrentFrame, playing, setPlaying, speed, setSpeed }: {
  frames: Frame[]; currentFrame: number; setCurrentFrame: (i: number) => void;
  playing: boolean; setPlaying: (p: boolean) => void; speed: number; setSpeed: (s: number) => void;
}) {
  const [preloaded, setPreloaded] = useState(false);

  // Preload all frame images
  useEffect(() => {
    if (frames.length === 0) return;
    setPreloaded(false);
    let loaded = 0;
    for (const f of frames) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= frames.length) setPreloaded(true);
      };
      img.src = f.image_url;
    }
  }, [frames]);

  // Only show key frame thumbnails to avoid overwhelming the strip
  const keyFrameIndices = useMemo(
    () => frames.map((f, i) => ({ frame: f, idx: i })).filter(({ frame }) => frame.is_key_frame ?? true),
    [frames],
  );

  // Progress for the scrubber
  const progress = frames.length > 1 ? (currentFrame / (frames.length - 1)) * 100 : 0;

  return (
    <>
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "16/9", borderRadius: "24px", boxShadow: "rgba(0,0,0,0.15) 0px 10px 20px" }}>
        {!preloaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80">
            <Spinner />
            <span className="text-white/60 text-xs mt-3">Loading frames...</span>
          </div>
        )}
        <img src={frames[currentFrame]?.image_url} alt="Key frame" className="w-full h-full object-contain" />
        <div className="absolute top-3 left-3 ra-glass px-3 py-1 text-xs font-medium text-white" style={{ borderRadius: "9999px" }}>
          {frames[currentFrame]?.phase.replace(/_/g, " ")}
        </div>
        <div className="absolute top-3 right-3 ra-glass px-3 py-1 text-xs text-white/60" style={{ borderRadius: "9999px" }}>
          {currentFrame + 1} / {frames.length}
        </div>
      </div>
      {/* Scrubber bar */}
      <div className="relative h-1.5 bg-border rounded-full overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          setCurrentFrame(Math.round(pct * (frames.length - 1)));
        }}
      >
        <div className="h-full bg-foreground rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
      {/* Key frame thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {keyFrameIndices.map(({ frame: f, idx: i }) => (
          <button key={f.id || i} onClick={() => setCurrentFrame(i)} className="flex-shrink-0 w-16 h-10 overflow-hidden transition-all" style={{ borderRadius: "8px", border: i === currentFrame ? "2px solid var(--foreground)" : "2px solid transparent", opacity: i === currentFrame ? 1 : 0.4 }}>
            <img src={f.image_url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setCurrentFrame((currentFrame - 1 + frames.length) % frames.length)} className="ra-btn-icon" title="Previous"><SkipBack size={14} /></button>
        <button onClick={() => setPlaying(!playing)} className="ra-btn-icon" title={playing ? "Pause" : "Play"}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        <button onClick={() => setCurrentFrame((currentFrame + 1) % frames.length)} className="ra-btn-icon" title="Next"><SkipForward size={14} /></button>
        <span className="text-xs text-muted-foreground font-medium ml-1">{speed}ms</span>
        <input type="range" min={100} max={1000} step={50} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 accent-foreground" />
      </div>
    </>
  );
}

function UploadCard({ onUpload }: { onUpload: (f: File) => void; }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files[0]);
  }

  return (
    <div className="p-8 bg-card border border-border" style={{ borderRadius: "16px", boxShadow: "rgba(0,0,0,0.08) 0px 3px 6px" }}>
      <SectionHeader num="01" label="Upload Video" />
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`mt-4 p-12 text-center cursor-pointer transition-all border-2 border-dashed rounded-xl ${dragActive ? "border-foreground bg-accent" : "border-border hover:border-muted-foreground"}`}
      >
        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-muted border border-border">
          <Upload size={22} className="text-muted-foreground" />
        </div>
        <div className="text-sm text-foreground">Drop your video here or <span className="text-primary font-medium">browse</span></div>
        <div className="text-xs text-muted-foreground mt-1">Supports MOV, MP4</div>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files[0]); }} />
      </div>
    </div>
  );
}
