"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import {
  PanelLeftClose, PanelLeftOpen,
  Play, Pause, SkipBack, SkipForward,
  Upload, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { CoinBalance } from "@/components/coin-balance";
import { COIN_ECONOMY } from "@/lib/coins-config";

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

interface Quota {
  balance: number;
  freeRemaining: number;
  freeTotal: number;
  analysisCost: number;
  completed: number;
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

const RATING_COLOR = { good: "#4f9a6a", warning: "#cf9a2e", bad: "#cf4f35" };
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
  return score >= 75 ? RATING_COLOR.good : score >= 50 ? RATING_COLOR.warning : RATING_COLOR.bad;
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

export default function RunAnalyzerPage() {
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
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
    if (!res.ok) return;
    const data = await res.json();
    setSessions(data.sessions || []);
    if (data.quota) setQuota(data.quota as Quota);
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

    // Upload straight to Storage (no size cap from our API), then extract.
    const urlRes = await fetch("/api/run-analyzer/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, filename: file.name, size: file.size, type: file.type }),
    });
    if (!urlRes.ok) {
      setError((await urlRes.json()).error || "Upload failed");
      setLoading(false);
      return;
    }
    const { path, token } = await urlRes.json();
    const { error: uploadErr } = await supabase.storage
      .from("run-videos")
      .uploadToSignedUrl(path, token, file, { contentType: file.type || "video/mp4" });
    if (uploadErr) {
      setError(`Upload failed: ${uploadErr.message}`);
      setLoading(false);
      return;
    }

