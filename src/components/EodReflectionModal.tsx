"use client";

import React, { useState } from "react";

// ── EOD Storage Helpers ────────────────────────────────────────────────────
export interface EodEntry {
  date: string;          // ISO date string  "2026-06-20"
  whatWorked: string;
  timeWasted: string;
  improveTomorrow: string;
  submittedAt: string;   // ISO timestamp
}

const EOD_STORAGE_KEY = "kaizenflow_eod_reflections";

export function loadEodEntries(): EodEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(EOD_STORAGE_KEY) ?? "[]") as EodEntry[];
  } catch {
    return [];
  }
}

function saveEodEntry(entry: EodEntry): void {
  const entries = loadEodEntries();
  // Replace existing entry for today if it exists
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  localStorage.setItem(EOD_STORAGE_KEY, JSON.stringify(entries));
}

interface EodReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EodReflectionModal({ isOpen, onClose }: EodReflectionModalProps) {
  const [whatWorked, setWhatWorked] = useState("");
  const [timeWasted, setTimeWasted] = useState("");
  const [improveTomorrow, setImproveTomorrow] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    const today = new Date().toISOString().split("T")[0];
    const entry: EodEntry = {
      date: today,
      whatWorked,
      timeWasted,
      improveTomorrow,
      submittedAt: new Date().toISOString(),
    };
    saveEodEntry(entry);
    console.log("📋 EOD Reflection Saved:", entry);
    setWhatWorked("");
    setTimeWasted("");
    setImproveTomorrow("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-border-glass w-full max-w-lg mx-4 p-8 animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-warning animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Kaizen Reflection</h2>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">End-of-Day Review</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            10 minutes of honest reflection. Small improvements compound into transformation.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">
              1. What worked today?
            </label>
            <textarea
              value={whatWorked}
              onChange={(e) => setWhatWorked(e.target.value)}
              placeholder="e.g. Cleared the frog task before 10am, deep work block was uninterrupted..."
              className="w-full bg-zinc-50 border border-border-glass rounded-lg px-4 py-2.5 text-sm text-zinc-700 placeholder-zinc-300 focus:outline-none focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 transition-all resize-none h-20"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">
              2. Where was time wasted?
            </label>
            <textarea
              value={timeWasted}
              onChange={(e) => setTimeWasted(e.target.value)}
              placeholder="e.g. 45 minutes on social media during the buffer block..."
              className="w-full bg-zinc-50 border border-border-glass rounded-lg px-4 py-2.5 text-sm text-zinc-700 placeholder-zinc-300 focus:outline-none focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 transition-all resize-none h-20"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">
              3. How will I improve by 1% tomorrow?
            </label>
            <textarea
              value={improveTomorrow}
              onChange={(e) => setImproveTomorrow(e.target.value)}
              placeholder="e.g. Use website blocker during deep work, start frog 15 minutes earlier..."
              className="w-full bg-zinc-50 border border-border-glass rounded-lg px-4 py-2.5 text-sm text-zinc-700 placeholder-zinc-300 focus:outline-none focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/20 transition-all resize-none h-20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-accent-violet hover:bg-accent-violet/90 text-white font-bold text-sm py-2.5 rounded-lg transition-colors shadow-md shadow-accent-violet/15"
          >
            Submit Reflection
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
