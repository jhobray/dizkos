// ============================================================
// DIZKOS — Motor Biomecánico v2.0
// El motor de análisis de running más avanzado del mercado
// ============================================================

import type { FrameLandmarks, SimplePoint } from "./types";

// ─── TIPOS ───────────────────────────────────────────────────

export type MetricBand = "Bajo" | "Media" | "Alta";
export type RiskLevel = "Bajo" | "Medio" | "Alto" | "Crítico";

export interface OverstrideResult {
  value: number;          // ratio 0–1 (horizontal ankle-hip / height)
  label: "Eficiente" | "Moderado" | "Severo";
  risk: "Bajo" | "Medio" | "Alto";
}

export interface HipDropResult {
  value: number;          // diferencia normalizada
  label: "Estable" | "Leve" | "Moderado" | "Severo";
  side: "izquierdo" | "derecho" | "simétrico";
}

export interface AsymmetryResult {
  value: number;          // 0–1 porcentaje diferencia
  label: "Mínima" | "Leve" | "Significativa" | "Severa";
}

export interface TrunkResult {
  angleDeg: number;
  label: "Vertical" | "Inclinado adelante" | "Inclinado atrás" | "Flexión excesiva";
}

export interface ImpactResult {
  pattern: "Talón" | "Mediopié" | "Antepié" | "Indeterminado";
  risk: "Bajo" | "Medio" | "Alto";
  label: string;
}

export interface BiomechanicsMetrics {
  cadence: number;
  overstride: OverstrideResult;
  hipDrop: HipDropResult;
  asymmetry: AsymmetryResult;
  trunkPosition: TrunkResult;
  impactControl: ImpactResult;
}

export interface BiomechanicsResult {
  technicalScore: number;          // 0–100
  riskLevel: RiskLevel;
  riskScore: number;               // 0–100
  priorityFocus: string;
  cadence: number;
  metrics: BiomechanicsMetrics;
  naturalLanguageDiagnosis: string;
  readinessAdjustment: number;     // -1 a +1 ajuste de carga
  coachCues: string[];             // frases para modo coach en vivo
}

// ─── UTILIDADES ──────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function smoothSeries(values: number[], windowSize = 5): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(values.length, start + windowSize);
    return mean(values.slice(start, end));
  });
}

function detectPeaks(series: number[]): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    if (series[i] > series[i - 1] && series[i] > series[i + 1]) {
      peaks.push(i);
    }
  }
  return peaks;
}

function detectValleys(series: number[]): number[] {
  const valleys: number[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    if (series[i] < series[i - 1] && series[i] < series[i + 1]) {
      valleys.push(i);
    }
  }
  return valleys;
}

function estimateBodyHeight(frames: FrameLandmarks[]): number {
  if (!frames.length) return 1;
  // Distancia promedio cabeza–tobillo como proxy de altura
  const heights = frames.map(f => {
    if (!f.leftAnkle || !f.nose) return 0;
    return Math.abs(f.nose.y - f.leftAnkle.y);
  }).filter(h => h > 0);
  return mean(heights) || 1;
}

// ─── 1. CADENCIA REAL ─────────────────────────────────────────

export function analyzeCadence(
  frames: FrameLandmarks[],
  durationSeconds: number
): number {
  if (frames.length < 10 || durationSeconds <= 0) return 0;

  // Extraer serie Y del tobillo derecho (baja = contacto suelo)
  const rawSeries = frames.map(f => f.rightAnkle?.y ?? 0);
  const smoothed = smoothSeries(rawSeries, 7);

  // Detectar valles (momentos de contacto con el suelo)
  const valleys = detectValleys(smoothed);

  // Filtrar valles muy cercanos (ruido) — mínimo 10 frames entre pasos
  const filteredValleys: number[] = [];
  for (const v of valleys) {
    if (!filteredValleys.length || v - filteredValleys[filteredValleys.length - 1] > 10) {
      filteredValleys.push(v);
    }
  }

  // Calcular ciclos (2 pasos = 1 ciclo de zancada)
  const steps = filteredValleys.length;
  const cycles = steps / 2;

  // Cadencia = ciclos por minuto
  const cadence = Math.round((cycles * 60) / durationSeconds);

  return clamp(cadence, 100, 220);
}

