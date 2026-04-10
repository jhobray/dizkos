create extension if not exists pgcrypto;

create table if not exists public.analysis_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null,
  analyzed_at timestamptz not null default now(),
  score integer not null,
  cadence integer,
  engine text not null,
  diagnostics_json jsonb not null default '{}'::jsonb,
  analysis_json jsonb not null default '{}'::jsonb,
  overlay_image text,
  overlay_points_json jsonb not null default '[]'::jsonb,
  overlay_frames_json jsonb not null default '[]'::jsonb,
  overlay_storage_path text,
  overlay_public_url text,
  video_file_name text,
  video_file_type text,
  video_file_size_bytes bigint,
  video_storage_path text,
  video_public_url text,
  created_at timestamptz not null default now()
);

create index if not exists analysis_records_athlete_id_idx
  on public.analysis_records (athlete_id, analyzed_at desc);

insert into storage.buckets (id, name, public)
values ('dizkos-videos', 'dizkos-videos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dizkos-overlays', 'dizkos-overlays', false)
on conflict (id) do nothing;