// ─── Tipos centrales de Dizkos ────────────────────────────────────────────────

export type AthleteLevel = "Principiante" | "Intermedio" | "Avanzado";

export type RiskLevel = "Bajo" | "Medio" | "Alto";

export type MetricBand = "Baja" | "Media" | "Alta";

export type TabId =
  | "dashboard"
  | "video"
  | "vision"
  | "weekly"
  | "garmin"
  | "history";

export type OverlayPoint = { x: number; y: number };

export type OverlayFrame = { time: number; points: OverlayPoint[] };

export type SimplePoint = { x: number; y: number; visibility: number };

export type FrameLandmarks = {
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

export type BiomechanicsMetrics = {
  cadenceRaw: number;
  overstrideMagnitude: number;
  hipDropMagnitude: number;
  asymmetryPercent: number;
  trunkAngleDeg: number;
  overstriding: MetricBand;
  hipDrop: MetricBand;
  asymmetry: MetricBand;
  impactControl: MetricBand;
  trunkPosition: string;
  cadenceLow: boolean;
};

export type BiomechanicsResult = {
  technicalScore: number;
  riskLevel: RiskLevel;
  priorityFocus: string;
  cadence: number;
  metrics: BiomechanicsMetrics;
  naturalLanguageDiagnosis: string;
  videoQualityScore: number;
  readinessAdjustment: string;
  overlayFrames: OverlayFrame[];
  diagnosticNotes: string[];
  averagePoseConfidence: number;
  validLateralView: boolean;
  movementDetected: boolean;
  fullBodyVisible: boolean;
};

export type AnalysisRecord = {
  athleteId: string;
  analyzedAt?: string;
  score: number;
  cadence: number | null;
  riskLevel?: RiskLevel;
  priorityFocus?: string;
  naturalLanguageDiagnosis?: string;
  diagnostics: {
    detectedFrames: number;
    sampledFrames: number;
    averagePoseConfidence: number;
    validLateralView: boolean;
    movementDetected: boolean;
    fullBodyVisible: boolean;
    notes: string[];
  };
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
    overstrideMagnitude?: number;
    hipDropMagnitude?: number;
    asymmetryPercent?: number;
    trunkAngleDeg?: number;
    riskLevel?: RiskLevel;
    priorityFocus?: string;
    naturalLanguageDiagnosis?: string;
  };
};

export type GarminData = {
  connected: boolean;
  deviceLabel: string;
  readiness: number;
  bodyBattery: number;
  recentRun: string;
  lastSyncLabel: string;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
  timestamp?: number;
};