// ─── 2. OVERSTRIDE REAL ───────────────────────────────────────

export function analyzeOverstride(
  frames: FrameLandmarks[],
  bodyHeight: number
): OverstrideResult {
  if (!frames.length || bodyHeight <= 0) {
    return { value: 0, label: "Eficiente", risk: "Bajo" };
  }

  // Encontrar frames de contacto (tobillo en punto más bajo local)
  const ankleY = frames.map(f => f.rightAnkle?.y ?? 0);
  const smoothed = smoothSeries(ankleY, 5);
  const contactFrames = detectValleys(smoothed);

  if (!contactFrames.length) {
    return { value: 0, label: "Eficiente", risk: "Bajo" };
  }

  // En cada contacto, medir distancia horizontal tobillo–cadera
  const ratios = contactFrames.map(idx => {
    const frame = frames[idx];
    if (!frame?.rightAnkle || !frame?.rightHip) return 0;
    const horizontalDist = frame.rightAnkle.x - frame.rightHip.x;
    return Math.abs(horizontalDist) / bodyHeight;
  }).filter(r => r > 0);

  const avgRatio = mean(ratios);

  let label: OverstrideResult["label"];
  let risk: OverstrideResult["risk"];

  if (avgRatio < 0.08) {
    label = "Eficiente"; risk = "Bajo";
  } else if (avgRatio < 0.15) {
    label = "Moderado"; risk = "Medio";
  } else {
    label = "Severo"; risk = "Alto";
  }

  return { value: parseFloat(avgRatio.toFixed(3)), label, risk };
}

// ─── 3. HIP DROP REAL ─────────────────────────────────────────

export function analyzeHipDrop(frames: FrameLandmarks[], bodyHeight: number): HipDropResult {
  if (!frames.length || bodyHeight <= 0) {
    return { value: 0, label: "Estable", side: "simétrico" };
  }

  // Calcular diferencia entre cadera izquierda y derecha en cada frame
  const drops = frames.map(f => {
    const lh = f.leftHip?.y ?? null;
    const rh = f.rightHip?.y ?? null;
    if (lh === null || rh === null) return null;
    return { diff: lh - rh, frame: f };
  }).filter((d): d is { diff: number; frame: FrameLandmarks } => d !== null);

  if (!drops.length) return { value: 0, label: "Estable", side: "simétrico" };

  // Separar fases de apoyo unilateral (cuando un tobillo está más bajo)
  const leftSupport = drops.filter(d => (d.frame.leftAnkle?.y ?? 0) > (d.frame.rightAnkle?.y ?? 0));
  const rightSupport = drops.filter(d => (d.frame.rightAnkle?.y ?? 0) > (d.frame.leftAnkle?.y ?? 0));

  const leftDrop = leftSupport.length ? Math.abs(mean(leftSupport.map(d => d.diff))) : 0;
  const rightDrop = rightSupport.length ? Math.abs(mean(rightSupport.map(d => d.diff))) : 0;

  const maxDrop = Math.max(leftDrop, rightDrop);
  const normalizedDrop = maxDrop / bodyHeight;

  let label: HipDropResult["label"];
  if (normalizedDrop < 0.02) label = "Estable";
  else if (normalizedDrop < 0.05) label = "Leve";
  else if (normalizedDrop < 0.09) label = "Moderado";
  else label = "Severo";

  const side: HipDropResult["side"] =
    Math.abs(leftDrop - rightDrop) < 0.01 ? "simétrico"
    : leftDrop > rightDrop ? "izquierdo"
    : "derecho";

  return { value: parseFloat(normalizedDrop.toFixed(3)), label, side };
}

// ─── 4. ASIMETRÍA REAL ────────────────────────────────────────

