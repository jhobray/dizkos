import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

// ─── GET: Obtener historial de análisis ───────────────────────

export async function GET(request: NextRequest) {
  try {
    const athleteId = request.nextUrl.searchParams.get("athleteId");
    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("analysis_records")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("analyzed_at", { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      records: (data ?? []).map((row) => ({
        athleteId: row.athlete_id,
        analyzedAt: row.analyzed_at,
        // Scores técnicos nuevos
        technicalScore: row.technical_score,
        riskScore: row.risk_score,
        riskLevel: row.risk_level,
        priorityFocus: row.priority_focus,
        naturalLanguageDiagnosis: row.natural_language_diagnosis,
        // Métricas biomecánicas
        cadence: row.cadence,
        analysis: row.analysis_json,
        // Legado
        score: row.score,
        notes: row.notes,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST: Guardar nuevo análisis ─────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      athleteId,
      technicalScore,
      riskScore,
      riskLevel,
      priorityFocus,
      naturalLanguageDiagnosis,
      cadence,
      readinessAdjustment,
      metrics,
      coachCues,
      // Legado
      score,
      notes,
    } = body;

    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("analysis_records")
      .insert([
        {
          athlete_id: athleteId,
          analyzed_at: new Date().toISOString(),
          // Nuevos campos
          technical_score: technicalScore ?? null,
          risk_score: riskScore ?? null,
          risk_level: riskLevel ?? null,
          priority_focus: priorityFocus ?? null,
          natural_language_diagnosis: naturalLanguageDiagnosis ?? null,
          cadence: cadence ?? null,
          readiness_adjustment: readinessAdjustment ?? 0,
          analysis_json: metrics ?? null,
          coach_cues: coachCues ?? [],
          // Legado
          score: score ?? technicalScore ?? null,
          notes: notes ?? naturalLanguageDiagnosis ?? null,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (err) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
