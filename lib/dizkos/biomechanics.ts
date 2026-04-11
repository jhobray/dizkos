import type {
  FrameLandmarks,
  SimplePoint,
  OverlayFrame,
  OverlayPoint,
  BiomechanicsResult,
  BiomechanicsMetrics,
  MetricBand,
  RiskLevel,
} from "./types";
import type { Athlete } from "./athletes";

// ─── Utilidades ───────────────────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function avgPoint(a: SimplePoint, b: SimplePoint): SimplePoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: (a.visibility + b.visibility) / 2,
  };
}

function band(v: number, low: number, high: number): MetricBand {
  if (v >= high) return "Alta";
  if (v >= low) return "Media";
  return "Baja";
}

// ─── Cadencia real por ciclos de tobillo ──────────────────────────────────────

function detectRealCadence(
  frames: FrameLandmarks[],
  durationSeconds: number
): number {
  const fallback = clamp(
    Math.round(
      (Math.max(8, Math.round(durationSeconds * 2.8)) /
        Math.max(durationSeconds, 1)) *
        60
    ),
    150,
    186
  );

  if (frames.length < 4) return fallback;

  const ankleYSeries = frames.map((f) => f.rightAnkle.y);

  // Suavizado de ventana 3
  const smoothed = ankleYSeries.map((v, i) => {
    const prev = ankleYSeries[Math.max(0, i - 1)];
    const next = ankleYSeries[Math.min(ankleYSeries.length - 1, i + 1)];
    return (prev + v + next) / 3;
  });

  // Mediana como threshold
  const sorted = [...smoothed].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Cruces descendentes = pasos del pie derecho
  // MediaPipe: Y crece hacia abajo → tobillo sube = Y baja = cruza mediana descendiendo
  let steps = 0;
  for (let i = 1; i < smoothed.length; i++) {
    if (smoothed[i - 1] >= median && smoothed[i] < median) {
      steps++;
    }
  }

  const cadence = Math.round(
    (steps * 2 * 60) / Math.max(durationSeconds, 1)
  );

  if (cadence < 100 || cadence > 220) return fallback;
  return clamp(cadence, 140, 210);
}

// ─── Overstride real ──────────────────────────────────────────────────────────

function detectOverstride(frames: FrameLandmarks[]): {
  magnitude: number;
  band: MetricBand;
} {
  const ratios = frames.map((f) => {
    const shoulderY = avgPoint(f.leftShoulder, f.rightShoulder).y;
    const ankleY = (f.leftAnkle.y + f.rightAnkle.y) / 2;
    const bodyHeight = Math.max(Math.abs(ankleY - shoulderY), 0.01);

    const lFwd = Math.max(0, f.leftAnkle.x - f.leftHip.x) / bodyHeight;
    const rFwd = Math.max(0, f.rightAnkle.x - f.rightHip.x) / bodyHeight;
    const lBwd = Math.max(0, f.leftHip.x - f.leftAnkle.x) / bodyHeight;
    const rBwd = Math.max(0, f.rightHip.x - f.rightAnkle.x) / bodyHeight;

    return Math.max(lFwd, rFwd, lBwd, rBwd);
  });

  const magnitude = mean(ratios);
  return {
    magnitude: Number(magnitude.toFixed(3)),
    band: band(magnitude, 0.08, 0.15),
  };
}

// ─── Hip Drop real ────────────────────────────────────────────────────────────

function detectHipDrop(frames: FrameLandmarks[]): {
  magnitude: number;
  band: MetricBand;
} {
  const drops = frames.map((f) => {
    const hipWidth = Math.max(Math.abs(f.leftHip.x - f.rightHip.x), 0.01);
    const vertDiff = Math.abs(f.leftHip.y - f.rightHip.y);
    return (Math.atan2(vertDiff, hipWidth) * 180) / Math.PI;
  });

  const magnitude = mean(drops);
  return {
    magnitude: Number(magnitude.toFixed(2)),
    band: band(magnitude, 3.5, 7.0),
  };
}

