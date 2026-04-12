import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

// ---- GET: Fetch analysis history for an athlete ----
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
              records: (data ?? []).map((row: any) => ({
                        athleteId: row.athlete_id,
                        analyzedAt: row.analyzed_at,
                        score: row.score,
                        cadence: row.cadence,
                        engine: row.engine,
                        technicalScore: row.technical_score,
                        riskScore: row.risk_score,
                        riskLevel: row.risk_level,
                        priorityFocus: row.priority_focus,
                        naturalLanguageDiagnosis: row.natural_language_diagnosis,
                        readinessAdjustment: row.readiness_adjustment,
                        coachCues: row.coach_cues,
                        notes: row.notes,
                        diagnostics: row.diagnostics_json,
                        analysis: row.analysis_json,
              })),
      });
    } catch (err: any) {
          console.error("[analysis/GET]", err);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// ---- POST: Save a new analysis record ----
export async function POST(request: NextRequest) {
    try {
          const body = await request.json();

      // Validate required fields
      if (!body.athlete_id) {
              return NextResponse.json({ error: "athlete_id is required" }, { status: 400 });
      }

      const supabase = createSupabaseAdminClient();

      // Insert record with all fields (aligned with migration 002)
      const { data, error } = await supabase
            .from("analysis_records")
            .insert({
                      athlete_id: body.athlete_id,
                      analyzed_at: body.analyzed_at || new Date().toISOString(),
                      score: body.score ?? body.technical_score ?? 0,
                      cadence: body.cadence ?? null,
                      engine: body.engine || "dizkos-biomechanics-v2",
                      diagnostics_json: body.diagnostics_json || {},
                      analysis_json: body.analysis_json || {},
                      // New columns from migration 002
                      technical_score: body.technical_score ?? body.score ?? null,
                      risk_score: body.risk_score ?? null,
                      risk_level: body.risk_level || "moderate",
                      priority_focus: body.priority_focus || null,
                      natural_language_diagnosis: body.natural_language_diagnosis || null,
                      readiness_adjustment: body.readiness_adjustment || null,
                      coach_cues: body.coach_cues || null,
                      notes: body.notes || null,
                      // Video/overlay fields (if provided)
                      video_file_name: body.video_file_name || null,
                      video_file_type: body.video_file_type || null,
                      video_file_size_bytes: body.video_file_size_bytes || null,
                      video_storage_path: body.video_storage_path || null,
                      video_public_url: body.video_public_url || null,
                      overlay_image: body.overlay_image || null,
                      overlay_points_json: body.overlay_points_json || [],
                      overlay_frames_json: body.overlay_frames_json || [],
                      overlay_storage_path: body.overlay_storage_path || null,
                      overlay_public_url: body.overlay_public_url || null,
            })
            .select()
            .single();

      if (error) {
              console.error("[analysis/POST] Supabase insert error:", error);
              return NextResponse.json(
                { error: error.message, hint: error.hint || "Check that migration 002 has been applied" },
                { status: 500 }
                      );
      }

      return NextResponse.json({ success: true, record: data }, { status: 201 });
    } catch (err: any) {
          console.error("[analysis/POST]", err);
          return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
                );
    }
}
