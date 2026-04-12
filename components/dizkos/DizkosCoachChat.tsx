"use client";

import React, { useEffect, useRef, useState } from "react";
import type { AnalysisRecord, ChatMessage, GarminData } from "@/lib/dizkos/types";
import type { Athlete } from "@/lib/dizkos/athletes";

type Props = {
  athlete: Athlete;
  analysis: AnalysisRecord | null;
  garmin: GarminData | null;
};

export function DizkosCoachChat({ athlete, analysis, garmin }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text, timestamp: Date.now() },
    ]);
    setInput("");
    setIsThinking(true);

    try {
      const res = await fetch("/api/dizkos/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.role === "ai" ? "assistant" : m.role,
              content: m.text,
            })),
            { role: "user", content: text },
          ],
          athlete,
          analysis,
          garmin,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: data.message ?? "Sin respuesta.",
          timestamp: Date.now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "No pude conectarme. Intenta de nuevo en unos segundos.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <section className="flex flex-col rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-emerald-500">
          <span className="text-sm font-bold text-white">D</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Dizkos Coach</p>
          <p className="text-xs text-slate-400">Inteligencia biomecánica</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-400">En línea</span>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-[220px] max-h-[320px]">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400 text-center leading-relaxed max-w-xs">
              Pregúntame sobre tu técnica, tu plan de semana, tu cadencia o tu recuperación.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "ai" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-emerald-500 mr-2 mt-0.5">
                <span className="text-xs font-bold text-white">D</span>
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-br-sm"
                  : "bg-slate-50 text-slate-700 rounded-bl-sm ring-1 ring-slate-100"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-emerald-500 mr-2 mt-0.5">
              <span className="text-xs font-bold text-white">D</span>
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <div className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-slate-100">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Pregúntale a Dizkos sobre ${athlete.name}...`}
            disabled={isThinking}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent disabled:opacity-50 transition"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isThinking}
            className="flex h-10 w-10
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white hover:bg-violet-700 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
