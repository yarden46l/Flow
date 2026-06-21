"use client";

import React, { useState } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/lib/db";

// ── Energy Level Config ────────────────────────────────────────────────────────
const ENERGY_OPTIONS: { value: Task["energyLevel"]; label: string; icon: string; color: string }[] = [
  { value: "HIGH",   label: "High",   icon: "⚡", color: "bg-red-50 border-red-200 text-red-600" },
  { value: "MEDIUM", label: "Med",    icon: "🔵", color: "bg-blue-50 border-blue-200 text-blue-600" },
  { value: "LOW",    label: "Low",    icon: "🌿", color: "bg-slate-50 border-slate-200 text-slate-500" },
];

const energyBadge = (level?: Task["energyLevel"]) => {
  switch (level) {
    case "HIGH":   return "bg-red-50 text-red-600 border-red-200";
    case "MEDIUM": return "bg-blue-50 text-blue-600 border-blue-200";
    case "LOW":    return "bg-slate-100 text-slate-500 border-slate-200";
    default:       return "bg-slate-100 text-slate-400 border-slate-200";
  }
};

const energyIcon = (level?: Task["energyLevel"]) => {
  switch (level) {
    case "HIGH":   return "⚡";
    case "MEDIUM": return "🔵";
    case "LOW":    return "🌿";
    default:       return null;
  }
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface CaptureZoneProps {
  items: Task[];
  onAddItem?: (
    text: string,
    duration?: number,
    isFrog?: boolean,
    energyLevel?: Task["energyLevel"],
    isSprintCritical?: boolean,
    isBatchTask?: boolean,
    batchTotal?: number,
    batchUnitName?: string,
  ) => void;
  onDeleteItem?: (id: string) => void;
  onAddProject?: (projectName: string) => void;
  onSeedDatabase?: () => void;
  onItemTap?: (item: Task) => void;
  onSmartSuggest?: () => void;
  isSmartSuggestRunning?: boolean;
  isSprintMode?: boolean;
}

// ── Draggable Inbox Item ───────────────────────────────────────────────────────
function DraggableInboxItem({
  item,
  onItemTap,
  onDeleteItem,
  isSprintMode,
}: {
  item: Task;
  onItemTap?: (item: Task) => void;
  onDeleteItem?: (id: string) => void;
  isSprintMode?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : undefined,
  };

  // In Sprint Mode, non-critical tasks are visually suppressed
  const isSuppressed = isSprintMode && item.isSprintCritical === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onItemTap?.(item);
      }}
      className={`group relative flex flex-col justify-between p-4 bg-white hover:bg-slate-50 border rounded-xl transition-all duration-200 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md ${
        isDragging ? "shadow-lg z-50 border-accent-violet/30" : ""
      } ${item.isFrog ? "border-l-4 border-l-red-400 border-y-red-100 border-r-red-100 bg-red-50/30" : "border-slate-200 hover:border-slate-300"} ${
        isSuppressed ? "opacity-35 grayscale-[60%]" : ""
      }`}
    >
      {/* Sprint-suppressed overlay label */}
      {isSuppressed && (
        <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 uppercase tracking-wider select-none">
          Non-critical
        </div>
      )}

      <div className="flex gap-3 items-start">
        {/* Drag Handle Icon */}
        <div className="mt-1 text-slate-300 group-hover:text-slate-500 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Task Text */}
        <div className="flex-1 select-none">
          <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors break-words">
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.isFrog && (
              <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-wider">
                Frog
              </span>
            )}
            {item.energyLevel && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${energyBadge(item.energyLevel)}`}>
                {energyIcon(item.energyLevel)} {item.energyLevel}
              </span>
            )}
            {item.isBatchTask && item.batchTotal && (
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {item.batchCompleted ?? 0}/{item.batchTotal} {item.batchUnitName ?? "items"}
              </span>
            )}
            {item.duration && (
              <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                {item.duration}m
              </span>
            )}
            {item.projectBlockType && (
              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                {item.projectBlockType === "deep" ? "4h Deep" : "2h Polish"}
              </span>
            )}
            {item.isSprintCritical && (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider">
                ⚡ Sprint
              </span>
            )}
            {!item.isFrog && !item.duration && !item.projectBlockType && !item.energyLevel && (
              <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">
                Inbox
              </span>
            )}
          </div>
        </div>

        {/* Age / Time ago + Delete */}
        <div className="flex flex-col items-end gap-1 self-start shrink-0">
          <span className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
            {item.createdAt}
          </span>
          {onDeleteItem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${item.title}"?`)) {
                  onDeleteItem(item.id);
                }
              }}
              title="Delete task"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Subtle glow border hover effect */}
      <div className="absolute inset-0 rounded-xl border border-accent-violet/0 group-hover:border-accent-violet/10 transition-colors pointer-events-none" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CaptureZone({
  items,
  onAddItem,
  onDeleteItem,
  onAddProject,
  onSeedDatabase,
  onItemTap,
  onSmartSuggest,
  isSmartSuggestRunning,
  isSprintMode,
}: CaptureZoneProps) {
  const [inputValue, setInputValue]     = useState("");
  const [durationValue, setDurationValue] = useState("");
  const [isFrog, setIsFrog]             = useState(false);
  const [energyLevel, setEnergyLevel]   = useState<Task["energyLevel"]>("MEDIUM");
  const [isSprintCritical, setIsSprintCritical] = useState(false);
  // Batch Task state
  const [isBatchTask, setIsBatchTask]     = useState(false);
  const [batchTotal, setBatchTotal]       = useState("");
  const [batchUnitName, setBatchUnitName] = useState("items");

  const { setNodeRef, isOver } = useDroppable({ id: "inbox-zone" });

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    const dur = parseInt(durationValue, 10);

    // 2-Minute Rule
    if (!isNaN(dur) && dur < 2) {
      window.alert("Do It Now! Tasks under 2 minutes should be executed immediately, not scheduled.");
      return;
    }

    onAddItem?.(
      inputValue.trim(),
      isNaN(dur) ? undefined : dur,
      isFrog,
      energyLevel,
      isSprintCritical,
      isBatchTask,
      isBatchTask ? (parseInt(batchTotal, 10) || 10) : undefined,
      isBatchTask ? (batchUnitName.trim() || "items") : undefined,
    );
    setInputValue("");
    setDurationValue("");
    setIsFrog(false);
    setEnergyLevel("MEDIUM");
    setIsSprintCritical(false);
    setIsBatchTask(false);
    setBatchTotal("");
    setBatchUnitName("items");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleNewProject = () => {
    const projName = window.prompt("Enter Project Name for the 4:2 Split:");
    if (projName && projName.trim()) onAddProject?.(projName.trim());
  };

  // Items visible in Sprint Mode: critical-only filter
  const sprintSuppressedCount = isSprintMode
    ? items.filter((t) => t.isSprintCritical === false).length
    : 0;

  return (
    <div className={`flex flex-col h-full backdrop-blur-md border-r p-6 transition-colors duration-300 ${
      isSprintMode
        ? "bg-slate-900/[0.03] border-slate-800/20"
        : "bg-slate-50/50 border-slate-200"
    }`}>
      {/* Header */}
      <div className="mb-5 select-none">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isSprintMode ? "bg-amber-500" : "bg-accent-violet"}`} />
          <h2 className={`text-xs font-bold uppercase tracking-widest ${isSprintMode ? "text-amber-600" : "text-slate-400"}`}>
            Capture Zone
          </h2>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">Inbox</h1>
        <p className="text-xs text-slate-500 mt-0.5">Frictionless entry to reduce cognitive load</p>
      </div>

      {/* Input Capture Field */}
      <div className="relative mb-3 shadow-sm">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Dump a task or thought..."
          className={`w-full bg-white border rounded-xl py-3 pl-4 pr-12 text-sm text-slate-700 placeholder-slate-400 focus:outline-none transition-all ${
            isSprintMode
              ? "border-amber-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
              : "border-slate-200 focus:border-accent-violet focus:ring-1 focus:ring-accent-violet/30"
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <kbd className="hidden sm:inline-flex items-center h-5 select-none pointer-events-none px-1.5 font-sans font-medium text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ↵
          </kbd>
        </div>
      </div>

      {/* ── Row 1: Duration + Frog + 4:2 Project ── */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          type="number"
          placeholder="Mins"
          value={durationValue}
          onChange={(e) => setDurationValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-16 bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-xs text-slate-700 focus:outline-none focus:border-accent-violet transition-all shadow-sm"
        />
        <button
          onClick={() => setIsFrog(!isFrog)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm ${isFrog ? "bg-red-50 border-red-200 text-red-600 shadow-red-500/10" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
        >
          <span>🐸</span>
          <span>Frog</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={handleNewProject}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors shadow-sm"
        >
          + 4:2 Project
        </button>
      </div>

      {/* ── Row 2: Energy Level Selector + Sprint Critical + Batch Task ── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Energy Level — 3-way toggle */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 gap-0.5">
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEnergyLevel(opt.value)}
              title={`Energy: ${opt.label}`}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                energyLevel === opt.value
                  ? opt.color + " shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span>{opt.icon}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Sprint Critical toggle */}
        <button
          onClick={() => setIsSprintCritical(!isSprintCritical)}
          title="Mark as Sprint Critical"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
            isSprintCritical
              ? "bg-amber-50 border-amber-300 text-amber-700 shadow-amber-500/10 shadow-sm"
              : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300"
          }`}
        >
          <span>⚡</span>
          <span>Sprint</span>
        </button>

        {/* Batch Task toggle */}
        <button
          onClick={() => setIsBatchTask(!isBatchTask)}
          title="Toggle Batch Task mode"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
            isBatchTask
              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
              : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300"
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Batch</span>
        </button>
      </div>

      {/* ── Batch Task Inputs (conditional) ── */}
      {isBatchTask && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
          <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <input
            type="number"
            min={1}
            placeholder="Total"
            value={batchTotal}
            onChange={(e) => setBatchTotal(e.target.value)}
            className="w-16 bg-white border border-indigo-200 rounded-lg py-1.5 px-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 transition-all shadow-sm"
          />
          <input
            type="text"
            placeholder="Unit (pages, eq.)"
            value={batchUnitName}
            onChange={(e) => setBatchUnitName(e.target.value)}
            className="flex-1 bg-white border border-indigo-200 rounded-lg py-1.5 px-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 transition-all shadow-sm"
          />
        </div>
      )}

      {/* ── Smart Suggest Button ── */}
      <button
        onClick={onSmartSuggest}
        disabled={isSmartSuggestRunning || items.length === 0}
        className={`w-full mb-5 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 shadow-sm ${
          items.length === 0
            ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
            : isSmartSuggestRunning
            ? "bg-indigo-50 border-indigo-200 text-indigo-400 cursor-wait"
            : isSprintMode
            ? "bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-amber-500/20 hover:shadow-md"
            : "bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white shadow-indigo-500/20 hover:shadow-md"
        }`}
      >
        {isSmartSuggestRunning ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Scheduling…</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.346.346a1 1 0 01-.707.293H9.88a1 1 0 01-.707-.293l-.346-.346z" />
            </svg>
            <span>{isSprintMode ? "⚡ Sprint Suggest" : "✨ Smart Suggest"}</span>
          </>
        )}
      </button>

      {/* ── Tasks List ── */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto pr-1 space-y-3 rounded-lg transition-colors p-2 -m-2 ${
          isOver ? "bg-accent-violet/[0.04] border border-dashed border-accent-violet/30" : ""
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 select-none">
          <span>Unprocessed Thoughts ({items.length})</span>
          {isSprintMode && sprintSuppressedCount > 0 && (
            <span className="text-amber-500">{sprintSuppressedCount} suppressed</span>
          )}
          <span>Age</span>
        </div>

        {items.map((item) => (
          <DraggableInboxItem
            key={item.id}
            item={item}
            onItemTap={onItemTap}
            onDeleteItem={onDeleteItem}
            isSprintMode={isSprintMode}
          />
        ))}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 border border-dashed border-slate-200 rounded-xl text-slate-400 select-none bg-slate-50/50">
            <p className="text-xs">Inbox is empty</p>
            <p className="text-[10px] text-slate-300 mt-1">Perfect cognitive clarity achieved.</p>
          </div>
        )}
      </div>

      {/* Seed Database Button */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button
          onClick={onSeedDatabase}
          className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200 rounded-lg text-xs font-semibold transition-colors shadow-sm"
        >
          Seed Database
        </button>
      </div>
    </div>
  );
}
