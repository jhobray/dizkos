import type { AthleteLevel } from "./types";

export type Athlete = {
  id: string;
  name: string;
  level: AthleteLevel;
  goal: string;
  distanceGoal: string;
  weeklyMessage: string;
  garminLabel: string;
};

export const ATHLETES: Athlete[] = [
  {
    id: "arielle",
    name: "Arielle",
    level: "Intermedio",
    goal: "Correr mejor, sin dolor y con una base técnica más sólida.",
    distanceGoal: "21K",
    weeklyMessage:
      "Semana orientada a estabilidad pélvica, técnica y rodaje controlado.",
    garminLabel: "Forerunner 265",
  },
  {
    id: "diego",
    name: "Diego",
    level: "Avanzado",
    goal: "Preparación específica para maratón con mejor economía de carrera.",
    distanceGoal: "42K",
    weeklyMessage:
      "Semana con trabajo de calidad y ajuste fino de técnica bajo carga.",
    garminLabel: "Forerunner 965",
  },
  {
    id: "valeria",
    name: "Valeria",
    level: "Principiante",
    goal: "Construir confianza, mejorar mecánica y disfrutar correr 10K.",
    distanceGoal: "10K",
    weeklyMessage:
      "Semana suave con foco en cadencia, postura y fuerza básica.",
    garminLabel: "No conectado",
  },
];