export function analyzeAsymmetry(frames: FrameLandmarks[]): AsymmetryResult {
  if (frames.length < 20) return { value: 0, label: "Mínima" };

  // Comparar amplitud de movimiento tobillo izquierdo vs derecho
  const leftY = frames.map(f => f.leftAnkle?.y ?? 0);
  const rightY = frames.map(f => f.rightAnkle?.y ?? 0);

  const leftAmp = Math.max(...leftY) - Math.min(...leftY);
  const rightAmp = Math.max(...rightY) - Math.min(...rightY);

  const avgAmp = (leftAmp + rightAmp) / 2;
  if (avgAmp === 0) return { value: 0, label: "Mínima" };

  const asymmetryRatio = Math.abs(leftAmp - rightAmp) / avgAmp;

  // Comparar también ciclos de tiempo entre izquierdo y derecho
  const leftPeaks = detectPeaks(smoothSeries(leftY)).length;
  const rightPeaks = detectPeaks(smoothSeries(rightY)).length;
  const peakAsymmetry = leftPeaks && rightPeaks
    ? Math.abs(leftPeaks - rightPeaks) / Math.max(leftPeaks, rightPeaks)
    : 0;

  const combinedAsymmetry = (asymmetryRatio + peakAsymmetry) / 2;

  let label: AsymmetryResult["label"];
  if (combinedAsymmetry < 0.05) label = "Mínima";
  else if (combinedAsymmetry < 0.10) label = "Leve";
  else if (combinedAsymmetry < 0.18) label = "Significativa";
  else label = "Severa";

  return { value: parseFloat(combinedAsymmetry.toFixed(3)), label };
}

// ─── 5. TRONCO REAL ───────────────────────────────────────────

export function analyzeTrunkPosition(frames: FrameLandmarks[]): TrunkResult {
  if (!frames.length) return { angleDeg: 0, label: "Vertical" };

  const angles = frames.map(f => {
    const ls = f.leftShoulder;
    const rs = f.rightShoulder;
    const lh = f.leftHip;
    const rh = f.rightHip;
    if (!ls || !rs || !lh || !rh) return null;

    // Centro de hombros y caderas
    const shoulderCenterX = (ls.x + rs.x) / 2;
    const shoulderCenterY = (ls.y + rs.y) / 2;
    const hipCenterX = (lh.x + rh.x) / 2;
    const hipCenterY = (lh.y + rh.y) / 2;

    // Ángulo respecto a la vertical
    const dx = shoulderCenterX - hipCenterX;
    const dy = shoulderCenterY - hipCenterY;
    return Math.atan2(dx, Math.abs(dy)) * (180 / Math.PI);
  }).filter((a): a is number => a !== null);

  if (!angles.length) return { angleDeg: 0, label: "Vertical" };

  const avgAngle = mean(angles);

  let label: TrunkResult["label"];
  if (Math.abs(avgAngle) < 5) label = "Vertical";
  else if (avgAngle > 0 && avgAngle < 15) label = "Inclinado adelante";
  else if (avgAngle < 0) label = "Inclinado atrás";
  else label = "Flexión excesiva";

  return { angleDeg: parseFloat(avgAngle.toFixed(1)), label };
}

// ─── 6. CONTROL DE IMPACTO ────────────────────────────────────