// ─── Asimetría ────────────────────────────────────────────────────────────────

function detectAsymmetry(frames: FrameLandmarks[]): {
  percent: number;
  band: MetricBand;
} {
  const left = mean(frames.map((f) => Math.abs(f.leftAnkle.x - f.leftHip.x)));
  const right = mean(
    frames.map((f) => Math.abs(f.rightAnkle.x - f.rightHip.x))
  );
  const avg = (left + right) / 2;
  const percent = avg > 0 ? (Math.abs(left - right) / avg) * 100 : 0;

  return {
    percent: Number(percent.toFixed(1)),
    band: band(percent, 6, 11),
  };
}

// ─── Tronco ───────────────────────────────────────────────────────────────────

function detectTrunkPosition(frames: FrameLandmarks[]): {
  angleDeg: number;
  label: string;
} {
  const angles = frames.map((f) => {
    const sc = avgPoint(f.leftShoulder, f.rightShoulder);
    const hc = avgPoint(f.leftHip, f.rightHip);
    const dx = sc.x - hc.x;
    const dy = hc.y - sc.y;
    return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
  });

  const angleDeg = mean(angles);
  const label =
    angleDeg > 15
      ? "Inestabilidad lateral"
      : angleDeg > 8
      ? "Leve inclinación"
      : angleDeg >= 3
      ? "Estable"
      : "Demasiado vertical";

  return { angleDeg: Number(angleDeg.toFixed(1)), label };
}

// ─── Control de impacto ───────────────────────────────────────────────────────

function detectImpactControl(
  frames: FrameLandmarks[],
  overstrideBand: MetricBand,
  cadence: number
): MetricBand {
  const hipVerticals = frames.map(
    (f) => avgPoint(f.leftHip, f.rightHip).y
  );
  const vertVar =
    Math.max(...hipVerticals) - Math.min(...hipVerticals);

  const ovPenalty =
    overstrideBand === "Alta" ? 0.04 : overstrideBand === "Media" ? 0.02 : 0;
  const cadPenalty = cadence < 160 ? 0.03 : cadence < 170 ? 0.01 : 0;

  return band(vertVar + ovPenalty + cadPenalty, 0.04, 0.08);
}

// ─── Prioridad ────────────────────────────────────────────────────────────────

function getPriorityFocus(
  metrics: BiomechanicsMetrics,
  athleteLevel: string
): string {
  if (athleteLevel === "Principiante" && metrics.cadenceLow)
    return "Aumentar cadencia a 170–175 spm";
  if (metrics.overstriding === "Alta")
    return "Reducir overstride — acortar zancada";
  if (metrics.hipDrop === "Alta")
    return "Estabilidad pélvica — fortalecer glúteo medio";
  if (metrics.asymmetry === "Alta")
    return "Corregir asimetría — investigar compensación";
  if (metrics.cadenceLow)
    return "Aumentar cadencia a 170–175 spm";
  if (metrics.overstriding === "Media")
    return "Optimizar aterrizaje — zancada más corta";
  if (metrics.trunkPosition === "Inestabilidad lateral")
    return "Estabilizar tronco — core y postura";
  return "Mantener y consolidar técnica actual";
}

// ─── Riesgo ───────────────────────────────────────────────────────────────────

function getRiskLevel(metrics: BiomechanicsMetrics): RiskLevel {
  const high = [
    metrics.overstriding === "Alta",
    metrics.hipDrop === "Alta",
    metrics.asymmetry === "Alta",
    metrics.impactControl === "Alta",
  ].filter(Boolean).length;

  const medium = [
    metrics.overstriding === "Media",
    metrics.hipDrop === "Media",
    metrics.asymmetry === "Media",
    metrics.cadenceLow,
  ].filter(Boolean).length;

  if (high >= 2 || (high === 1 && medium >= 2)) return "Alto";
  if (high === 1 || medium >= 2) return "Medio";
  return "Bajo";
}

// ─── Diagnóstico en lenguaje natural ─────────────────────────────────────────

