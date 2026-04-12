"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  Flag,
  Gauge,
  Heart,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Upload,
  UserCircle2,
  Video,
  Watch,
  Zap,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ─── TIPOS ────────────────────────────────────────────────────

type TabId = "dashboard" | "video" | "vision" | "weekly" | "garmin" | "history" | "coach";
type RiskLevel = "Bajo" | "Medio" | "Alto" | "Crítico";

interface Athlete {
  id: string;
  name: string;
  level: string;
  distanceGoal: number;
  yearsRunning?: number;
}

interface BiomechanicsMetrics {
  overstride?: { label: string; value: number; risk: string };
  hipDrop?: { label: string; value: number; side: string };
  asymmetry?: { label: string; value: number };
  trunkPosition?: { label: string; angleDeg: number };
  impactControl?: { label: string; pattern: string; risk: string };
}

interface AnalysisResult {
  technicalScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  priorityFocus: string;
  cadence: number;
  metrics: BiomechanicsMetrics;
  naturalLanguageDiagnosis: string;
  readinessAdjustment: number;
  coachCues: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GarminData {
  hrv?: number;
  restingHR?: number;
  sleep?: number;
  bodyBattery?: number;
  weeklyLoad?: number;
  readiness?: number;
}

// ─── SUPABASE ─────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

// ─── HELPERS UI ───────────────────────────────────────────────

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "Bajo": return "text-emerald-400";
    case "Medio": return "text-amber-400";
    case "Alto": return "text-orange-500";
    case "Crítico": return "text-red-500";
    default: return "text-zinc-400";
  }
}