export function analyzeImpactControl(
  frames: FrameLandmarks[],
  overstride: OverstrideResult,
  cadence: number
): ImpactResult {
  if (!frames.length) {
    return { pattern: "Indeterminado", risk: "Medio", label: "Sin datos suficientes" };
  }

  // Aproximar patrón por posición del tobillo vs rodilla en contacto
  const ankleY = frames.map(f => f.rightAnkle?.y ?? 0);
  const kneeY = frames.map(f => f.rightKnee?.y ?? 0);
  const smoothedAnkle = smoothSeries(ankleY, 5);
  const contactFrames = detectValleys(smoothedAnkle).slice(0, 10);

  if (!contactFrames.length) {
    return { pattern: "Indeterminado", risk: "Medio", label: "No se detectaron contactos claros" };
  }

  // En frames de contacto, si rodilla está considerablemente más adelante = talón
  const kneeAheadRatios = contactFrames.map(idx => {
    const f = frames[idx];
    if (!f?.rightKnee || !f?.rightAnkle) return 0;
    return (f.rightKnee.x - f.rightAnkle.x); // positivo = rodilla adelante del tobillo
  });

  const avgKneeAhead = mean(kneeAheadRatios);

  let pattern: ImpactResult["pattern"];
  if (avgKneeAhead > 0.05) pattern = "Talón";
  else if (avgKneeAhead > -0.02) pattern = "Mediopié";
  else pattern = "Antepié";

  // Riesgo combinado: patrón + overstride + cadencia
  let riskScore = 0;
  if (pattern === "Talón") riskScore += 3;
  else if (pattern === "Mediopié") riskScore += 1;
  if (overstride.risk === "Alto") riskScore += 3;
  else if (overstride.risk === "Medio") riskScore += 1;
  if (cadence < 160) riskScore += 2;
  else if (cadence < 170) riskScore += 1;

  const risk: ImpactResult["risk"] = riskScore >= 5 ? "Alto" : riskScore >= 3 ? "Medio" : "Bajo";

  const labels: Record<string, string> = {
    "Talón-Alto": "Aterrizaje de talón con overstride — carga alta en rodilla",
    "Talón-Medio": "Aterrizaje de talón — mejorable",
    "Talón-Bajo": "Talón con buena cadencia — aceptable",
    "Mediopié-Alto": "Mediopié con zancada larga — revisar cadencia",
    "Mediopié-Medio": "Mediopié — patrón funcional",
    "Mediopié-Bajo": "Mediopié eficiente",
    "Antepié-Alto": "Antepié con overstride — poco frecuente, revisar",
    "Antepié-Medio": "Antepié con esfuerzo en gemelos",
    "Antepié-Bajo": "Antepié — patrón eficiente",
  };

  const label = labels[`${pattern}-${risk}`] ?? `${pattern} — riesgo ${risk}`;

  return { pattern, risk, label };
}

// ─── 7. PRIORIDAD ÚNICA ───────────────────────────────────────

export function getPriorityFocus(metrics: BiomechanicsMetrics, cadence: number): string {
  // Orden de prioridad clínica: primero lo que más lesiona
  if (metrics.overstride.label === "Severo") return "Reducir overstride urgente";
  if (metrics.hipDrop.label === "Severo") return "Estabilizar cadera";
  if (metrics.asymmetry.label === "Severa") return "Corregir asimetría";
  if (cadence < 155) return "Aumentar cadencia";
  if (metrics.overstride.label === "Moderado") return "Acortar la zancada";
  if (metrics.hipDrop.label === "Moderado") return "Fortalecer glúteo medio";
  if (metrics.asymmetry.label === "Significativa") return "Igualar impulso bilateral";
  if (metrics.trunkPosition.label === "Flexión excesiva") return "Corregir postura de tronco";
  if (metrics.impactControl.risk === "Alto") return "Mejorar patrón de aterrizaje";
  if (cadence < 165) return "Optimizar cadencia";
  return "Mantener y consolidar técnica";
}

// ─── 8. SCORING TÉCNICO ───────────────────────────────────────

export function calculateTechnicalScore(metrics: BiomechanicsMetrics, cadence: number): number {
  let score = 100;

  // Cadencia (peso: 20 puntos)
  if (cadence < 150) score -= 20;
  else if (cadence < 160) score -= 12;
  else if (cadence < 165) score -= 6;
  else if (cadence > 185) score -= 5;

  // Overstride (peso: 25 puntos)
  if (metrics.overstride.label === "Severo") score -= 25;
  else if (metrics.overstride.label === "Moderado") score -= 12;

  // Hip Drop (peso: 20 puntos)
  if (metrics.hipDrop.label === "Severo") score -= 20;
  else if (metrics.hipDrop.label === "Moderado") score -= 10;
  else if (metrics.hipDrop.label === "Leve") score -= 4;

  // Asimetría (peso: 15 puntos)
  if (metrics.asymmetry.label === "Severa") score -= 15;
  else if (metrics.asymmetry.label === "Significativa") score -= 8;
  else if (metrics.asymmetry.label === "Leve") score -= 3;

  // Tronco (peso: 10 puntos)
  if (metrics.trunkPosition.label === "Flexión excesiva") score -= 10;
  else if (metrics.trunkPosition.label === "Inclinado atrás") score -= 6;

  // Impacto (peso: 10 puntos)
  if (metrics.impactControl.risk === "Alto") score -= 10;
  else if (metrics.impactControl.risk === "Medio") score -= 4;

  return clamp(Math.round(score), 0, 100);
}

