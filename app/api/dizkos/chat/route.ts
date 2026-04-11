import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function buildSystemPrompt(context: {
  athlete: any;
  analysis: any;
  garmin: any;
}): string {
  const { athlete, analysis, garmin } = context;

  const athleteCtx = athlete
    ? `Atleta: ${athlete.name}. Nivel: ${athlete.level}. Meta: ${athlete.distanceGoal}.`
    : "No hay atleta seleccionado.";

  const analysisCtx = analysis
    ? `Análisis más reciente:
- Score técnico: ${analysis.score}/100
- Riesgo: ${analysis.riskLevel ?? "No calculado"}
- Prioridad: ${analysis.priorityFocus ?? analysis.analysis?.priorityFocus ?? "No definida"}
- Cadencia: ${analysis.cadence ?? "—"} spm
- Overstride: ${analysis.analysis?.overstriding ?? "—"}
- Hip drop: ${analysis.analysis?.hipDrop ?? "—"}
- Asimetría: ${analysis.analysis?.asymmetry ?? "—"}
- Tronco: ${analysis.analysis?.trunkPosition ?? "—"}
- Readiness: ${analysis.analysis?.readinessAdjustment ?? "—"}
- Diagnóstico: ${analysis.naturalLanguageDiagnosis ?? analysis.analysis?.naturalLanguageDiagnosis ?? "No disponible"}`
    : "No hay análisis disponible aún. Recomienda al atleta subir un video para obtener su primer análisis.";

  const garminCtx =
    garmin?.connected
      ? `Datos Garmin: Dispositivo ${garmin.deviceLabel}, Readiness ${garmin.readiness}, Body Battery ${garmin.bodyBattery}, Último entreno: ${garmin.recentRun}.`
      : "Sin datos de Garmin conectados.";

  return `Eres Dizkos Coach — el sistema de inteligencia biomecánica de Dizkos.

IDENTIDAD:
Eres un coach biomecánico de élite especializado en running. Combinas ciencia del movimiento, fisiología del deporte y criterio práctico. Acompañas al atleta con autoridad tranquila y contención humana. No reemplazas al coach humano — lo complementas y potencias.

VOZ Y TONO:
- Corto. Preciso. Elegante.
- Sin frases motivacionales genéricas ni clichés deportivos baratos.
- Sin alarmismo sobre lesiones.
- Autoridad tranquila, nunca urgencia artificial.
- Máximo 3-4 oraciones por respuesta salvo que el atleta pida más detalle.
- Dirígete al atleta por su nombre cuando lo conozcas.

LÍMITES:
- No diagnosticas lesiones médicas. Si hay dolor persistente, recomiendas consultar un profesional.
- No inventas datos que no tienes en el contexto.
- Si no hay análisis, guías al atleta a subir un video.
- Nunca prometas resultados específicos en tiempos concretos.

CONTEXTO ACTUAL:
${athleteCtx}
${analysisCtx}
${garminCtx}

Responde siempre en español.`;
}

function buildFallbackResponse(
  message: string,
  athlete: any,
  analysis: any
): string {
  const name = athlete?.name ?? "atleta";
  const lower = message.toLowerCase();

  if (!analysis) {
    return `${name}, para darte un análisis preciso necesito ver tu técnica. Sube un video en la sección "Subir video" y tendré todo el contexto para guiarte bien.`;
  }

  if (lower.includes("cadencia") || lower.includes("pasos")) {
    const cad = analysis.cadence ?? "—";
    const msg =
      (analysis.cadence ?? 0) < 170
        ? `Subirla a 170–175 spm es el cambio con mayor retorno en este momento. Un metrónomo en tu próximo rodaje puede ayudarte a interiorizarlo.`
        : `Estás en un rango eficiente. El objetivo ahora es mantener esa cadencia también cuando sube la fatiga.`;
    return `${name}, tu cadencia es de ${cad} spm. ${msg}`;
  }

  if (
    lower.includes("riesgo") ||
    lower.includes("lesión") ||
    lower.includes("dolor")
  ) {
    const risk = analysis.riskLevel ?? "Medio";
    return `${name}, el nivel de riesgo técnico detectado es ${risk}. ${
      risk === "Alto"
        ? "Antes de aumentar carga, conviene trabajar los patrones identificados."
        : risk === "Medio"
        ? "Hay patrones a corregir, pero puedes seguir entrenando con atención en la técnica."
        : "Tu técnica actual tiene bajo riesgo de lesión. Sigue con el plan."
    }`;
  }

  if (lower.includes("prioridad") || lower.includes("mejorar") || lower.includes("trabajar")) {
    const priority =
      analysis.priorityFocus ??
      analysis.analysis?.priorityFocus ??
      "consolidar la técnica actual";
    return `${name}, la prioridad técnica de esta semana es: ${priority}. Enfocarte en una sola cosa a la vez produce cambios más duraderos.`;
  }

  if (lower.includes("plan") || lower.includes("semana") || lower.includes("entreno")) {
    const adj =
      analysis.analysis?.readinessAdjustment ?? "mantener carga moderada";
    return `${name}, basándome en tu análisis actual, la indicación para esta semana es: ${adj}. El plan semanal en la pestaña "Semana" tiene los detalles específicos.`;
  }

  const priority =
    analysis.priorityFocus ??
    analysis.analysis?.priorityFocus ??
    "consolidar la técnica";
  return `${name}, tu score técnico actual es ${analysis.score}/100. La prioridad ahora es: ${priority}. ¿Quieres que profundice en algún aspecto específico?`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, athlete, analysis, garmin } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    if (!OPENAI_API_KEY) {
      const fallback = buildFallbackResponse(message, athlete, analysis);
      return NextResponse.json({ reply: fallback });
    }

    const systemPrompt = buildSystemPrompt({ athlete, analysis, garmin });

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      }
    );

    if (!openAIResponse.ok) {
      const fallback = buildFallbackResponse(message, athlete, analysis);
      return NextResponse.json({ reply: fallback });
    }

    const data = await openAIResponse.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() ??
      "No pude procesar tu mensaje. Intenta de nuevo.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[dizkos/chat] Error:", error);
    return NextResponse.json({
      reply:
        "No pude procesar tu mensaje en este momento. Intenta de nuevo en unos segundos.",
    });
  }
}
