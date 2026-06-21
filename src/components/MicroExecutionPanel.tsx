/**
 * MicroExecutionPanel.tsx — Phase 12
 *
 * Renders one of two execution modes based on the active task:
 *  • Batch Task  (isBatchTask: true) → Quantitative progress bar + stepper
 *  • Time Task   (default)           → 50:10 Pomodoro circular timer
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task, updateTask } from "@/lib/db";

interface MicroExecutionPanelProps {
  activeTask: Task | null;
  onCompleteTask?: (taskId: string) => void;
}

// ── Timer constants ────────────────────────────────────────────────────────────
const WORK_TIME  = 50 * 60;
const BREAK_TIME = 10 * 60;

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col h-full bg-slate-50/50 backdrop-blur-md border-l border-slate-200 p-6 justify-center items-center text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-700">No Active Task</h3>
      <p className="text-xs text-slate-400 mt-2">Click a scheduled time block in the canvas to begin execution.</p>
    </div>
  );
}

// ── Batch Processing Engine ────────────────────────────────────────────────────
function BatchEngine({ task }: { task: Task }) {
  const total     = task.batchTotal     ?? 10;
  const unit      = task.batchUnitName  ?? "items";
  const initial   = task.batchCompleted ?? 0;

  const [completed, setCompleted] = useState(initial);
  const [customInput, setCustomInput] = useState("");
  const [isDone, setIsDone] = useState(initial >= total);

  // Sync with Firestore whenever completed changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const clampedCompleted = Math.min(completed, total);
    updateTask(task.id, { batchCompleted: clampedCompleted });
    if (clampedCompleted >= total && !isDone) {
      setIsDone(true);
      updateTask(task.id, { isCompleted: true, completedAt: new Date().toISOString() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  // Reset local state when a different batch task is selected
  useEffect(() => {
    setCompleted(task.batchCompleted ?? 0);
    setIsDone((task.batchCompleted ?? 0) >= total);
    isFirstRender.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const increment = (delta: number) => {
    if (isDone) return;
    setCompleted((prev) => Math.min(prev + delta, total));
  };

  const handleCustomAdd = () => {
    const n = parseInt(customInput, 10);
    if (!isNaN(n) && n > 0) { increment(n); setCustomInput(""); }
  };

  const progressPct = total > 0 ? Math.min((completed / total) * 100, 100) : 0;

  const progressColor = isDone
    ? "from-emerald-500 to-emerald-400"
    : progressPct > 60
    ? "from-indigo-500 to-violet-500"
    : "from-indigo-600 to-indigo-400";

  return (
    <div className="flex flex-col h-full bg-slate-50/50 backdrop-blur-md border-l border-slate-200 p-6 justify-between overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDone ? "bg-emerald-400" : "bg-indigo-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isDone ? "bg-emerald-500" : "bg-indigo-500"}`} />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Batch Processing</h2>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">Volume Tracker</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track progress by quantity, not time</p>
        </div>

        {/* Active Task Card */}
        <div className={`p-4 rounded-xl border shadow-sm ${isDone ? "bg-emerald-50/60 border-emerald-200" : "bg-indigo-50/40 border-indigo-200"}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDone ? "text-emerald-600" : "text-indigo-500"}`}>
            {isDone ? "✓ Batch Complete" : "Active Batch Task"}
          </div>
          <h3 className="text-sm font-semibold text-slate-800 break-words">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              <strong className="text-slate-700">Details:</strong> {task.description}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Numeric summary */}
          <div className="flex items-end justify-between">
            <div>
              <span className="text-4xl font-extrabold text-slate-900 tabular-nums leading-none">
                {completed}
              </span>
              <span className="text-sm font-medium text-slate-400 ml-1.5">/ {total} {unit}</span>
            </div>
            <span className={`text-2xl font-extrabold tabular-nums ${isDone ? "text-emerald-500" : "text-indigo-500"}`}>
              {Math.round(progressPct)}%
            </span>
          </div>

          {/* Bar */}
          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out`}
              style={{ width: `${progressPct}%` }}
            />
            {/* Shimmer on active */}
            {!isDone && (
              <div
                className="absolute inset-y-0 bg-white/30 rounded-full animate-pulse"
                style={{ left: 0, width: `${progressPct}%` }}
              />
            )}
          </div>

          {/* Remaining label */}
          <p className="text-xs text-slate-500 text-right">
            {isDone ? "All done! 🎉" : `${total - completed} ${unit} remaining`}
          </p>
        </div>

        {/* Stepper Buttons */}
        {!isDone && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Quick Add</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 5, 10].map((delta) => (
                <button
                  key={delta}
                  onClick={() => increment(delta)}
                  className="flex items-center justify-center gap-1 py-3 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl text-sm font-bold text-slate-700 hover:text-indigo-700 transition-all duration-150 shadow-sm hover:shadow-md active:scale-95"
                >
                  <span className="text-indigo-400 text-xs">+</span>
                  <span>{delta}</span>
                  <span className="text-slate-400 text-[10px]">{unit}</span>
                </button>
              ))}
            </div>

            {/* Custom increment */}
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
                placeholder={`Custom ${unit}…`}
                className="flex-1 bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-all shadow-sm"
              />
              <button
                onClick={handleCustomAdd}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm shadow-indigo-500/20 transition-all active:scale-95"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Completion CTA */}
        {isDone ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-700">Batch complete!</p>
              <p className="text-xs text-emerald-600 mt-0.5">Task marked as done. Great execution.</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setCompleted(total);
            }}
            className="w-full py-2.5 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors"
          >
            Mark Batch Complete
          </button>
        )}
      </div>

      {/* Bottom filler */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Actionable Roadmap</div>
        <div className="text-xs text-slate-500 italic">Checklist integration coming in future phase.</div>
      </div>
    </div>
  );
}

// ── Pomodoro Timer ─────────────────────────────────────────────────────────
function PomodoroTimer({ activeTask, onCompleteTask }: { activeTask: Task; onCompleteTask?: (id: string) => void }) {
  const [mode, setMode]           = useState<"work" | "break">("work");
  const [timeLeft, setTimeLeft]   = useState(WORK_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef               = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsRunning(false);
    setMode("work");
    setTimeLeft(WORK_TIME);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, [activeTask.id]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            const nextMode = mode === "work" ? "break" : "work";
            setMode(nextMode);
            setIsRunning(false);
            return nextMode === "work" ? WORK_TIME : BREAK_TIME;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isRunning, mode]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer  = () => { setIsRunning(false); setMode("work"); setTimeLeft(WORK_TIME); };
  const formatTime  = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const totalTime      = mode === "work" ? WORK_TIME : BREAK_TIME;
  const progressPercent = ((totalTime - timeLeft) / totalTime) * 100;
  const dashOffset     = 402 - (402 * progressPercent) / 100;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 backdrop-blur-md border-l border-slate-200 p-6 justify-between overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRunning ? "bg-accent-success" : "bg-red-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? "bg-accent-success" : "bg-red-500"}`} />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Micro-Execution</h2>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">Focus Mode</h1>
          <p className="text-xs text-slate-400 mt-0.5">Focus single-mindedly on the active block</p>
        </div>

        {/* Active Block Card */}
        <div className={`p-4 rounded-xl border shadow-sm ${mode === "work" ? "bg-red-50/50 border-red-200" : "bg-emerald-50/50 border-emerald-200"}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${mode === "work" ? "text-accent-frog" : "text-accent-success"}`}>
            {mode === "work" ? "Current Active Task" : "Break Time"}
          </div>
          <h3 className="text-sm font-semibold text-slate-800 break-words">{activeTask.title}</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            <strong className="text-slate-700">Details:</strong> {activeTask.description || "No description provided."}
          </p>
        </div>

        {/* Circular Timer */}
        <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-radial-gradient from-accent-violet/5 to-transparent pointer-events-none" />
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="72" cy="72" r="64" stroke="rgba(0,0,0,0.05)" strokeWidth="6" fill="transparent" />
              <circle
                cx="72" cy="72" r="64"
                stroke={mode === "work" ? "var(--accent)" : "var(--success)"}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray="402"
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="opacity-80 transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center select-none">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{formatTime(timeLeft)}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{mode === "work" ? "Working" : "Resting"}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 mt-5">
            <button onClick={resetTimer} className="p-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </button>
            <button onClick={toggleTimer} className={`p-3.5 rounded-full text-white transition-all shadow-md ${isRunning ? "bg-slate-800 hover:bg-slate-700 shadow-slate-800/20 scale-95" : "bg-accent-violet hover:bg-accent-violet/90 shadow-accent-violet/20 scale-100"}`}>
              {isRunning ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg className="w-5 h-5 pl-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button
              onClick={() => {
                // Complete task: update parent state optimistically, then reset timer
                if (onCompleteTask) {
                  onCompleteTask(activeTask.id);
                } else {
                  // Fallback: direct Firestore call if prop not passed
                  updateTask(activeTask.id, { isCompleted: true, completedAt: new Date().toISOString(), status: "archived" });
                }
                resetTimer();
              }}
              className="p-2.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shadow-sm"
              title="Mark Task Complete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="space-y-2 opacity-60">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actionable Roadmap</div>
          <div className="text-xs text-slate-500 italic">Checklist integration coming in future phase.</div>
        </div>
      </div>
    </div>
  );
}

// ── Root export ─────────────────────────────────────────────────────────
export default function MicroExecutionPanel({ activeTask, onCompleteTask }: MicroExecutionPanelProps) {
  if (!activeTask) return <EmptyState />;
  if (activeTask.isBatchTask) return <BatchEngine task={activeTask} />;
  return <PomodoroTimer activeTask={activeTask} onCompleteTask={onCompleteTask} />;
}
