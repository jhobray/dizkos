import { NextRequest, NextResponse } from "next/server";

const fallback: Record<string, any> = {
  arielle: {
    connected: true,
    deviceLabel: "Forerunner 265",
    readiness: 74,
    bodyBattery: 63,
    recentRun: "7.2 km · 5:41/km",
    lastSyncLabel: "Demo local / fallback",
  },
  diego: {
    connected: true,
    deviceLabel: "Forerunner 965",
    readiness: 68,
    bodyBattery: 57,
    recentRun: "10.5 km · 4:22/km",
    lastSyncLabel: "Demo local / fallback",
  },
  valeria: {
    connected: false,
    deviceLabel: "No conectado",
    readiness: 52,
    bodyBattery: 49,
    recentRun: "4.0 km · 6:35/km",
    lastSyncLabel: "Sin conexión Garmin",
  },
};

export async function GET(request: NextRequest) {
  const athleteId = request.nextUrl.searchParams.get("athleteId") || "arielle";
  return NextResponse.json(fallback[athleteId] ?? fallback.arielle);
}