export function calculateRiskScore(metrics: BiomechanicsMetrics, cadence: number): number {
  let risk = 0;

  if (metrics.overstride.label === "Severo") risk += 35;
  else if (metrics.overstride.label === "Moderado") risk += 18;

  if (metrics.hipDrop.label === "Severo") risk += 25;
  else if (metrics.hipDrop.label === "Moderado") risk += 12;

  if (metrics.asymmetry.label === "Severa") risk += 20;
  else if (metrics.asymmetry.label === "Significativa") risk += 10;

  if (cadence < 155) risk += 15;
  else if (cadence < 165) risk += 5;

  if (metrics.impactControl.risk === "Alto") risk += 15;
  else if (metrics.impactControl.risk === "Medio") risk += 6;

  return clamp(Math.round(risk), 0, 100);
}

export function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 70) return "Crítico";
  if (riskScore >= 45) return "Alto";
  if (riskScore >= 20) return "Medio";
  return "Bajo";
}

// ─── 9. DIAGNÓSTICO EN LENGUAJE NATURAL ──────────────────────

export function generateNaturalDiagnosis(
  metrics: BiomechanicsMetrics,
  cadence: number,
  technicalScore: number,
  priorityFocus: string,
  athleteName?: string
): string {
  const name = athleteName ? `${athleteName}, ` : "";
  const greet = name ? `${name}` : "";

  // Diagnóstico personalizado según el patrón dominante
  if (metrics.overstride.label === "Severo") {
    return `${greet}tu patrón principal de riesgo hoy es el aterrizaje adelantado. Cada zancada genera un freno y una carga extra en rodilla y tibia. Acortar la zancada y subir cadencia a ${Math.max(cadence + 10, 170)} spm sería el cambio más impactante esta semana.`;
  }

  if (metrics.hipDrop.label === "Severo") {
    const side = metrics.hipDrop.side !== "simétrico" ? `del lado ${metrics.hipDrop.side}` : "bilateral";
    return `${greet}tienes una caída de cadera ${side} significativa. Esto indica que el glúteo medio no está activado suficientemente. Antes de aumentar volumen, fortalecer esta zona reducirá el riesgo de lesión en IT band y cadera.`;
  }

  if (metrics.asymmetry.label === "Severa") {
    return `${greet}tu patrón de carrera muestra una asimetría importante entre pierna izquierda y derecha. Esto puede indicar una lesión compensada o debilidad unilateral. Recomiendo reducir carga y revisar con fisioterapeuta antes de continuar.`;
  }

  if (cadence < 160) {
    return `${greet}tu cadencia de ${cadence} spm está por debajo del rango óptimo. Aumentar cadencia es el cambio técnico con mayor retorno: reduce el impacto, acorta la zancada y mejora la economía de carrera automáticamente.`;
  }

  if (metrics.impactControl.risk === "Alto") {
    return `${greet}tu patrón de ${metrics.impactControl.pattern.toLowerCase()} combinado con la zancada actual genera carga articular alta. Trabajar en aterrizaje bajo el centro de masa mejoraría el score técnico de ${technicalScore} a más de 80.`;
  }

  if (technicalScore >= 80) {
    return `${greet}tu técnica está en un nivel muy bueno (${technicalScore}/100). La prioridad ahora es consolidar: ${priorityFocus}. Mantén la consistencia y enfócate en no perder forma cuando aumenta la fatiga.`;
  }

  return `${greet}tu técnica actual marca ${technicalScore}/100. El área de mayor impacto para mejorar esta semana es: ${priorityFocus}. Pequeños ajustes en esta dirección producirán mejoras medibles en tu próxima sesión.`;
}

// ─── 10. CUES PARA MODO COACH EN VIVO ─────────────────────────

