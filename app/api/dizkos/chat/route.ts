import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── SISTEMA DE PROMPT ADAPTATIVO ────────────────────────────

function buildSystemPrompt(context: {
  athlete: any;
  analysis: any;
  garmin: any;
  sessionHistory: any[];
  isLiveCoach?: boolean;
  athleteFeelings?: string;
}): string {
  const { athlete, analysis, garmin, sessionHistory, isLiveCoach, athleteFeelings } = context;

  const athleteCtx = athlete
    ? `Atleta: ${athlete.name}. Nivel: ${athlete.level}. Meta: ${athlete.distanceGoal}km. Experiencia: ${athlete.yearsRunning ?? "no especificada"} años.`
    : "No hay atleta seleccionado.";

  const analysisCtx = analysis
    ? `
Último análisis biomecánico:
- Score técnico: ${analysis.technicalScore}/100
- Riesgo: ${analysis.riskLevel} (${analysis.riskScore}/100)
- Prioridad de esta semana: ${analysis.priorityFocus}
- Cadencia: ${analysis.cadence} spm
- Overstride: ${analysis.metrics?.overstride ?? analysis.analysis?.overstride ?? "—"}
- Hip drop: ${analysis.metrics?.hipDrop ?? analysis.analysis?.hipDrop ?? "—"}
- Asimetría: ${analysis.metrics?.asymmetry ?? analysis.analysis?.asymmetry ?? "—"}
- Tronco: ${analysis.metrics?.trunkPosition ?? analysis.analysis?.trunkPosition ?? "—"}
- Patrón de impacto: ${analysis.metrics?.impactControl ?? "—"}
- Diagnóstico: ${analysis.naturalLanguageDiagnosis ?? "—"}
- Readiness adjustment: ${analysis.readinessAdjustment ?? 0}`
    : "Sin análisis biomecánico reciente.";

  const garminCtx = garmin
    ? `
Datos Garmin recientes:
- HRV: ${garmin.hrv ?? "—"}
- Frecuencia cardíaca en reposo: ${garmin.restingHR ?? "—"}
- Sueño: ${garmin.sleep ?? "—"} horas
- Body Battery: ${garmin.bodyBattery ?? "—"}
- Carga semanal: ${garmin.weeklyLoad ?? "—"}
- Readiness Garmin: ${garmin.readiness ?? "—"}`
    : "Sin datos Garmin.";

  const historyCtx = sessionHistory?.length
    ? `
Historial de sesiones recientes (últimas ${Math.min(sessionHistory.length, 5)}):
${sessionHistory.slice(-5).map((s: any, i: number) =>
  `  Sesión ${i + 1}: Score ${s.technicalScore ?? "—"}/100, Riesgo ${s.riskLevel ?? "—"}, Foco: ${s.priorityFocus ?? "—"}`
).join("\n")}`
    : "";

  const feelingsCtx = athleteFeelings
    ? `\nEl atleta dice hoy: "${athleteFeelings}"`
    : "";

  const liveModeCtx = isLiveCoach
    ? `\n⚡ MODO COACH EN VIVO ACTIVO: Respuestas muy cortas (1-2 frases), directas, motivadoras. El atleta está corriendo ahora mismo. Usa lenguaje imperativo positivo.`
    : "";

  const basePersonality = isLiveCoach
    ? `Eres Dizkos, el coach de running más avanzado del mundo. ESTÁS EN SESIÓN EN VIVO con el atleta. Responde SOLO con cues cortos, directos y energéticos. Máximo 2 frases. Sin explicaciones largas.`
    : `Eres Dizkos, el coach de running más inteligente del mercado. Combinas biomecánica de élite, fisiología del deporte y psicología del rendimiento. Tu característica más importante: NO das respuestas genéricas. Cada respuesta debe referenciar los datos reales del atleta. Si el atleta menciona molestias o dolor, SIEMPRE prioriza eso sobre cualquier otro objetivo. Adaptas el entrenamiento según el estado real del atleta hoy.`;

  return `${basePersonality}

CONTEXTO DEL ATLETA:
${athleteCtx}

DATOS BIOMECÁNICOS:
${analysisCtx}

DATOS FISIOLÓGICOS:
${garminCtx}
${historyCtx}
${feelingsCtx}
${liveModeCtx}

REGLAS DE RESPUESTA:
1. Nunca inventes datos. Si no tienes información, dilo y pide que analice.
2. Si el atleta menciona dolor, fatiga extrema o molestias, modifica el plan hacia recuperación.
3. Siempre conecta tus recomendaciones con los datos reales del score y las métricas.
4. Responde en español natural, como un coach humano experto.
5. Cuando des un ejercicio o corrección, explica el PORQUÉ con los datos del atleta.
6. Si el historial muestra progreso, reconócelo. Si muestra estancamiento, dilo con honestidad.`;
}

// ─── HANDLER ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      athlete,
      analysis,
      garmin,
      sessionHistory,
      isLiveCoach,
      athleteFeelings,
    } = body;

    if (!messages?.length) {
      return NextResponse.json({ error: "messages requerido" }, { status: 400 });
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key no configurada" }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt({
      athlete,
      analysis,
      garmin,
      sessionHistory: sessionHistory ?? [],
      isLiveCoach: isLiveCoach ?? false,
      athleteFeelings,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: isLiveCoach ? 120 : 600,
        temperature: isLiveCoach ? 0.6 : 0.75,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      }),
    });


    if (!response.ok) {
      return NextResponse.json(
        { error: `Error de OpenAI: ${response.status}` },
        { status: response.status }
      );
    }

    const json = await response.json();
    const message = json.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ message });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
