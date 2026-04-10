import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { analysisRecordSchema } from "../../../../lib/validation/dizkos";

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
        score: row.score,
        cadence: row.cadence,
        diagnostics: row.diagnostics_json,
        engine: row.engine,
        overlayImage: row.overlay_image,
        overlayPoints: row.overlay_points_json ?? [],
        overlayFrames: row.overlay_frames_json ?? [],
        overlayStoragePath: row.overlay_storage_path,
        overlayPublicUrl: row.overlay_public_url,
        video: {
          fileName: row.video_file_name,
          fileType: row.video_file_type,
          fileSizeBytes: row.video_file_size_bytes,
          storagePath: row.video_storage_path,
          publicUrl: row.video_public_url,
        },
        analysis: row.analysis_json,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = analysisRecordSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const supabase = createSupabaseAdminClient();

    const payload = {
      athlete_id: body.athleteId,
      analyzed_at: body.analyzedAt ?? new Date().toISOString(),
      score: body.score,
      cadence: body.cadence,
      engine: body.engine,
      diagnostics_json: body.diagnostics,
      analysis_json: body.analysis,
      overlay_image: body.overlayImage ?? null,
      overlay_points_json: body.overlayPoints ?? [],
      overlay_frames_json: body.overlayFrames ?? [],
      overlay_storage_path: body.overlayStoragePath ?? null,
      overlay_public_url: body.overlayPublicUrl ?? null,
      video_file_name: body.video?.fileName ?? null,
      video_file_type: body.video?.fileType ?? null,
      video_file_size_bytes: body.video?.fileSizeBytes ?? null,
      video_storage_path: body.video?.storagePath ?? null,
      video_public_url: body.video?.publicUrl ?? null,
    };

    const { data, error } = await supabase
      .from("analysis_records")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const athleteId = request.nextUrl.searchParams.get("athleteId");
    if (!athleteId) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: rows, error: readError } = await supabase
      .from("analysis_records")
      .select("video_storage_path, overlay_storage_path")
      .eq("athlete_id", athleteId);

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const videoPaths = (rows ?? []).map((r) => r.video_storage_path).filter(Boolean);
    const overlayPaths = (rows ?? []).map((r) => r.overlay_storage_path).filter(Boolean);

    if (videoPaths.length) {
      const { error } = await supabase.storage.from("dizkos-videos").remove(videoPaths);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (overlayPaths.length) {
      const { error } = await supabase.storage.from("dizkos-overlays").remove(overlayPaths);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error } = await supabase.from("analysis_records").delete().eq("athlete_id", athleteId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}