    const extractRes = await fetch("/api/run-analyzer/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id, video_path: path }),
    });
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
      const body = await res.json().catch(() => ({}));
      if (body.code === "INSUFFICIENT_COINS") {
        setError(`Not enough coins (have ${body.balance}, need ${body.cost}). Get more on the Coins page.`);
      } else {
        setError(body.error || "Analysis failed");
      }
      loadSessions();
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
      <div className="max-w-3xl">
        <header className="border-b-2 border-rule pb-4 mb-8">
          <p className="eyebrow mb-2">AI Coach</p>
          <h1 className="headline text-5xl sm:text-7xl">Check your running form from one video</h1>
        </header>
        <ol className="divide-y border-b">
          {[
            ["Film", "A few seconds of you running past the camera, filmed side-on."],
            ["Frames", "We pull out the key moments of your stride and map your joints."],
            ["Feedback", "Foot strike, cadence, posture, arms, hips and knee drive, each rated, plus what to fix first."],
          ].map(([title, text], i) => (
            <li key={title} className="grid grid-cols-[2.5rem_7rem_1fr] max-sm:grid-cols-[2rem_1fr] gap-x-4 py-4 items-baseline">
              <span className="time text-sm text-primary">0{i + 1}</span>
              <span className="headline text-2xl">{title}</span>
              <span className="text-sm text-muted-foreground max-sm:col-start-2">{text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button onClick={signIn} className="h-11 px-5 rounded-sm bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
            Sign in with Google to start
          </button>
          <p className="text-sm text-muted-foreground">
            First {COIN_ECONOMY.FREE_ANALYSES} analyses free, then {COIN_ECONOMY.ANALYSIS_COST} coins each.
          </p>
        </div>
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
            <button onClick={startNew} className="flex-1 mr-2 h-10 rounded-sm font-semibold text-sm bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Plus size={14} /> New Analysis
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Close sidebar">
              <PanelLeftClose size={18} />
            </button>
          </div>
          <QuotaPanel quota={quota} />
          <div className="eyebrow mb-2 border-b border-rule pb-1">Sessions</div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left py-2.5 px-2 text-sm transition-colors border-l-[3px] ${activeSessionId === s.id ? "bg-accent border-primary" : "border-transparent hover:bg-muted"}`}
              >
                <div className="font-semibold text-foreground truncate">{s.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <StatusDot status={s.status} />
                  <span>{s.status}</span>
                  {s.overall_score != null && <span className="ml-auto time font-semibold" style={{ color: scoreColor(s.overall_score) }}>{s.overall_score}</span>}
                </div>
                <div className="time text-[11px] text-muted-foreground mt-1">{new Date(s.created_at).toLocaleDateString()}</div>
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
          <header className="border-b-2 border-rule pb-3 mb-8">
            <p className="eyebrow mb-1">AI Coach</p>
            <h1 className="headline text-4xl sm:text-5xl">Running form analysis</h1>
          </header>

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
                    <AnalyzeCTA quota={quota} onAnalyze={handleAnalyze} />
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
                    <div className="border-t border-rule">
                      {analysis.sections.map((s, i) => {
                        const isOpen = expanded.has(i);
                        return (
                          <div
                            key={i}
                            className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              const next = new Set(expanded);
                              next.has(i) ? next.delete(i) : next.add(i);
                              setExpanded(next);
                              // Also sync video player to this section
                              setActiveSectionIdx(i);
                              setAutoPlaying(false);
                            }}
                            style={{ borderLeft: `3px solid ${RATING_COLOR[s.rating]}` }}
                          >
                            <div className="py-3 pl-4 pr-2 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-foreground">{s.title}</span>
                                  <span className="eyebrow" style={{ color: RATING_COLOR[s.rating] }}>
                                    {RATING_ICON[s.rating]} {s.rating}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{s.summary}</div>
                              </div>
                              <span className="text-muted-foreground flex-shrink-0">
                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </div>
                            {isOpen && (
                              <div className="pl-4 pr-2 pb-4 text-sm text-muted-foreground leading-relaxed max-w-prose">
                                {s.details}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Recommendations */}
                    <div>
                      <h3 className="headline text-3xl border-b-2 border-rule pb-2">Work on first</h3>
                      {analysis.recommendations.map((r, i) => (
                        <div
                          key={i}
                          className="flex gap-4 py-3 border-b"
                        >
                          <span className="time text-sm text-primary flex-shrink-0 w-6">{String(r.priority).padStart(2, "0")}</span>
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
        @keyframes ra-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .ra-btn-icon {
          width: 32px; height: 32px; border-radius: 2px;
          border: 1px solid var(--border); background: var(--card);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; color: var(--foreground);
        }
        .ra-btn-icon:hover { border-color: var(--foreground); }
        .ra-btn-secondary {
          padding: 0.75rem; border-radius: 2px; border: 1px solid var(--border);
          background: var(--card); font-size: 0.875rem; cursor: pointer;
          transition: all 0.2s; color: var(--foreground); font-weight: 500;
        }
        .ra-btn-secondary:hover { border-color: var(--foreground); }
        .ra-glass {
          background: rgba(20, 18, 16, 0.78);
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
          borderRadius: "3px",
          outline: inAnalysisZone && currentSection ? `3px solid ${RATING_COLOR[currentSection.rating]}` : "none",
          outlineOffset: "-3px",
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

        {/* Phase pill — top left */}
        {currentFrame && (
          <div
            className="absolute top-3 left-3 ra-glass px-3 py-1 text-xs font-medium text-white"
            style={{
              borderRadius: "2px",
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
            className="absolute top-3 right-3 flex items-center gap-2 ra-glass px-3 py-1.5"
            style={{
              borderRadius: "2px",
              border: `1px solid ${RATING_COLOR[currentSection.rating]}60`,
            }}
          >
            <span className="size-1.5" style={{ background: RATING_COLOR[currentSection.rating] }} />
            <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Coaching</span>
          </div>
        ) : (
          <div className="absolute top-3 right-3 ra-glass px-3 py-1 text-xs text-white/70" style={{ borderRadius: "2px" }}>
            {frameIdx + 1} / {frames.length}
          </div>
        )}

        {/* ---- RATING BADGE — pops in on analysis frames ---- */}
        {currentSection && (
          <div
            key={`badge-${currentSectionIdx}`}
            className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 ra-glass px-4 py-1.5"
            style={{
              borderRadius: "2px",
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
          className="absolute left-2 top-1/2 -translate-y-1/2 ra-glass w-8 h-8 rounded-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
          style={{ display: frameIdx > 0 ? undefined : "none" }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => { setFrameIdx(Math.min(frames.length - 1, frameIdx + 1)); setAutoPlaying(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 ra-glass w-8 h-8 rounded-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
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
          <div className="h-1.5 bg-border overflow-hidden">
            <div className="h-full bg-foreground transition-all duration-100" style={{ width: `${progress}%` }} />
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
                  transition: "transform 0.2s",
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
                    className="h-1.5 transition-colors duration-300"
                    style={{
                      background: isActive
                        ? RATING_COLOR[s.rating]
                        : sectionToFrame.has(i) && frameIdx > (sectionToFrame.get(i) ?? 0)
                          ? `${RATING_COLOR[s.rating]}60`
                          : "var(--border)",
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

function QuotaPanel({ quota }: { quota: Quota | null }) {
  if (!quota) return null;
  const onFreeTier = quota.freeRemaining > 0;
  return (
    <div className="mb-5 pb-3 border-b">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">
          {onFreeTier ? "Free analyses" : "Balance"}
        </span>
        {!onFreeTier && <CoinBalance amount={quota.balance} size="sm" />}
      </div>
      {onFreeTier && (
        <div className="mt-1.5 text-sm font-semibold text-foreground">
          {quota.freeRemaining} of {quota.freeTotal} remaining
        </div>
      )}
      {!onFreeTier && (
        <Link
          href="/coins"
          className="mt-2 block text-center py-1.5 rounded-sm text-xs font-semibold border border-foreground hover:bg-foreground hover:text-background transition-colors"
        >
          Get coins
        </Link>
      )}
    </div>
  );
}

function AnalyzeCTA({ quota, onAnalyze }: { quota: Quota | null; onAnalyze: () => void }) {
  const onFreeTier = (quota?.freeRemaining ?? 1) > 0;
  const canPay = !!quota && quota.balance >= quota.analysisCost;
  const needsCoins = !onFreeTier && !canPay;

  if (needsCoins) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground text-center">
          You need {quota?.analysisCost ?? COIN_ECONOMY.ANALYSIS_COST} coins to analyze.
          You have {quota?.balance ?? 0}.
        </div>
        <Link
          href="/coins"
          className="block text-center w-full h-12 leading-[3rem] rounded-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          Get coins
        </Link>
      </div>
    );
  }

  return (
    <button
      onClick={onAnalyze}
      className="w-full h-12 rounded-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-3"
    >
      <span>Analyze my form</span>
      {onFreeTier ? (
        <span className="time text-xs opacity-80">free</span>
      ) : (
        <span className="time text-xs opacity-80">−{quota?.analysisCost ?? COIN_ECONOMY.ANALYSIS_COST} coins</span>
      )}
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "done" ? RATING_COLOR.good : status === "error" ? RATING_COLOR.bad : status === "extracted" ? "var(--chart-4)" : RATING_COLOR.warning;
  return <span className="size-2 inline-block" style={{ background: color }} />;
}

function SectionHeader({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b-2 border-rule pb-1.5 mb-3">
      <span className="time text-sm text-primary">{num}</span>
      <span className="headline text-2xl">{label}</span>
    </div>
  );
}

/** Overall score as a big figure over a 0–100 rule, marked at 50 and 75. */
function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div className="py-2">
      <p className="eyebrow">Overall</p>
      <p className="headline text-8xl tabular-nums" style={{ color }}>
        {score}<span className="text-3xl text-muted-foreground">/100</span>
      </p>
      <div className="relative mt-3 h-2 bg-muted">
        <div className="h-full" style={{ width: `${score}%`, background: color }} />
        {[50, 75].map((m) => (
          <span key={m} className="absolute -top-1 h-4 w-px bg-foreground/40" style={{ left: `${m}%` }} />
        ))}
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
      <div className="relative overflow-hidden bg-black rounded-sm" style={{ aspectRatio: "16/9" }}>
        {!preloaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80">
            <Spinner />
            <span className="text-white/60 text-xs mt-3">Loading frames...</span>
          </div>
        )}
        <img src={frames[currentFrame]?.image_url} alt="Key frame" className="w-full h-full object-contain" />
        <div className="absolute top-3 left-3 ra-glass px-3 py-1 text-xs font-medium text-white" style={{ borderRadius: "2px" }}>
          {frames[currentFrame]?.phase.replace(/_/g, " ")}
        </div>
        <div className="absolute top-3 right-3 ra-glass px-3 py-1 text-xs text-white/60" style={{ borderRadius: "2px" }}>
          {currentFrame + 1} / {frames.length}
        </div>
      </div>
      {/* Scrubber bar */}
      <div className="relative h-1.5 bg-border overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          setCurrentFrame(Math.round(pct * (frames.length - 1)));
        }}
      >
        <div className="h-full bg-foreground transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
      {/* Key frame thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {keyFrameIndices.map(({ frame: f, idx: i }) => (
          <button key={f.id || i} onClick={() => setCurrentFrame(i)} className="flex-shrink-0 w-16 h-10 overflow-hidden transition-all" style={{ borderRadius: "2px", border: i === currentFrame ? "2px solid var(--foreground)" : "2px solid transparent", opacity: i === currentFrame ? 1 : 0.4 }}>
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
    <div>
      <SectionHeader num="01" label="Upload Video" />
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`mt-4 px-6 py-14 text-center cursor-pointer transition-colors border-2 border-dashed rounded-sm ${dragActive ? "border-primary bg-accent" : "border-input hover:border-foreground"}`}
      >
        <Upload size={22} className="mx-auto mb-3 text-muted-foreground" />
        <div className="headline text-3xl">Drop a video, or <span className="text-primary underline underline-offset-4">choose a file</span></div>
        <div className="text-sm text-muted-foreground mt-2">MOV or MP4 · a few seconds · filmed side-on</div>
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files[0]); }} />
      </div>
    </div>
  );
}