function buildNaturalDiagnosis(
  metrics: BiomechanicsMetrics,
  cadence: number,
  riskLevel: RiskLevel,
  readiness: number,
  athleteLevel: string
): string {
  const parts: string[] = [];

  if (metrics.overstriding === "Alta") {
    parts.push(
      "Tu pie aterriza adelante de tu centro de masa en la mayoría de las zancadas. Esto frena el impulso y aumenta la carga en rodilla y tibia. El cambio más efectivo ahora es acortar la zancada y subir la cadencia."
    );
  } else if (metrics.overstriding === "Media") {
    parts.push(
      "Hay un leve aterrizaje adelantado. No es crítico, pero corregirlo mejoraría la eficiencia y reduciría el desgaste articular a largo plazo."
    );
  } else {
    parts.push(
      "El aterrizaje es eficiente. El pie cae cerca del centro de masa."
    );
  }

  if (cadence < 160) {
    parts.push(
      `Cadencia de ${cadence} spm — significativamente baja. Subirla a 170–175 spm reduciría el impacto articular y mejoraría la economía de carrera sin cambiar la velocidad.`
    );
  } else if (cadence < 170) {
    parts.push(
      `Cadencia de ${cadence} spm. Hay margen para subir a 170–175 spm y ganar eficiencia.`
    );
  } else {
    parts.push(`Cadencia de ${cadence} spm — en rango óptimo.`);
  }

  if (metrics.hipDrop === "Alta") {
    parts.push(
      "Se detecta caída de cadera considerable. Suele indicar debilidad del glúteo medio y genera sobrecargas en cadena. Priorizar fuerza unilateral antes de aumentar volumen."
    );
  } else if (metrics.hipDrop === "Media") {
    parts.push(
      "Caída de cadera leve. Ejercicios de estabilidad pélvica preventivos serían beneficiosos."
    );
  }

  if (readiness < 55) {
    parts.push(
      "Con readiness bajo, hoy no es el día para empujar. La recuperación activa tiene más valor que cualquier sesión de calidad."
    );
  } else if (readiness >= 70) {
    parts.push("El cuerpo está en condiciones de progresar esta semana.");
  }

  if (riskLevel === "Alto") {
    parts.push(
      "Riesgo técnico alto. Antes de aumentar carga, conviene trabajar los patrones detectados."
    );
  } else if (riskLevel === "Bajo" && athleteLevel !== "Principiante") {
    parts.push(
      "Técnica sólida. El foco ahora puede estar en eficiencia y especificidad para la meta."
    );
  }

  return parts.join(" ");
}

// ─── Frame a overlay ──────────────────────────────────────────────────────────

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

// ─── Función principal ────────────────────────────────────────────────────────