function getRiskBg(level: RiskLevel): string {
  switch (level) {
    case "Bajo": return "bg-emerald-500/10 border-emerald-500/30";
    case "Medio": return "bg-amber-500/10 border-amber-500/30";
    case "Alto": return "bg-orange-500/10 border-orange-500/30";
    case "Crítico": return "bg-red-500/10 border-red-500/30";
    default: return "bg-zinc-800 border-zinc-700";
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : score >= 40 ? "#fb923c" : "#f87171";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth="6" />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────

export default function DizkosApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [garminData, setGarminData] = useState<GarminData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [athleteFeelings, setAthleteFeelings] = useState("");
  const [isLiveCoach, setIsLiveCoach] = useState(false);
  const [liveCueIndex, setLiveCueIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveCoachInterval = useRef<NodeJS.Timeout | null>(null);

  // Cargar atletas al iniciar
  useEffect(() => {
    loadAthletes();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Modo coach en vivo: rotar cues automáticamente
  useEffect(() => {
    if (isLiveCoach && analysis?.coachCues?.length) {
      liveCoachInterval.current = setInterval(() => {
        setLiveCueIndex(i => (i + 1) % (analysis.coachCues?.length ?? 1));
      }, 8000);
    } else {
      if (liveCoachInterval.current) clearInterval(liveCoachInterval.current);
    }
    return () => { if (liveCoachInterval.current) clearInterval(liveCoachInterval.current); };
  }, [isLiveCoach, analysis]);

  async function loadAthletes() {
    const { data } = await supabase.from("athletes").select("*").order("name");
    if (data) setAthletes(data);
  }

  async function selectAthlete(athlete: Athlete) {
    setSelectedAthlete(athlete);
    setAnalysis(null);
    setAnalysisHistory([]);
    setChatMessages([{
      role: "assistant",
      content: `Hola ${athlete.name}, soy Dizkos. ¿Cómo te sientes hoy antes de entrenar? Puedes contarme si tienes alguna molestia, fatiga o cualquier cosa que sienta tu cuerpo.`,
    }]);

    // Cargar historial de análisis
    const res = await fetch(`/api/dizkos/analysis?athleteId=${athlete.id}`);
    if (res.ok) {
      const { records } = await res.json();
      if (records?.length) {
        setAnalysisHistory(records);
        setAnalysis(records[0]); // Mostrar el más reciente
      }
    }
  }

  async function runAnalysis() {
    if (!selectedAthlete) return;
    setIsAnalyzing(true);

    // Simular análisis (en producción, conectar con PoseNet/MediaPipe)
    await new Promise(r => setTimeout(r, 2000));

    // Demo result — en producción esto viene de analyzeBiomechanics()
    const result: AnalysisResult = {
      technicalScore: 72,
      riskScore: 38,
      riskLevel: "Medio",
      priorityFocus: "Acortar la zancada",
      cadence: 163,
      metrics: {
        overstride: { label: "Moderado", value: 0.12, risk: "Medio" },
        hipDrop: { label: "Leve", value: 0.04, side: "derecho" },
        asymmetry: { label: "Leve", value: 0.07 },
        trunkPosition: { label: "Vertical", angleDeg: 3 },
        impactControl: { label: "Mediopié eficiente", pattern: "Mediopié", risk: "Bajo" },
      },
      naturalLanguageDiagnosis: `${selectedAthlete.name}, tu patrón principal de riesgo hoy es el overstride moderado. Acortar la zancada y subir cadencia a 170 spm reduciría la carga en rodilla significativamente.`,
      readinessAdjustment: -0.1,
      coachCues: [
        "Aterriza bajo tu cadera, no delante",
        "Pasos más cortos y rápidos",
        "Activa el glúteo en cada apoyo",
        "Relaja los hombros",
      ],
    };

    setAnalysis(result);
    setIsAnalyzing(false);
    setActiveTab("dashboard");

    // Guardar en Supabase
    await fetch("/api/dizkos/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        athleteId: selectedAthlete.id,
        ...result,
      }),
    });

    // Auto-mensaje del coach
    const autoMsg: ChatMessage = {
      role: "assistant",
      content: `Análisis completado. ${result.naturalLanguageDiagnosis} Tu score técnico es ${result.technicalScore}/100. ¿Tienes preguntas sobre los resultados?`,
    };
    setChatMessages(prev => [...prev, autoMsg]);
  }

  async function sendChat(message?: string) {
    const text = message ?? chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/dizkos/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          athlete: selectedAthlete,
          analysis,
          garmin: garminData,
          sessionHistory: analysisHistory,
          isLiveCoach,
          athleteFeelings,
        }),
      });

      const data = await res.json();
      if (data.message) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "Error de conexión. Intenta de nuevo.",
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ─── TAB: DASHBOARD ─────────────────────────────────────────

  function renderDashboard() {
    if (!selectedAthlete) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
          <UserCircle2 size={48} className="opacity-30" />
          <p className="text-lg">Selecciona un atleta para comenzar</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header atleta */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
            {selectedAthlete.name[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-white font-semibold text-lg">{selectedAthlete.name}</h2>
            <p className="text-zinc-400 text-sm">{selectedAthlete.level} · Meta: {selectedAthlete.distanceGoal}km</p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-all"
          >
            {isAnalyzing ? (
              <><RotateCcw size={14} className="animate-spin" /> Analizando...</>
            ) : (
              <><Sparkles size={14} /> Analizar</>
            )}
          </button>
        </div>

        {/* Scores principales */}
        {analysis ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {/* Score técnico */}
              <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700 flex flex-col items-center gap-2">
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Score Técnico</p>
                <ScoreRing score={analysis.technicalScore} size={80} />
                <p className={`text-xs font-medium ${getScoreColor(analysis.technicalScore)}`}>
                  {analysis.technicalScore >= 80 ? "Excelente" : analysis.technicalScore >= 65 ? "Bueno" : analysis.technicalScore >= 50 ? "Mejorable" : "Crítico"}
                </p>
              </div>

              {/* Riesgo */}
              <div className={`p-4 rounded-2xl border flex flex-col items-center gap-2 ${getRiskBg(analysis.riskLevel)}`}>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Nivel de Riesgo</p>
                <div className="flex flex-col items-center">
                  <AlertTriangle size={32} className={`${getRiskColor(analysis.riskLevel)} mt-1`} />
                  <span className={`text-2xl font-bold mt-1 ${getRiskColor(analysis.riskLevel)}`}>
                    {analysis.riskLevel}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs">{analysis.riskScore}/100</p>
              </div>
            </div>

            {/* Prioridad */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Flag size={14} className="text-violet-400" />
                <p className="text-violet-300 text-xs font-semibold uppercase tracking-wider">Foco de esta semana</p>
              </div>
              <p className="text-white font-bold text-lg">{analysis.priorityFocus}</p>
            </div>

            {/* Cadencia */}
            <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-amber-400" />
                  <span className="text-zinc-300 text-sm font-medium">Cadencia</span>
                </div>
                <span className={`text-xl font-bold ${analysis.cadence >= 170 ? "text-emerald-400" : analysis.cadence >= 160 ? "text-amber-400" : "text-orange-400"}`}>
                  {analysis.cadence} <span className="text-sm font-normal text-zinc-400">spm</span>
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${analysis.cadence >= 170 ? "bg-emerald-400" : analysis.cadence >= 160 ? "bg-amber-400" : "bg-orange-400"}`}
                  style={{ width: `${Math.min(100, ((analysis.cadence - 140) / 60) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-zinc-600 text-xs">140</span>
                <span className="text-zinc-500 text-xs">Óptimo 170-180</span>
                <span className="text-zinc-600 text-xs">200</span>
              </div>
            </div>

            {/* Métricas detalle */}
            <div className="grid grid-cols-1 gap-2">
              {[
                { key: "overstride", label: "Overstride", icon: <TrendingUp size={14} />, value: analysis.metrics.overstride?.label, risk: analysis.metrics.overstride?.risk },
                { key: "hipDrop", label: "Hip Drop", icon: <Activity size={14} />, value: analysis.metrics.hipDrop?.label, risk: analysis.metrics.hipDrop?.label === "Severo" ? "Alto" : analysis.metrics.hipDrop?.label === "Moderado" ? "Medio" : "Bajo" },
                { key: "asymmetry", label: "Asimetría", icon: <BarChart3 size={14} />, value: analysis.metrics.asymmetry?.label, risk: analysis.metrics.asymmetry?.label === "Severa" ? "Alto" : "Bajo" },
                { key: "trunk", label: "Tronco", icon: <Zap size={14} />, value: analysis.metrics.trunkPosition?.label, risk: "Bajo" },
                { key: "impact", label: "Impacto", icon: <CheckCircle2 size={14} />, value: analysis.metrics.impactControl?.label, risk: analysis.metrics.impactControl?.risk },
              ].map(m => (
                <div key={m.key} className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
                  <div className="flex items-center gap-2 text-zinc-400">
                    {m.icon}
                    <span className="text-sm">{m.label}</span>
                  </div>
                  <span className={`text-sm font-medium ${m.risk === "Alto" ? "text-orange-400" : m.risk === "Medio" ? "text-amber-400" : "text-emerald-400"}`}>
                    {m.value ?? "—"}
                  </span>
                </div>
              ))}
            </div>

            {/* Diagnóstico */}
            <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={14} className="text-violet-400" />
                <span className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">Diagnóstico Dizkos</span>
              </div>
              <p className="text-zinc-200 text-sm leading-relaxed italic">
                "{analysis.naturalLanguageDiagnosis}"
              </p>
            </div>

            {/* Modo Coach en Vivo */}
            <div className={`p-4 rounded-2xl border transition-all ${isLiveCoach ? "bg-violet-600/20 border-violet-500/50" : "bg-zinc-800/40 border-zinc-700"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={16} className={isLiveCoach ? "text-violet-400 animate-pulse" : "text-zinc-500"} />
                  <span className={`text-sm font-semibold ${isLiveCoach ? "text-violet-300" : "text-zinc-400"}`}>
                    Coach en Vivo
                  </span>
                </div>
                <button
                  onClick={() => { setIsLiveCoach(!isLiveCoach); setLiveCueIndex(0); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${isLiveCoach ? "bg-violet-600 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}
                >
                  {isLiveCoach ? "Activo" : "Activar"}
                </button>
              </div>

              {isLiveCoach && analysis.coachCues?.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-violet-600/30 border border-violet-500/40">
                  <p className="text-white font-bold text-base text-center animate-pulse">
                    ⚡ {analysis.coachCues[liveCueIndex]}
                  </p>
                  <div className="flex justify-center gap-1 mt-2">
                    {analysis.coachCues.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === liveCueIndex ? "bg-violet-300" : "bg-zinc-600"}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-zinc-500">
            <Sparkles size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Sube un video o analiza en vivo para ver tu biomecánica</p>
            <button
              onClick={runAnalysis}
              className="mt-4 px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
            >
              Comenzar análisis demo
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── TAB: COACH CHAT ─────────────────────────────────────────

  function renderCoach() {
    return (
      <div className="flex flex-col h-full" style={{ minHeight: "60vh" }}>
        {/* Feelings input */}
        {!athleteFeelings && (
          <div className="mb-3 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
            <p className="text-zinc-400 text-xs mb-2">¿Cómo te sientes hoy? (opcional)</p>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-900 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700 outline-none focus:border-violet-500"
                placeholder="Ej: rodilla derecha molesta, cansado, bien descansado..."
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      setAthleteFeelings(val);
                      sendChat(`Hoy me siento así: ${val}`);
                    }
                  }
                }}
              />
              <Heart size={16} className="text-zinc-500 self-center" />
            </div>
          </div>
        )}

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1" style={{ maxHeight: "45vh" }}>
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                  <Brain size={10} className="text-white" />
                </div>
              )}
              <div className={`max-w-xs rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-br-sm"
                  : "bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-bl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center mr-2 mt-1">
                <Brain size={10} className="text-white animate-pulse" />
              </div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick replies */}
        {analysis && chatMessages.length <= 2 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {[
              "¿Qué debo trabajar esta semana?",
              `¿Por qué ${analysis.cadence} spm?`,
              "Tengo dolor en la rodilla",
            ].map(q => (
              <button
                key={q}
                onClick={() => sendChat(q)}
                className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-violet-500 hover:text-violet-300 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendChat()}
            placeholder={isLiveCoach ? "Pregunta rápida al coach en vivo..." : "Pregunta a Dizkos..."}
            className="flex-1 bg-zinc-800 text-white text-sm rounded-xl px-4 py-3 border border-zinc-700 outline-none focus:border-violet-500 transition-colors placeholder-zinc-500"
          />
          <button
            onClick={() => sendChat()}
            disabled={!chatInput.trim() || chatLoading}
            className="px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ─── TAB: HISTORIAL ──────────────────────────────────────────

  function renderHistory() {
    if (!analysisHistory.length) {
      return (
        <div className="text-center py-10 text-zinc-500">
          <Database size={40} className="mx-auto mb-3 opacity-20" />
          <p>Sin historial de análisis todavía</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {analysisHistory.slice(0, 15).map((record: any, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700 cursor-pointer hover:border-violet-500/50 transition-all"
            onClick={() => { setAnalysis(record); setActiveTab("dashboard"); }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-xs">
                {record.analyzedAt ? new Date(record.analyzedAt).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                record.riskLevel === "Bajo" ? "bg-emerald-500/20 text-emerald-400"
                : record.riskLevel === "Medio" ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
              }`}>
                {record.riskLevel ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-zinc-500 text-xs">Técnico</p>
                <p className={`text-xl font-bold ${getScoreColor(record.technicalScore ?? 0)}`}>
                  {record.technicalScore ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Cadencia</p>
                <p className="text-xl font-bold text-white">{record.cadence ?? "—"}</p>
              </div>
              <div className="flex-1">
                <p className="text-zinc-500 text-xs">Prioridad</p>
                <p className="text-sm text-zinc-300 truncate">{record.priorityFocus ?? "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ─── NAVEGACIÓN ───────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <Sparkles size={16} /> },
    { id: "coach", label: "Coach", icon: <Brain size={16} /> },
    { id: "video", label: "Video", icon: <Video size={16} /> },
    { id: "weekly", label: "Semana", icon: <CalendarDays size={16} /> },
    { id: "garmin", label: "Garmin", icon: <Watch size={16} /> },
    { id: "history", label: "Historial", icon: <Database size={16} /> },
  ];

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
