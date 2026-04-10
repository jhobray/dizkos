import { z } from "zod";

export const uploadAssetTypeSchema = z.enum(["video", "overlay"]);

export const overlayPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const overlayFrameSchema = z.object({
  time: z.number(),
  points: z.array(overlayPointSchema),
});

export const analysisRecordSchema = z.object({
  athleteId: z.string().min(1),
  analyzedAt: z.string().optional(),
  score: z.number().int(),
  cadence: z.number().int().nullable(),
  diagnostics: z.record(z.any()),
  engine: z.string().min(1),
  overlayImage: z.string().nullable().optional(),
  overlayPoints: z.array(overlayPointSchema).optional(),
  overlayFrames: z.array(overlayFrameSchema).optional(),
  overlayStoragePath: z.string().nullable().optional(),
  overlayPublicUrl: z.string().nullable().optional(),
  video: z.object({
    fileName: z.string().nullable().optional(),
    fileType: z.string().nullable().optional(),
    fileSizeBytes: z.number().nullable().optional(),
    storagePath: z.string().nullable().optional(),
    publicUrl: z.string().nullable().optional(),
  }).optional(),
  analysis: z.object({
    technicalScore: z.number().int(),
    overstriding: z.string(),
    hipDrop: z.string(),
    cadence: z.number().int().nullable(),
    cadenceLow: z.boolean(),
    asymmetry: z.string(),
    impactControl: z.string(),
    trunkPosition: z.string(),
    videoQualityScore: z.number(),
    readinessAdjustment: z.string(),
    viewMode: z.string(),
  }),
});