import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { uploadAssetTypeSchema } from "../../../../lib/validation/dizkos";

const BUCKETS = {
  video: "dizkos-videos",
  overlay: "dizkos-overlays",
} as const;

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const athleteId = formData.get("athleteId");
    const rawAssetType = formData.get("assetType");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (typeof athleteId !== "string" || !athleteId.trim()) {
      return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
    }

    const parsedAssetType = uploadAssetTypeSchema.safeParse(rawAssetType);
    if (!parsedAssetType.success) {
      return NextResponse.json({ error: "Invalid assetType" }, { status: 400 });
    }

    const assetType = parsedAssetType.data;
    const supabase = createSupabaseAdminClient();

    const ext = (file.name.split(".").pop() || (assetType === "video" ? "mp4" : "jpg")).toLowerCase();
    const storagePath = `${sanitize(athleteId)}/${assetType}s/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKETS[assetType])
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKETS[assetType])
      .createSignedUrl(storagePath, 60 * 60 * 24);

    if (signedError) {
      return NextResponse.json({ error: signedError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      assetType,
      bucket: BUCKETS[assetType],
      storagePath,
      publicUrl: signedData.signedUrl,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected upload error" },
      { status: 500 }
    );
  }
}