export function analyzeFromFrames(
  frames: FrameLandmarks[],
  durationSeconds: number,
  readiness: number,
  athlete: Athlete
): BiomechanicsResult {
  const overlayFrames: OverlayFrame[] = frames.map((f) => ({
    time: f.time,
    points: frameToOverlayPoints(f),
  }));

  const allPoints = frames.flatMap((f) => [
    f.leftShoulder, f.rightShoulder,
    f.leftHip, f.rightHip,
    f.leftKnee, f.rightKnee,
    f.leftAnkle, f.rightAnkle,
  ]);
  const avgConfidence = mean(allPoints.map((p) => p.visibility));

  const shoulderSpread = mean(
    frames.map((f) => Math.abs(f.leftShoulder.x - f.rightShoulder.x))
  );
  const hipSpread = mean(
    frames.map((f) => Math.abs(f.leftHip.x - f.rightHip.x))
  );
  const validLateralView = (shoulderSpread + hipSpread) / 2 < 0.22;

  const fullBodyVisible =
    frames.filter((f) => {
      const pts = [
        f.leftShoulder, f.rightShoulder,
        f.leftHip, f.rightHip,
        f.leftKnee, f.rightKnee,
        f.leftAnkle, f.rightAnkle,
      ];
      return pts.every((p) => p.visibility > 0.45 && p.y >= 0 && p.y <= 1);
    }).length /
      Math.max(frames.length, 1) >=
    0.75;

  const hipCenters = frames.map((f) => avgPoint(f.leftHip, f.rightHip));
  const movementDetected =
    Math.max(...hipCenters.map((p) => p.x)) -
      Math.min(...hipCenters.map((p) => p.x)) >
    0.04;

  const safeReadiness =
    typeof readiness === "number" && isFinite(readiness) ? readiness : 60;

  const cadence = detectRealCadence(frames, durationSeconds);
  const overstride = detectOverstride(frames);
  const hipDrop = detectHipDrop(frames);
  const asymmetry = detectAsymmetry(frames);
  const trunk = detectTrunkPosition(frames);
  const impactControl = detectImpactControl(frames, overstride.band, cadence);

  const metrics: BiomechanicsMetrics = {
    cadenceRaw: cadence,
    overstrideMagnitude: overstride.magnitude,
    hipDropMagnitude: hipDrop.magnitude,
    asymmetryPercent: asymmetry.percent,
    trunkAngleDeg: trunk.angleDeg,
    overstriding: overstride.band,
    hipDrop: hipDrop.band,
    asymmetry: asymmetry.band,
    impactControl,
    trunkPosition: trunk.label,
    cadenceLow: cadence < 170,
  };

  const penalty =
    (overstride.band === "Alta" ? 12 : overstride.band === "Media" ? 6 : 0) +
    (hipDrop.band === "Alta" ? 10 : hipDrop.band === "Media" ? 4 : 0) +
    (asymmetry.band === "Alta" ? 8 : asymmetry.band === "Media" ? 3 : 0) +
    (impactControl === "Alta" ? 8 : impactControl === "Media" ? 3 : 0) +
    (cadence < 160 ? 6 : cadence < 170 ? 3 : 0) +
    (trunk.label === "Inestabilidad lateral" ? 5 : 0);

  const readinessBonus =
    safeReadiness >= 70 ? 3 : safeReadiness >= 55 ? 0 : -3;
  const technicalScore = clamp(
    Math.round(100 - penalty + readinessBonus),
    45,
    97
  );

  const riskLevel = getRiskLevel(metrics);
  const priorityFocus = getPriorityFocus(metrics, athlete.level);

  const readinessAdjustment =
    safeReadiness >= 70
      ? "Condiciones para progresar esta semana"
      : safeReadiness >= 55
      ? "Mantener carga moderada"
      : "Reducir intensidad — priorizar recuperación";

  const naturalLanguageDiagnosis = buildNaturalDiagnosis(
    metrics,
    cadence,
    riskLevel,
    safeReadiness,
    athlete.level
  );

  const diagnosticNotes = [
    validLateralView
      ? "Vista lateral válida para el análisis."
      : "Vista no completamente lateral — regrabar más de perfil mejora la precisión.",
    fullBodyVisible
      ? "Cuerpo completo visible durante el video."
      : "El cuerpo no se mantiene completo en todos los frames.",
    avgConfidence >= 0.6
      ? `Confianza de detección suficiente (${Math.round(avgConfidence * 100)}%).`
      : "Confianza de detección baja — mejorar iluminación o calidad de video.",
    movementDetected
      ? "Desplazamiento horizontal detectado correctamente."
      : "Desplazamiento limitado — asegurarse de correr durante el video.",
    readinessAdjustment,
  ];

  return {
    technicalScore,
    riskLevel,
    priorityFocus,
    cadence,
    metrics,
    naturalLanguageDiagnosis,
    videoQualityScore: Number(
      clamp(avgConfidence + 0.05, 0.65, 0.98).toFixed(2)
    ),
    readinessAdjustment,
    overlayFrames,
    diagnosticNotes,
    averagePoseConfidence: Number(avgConfidence.toFixed(2)),
    validLateralView,
    movementDetected,
    fullBodyVisible,
  };
}
