"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  Database,
  Flag,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Upload,
  UserCircle2,
  Video,
  Watch,
} from "lucide-react";

type TabId = "dashboard" | "video" | "vision" | "weekly" | "garmin" | "history";
type OverlayPoint = { x: number; y: number };
type OverlayFrame = { time: number; points: OverlayPoint[] };
type SimplePoint = { x: number; y: number; visibility: number };
type FrameLandmarks = {
  time: number;
  leftShoulder: SimplePoint;
  rightShoulder: SimplePoint;
  leftHip: SimplePoint;
  rightHip: SimplePoint;
  leftKnee: SimplePoint;
  rightKnee: SimplePoint;
  leftAnkle: SimplePoint;
  rightAnkle: SimplePoint;
};

type Diagnostics = {
  detectedFrames: number;
  sampledFrames: number;
  averagePoseConfidence: number;
  validLateralView: boolean;
  movementDetected: boolean;
  fullBodyVisible: boolean;
  notes: string[];
};

type AnalysisRecord = {
  athleteId: string;
  analyzedAt?: string;
  score: number;
  cadence: number | null;
  diagnostics: Diagnostics;
  engine: string;
  overlayImage?: string | null;
  overlayPoints?: OverlayPoint[];
  overlayFrames?: OverlayFrame[];
  overlayStoragePath?: string | null;
  overlayPublicUrl?: string | null;
  video?: {
    fileName?: string | null;
    fileType?: string | null;
    fileSizeBytes?: number | null;
    storagePath?: string | null;
    publicUrl?: string | null;
  };
  analysis: {
    technicalScore: number;
    overstriding: string;
    hipDrop: string;
    cadence: number | null;
    cadenceLow: boolean;
    asymmetry: string;
    impactControl: string;
    trunkPosition: string;
    videoQualityScore: number;
    readinessAdjustment: string;
    viewMode: string;
  };
};

type GarminData = {
  connected: boolean;
  deviceLabel: string;
  readiness: number;
  bodyBattery: number;
  recentRun: string;
  lastSyncLabel: string;
};

const ANALYSIS_ENDPOINT = "/api/dizkos/analysis";
const UPLOAD_ENDPOINT = "/api/dizkos/upload";
const GARMIN_STATUS_ENDPOINT = "/api/garmin/status";

const athletes = [
  {
    id: "arielle",
    name: "Arielle",
    level: "Intermedio",
    goal: "Correr mejor, sin dolor y con una base técnica más sólida.",
    distanceGoal: "21K",
    weeklyMessage: "Semana orientada a estabilidad pélvica, técnica y rodaje controlado.",
    garminLabel: "Forerunner 265",
  },
  {
    id: "diego",
    name: "Diego",
    level: "Avanzado",
    goal: "Preparación específica para maratón con mejor economía de carrera.",
    distanceGoal: "42K",
    weeklyMessage: "Semana con trabajo de calidad y ajuste fino de técnica bajo carga.",
    garminLabel: "Forerunner 965",
  },
  {
    id: "valeria",
    name: "Valeria",
    level: "Principiante",
    goal: "Construir confianza, mejorar mecánica y disfrutar correr 10K.",
    distanceGoal: "10K",
    weeklyMessage: "Semana suave con foco en cadencia, postura y fuerza básica.",
    garminLabel: "No conectado",
  },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function averagePoint(a: SimplePoint, b: SimplePoint): SimplePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: (a.visibility + b.visibility) / 2 };
}

function distance2D(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bandThree(value: number, lowThreshold: number, highThreshold: number): "Baja" | "Media" | "Alta" {
  if (value >= highThreshold) return "Alta";
  if (value >= lowThreshold) return "Media";
  return "Baja";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadAsset(file: File, athleteId: string, assetType: "video" | "overlay") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("athleteId", athleteId);
  formData.append("assetType", assetType);
  const response = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`No se pudo subir ${assetType}`);
  return response.json();
}

