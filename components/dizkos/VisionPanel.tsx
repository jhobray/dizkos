"use client";

import React from "react";
import type { AnalysisRecord, RiskLevel } from "@/lib/dizkos/types";

type Props = {
  record: AnalysisRecord | null;
};

function riskColor(level: RiskLevel | undefined) {
  if (level === "Alto") return "text-red-600 bg-red-50 ring-red-200";
  if (level === "Medio") return "text-amber-600 bg-amber-50 ring-amber-200";
  return "text-emerald-600 bg-emerald-50 ring-emerald-200";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 65) return "text-amber-600";
  return "text-red-500";
}

function MetricRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  const isHigh = value === "Alta";
  const isMed = value === "Media";
  const dot = isHigh
    ? "bg-red-400"
    : isMed
    ? "bg-amber-400"
    : "bg-emerald-400";

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-slate-700">{value}</span>
      </div>
    </div>
  );
}

export function VisionPanel({ record }: Props) {
  if (!record) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 flex flex-col items-center justify-center min-h-[320px] text-center">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🎥</span>
        </div>
        <p className="text-base font-semibold text-slate-700">
          Sin análisis activo
        </p>
        <p className="mt-1 text-sm text-slate-400 max-w-xs">
          Sube un video de carrera para obtener tu diagnóstico biomecánico
          completo.
        </p>
      </section>
    );
  }

  const risk = record.riskLevel ?? record.analysis?.riskLevel;
  const priority =
    record.priorityFocus ?? record.analysis?.priorityFocus;
  const diagnosis =
    record.naturalLanguageDiagnosis ??
    record.analysis?.naturalLanguageDiagnosis;

  return (
    <div className="space-y-4">
      {/* Score + Riesgo + Prioridad */}
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-3 gap-4">
          {/* Score */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-5">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
              Score
            </p>
            <p className={`text-4xl font-bold ${scoreColor(record.score)}`}>
              {record.score}
            </p>
            <p className="text-xs text-slate-400 mt-1">/ 100</p>
          </div>

          {/* Riesgo */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-5">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
              Riesgo
            </p>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ring-1 ${riskColor(risk)}`}
            >
              {risk ?? "—"}
            </span>
          </div>

          {/* Cadencia */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-5">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
              Cadencia
            </p>
            <p className="text-4xl font-bold text-slate-800">
              {record.cadence ?? "—"}
            </p>
            <p className="text-xs text-slate-400 mt-1">spm</p>
          </div>
        </div>

        {/* Prioridad */}
        {priority && (
          <div className="mt-4 rounded-2xl bg-violet-50 px-5 py-3 ring-1 ring-violet-100 flex items-start gap-3">
            <span className="mt-0.5 text-violet-500 text-base">⚡</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-400 mb-0.5">
                Prioridad esta semana
              </p>
              <p className="text-sm font-semibold text-violet-800">
                {priority}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Métricas detalladas */}
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
          Métricas biomecánicas
        </p>
        <MetricRow
          label="Overstride"
          value={record.analysis.overstriding}
          note="Aterrizaje adelantado del pie"
        />
        <MetricRow
          label="Hip Drop"
          value={record.analysis.hipDrop}
          note="Caída de cadera en apoyo"
        />
        <MetricRow
          label="Asimetría"
          value={record.analysis.asymmetry}
          note="Diferencia entre pierna izq. y der."
        />
        <MetricRow
          label="Control de impacto"
          value={record.analysis.impactControl}
          note="Amortiguación estimada"
        />
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Tronco</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Posición del torso
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {record.analysis.trunkPosition}
          </span>
        </div>
      </section>

      {/* Diagnóstico natural */}
      {diagnosis && (
        <section className="rounded-3xl bg-slate-900 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">
            Diagnóstico Dizkos
          </p>
          <p className="text-sm text-slate-200 leading-relaxed">{diagnosis}</p>
          <p className="mt-3 text-xs text-slate-500">
            Motor: {record.engine} ·{" "}
            {record.analyzedAt
              ? new Date(record.analyzedAt).toLocaleString("es", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "sin fecha"}
          </p>
        </section>
      )}
    </div>
  );
}