export function generateLiveCoachCues(metrics: BiomechanicsMetrics, cadence: number): string[] {
  const cues: string[] = [];

  if (metrics.overstride.label !== "Eficiente") {
    cues.push("Aterriza bajo tu cadera, no delante de ti");
    cues.push("Piensa en 'rueda de bicicleta' — el pie cae debajo del cuerpo");
  }

  if (cadence < 165) {
    cues.push(`Sube el ritmo de pasos — busca ${Math.min(cadence + 8, 172)} spm`);
    cues.push("Pasos más cortos y rápidos, no más largos");
  }

  if (metrics.hipDrop.label !== "Estable") {
    cues.push("Activa el glúteo en cada apoyo — empuja el suelo hacia atrás");
    cues.push("Mantén la cadera nivelada, no la dejes caer al lado");
  }

  if (metrics.trunkPosition.label === "Flexión excesiva") {
    cues.push("Levanta el pecho, no te encorves");
    cues.push("Imagina que un hilo te jala hacia arriba desde la coronilla");
  }

  if (metrics.asymmetry.label !== "Mínima") {
    cues.push("Iguala el impulso de ambos brazos");
    cues.push("Siente que ambas piernas empujan igual");
  }

  if (!cues.length) {
    cues.push("¡Técnica excelente! Mantén este patrón");
    cues.push("Relaja hombros y manos");
    cues.push("Respira con el ritmo de zancada");
  }

  return cues;
}

// ─── 11. FUNCIÓN PRINCIPAL DE ANÁLISIS ───────────────────────

export function analyzeBiomechanics(
  frames: FrameLandmarks[],
  durationSeconds: number,
  athleteName?: string
): BiomechanicsResult {
  if (!frames || frames.length < 15) {
    return createEmptyResult();
  }

  const bodyHeight = estimateBodyHeight(frames);
  const cadence = analyzeCadence(frames, durationSeconds);
  const overstride = analyzeOverstride(frames, bodyHeight);
  const hipDrop = analyzeHipDrop(frames, bodyHeight);
  const asymmetry = analyzeAsymmetry(frames);
  const trunkPosition = analyzeTrunkPosition(frames);
  const impactControl = analyzeImpactControl(frames, overstride, cadence);

  const metrics: BiomechanicsMetrics = {
    cadence,
    overstride,
    hipDrop,
    asymmetry,
    trunkPosition,
    impactControl,
  };

  const technicalScore = calculateTechnicalScore(metrics, cadence);
  const riskScore = calculateRiskScore(metrics, cadence);
  const riskLevel = getRiskLevel(riskScore);
  const priorityFocus = getPriorityFocus(metrics, cadence);
  const naturalLanguageDiagnosis = generateNaturalDiagnosis(
    metrics, cadence, technicalScore, priorityFocus, athleteName
  );
  const coachCues = generateLiveCoachCues(metrics, cadence);

  // Ajuste de readiness según riesgo
  const readinessAdjustment = riskScore >= 60 ? -0.3 : riskScore >= 35 ? -0.1 : 0;

  return {
    technicalScore,
    riskLevel,
    riskScore,
    priorityFocus,
    cadence,
    metrics,
    naturalLanguageDiagnosis,
    readinessAdjustment,
    coachCues,
  };
}

function createEmptyResult(): BiomechanicsResult {
  return {
    technicalScore: 0,
    riskLevel: "Bajo",
    riskScore: 0,
    priorityFocus: "Capturar más frames para análisis",
    cadence: 0,
    metrics: {
      cadence: 0,
      overstride: { value: 0, label: "Eficiente", risk: "Bajo" },
      hipDrop: { value: 0, label: "Estable", side: "simétrico" },
      asymmetry: { value: 0, label: "Mínima" },
      trunkPosition: { angleDeg: 0, label: "Vertical" },
      impactControl: { pattern: "Indeterminado", risk: "Bajo", label: "Sin datos" },
    },
    naturalLanguageDiagnosis: "Necesito más datos para darte un diagnóstico preciso. Graba al menos 10 segundos corriendo.",
    readinessAdjustment: 0,
    coachCues: ["Graba más tiempo para que pueda verte bien"],
  };
}