async function persistAnalysis(record: AnalysisRecord) {
  const response = await fetch(ANALYSIS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error("No se pudo guardar el análisis");
  return response.json();
}

async function fetchHistory(athleteId: string): Promise<AnalysisRecord[]> {
  const response = await fetch(`${ANALYSIS_ENDPOINT}?athleteId=${encodeURIComponent(athleteId)}`);
  if (!response.ok) throw new Error("No se pudo leer el historial");
  const data = await response.json();
  return Array.isArray(data?.records) ? data.records : [];
}

async function clearHistoryBackend(athleteId: string) {
  const response = await fetch(`${ANALYSIS_ENDPOINT}?athleteId=${encodeURIComponent(athleteId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("No se pudo limpiar el historial");
  return response.json();
}

async function fetchGarminStatus(athleteId: string): Promise<GarminData> {
  const response = await fetch(`${GARMIN_STATUS_ENDPOINT}?athleteId=${encodeURIComponent(athleteId)}`);
  if (!response.ok) throw new Error("No se pudo leer Garmin");
  return response.json();
}

function captureCurrentFrame(video: HTMLVideoElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

async function fileToVideoElement(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("No se pudo cargar metadata del video"));
  });
  return { video, url };
}

let poseLandmarkerPromise: Promise<any> | null = null;

async function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })();
  }
  return poseLandmarkerPromise;
}

function mapPosePoint(point: any): SimplePoint {
  return { x: point?.x ?? 0, y: point?.y ?? 0, visibility: point?.visibility ?? 0 };
}

function poseToFrame(pose: any[], time: number): FrameLandmarks | null {
  if (!pose || pose.length < 29) return null;
  return {
    time,
    leftShoulder: mapPosePoint(pose[11]),
    rightShoulder: mapPosePoint(pose[12]),
    leftHip: mapPosePoint(pose[23]),
    rightHip: mapPosePoint(pose[24]),
    leftKnee: mapPosePoint(pose[25]),
    rightKnee: mapPosePoint(pose[26]),
    leftAnkle: mapPosePoint(pose[27]),
    rightAnkle: mapPosePoint(pose[28]),
  };
}

function frameToOverlayPoints(frame: FrameLandmarks): OverlayPoint[] {
  return [
    { x: frame.leftShoulder.x, y: frame.leftShoulder.y },
    { x: frame.rightShoulder.x, y: frame.rightShoulder.y },
    { x: frame.leftHip.x, y: frame.leftHip.y },
    { x: frame.rightHip.x, y: frame.rightHip.y },
    { x: frame.leftKnee.x, y: frame.leftKnee.y },
    { x: frame.rightKnee.x, y: frame.rightKnee.y },
    { x: frame.leftAnkle.x, y: frame.leftAnkle.y },
    { x: frame.rightAnkle.x, y: frame.rightAnkle.y },
  ];
}

function analyzeFromFrames(readiness: number, frames: FrameLandmarks[], durationSeconds: number) {
  const overlayFrames = frames.map((frame) => ({ time: frame.time, points: frameToOverlayPoints(frame) }));
  const hipCenters = frames.map((frame) => averagePoint(frame.leftHip, frame.rightHip));
  const shoulderSpread = mean(frames.map((frame) => Math.abs(frame.leftShoulder.x - frame.rightShoulder.x)));
  const hipSpread = mean(frames.map((frame) => Math.abs(frame.leftHip.x - frame.rightHip.x)));
  const validLateralView = ((shoulderSpread + hipSpread) / 2) < 0.22;

  const fullBodyVisible =
    frames.filter((frame) => {
      const pts = [
        frame.leftShoulder,
        frame.rightShoulder,
        frame.leftHip,
        frame.rightHip,
        frame.leftKnee,
        frame.rightKnee,
        frame.leftAnkle,
        frame.rightAnkle,
      ];
      return pts.every((pt) => pt.visibility > 0.45 && pt.y >= 0 && pt.y <= 1);
    }).length / Math.max(frames.length, 1) >= 0.75;

  const avgConfidence = mean(
    frames.flatMap((frame) =>
      [
        frame.leftShoulder,
        frame.rightShoulder,
        frame.leftHip,
        frame.rightHip,
        frame.leftKnee,
        frame.rightKnee,
        frame.leftAnkle,
        frame.rightAnkle,
      ].map((pt) => pt.visibility)
    )
  );

  const movementDetected =
    Math.max(...hipCenters.map((pt) => pt.x)) - Math.min(...hipCenters.map((pt) => pt.x)) > 0.04;

  const stanceRatios = frames.map((frame) => {
    const leftLeg = distance2D(frame.leftHip, frame.leftKnee) + distance2D(frame.leftKnee, frame.leftAnkle);
    const rightLeg = distance2D(frame.rightHip, frame.rightKnee) + distance2D(frame.rightKnee, frame.rightAnkle);
    const leftReach = Math.abs(frame.leftAnkle.x - frame.leftHip.x) / Math.max(leftLeg, 0.0001);
    const rightReach = Math.abs(frame.rightAnkle.x - frame.rightHip.x) / Math.max(rightLeg, 0.0001);
    return (leftReach + rightReach) / 2;
  });

  const overstriding = bandThree(mean(stanceRatios), 0.11, 0.17);
  const hipDrop = bandThree(
    mean(frames.map((frame) => Math.abs(frame.leftHip.y - frame.rightHip.y) * 100)),
    3.5,
    6.5
  );

  const leftStrideSeries = frames.map((frame) => Math.abs(frame.leftAnkle.x - frame.leftHip.x));
  const rightStrideSeries = frames.map((frame) => Math.abs(frame.rightAnkle.x - frame.rightHip.x));
  const asymmetryValue =
    (Math.abs(mean(leftStrideSeries) - mean(rightStrideSeries)) /
      Math.max((mean(leftStrideSeries) + mean(rightStrideSeries)) / 2, 0.0001)) *
    100;
  const asymmetry = bandThree(asymmetryValue, 6, 11);

  const trunkOffsets = frames.map((frame) =>
    Math.abs(averagePoint(frame.leftShoulder, frame.rightShoulder).x - averagePoint(frame.leftHip, frame.rightHip).x)
  );
  const trunkPosition =
    mean(trunkOffsets) > 0.045 ? "Inestabilidad" : mean(trunkOffsets) > 0.025 ? "Leve inclinación" : "Estable";

  const impactControl = bandThree(
    mean(
      frames.map((frame) => {
        const shoulderY = averagePoint(frame.leftShoulder, frame.rightShoulder).y;
        const hipY = averagePoint(frame.leftHip, frame.rightHip).y;
        return Math.abs(shoulderY - hipY) * 100;
      })
    ),
    23,
    30
  );

  const cadence = clamp(
    Math.round((Math.max(8, Math.round(durationSeconds * 2.8)) / Math.max(durationSeconds, 1)) * 60),
    150,
    186
  );

  const readinessAdjustment =
    readiness >= 70
      ? "Lista para progresar ligeramente"
      : readiness >= 55
      ? "Mantener carga moderada"
      : "Conviene reducir intensidad esta semana";

  const scorePenalty =
    (overstriding === "Alta" ? 10 : overstriding === "Media" ? 5 : 1) +
    (hipDrop === "Alta" ? 9 : hipDrop === "Media" ? 4 : 1) +
    (asymmetry === "Alta" ? 8 : asymmetry === "Media" ? 4 : 1) +
    (impactControl === "Alta" ? 8 : impactControl === "Media" ? 4 : 1) +
    (cadence < 168 ? 4 : 1);

  const score = clamp(Math.round(100 - scorePenalty + (readiness > 70 ? 2 : -1)), 55, 96);

  return {
    score,
    cadence,
    diagnostics: {
      detectedFrames: frames.length,
      sampledFrames: frames.length,
      averagePoseConfidence: Number(avgConfidence.toFixed(2)),
      validLateralView,
      movementDetected,
      fullBodyVisible,
      notes: [
        validLateralView
          ? "La vista lateral es válida para analizar la técnica."
          : "La vista no parece completamente lateral; conviene regrabar más de perfil.",
        fullBodyVisible ? "El cuerpo completo se mantiene visible." : "El cuerpo no se ve completo durante todo el video.",
        avgConfidence >= 0.6
          ? `La confianza de landmarks es suficiente (${Math.round(avgConfidence * 100)}%).`
          : "La confianza de landmarks es baja; revisa luz o calidad de video.",
        movementDetected ? "Se detecta desplazamiento suficiente." : "No se detectó suficiente desplazamiento.",
        readinessAdjustment,
      ],
    } as Diagnostics,
    analysis: {
      technicalScore: score,
      overstriding,
      hipDrop,
      cadence,
      cadenceLow: cadence < 168,
      asymmetry,
      impactControl,
      trunkPosition,
      videoQualityScore: Number(clamp(avgConfidence + 0.05, 0.65, 0.98).toFixed(2)),
      readinessAdjustment,
      viewMode: "lateral",
    },
    overlayFrames,
  };
}

async function runRealPoseAnalysis(file: File, readiness: number) {
  const poseLandmarker = await getPoseLandmarker();
  const { video, url } = await fileToVideoElement(file);

  try {
    const durationSeconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8;
    const sampleCount = Math.max(10, Math.min(24, Math.round(durationSeconds * 2)));
    const frames: FrameLandmarks[] = [];
    let overlayImage: string | null = null;

    for (let index = 0; index < sampleCount; index += 1) {
      const time = Math.min((durationSeconds / sampleCount) * index, Math.max(durationSeconds - 0.05, 0));

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = time;
      });

      const result = poseLandmarker.detectForVideo(video, Math.round(time * 1000));
      const pose = result?.landmarks?.[0];
      const mapped = poseToFrame(pose, time);

      if (mapped) {
        frames.push(mapped);
        if (!overlayImage) overlayImage = captureCurrentFrame(video);
      }
    }

    if (!frames.length) {
      throw new Error("No se detectaron landmarks suficientes para analizar el video.");
    }

    const derived = analyzeFromFrames(readiness, frames, durationSeconds);
    return { durationSeconds, overlayImage, ...derived };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildAnalysisRecord(athleteId: string, videoMeta: any, overlayMeta: any, realAnalysis: any): AnalysisRecord {
  return {
    athleteId,
    analyzedAt: new Date().toISOString(),
    score: realAnalysis.score,
    cadence: realAnalysis.cadence,
    diagnostics: realAnalysis.diagnostics,
    engine: "mediapipe_pose_real_v1",
    overlayImage: overlayMeta?.publicUrl || null,
    overlayPublicUrl: overlayMeta?.publicUrl || null,
    overlayStoragePath: overlayMeta?.storagePath || null,
    overlayPoints: realAnalysis.overlayFrames[0]?.points || [],
    overlayFrames: realAnalysis.overlayFrames,
    video: {
      fileName: videoMeta.fileName,
      fileType: videoMeta.fileType,
      fileSizeBytes: videoMeta.fileSizeBytes,
      storagePath: videoMeta.storagePath,
      publicUrl: videoMeta.publicUrl,
    },
    analysis: realAnalysis.analysis,
  };
}

function readLocalHistory(): Record<string, AnalysisRecord[]> {
  if (typeof window === "undefined") return { arielle: [], diego: [], valeria: [] };
  try {
    const raw = window.localStorage.getItem("dizkos_history_product_v3");
    if (!raw) return { arielle: [], diego: [], valeria: [] };
    const parsed = JSON.parse(raw);
    return {
      arielle: Array.isArray(parsed?.arielle) ? parsed.arielle : [],
      diego: Array.isArray(parsed?.diego) ? parsed.diego : [],
      valeria: Array.isArray(parsed?.valeria) ? parsed.valeria : [],
    };
  } catch {
    return { arielle: [], diego: [], valeria: [] };
  }
}

function OverlaySkeleton({ points }: { points: OverlayPoint[] }) {
  if (points.length < 8) return null;

  return (
    <>
      {points.map((dot, index) => (
        <div
          key={index}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
          style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }}
        />
      ))}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={points[0].x * 100} y1={points[0].y * 100} x2={points[1].x * 100} y2={points[1].y * 100} stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
        <line x1={points[2].x * 100} y1={points[2].y * 100} x2={points[3].x * 100} y2={points[3].y * 100} stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
        <line x1={points[0].x * 100} y1={points[0].y * 100} x2={points[2].x * 100} y2={points[2].y * 100} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1={points[1].x * 100} y1={points[1].y * 100} x2={points[3].x * 100} y2={points[3].y * 100} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1={points[2].x * 100} y1={points[2].y * 100} x2={points[4].x * 100} y2={points[4].y * 100} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1={points[3].x * 100} y1={points[3].y * 100} x2={points[5].x * 100} y2={points[5].y * 100} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1={points[4].x * 100} y1={points[4].y * 100} x2={points[6].x * 100} y2={points[6].y * 100} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1={points[5].x * 100} y1={points[5].y * 100} x2={points[7].x * 100} y2={points[7].y * 100} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      </svg>
    </>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-violet-600" />
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoCard({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={`rounded-2xl bg-slate-50 p-4 ${small ? "text-xs" : "text-sm"}`}>
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 break-all text-slate-700">{value}</p>
    </div>
  );
}

export default function DizkosApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [athleteId, setAthleteId] = useState("arielle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [playerSource, setPlayerSource] = useState("");
  const [objectPreviewUrl, setObjectPreviewUrl] = useState("");
  const [currentRecord, setCurrentRecord] = useState<AnalysisRecord | null>(null);
  const [status, setStatus] = useState("Esperando archivo");
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [persistenceMode, setPersistenceMode] = useState("local_cache");
  const [historyByAthlete, setHistoryByAthlete] = useState<Record<string, AnalysisRecord[]>>(() =>
    readLocalHistory()
  );
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [garminData, setGarminData] = useState<GarminData | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestIdRef = useRef(0);

  const athlete = useMemo(() => athletes.find((item) => item.id === athleteId) || athletes[0], [athleteId]);
  const history = useMemo(() => historyByAthlete[athleteId] || [], [historyByAthlete, athleteId]);

  const currentOverlayPoints = useMemo(() => {
    if (!currentRecord) return [];
    const frames = currentRecord.overlayFrames;
    if (!frames?.length) return currentRecord.overlayPoints || [];
    let selected = frames[0];
    for (const frame of frames) {
      if (frame.time <= playhead) selected = frame;
    }
    return selected.points;
  }, [currentRecord, playhead]);

  useEffect(() => {
    window.localStorage.setItem("dizkos_history_product_v3", JSON.stringify(historyByAthlete));
  }, [historyByAthlete]);

  useEffect(() => {
    return () => {
      if (objectPreviewUrl) URL.revokeObjectURL(objectPreviewUrl);
    };
  }, [objectPreviewUrl]);

  useEffect(() => {
    fetchGarminStatus(athleteId).then(setGarminData).catch(() => {});
  }, [athleteId]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let mounted = true;

    fetchHistory(athleteId)
      .then((remote) => {
        if (!mounted || requestId !== requestIdRef.current) return;
        setHistoryByAthlete((prev) => ({ ...prev, [athleteId]: remote }));
        setPersistenceMode("backend");
      })
      .catch(() => {
        if (!mounted || requestId !== requestIdRef.current) return;
        setPersistenceMode("local_cache");
      });

    return () => {
      mounted = false;
    };
  }, [athleteId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setCurrentRecord(null);
    setSelectedHistoryIndex(null);
    setStatus(file ? "Archivo cargado. Listo para subir y analizar." : "Esperando archivo");

    if (objectPreviewUrl) URL.revokeObjectURL(objectPreviewUrl);
    const nextUrl = file ? URL.createObjectURL(file) : "";
    setObjectPreviewUrl(nextUrl);
    setPlayerSource(nextUrl);
    setPlayhead(0);
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setPlayhead(0);
    setIsPlaying(false);
  };

  const handleRunPipeline = async () => {
    if (!selectedFile) return;

    setIsSaving(true);
    setStatus("Subiendo video a backend...");

    try {
      const uploadedVideo = await uploadAsset(selectedFile, athleteId, "video");

      setStatus("Ejecutando análisis real con MediaPipe...");
      const realAnalysis = await runRealPoseAnalysis(selectedFile, garminData?.readiness ?? 60);

      let uploadedOverlay: any = null;
      if (realAnalysis.overlayImage) {
        setStatus("Subiendo overlay real al backend...");
        const overlayBlob = dataUrlToBlob(realAnalysis.overlayImage);
        const overlayFile = new File([overlayBlob], `overlay-${Date.now()}.jpg`, {
          type: overlayBlob.type || "image/jpeg",
        });
        uploadedOverlay = await uploadAsset(overlayFile, athleteId, "overlay");
      }

      setStatus("Persistiendo análisis real...");
      const record = buildAnalysisRecord(athleteId, uploadedVideo, uploadedOverlay, realAnalysis);
      await persistAnalysis(record);

      setCurrentRecord(record);
      setHistoryByAthlete((prev) => ({
        ...prev,
        [athleteId]: [record, ...(prev[athleteId] || [])].slice(0, 12),
      }));
      setPersistenceMode("backend");
      setStatus("Video, overlay y análisis real guardados en backend.");
      setActiveTab("vision");
    } catch (error) {
      console.error(error);
      setPersistenceMode("local_cache");
      setStatus(error instanceof Error ? error.message : "Falló el flujo backend.");
    } finally {
      setIsSaving(false);
    }
  };

  const openHistoryRecord = (record: AnalysisRecord, index: number) => {
    setCurrentRecord(record);
    setSelectedHistoryIndex(index);
    setPlayerSource(record.video?.publicUrl || "");
    setPlayhead(0);
    setActiveTab("vision");
    setStatus("Análisis histórico cargado en pantalla.");
  };

  const clearHistory = async () => {
    setHistoryByAthlete((prev) => ({ ...prev, [athleteId]: [] }));
    setSelectedHistoryIndex(null);

    try {
      await clearHistoryBackend(athleteId);
      setPersistenceMode("backend");
      setStatus("Historial eliminado en backend.");
    } catch {
      setPersistenceMode("local_cache");
      setStatus("Historial limpiado localmente. Backend no disponible.");
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "video", label: "Subir video", icon: Upload },
    { id: "vision", label: "Visión", icon: Gauge },
    { id: "weekly", label: "Semana", icon: CalendarDays },
    { id: "garmin", label: "Garmin", icon: Watch },
    { id: "history", label: "Historial", icon: Database },
  ];

  const premiumWeekly = useMemo(() => {
    const readiness = garminData?.readiness ?? 60;
    const readinessTier = readiness >= 70 ? "progresar" : readiness >= 55 ? "mantener" : "descargar";

    const techniqueFocus =
      currentRecord?.analysis.overstriding === "Alta"
        ? "acortar zancada y mejorar cadencia"
        : currentRecord?.analysis.hipDrop === "Alta"
        ? "estabilidad pélvica y control unilateral"
        : "economía de carrera y postura";

    return [
      `Lunes · movilidad + fuerza específica para ${techniqueFocus}`,
      `Martes · sesión clave orientada a ${athlete.distanceGoal} con objetivo de ${readinessTier}`,
      `Jueves · rodaje técnico con foco en ${techniqueFocus}`,
      `Sábado · bloque principal según meta ${athlete.distanceGoal}`,
    ];
  }, [athlete.distanceGoal, currentRecord, garminData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 p-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-[0.24em] text-violet-600">Dizkos</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Producto integrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Análisis real con MediaPipe, overlay temporal, historial persistente y Garmin conectado por backend opcional.
          </p>

          <label className="mt-5 block rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Atleta activo</p>
            <select
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {athletes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    activeTab === tab.id ? "bg-violet-100 text-violet-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Persistencia</p>
            <p className="mt-1">{persistenceMode === "backend" ? "Backend real activo" : "Caché local / fallback"}</p>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-3xl bg-gradient-to-r from-violet-600 to-emerald-500 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/70">{athlete.name}</p>
            <h2 className="mt-2 text-3xl font-semibold">Corre mejor. Sin dolor. Con inteligencia.</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/90">{athlete.goal}</p>
          </section>

          {activeTab === "dashboard" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Panel title="Resumen del atleta" icon={UserCircle2}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoCard label="Nivel" value={athlete.level} />
                  <InfoCard label="Meta" value={athlete.distanceGoal} />
                  <InfoCard label="Garmin" value={garminData?.deviceLabel || athlete.garminLabel} />
                  <InfoCard label="Historial" value={`${history.length} análisis`} />
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{athlete.weeklyMessage}</div>
              </Panel>

              <Panel title="Estado del producto" icon={Sparkles}>
                <div className="space-y-3">
                  {[
                    selectedFile ? "Archivo cargado" : "Falta cargar archivo",
                    currentRecord ? `Análisis activo: ${currentRecord.score}/100` : "No hay análisis activo",
                    persistenceMode === "backend" ? "Historial remoto conectado" : "Historial remoto no disponible",
                    garminData?.connected ? `Garmin activo (${garminData.deviceLabel})` : "Garmin pendiente",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "video" && (
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Subida y persistencia" icon={Upload}>
                <label className="block rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Video</p>
                  <input type="file" accept="video/*" onChange={handleFileChange} className="mt-2 block w-full text-sm" />
                </label>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">Estado</p>
                  <p className="mt-1">{status}</p>
                </div>

                <button
                  onClick={handleRunPipeline}
                  disabled={!selectedFile || isSaving}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Database className="h-4 w-4" />
                  {isSaving ? "Procesando..." : "Subir video + overlay + guardar análisis"}
                </button>
              </Panel>

              <Panel title="Reproductor con overlay" icon={Video}>
                <div className="overflow-hidden rounded-3xl bg-slate-950">
                  <div className="relative aspect-video w-full bg-black">
                    {playerSource ? (
                      <video
                        ref={videoRef}
                        src={playerSource}
                        controls={false}
                        className="h-full w-full object-contain"
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        Sube un video para previsualizarlo
                      </div>
                    )}
                    {currentOverlayPoints.length ? <OverlaySkeleton points={currentOverlayPoints} /> : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handlePlayPause}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? "Pausar" : "Reproducir"}
                  </button>

                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reiniciar
                  </button>
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "vision" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Panel title="Análisis actual" icon={Gauge}>
                {currentRecord ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoCard label="Score" value={`${currentRecord.score}/100`} />
                    <InfoCard label="Cadencia" value={`${currentRecord.cadence ?? "—"} spm`} />
                    <InfoCard label="Motor" value={currentRecord.engine} />
                    <InfoCard label="Overstride" value={currentRecord.analysis.overstriding} />
                    <InfoCard label="Hip drop" value={currentRecord.analysis.hipDrop} />
                    <InfoCard label="Impacto" value={currentRecord.analysis.impactControl} />
                    <InfoCard label="Tronco" value={currentRecord.analysis.trunkPosition} />
                    <InfoCard label="Calidad video" value={`${Math.round(currentRecord.analysis.videoQualityScore * 100)}%`} />
                    <InfoCard label="Ajuste readiness" value={currentRecord.analysis.readinessAdjustment} />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    Todavía no hay un análisis activo.
                  </div>
                )}
              </Panel>

              <Panel title="Diagnóstico técnico" icon={Brain}>
                <div className="space-y-3">
                  {(currentRecord?.diagnostics.notes || ["Aún no hay diagnósticos disponibles."]).map((note) => (
                    <div key={note} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      {note}
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "weekly" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Panel title="Semana recomendada" icon={CalendarDays}>
                <div className="space-y-3">
                  {premiumWeekly.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Notas de Dizkos" icon={TrendingUp}>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{athlete.weeklyMessage}</div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    {currentRecord?.analysis.readinessAdjustment || "Todavía no hay ajuste de readiness calculado."}
                  </div>
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "garmin" && (
            <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <Panel title="Conexión Garmin" icon={Watch}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoCard label="Estado" value={garminData?.connected ? "Conectado" : "Pendiente"} />
                  <InfoCard label="Dispositivo" value={garminData?.deviceLabel || athlete.garminLabel} />
                  <InfoCard label="Readiness" value={`${garminData?.readiness ?? "—"}`} />
                  <InfoCard label="Body Battery" value={`${garminData?.bodyBattery ?? "—"}`} />
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  Último entreno: {garminData?.recentRun || "Sin datos"}
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {garminData?.lastSyncLabel || "Sin información de sincronización"}
                </div>
              </Panel>

              <Panel title="Cómo impacta al plan" icon={Flag}>
                <div className="space-y-3">
                  {[
                    (garminData?.readiness ?? 0) >= 70
                      ? "La carga semanal puede progresar ligeramente."
                      : (garminData?.readiness ?? 0) >= 55
                      ? "Conviene sostener una carga moderada."
                      : "La prioridad es recuperar y bajar intensidad.",
                    garminData?.connected
                      ? "La app ya tiene un contexto premium del atleta para personalizar el bloque semanal."
                      : "Sin Garmin, Dizkos usa reglas conservadoras y feedback manual.",
                    currentRecord
                      ? `El análisis actual se cruza con una cadencia estimada de ${currentRecord.cadence ?? "—"} spm.`
                      : "Todavía no hay análisis para cruzar con los datos del reloj.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "history" && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-violet-600">Historial</p>
                  <h3 className="mt-1 text-2xl font-semibold">Persistencia por atleta</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Modo actual: {persistenceMode === "backend" ? "Backend real" : "Caché local"}
                  </p>
                </div>

                <button
                  onClick={clearHistory}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Limpiar historial
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {history.length ? (
                  history.map((item, index) => (
                    <button
                      key={`${item.analyzedAt || "record"}-${index}`}
                      onClick={() => openHistoryRecord(item, index)}
                      className={`block w-full rounded-2xl border p-4 text-left ${
                        selectedHistoryIndex === index ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Análisis {index + 1}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Score: {item.score}/100 · Cadencia: {item.cadence ?? "—"} spm
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Motor: {item.engine} ·{" "}
                            {item.analyzedAt ? new Date(item.analyzedAt).toLocaleString() : "sin fecha"}
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          {selectedHistoryIndex === index ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {selectedHistoryIndex === index ? "Activo" : "Abrir"}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    Todavía no hay análisis persistidos para este atleta.
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}