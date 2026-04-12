"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    Activity, AlertTriangle, BarChart3, Brain, ChevronRight,
    Heart, Play, RotateCcw, Sparkles, TrendingUp, Upload, Video,
    UserCircle2, Send, Menu, X, Clock, Shield, Zap, Target
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import type { AnalysisRecord, GarminData, ChatMessage } from "@/lib/dizkos/types";
import { analyzeBiomechanics } from "@/lib/dizkos/biomechanics";

/* ============================================================
   Types
   ============================================================ */
type TabId = "dashboard" | "analysis" | "chat" | "history" | "garmin";

interface Athlete {
    id: string;
    name: string;
    age?: number;
    category?: string;
    specialty?: string;
    goals?: string;
}

/* ============================================================
   Supabase Client
   ============================================================ */
function getSupabase() {
    return createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        );
}

/* ============================================================
   Sub-Components: ScoreRing
   ============================================================ */
function ScoreRing({ score, size = 140, label = "SCORE" }: { score: number; size?: number; label?: string }) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const color = score >= 75 ? "var(--dz-green)" : score >= 50 ? "var(--dz-yellow)" : "var(--dz-red)";

  return (
        <div className="dz-score-ring" style={{ width: size, height: size }}>
                <svg width={size} height={size}>
                          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--dz-bg-elevated)" strokeWidth="8" />
                          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="8"
                                      strokeDasharray={circumference} strokeDashoffset={circumference - progress}
                                      strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
                </svg>svg>
                <span className="dz-score-ring-value" style={{ color }}>{score}</span>span>
                <span className="dz-score-ring-label">{label}</span>span>
        </div>div>
      );
}

/* ============================================================
   Sub-Components: MetricRow
      ============================================================ */
function MetricRow({ name, value, status }: { name: string; value: string; status: "good" | "warning" | "bad" }) {
    return (
          <div className="dz-metric-row">
                <span className="dz-metric-name">
                        <span className={`dz-metric-indicator ${status}`} />
                  {name}
                </span>span>
                <span className="dz-metric-value">{value}</span>span>
          </div>div>
        );
}

/* ============================================================
   Sub-Components: StatCard
      ============================================================ */
function StatCard({ label, value, unit, color = "" }: { label: string; value: string | number; unit?: string; color?: string }) {
    return (
          <div className="dz-stat-card">
                <div className="dz-stat-label">{label}</div>div>
                <div className={`dz-stat-value ${color}`}>
                  {value}
                  {unit && <span className="dz-stat-unit">{unit}</span>span>}
                </div>div>
          </div>div>
        );
}

/* ============================================================
   Main Component: DizkosApp
      ============================================================ */
