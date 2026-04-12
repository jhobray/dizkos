import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TIMEOUT_MS = 30000;

// ---- Contextual System Prompt Builder ----
function buildSystemPrompt(context: {
    athlete: any;
    analysis: any;
    garmin: any;
    sessionHistory: any[];
}): string {
    const { athlete, analysis, garmin, sessionHistory } = context;

  const athleteCtx = athlete
      ? `Atleta: ${athlete.name}. Nivel: ${athlete.category}. Especialidad: ${athlete.specialty}. Edad: ${athlete.age || "no especificada"}.`
        : "No hay atleta seleccionado.";

  const analysisCtx = analysis
      ? `Ultimo analisis biomecanico:
      - Score tecnico: ${analysis.technicalScore}/100
      - Riesgo: ${analysis.riskLevel}
      - Foco prioritario: ${analysis.priorityFocus}
      - Cadencia: ${analysis.cadence || "N/A"}
      - Overstriding: ${analysis.overstriding ? "detectado" : "normal"}
      - Hip drop: ${analysis.hipDrop ? "detectado" : "normal"}
      - Asimetria: ${analysis.asymmetry ? "presente" : "balanceado"}
      - Control de impacto: ${analysis.impactControl ? "deficiente" : "bueno"}
      - Posicion tronco: ${analysis.trunkPosition ? "inclinado" : "correcto"}
      - Diagnostico: ${analysis.naturalLanguageDiagnosis || "N/A"}`
        : "No hay analisis reciente.";

  const garminCtx = garmin?.connected
      ? `Datos Garmin:
      - Dispositivo: ${garmin.deviceLabel}
      - Training Readiness: ${garmin.readiness}/100
      - Body Battery: ${garmin.bodyBattery}/100
      - Ultima carrera: ${garmin.recentRun?.distanceKm || "N/A"} km a ${garmin.recentRun?.paceMinKm || "N/A"} min/km
      - FC promedio: ${garmin.recentRun?.heartRateAvg || "N/A"} bpm
      - Cadencia carrera: ${garmin.recentRun?.cadenceAvg || "N/A"} spm`
        : "Garmin no conectado.";

  const historyCtx = sessionHistory?.length > 0
      ? `Historial de conversacion reciente: ${sessionHistory.length} mensajes previos.`
        : "";

  return `Eres el Coach AI de Dizkos, una plataforma premium de analisis biomecanico de running. 
  Tu rol es ser un coach de running experto en biomecanica, prevencion de lesiones y optimizacion del rendimiento.

  CONTEXTO DEL ATLETA:
  ${athleteCtx}

  DATOS DE ANALISIS:
  ${analysisCtx}

  DATOS FISIOLOGICOS:
  ${garminCtx}

  ${historyCtx}

  DIRECTRICES:
  - Responde siempre en espanol
  - Se conciso pero profundo (2-4 parrafos maximo)
  - Usa datos especificos del analisis y Garmin cuando esten disponibles
  - Prioriza la prevencion de lesiones
  - Da recomendaciones practicas y accionables
  - Cuando hables de metricas, contextualiza que significan para el atleta
  - Si no tienes suficiente contexto, pide mas informacion
  - Mantene un tono profesional pero cercano, como un coach personal`;
}

// ---- POST: Chat with AI Coach ----
export async function POST(request: NextRequest) {
    // Check for API key before processing
  if (!OPENAI_API_KEY) {
        return NextResponse.json({
                response: "El Coach AI no esta disponible en este momento. La clave de OpenAI no esta configurada. Contacta al administrador.",
                error: "OPENAI_API_KEY not configured"
        }, { status: 200 }); // Return 200 with fallback message instead of 500
  }

  try {
        const body = await request.json();
        const { message, athlete, analysis, garmin, history: chatHistory } = body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
              return NextResponse.json({ error: "message is required" }, { status: 400 });
      }

      const systemPrompt = buildSystemPrompt({
              athlete, analysis, garmin, sessionHistory: chatHistory || []
      });

      // Build messages array
      const messages: any[] = [
        { role: "system", content: systemPrompt }
            ];

      // Add chat history for context
      if (chatHistory && Array.isArray(chatHistory)) {
              for (const msg of chatHistory.slice(-6)) {
                        messages.push({
                                    role: msg.role === "user" ? "user" : "assistant",
                                    content: msg.text || msg.content || ""
                        });
              }
      }

      messages.push({ role: "user", content: message.trim() });

      // Call OpenAI with timeout
      const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

      try {
              const res = await fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                        },
                        body: JSON.stringify({
                                    model: "gpt-4o-mini",
                                    messages,
                                    max_tokens: 800,
                                    temperature: 0.7,
                        }),
                        signal: controller.signal,
              });

          clearTimeout(timeoutId);

          if (!res.ok) {
                    const errBody = await res.text().catch(() => "");
                    console.error("[chat/POST] OpenAI error:", res.status, errBody);

                if (res.status === 429) {
                            return NextResponse.json({
                                          response: "El Coach AI esta temporalmente ocupado. Intenta de nuevo en unos segundos.",
                                          error: "rate_limited"
                            }, { status: 200 });
                }

                return NextResponse.json({
                            response: "Error al comunicarse con el Coach AI. Intenta de nuevo.",
                            error: `OpenAI returned ${res.status}`
                }, { status: 200 });
          }

          const data = await res.json();
              const reply = data.choices?.[0]?.message?.content || "Sin respuesta del coach.";

          return NextResponse.json({ response: reply });
      } catch (fetchErr: any) {
              clearTimeout(timeoutId);
              if (fetchErr.name === "AbortError") {
                        return NextResponse.json({
                                    response: "El Coach AI tardo demasiado en responder. Intenta con una pregunta mas corta.",
                                    error: "timeout"
                        }, { status: 200 });
              }
              throw fetchErr;
      }
  } catch (err: any) {
        console.error("[chat/POST]", err);
        return NextResponse.json({
                response: "Error interno del servidor. Intenta de nuevo.",
                error: err.message || "Internal server error"
        }, { status: 200 }); // Return 200 with error message for graceful degradation
  }
}