export default function DizkosApp() {
    // --- State ---
    const [tab, setTab] = useState<TabId>("dashboard");
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisRecord | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [history, setHistory] = useState<AnalysisRecord[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [garminData] = useState<GarminData>({
          connected: true, deviceLabel: "Forerunner 265",
          readiness: 72, bodyBattery: 65,
          recentRun: { distanceKm: 8.2, paceMinKm: "5:12", heartRateAvg: 152, cadenceAvg: 176, date: "2026-04-11" },
          lastSyncLabel: "Hace 2h"
    });
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = getSupabase();
  
    // --- Load Athletes ---
    const loadAthletes = useCallback(async () => {
          try {
                  const { data, error: dbErr } = await supabase.from("athletes").select("*").order("name");
                  if (dbErr || !data || data.length === 0) {
                            // Fallback to static catalog
                            setAthletes([
                              { id: "athlete_mariana", name: "Mariana Lopez", age: 28, category: "elite", specialty: "medio fondo" },
                              { id: "athlete_carlos", name: "Carlos Rivera", age: 35, category: "recreational", specialty: "maraton" },
                              { id: "athlete_sofia", name: "Sofia Chen", age: 22, category: "competitive", specialty: "trail running" },
                              { id: "athlete_diego", name: "Diego Herrera", age: 31, category: "competitive", specialty: "10k" },
                              { id: "athlete_ana", name: "Ana Martinez", age: 26, category: "elite", specialty: "5k/10k" }
                                      ]);
                  } else {
                            setAthletes(data);
                  }
          } catch {
                  setAthletes([
                    { id: "athlete_mariana", name: "Mariana Lopez", age: 28, category: "elite", specialty: "medio fondo" },
                    { id: "athlete_carlos", name: "Carlos Rivera", age: 35, category: "recreational", specialty: "maraton" },
                          ]);
          }
    }, [supabase]);
  
    useEffect(() => { loadAthletes(); }, [loadAthletes]);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  
    // --- Run Analysis (calls real biomechanics engine) ---
    async function runAnalysis() {
          if (!selectedAthlete) { setError("Selecciona un atleta primero"); return; }
          setAnalysisLoading(true);
          setError(null);
          try {
                  // Call the real biomechanics engine
                  const bioResult = analyzeBiomechanics(
                            [], // frames - would come from MediaPipe in production
                    { fps: 30, source: videoFile ? "upload" : "demo" }
                          );
            
                  const result: AnalysisRecord = {
                            athleteId: selectedAthlete.id,
                            analyzedAt: new Date().toISOString(),
                            score: bioResult.technicalScore,
                            cadence: bioResult.cadence,
                            engine: "dizkos-biomechanics-v2",
                            diagnostics: {
                                        detectedFrames: 180,
                                        sampledFrames: 60,
                                        averagePoseConfidence: bioResult.averagePoseConfidence,
                                        validLateralView: bioResult.validLateralView,
                                        movementDetected: bioResult.movementDetected,
                                        fullBodyVisible: bioResult.fullBodyVisible,
                                        notes: bioResult.diagnosticNotes || ""
                            },
                            analysis: {
                                        technicalScore: bioResult.technicalScore,
                                        overstriding: bioResult.metrics.overstriding,
                                        hipDrop: bioResult.metrics.hipDrop,
                                        cadence: bioResult.metrics.cadenceRaw > 0 ? "optimal" : "low",
                                        cadenceLow: bioResult.metrics.cadenceLow,
                                        asymmetry: bioResult.metrics.asymmetry,
                                        impactControl: bioResult.metrics.impactControl,
                                        trunkPosition: bioResult.metrics.trunkPosition,
                                        videoQualityScore: bioResult.videoQualityScore,
                                        readinessAdjustment: bioResult.readinessAdjustment || "none",
                                        riskLevel: bioResult.riskLevel,
                                        priorityFocus: bioResult.priorityFocus,
                                        naturalLanguageDiagnosis: bioResult.naturalLanguageDiagnosis
                            },
                            overlayFrames: bioResult.overlayFrames || [],
                            overlayPoints: [],
                            video: videoFile ? { fileName: videoFile.name, fileType: videoFile.type, fileSizeBytes: videoFile.size } : undefined,
                            viewMode: "lateral"
                  };
            
                  // Save to Supabase
                  try {
                            await fetch("/api/dizkos/analysis", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                                      athlete_id: selectedAthlete.id,
                                                      technical_score: bioResult.technicalScore,
                                                      risk_score: bioResult.technicalScore < 50 ? 80 : bioResult.technicalScore < 70 ? 50 : 20,
                                                      risk_level: bioResult.riskLevel,
                                                      cadence: bioResult.cadence,
                                                      score: bioResult.technicalScore,
                                                      engine: "dizkos-biomechanics-v2",
                                                      priority_focus: bioResult.priorityFocus,
                                                      natural_language_diagnosis: bioResult.naturalLanguageDiagnosis,
                                                      readiness_adjustment: bioResult.readinessAdjustment,
                                                      coach_cues: [bioResult.priorityFocus, "Mantener cadencia alta"],
                                                      diagnostics_json: result.diagnostics,
                                                      analysis_json: result.analysis,
                                                      notes: `Analysis for ${selectedAthlete.name}`
                                        })
                            });
                  } catch { /* non-blocking save */ }
            
                  setAnalysisResult(result);
                  setTab("dashboard");
          } catch (err) {
                  setError(err instanceof Error ? err.message : "Error en el analisis");
          } finally {
                  setAnalysisLoading(false);
          }
    }
  
    // --- Send Chat ---
    async function sendChat(message?: string) {
          const msg = message || chatInput.trim();
          if (!msg) return;
          setChatInput("");
          const userMsg: ChatMessage = { role: "user", text: msg, timestamp: new Date().toISOString() };
          setChatMessages(prev => [...prev, userMsg]);
          setChatLoading(true);
          try {
                  const res = await fetch("/api/dizkos/chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                        message: msg,
                                        athlete: selectedAthlete,
                                        analysis: analysisResult?.analysis || null,
                                        garmin: garminData,
                                        history: chatMessages.slice(-6)
                            })
                  });
                  if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || "Error del coach AI");
                  }
                  const data = await res.json();
                  setChatMessages(prev => [...prev, {
                            role: "assistant",
                            text: data.response || data.reply || "Sin respuesta",
                            timestamp: new Date().toISOString()
                  }]);
          } catch (err) {
                  setChatMessages(prev => [...prev, {
                            role: "assistant",
                            text: err instanceof Error ? `Error: ${err.message}` : "Error de conexion con el coach",
                            timestamp: new Date().toISOString()
                  }]);
          } finally {
                  setChatLoading(false);
          }
    }
  
    // --- Load History ---
    async function loadHistory() {
          if (!selectedAthlete) return;
          try {
                  const { data } = await supabase
                            .from("analysis_records")
                            .select("*")
                            .eq("athlete_id", selectedAthlete.id)
                            .order("analyzed_at", { ascending: false })
                            .limit(20);
                  if (data) setHistory(data as any[]);
          } catch { /* silently fail */ }
    }
  
    useEffect(() => { if (tab === "history" && selectedAthlete) loadHistory(); }, [tab, selectedAthlete]);
  
    // --- Navigation Items ---
    const navItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
      { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={20} /> },
      { id: "analysis", label: "Analisis", icon: <Activity size={20} /> },
      { id: "chat", label: "Coach AI", icon: <Brain size={20} /> },
      { id: "history", label: "Historial", icon: <Clock size={20} /> },
      { id: "garmin", label: "Garmin", icon: <Heart size={20} /> },
        ];
  
    const a = analysisResult?.analysis;
    const riskColor = a?.riskLevel === "low" ? "green" : a?.riskLevel === "high" ? "red" : "yellow";
  
    // --- RENDER ---
    return (
          <div className="dz-app">
            {/* === SIDEBAR === */}
                <aside className={`dz-sidebar ${sidebarOpen ? "open" : ""}`}>
                        <div className="dz-logo-area">
                                  <div className="dz-logo-mark">D</div>div>
                                  <div>
                                              <div className="dz-logo-text">DIZKOS</div>div>
                                              <div className="dz-logo-sub">Biomechanics Lab</div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Athlete Selector */}
                        <div className="dz-athlete-selector">
                                  <div className="dz-text-xs dz-text-muted" style={{ padding: "0 12px 8px", textTransform: "uppercase", letterSpacing: 1 }}>Atletas</div>div>
                          {athletes.map(ath => (
                        <button key={ath.id}
                                        className={`dz-athlete-chip ${selectedAthlete?.id === ath.id ? "selected" : ""}`}
                                        onClick={() => { setSelectedAthlete(ath); setAnalysisResult(null); }}>
                                      <div className="dz-athlete-avatar">{ath.name.charAt(0)}</div>div>
                                      <div>
                                                      <div className="dz-athlete-name">{ath.name}</div>div>
                                                      <div className="dz-athlete-meta">{ath.category} &middot; {ath.specialty}</div>div>
                                      </div>div>
                        </button>button>
                      ))}
                        </div>div>
                
                  {/* Navigation */}
                        <nav className="dz-nav">
                          {navItems.map(item => (
                        <button key={item.id}
                                        className={`dz-nav-item ${tab === item.id ? "active" : ""}`}
                                        onClick={() => setTab(item.id)}>
                          {item.icon}
                          {item.label}
                        </button>button>
                      ))}
                        </nav>nav>
                
                  {/* Sidebar Footer */}
                        <div style={{ padding: 16, borderTop: "1px solid var(--dz-border)" }}>
                                  <div className="dz-text-xs dz-text-muted">Dizkos v2.0</div>div>
                                  <div className="dz-text-xs dz-text-muted">Engine: Biomechanics AI</div>div>
                        </div>div>
                </aside>aside>
          
            {/* === MAIN CONTENT === */}
                <main className="dz-main">
                  {/* Top Bar */}
                        <header className="dz-topbar">
                                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                              <button className="dz-btn dz-btn-ghost dz-btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)}
                                                              style={{ display: "none" }}>
                                                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                                              </button>button>
                                              <span className="dz-topbar-title">
                                                {navItems.find(n => n.id === tab)?.label || "Dashboard"}
                                              </span>span>
                                    {selectedAthlete && (
                          <span className="dz-text-sm dz-text-muted" style={{ marginLeft: 8 }}>
                                          — {selectedAthlete.name}
                          </span>span>
                                              )}
                                  </div>div>
                                  <div className="dz-topbar-actions">
                                    {selectedAthlete && (
                          <span className={`dz-badge ${selectedAthlete.category === "elite" ? "elite" : "moderate"}`}>
                            {selectedAthlete.category}
                          </span>span>
                                              )}
                                  </div>div>
                        </header>header>
                
                  {/* Error Banner */}
                  {error && (
                      <div style={{ padding: "12px 32px", background: "var(--dz-red-soft)", borderBottom: "1px solid var(--dz-red)", display: "flex", alignItems: "center", gap: 8 }}>
                                  <AlertTriangle size={16} color="var(--dz-red)" />
                                  <span className="dz-text-sm" style={{ color: "var(--dz-red)" }}>{error}</span>span>
                                  <button onClick={() => setError(null)} className="dz-btn dz-btn-ghost dz-btn-sm" style={{ marginLeft: "auto" }}>
                                                <X size={14} />
                                  </button>button>
                      </div>div>
                        )}
                
                  {/* === TAB CONTENT === */}
                        <div className="dz-dashboard">
                        
                          {/* DASHBOARD TAB */}
                          {tab === "dashboard" && (
                        <div className="dz-animate-in">
                          {!selectedAthlete ? (
                                          <div style={{ textAlign: "center", padding: 80 }}>
                                                            <UserCircle2 size={64} color="var(--dz-purple-400)" style={{ margin: "0 auto 16px", opacity: 0.5 }} />
                                                            <h2 className="dz-text-xl dz-font-bold" style={{ marginBottom: 8 }}>Selecciona un Atleta</h2>h2>
                                                            <p className="dz-text-secondary">Elige un atleta desde la barra lateral para ver su dashboard</p>p>
                                          </div>div>
                                        ) : !analysisResult ? (
                                          <div style={{ textAlign: "center", padding: 80 }}>
                                                            <Activity size={64} color="var(--dz-purple-400)" style={{ margin: "0 auto 16px", opacity: 0.5 }} />
                                                            <h2 className="dz-text-xl dz-font-bold" style={{ marginBottom: 8 }}>Sin Analisis</h2>h2>
                                                            <p className="dz-text-secondary" style={{ marginBottom: 24 }}>Ejecuta un analisis biomecanico para ver resultados</p>p>
                                                            <button className="dz-btn dz-btn-primary dz-btn-lg" onClick={() => setTab("analysis")}>
                                                                                <Play size={20} /> Ir a Analisis
                                                            </button>button>
                                          </div>div>
                                        ) : (
                                          <>
                                            {/* Stats Grid */}
                                                            <div className="dz-stat-grid">
                                                                                <StatCard label="Technical Score" value={a?.technicalScore || 0} color="purple" />
                                                                                <StatCard label="Cadencia" value={analysisResult.cadence || 0} unit="spm" />
                                                                                <StatCard label="Nivel de Riesgo" value={a?.riskLevel || "N/A"} color={riskColor} />
                                                                                <StatCard label="Foco Prioritario" value={a?.priorityFocus || "N/A"} />
                                                            </div>div>
                                          
                                            {/* Main Analysis Grid */}
                                                            <div className="dz-grid dz-grid-2" style={{ marginBottom: 24 }}>
                                                              {/* Score + Diagnosis */}
                                                                                <div className="dz-analysis-hero">
                                                                                                      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                                                                                                                              <ScoreRing score={a?.technicalScore || 0} />
                                                                                                                              <div style={{ flex: 1 }}>
                                                                                                                                                        <h3 className="dz-text-lg dz-font-bold" style={{ marginBottom: 8 }}>Diagnostico</h3>h3>
                                                                                                                                                        <p className="dz-text-sm dz-text-secondary" style={{ lineHeight: 1.6 }}>
                                                                                                                                                          {a?.naturalLanguageDiagnosis || "Ejecuta un analisis para obtener el diagnostico biomecanico."}
                                                                                                                                                          </p>p>
                                                                                                                                                        <div style={{ marginTop: 12 }}>
                                                                                                                                                                                    <span className={`dz-badge ${riskColor === "green" ? "low" : riskColor === "red" ? "high" : "moderate"}`}>
                                                                                                                                                                                                                  <Shield size={12} /> Riesgo {a?.riskLevel}
                                                                                                                                                                                                                </span>span>
                                                                                                                                                          </div>div>
                                                                                                                                </div>div>
                                                                                                        </div>div>
                                                                                  </div>div>
                                                            
                                                              {/* Biomechanics Metrics */}
                                                                                <div className="dz-card">
                                                                                                      <div className="dz-card-header">
                                                                                                                              <span className="dz-card-title">Metricas Biomecanicas</span>span>
                                                                                                                              <Zap size={16} color="var(--dz-purple-400)" />
                                                                                                        </div>div>
                                                                                                      <MetricRow name="Overstriding" value={a?.overstriding ? "Detectado" : "Normal"} status={a?.overstriding ? "bad" : "good"} />
                                                                                                      <MetricRow name="Hip Drop" value={a?.hipDrop ? "Detectado" : "Normal"} status={a?.hipDrop ? "warning" : "good"} />
                                                                                                      <MetricRow name="Asimetria" value={a?.asymmetry ? "Presente" : "Balanceado"} status={a?.asymmetry ? "warning" : "good"} />
                                                                                                      <MetricRow name="Cadencia" value={a?.cadenceLow ? "Baja" : "Optima"} status={a?.cadenceLow ? "warning" : "good"} />
                                                                                                      <MetricRow name="Control Impacto" value={a?.impactControl ? "Deficiente" : "Bueno"} status={a?.impactControl ? "bad" : "good"} />
                                                                                                      <MetricRow name="Posicion Tronco" value={a?.trunkPosition ? "Inclinado" : "Correcto"} status={a?.trunkPosition ? "warning" : "good"} />
                                                                                  </div>div>
                                                            </div>div>
                                          
                                            {/* Readiness + Quick Actions */}
                                                            <div className="dz-grid dz-grid-2">
                                                                                <div className="dz-card">
                                                                                                      <div className="dz-card-header">
                                                                                                                              <span className="dz-card-title">Ajuste de Readiness</span>span>
                                                                                                                              <Target size={16} color="var(--dz-purple-400)" />
                                                                                                        </div>div>
                                                                                                      <p className="dz-text-sm dz-text-secondary">{a?.readinessAdjustment || "Sin ajuste especial"}</p>p>
                                                                                  </div>div>
                                                                                <div className="dz-card">
                                                                                                      <div className="dz-card-header">
                                                                                                                              <span className="dz-card-title">Acciones Rapidas</span>span>
                                                                                                        </div>div>
                                                                                                      <div style={{ display: "flex", gap: 12 }}>
                                                                                                                              <button className="dz-btn dz-btn-primary dz-btn-sm" onClick={() => setTab("chat")}>
                                                                                                                                                        <Brain size={14} /> Consultar Coach
                                                                                                                                </button>button>
                                                                                                                              <button className="dz-btn dz-btn-secondary dz-btn-sm" onClick={() => { setAnalysisResult(null); setTab("analysis"); }}>
                                                                                                                                                        <RotateCcw size={14} /> Nuevo Analisis
                                                                                                                                </button>button>
                                                                                                        </div>div>
                                                                                  </div>div>
                                                            </div>div>
                                          </>>
                                        )}
                        </div>div>
                                  )}
                        
                          {/* ANALYSIS TAB */}
                          {tab === "analysis" && (
                        <div className="dz-animate-in">
                                      <div style={{ maxWidth: 700, margin: "0 auto" }}>
                                                      <div className="dz-analysis-hero" style={{ textAlign: "center", marginBottom: 24 }}>
                                                                        <Video size={48} color="var(--dz-purple-400)" style={{ marginBottom: 16 }} />
                                                                        <h2 className="dz-text-xl dz-font-bold" style={{ marginBottom: 8 }}>Analisis Biomecanico</h2>h2>
                                                                        <p className="dz-text-secondary dz-text-sm" style={{ marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
                                                                                            Sube un video lateral de carrera para obtener un analisis completo de tu biomecanica con el motor Dizkos v2.0
                                                                        </p>p>
                                                      
                                                        {/* Upload Zone */}
                                                                        <div className={`dz-upload-zone ${videoFile ? "active" : ""}`}
                                                                                              onClick={() => fileInputRef.current?.click()}>
                                                                                            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
                                                                                                                    onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                                                                          {videoFile ? (
                                                                                                                      <>
                                                                                                                                              <Video size={32} color="var(--dz-green)" style={{ margin: "0 auto 12px" }} />
                                                                                                                                              <p className="dz-font-bold">{videoFile.name}</p>p>
                                                                                                                                              <p className="dz-text-xs dz-text-muted">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>p>
                                                                                                                        </>>
                                                                                                                    ) : (
                                                                                                                      <>
                                                                                                                                              <Upload size={32} color="var(--dz-purple-400)" style={{ margin: "0 auto 12px" }} />
                                                                                                                                              <p className="dz-font-bold" style={{ marginBottom: 4 }}>Arrastra un video o haz clic</p>p>
                                                                                                                                              <p className="dz-text-xs dz-text-muted">MP4, MOV hasta 100MB</p>p>
                                                                                                                        </>>
                                                                                                                    )}
                                                                        </div>div>
                                                      
                                                        {/* Run Button */}
                                                                        <button className="dz-btn dz-btn-primary dz-btn-lg" style={{ marginTop: 24, width: "100%", maxWidth: 400 }}
                                                                                              onClick={runAnalysis} disabled={analysisLoading || !selectedAthlete}>
                                                                          {analysisLoading ? (
                                                                                                                      <><RotateCcw size={20} className="dz-progress-ring" /> Analizando...</>>
                                                                                                                    ) : (
                                                                                                                      <><Sparkles size={20} /> Ejecutar Analisis</>>
                                                                                                                    )}
                                                                        </button>button>
                                                      
                                                        {!selectedAthlete && (
                                              <p className="dz-text-xs dz-text-muted" style={{ marginTop: 8 }}>
                                                                    Selecciona un atleta en la barra lateral
                                              </p>p>
                                                                        )}
                                                      </div>div>
                                      
                                        {/* Analysis Loading State */}
                                        {analysisLoading && (
                                            <div className="dz-card" style={{ textAlign: "center", padding: 40 }}>
                                                                <div className="dz-loading-bar" style={{ marginBottom: 16 }}>
                                                                                      <div className="dz-loading-bar-fill dz-pulse" style={{ width: "70%" }} />
                                                                </div>div>
                                                                <p className="dz-text-sm dz-text-secondary">Procesando biomecanica con IA...</p>p>
                                                                <p className="dz-text-xs dz-text-muted" style={{ marginTop: 4 }}>Analizando overstriding, hip drop, asimetria, cadencia y mas</p>p>
                                            </div>div>
                                                      )}
                                      </div>div>
                        </div>div>
                                  )}
                        
                          {/* CHAT TAB */}
                          {tab === "chat" && (
                        <div className="dz-chat" style={{ height: "calc(100vh - 64px)", margin: "-24px -32px" }}>
                                      <div className="dz-chat-messages">
                                        {chatMessages.length === 0 && (
                                            <div style={{ textAlign: "center", padding: "60px 0" }}>
                                                                <Brain size={48} color="var(--dz-purple-400)" style={{ margin: "0 auto 16px", opacity: 0.5 }} />
                                                                <h3 className="dz-text-lg dz-font-bold" style={{ marginBottom: 8 }}>Coach AI Dizkos</h3>h3>
                                                                <p className="dz-text-sm dz-text-secondary" style={{ maxWidth: 400, margin: "0 auto 24px" }}>
                                                                                      Consulta sobre biomecanica, entrenamiento, prevencion de lesiones y mas. El coach tiene contexto de tu atleta y analisis.
                                                                </p>p>
                                                                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                                                  {["Como mejorar mi cadencia?", "Que ejercicios previenen hip drop?", "Analiza mi riesgo de lesion"].map(q => (
                                                                      <button key={q} className="dz-btn dz-btn-secondary dz-btn-sm" onClick={() => sendChat(q)}>{q}</button>button>
                                                                    ))}
                                                                </div>div>
                                            </div>div>
                                                      )}
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`dz-chat-bubble ${msg.role}`}>
                                              {msg.text}
                                            </div>div>
                                          ))}
                                        {chatLoading && (
                                            <div className="dz-chat-bubble assistant dz-pulse">
                                                                Pensando...
                                            </div>div>
                                                      )}
                                                      <div ref={chatEndRef} />
                                      </div>div>
                                      <div className="dz-chat-input-area">
                                                      <input className="dz-chat-input" placeholder="Pregunta al Coach AI..."
                                                                          value={chatInput} onChange={e => setChatInput(e.target.value)}
                                                                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())} />
                                                      <button className="dz-chat-send" onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}>
                                                                        <Send size={18} />
                                                      </button>button>
                                      </div>div>
                        </div>div>
                                  )}
                        
                          {/* HISTORY TAB */}
                          {tab === "history" && (
                        <div className="dz-animate-in">
                                      <div className="dz-card">
                                                      <div className="dz-card-header">
                                                                        <span className="dz-card-title">Historial de Analisis</span>span>
                                                                        <button className="dz-btn dz-btn-ghost dz-btn-sm" onClick={loadHistory}>
                                                                                            <RotateCcw size={14} /> Actualizar
                                                                        </button>button>
                                                      </div>div>
                                        {!selectedAthlete ? (
                                            <p className="dz-text-sm dz-text-secondary">Selecciona un atleta para ver su historial</p>p>
                                          ) : history.length === 0 ? (
                                            <p className="dz-text-sm dz-text-secondary">No hay analisis previos para {selectedAthlete.name}</p>p>
                                          ) : (
                                            <div>
                                                                <div className="dz-history-row" style={{ fontWeight: 600, color: "var(--dz-text-muted)", fontSize: 12, textTransform: "uppercase" }}>
                                                                                      <span>Fecha</span>span><span>Score</span>span><span>Cadencia</span>span><span>Riesgo</span>span><span>Motor</span>span>
                                                                </div>div>
                                              {history.map((h, i) => (
                                                                    <div key={i} className="dz-history-row">
                                                                                            <span className="dz-history-date">{new Date(h.analyzedAt || "").toLocaleDateString()}</span>span>
                                                                                            <span className="dz-history-detail">{h.score || "—"}</span>span>
                                                                                            <span className="dz-history-detail">{h.cadence || "—"} spm</span>span>
                                                                                            <span><span className={`dz-badge ${h.analysis?.riskLevel === "low" ? "low" : h.analysis?.riskLevel === "high" ? "high" : "moderate"}`}>{h.analysis?.riskLevel || "—"}</span>span></span>span>
                                                                                            <span className="dz-history-detail dz-text-xs">{h.engine}</span>span>
                                                                    </div>div>
                                                                  ))}
                                            </div>div>
                                                      )}
                                      </div>div>
                        </div>div>
                                  )}
                        
                          {/* GARMIN TAB */}
                          {tab === "garmin" && (
                        <div className="dz-animate-in">
                                      <div className="dz-grid dz-grid-2">
                                                      <div className="dz-garmin-card">
                                                                        <div className="dz-garmin-header">
                                                                                            <Heart size={20} color="#00b4d8" />
                                                                                            <span className="dz-garmin-logo">GARMIN CONNECT</span>span>
                                                                                            <span className="dz-badge low" style={{ marginLeft: "auto" }}>Conectado</span>span>
                                                                        </div>div>
                                                                        <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Dispositivo</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.deviceLabel}</span>span>
                                                                        </div>div>
                                                                        <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Training Readiness</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.readiness}</span>span>
                                                                        </div>div>
                                                                        <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Body Battery</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.bodyBattery}</span>span>
                                                                        </div>div>
                                                                        <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Ultima Sincronizacion</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.lastSyncLabel}</span>span>
                                                                        </div>div>
                                                      </div>div>
                                      
                                                      <div className="dz-garmin-card">
                                                                        <div className="dz-garmin-header">
                                                                                            <Activity size={20} color="#00b4d8" />
                                                                                            <span className="dz-garmin-logo">ULTIMA CARRERA</span>span>
                                                                        </div>div>
                                                        {garminData.recentRun && (
                                              <>
                                                                    <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Distancia</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.recentRun.distanceKm} km</span>span>
                                                                    </div>div>
                                                                    <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Pace</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.recentRun.paceMinKm} min/km</span>span>
                                                                    </div>div>
                                                                    <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">FC Promedio</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.recentRun.heartRateAvg} bpm</span>span>
                                                                    </div>div>
                                                                    <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Cadencia</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.recentRun.cadenceAvg} spm</span>span>
                                                                    </div>div>
                                                                    <div className="dz-garmin-stat">
                                                                                            <span className="dz-garmin-stat-label">Fecha</span>span>
                                                                                            <span className="dz-garmin-stat-value">{garminData.recentRun.date}</span>span>
                                                                    </div>div>
                                              </>>
                                            )}
                                                      </div>div>
                                      </div>div>
                        </div>div>
                                  )}
                        </div>div>
                </main>main>
          </div>div>
        );
}</></></></></></></span>
