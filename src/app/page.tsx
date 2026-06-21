"use client";

import React, { useState } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import CaptureZone from "@/components/CaptureZone";
import TimeBlockCanvas from "@/components/TimeBlockCanvas";
import MicroExecutionPanel from "@/components/MicroExecutionPanel";
import EodReflectionModal from "@/components/EodReflectionModal";
import AuthScreen from "@/components/AuthScreen";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { shouldTriggerSpacedRepetition, generate2357Reviews, generateSprintRecallReviews } from "@/utils/spacedRepetition";
import { analyzeFriction } from "@/utils/frictionAnalyzer";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { format, isWeekend, parseISO, startOfWeek, addDays } from "date-fns";

import { Task, subscribeToTasks, addTask, updateTask, deleteTask, seedDatabase, flushSyncQueue } from "@/lib/db";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<"workspace" | "analytics">("workspace");

  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  // Mobile & Fallback State
  const [mobileTab, setMobileTab] = useState<"inbox" | "calendar" | "focus">("inbox");
  const [activeMobileScheduleItem, setActiveMobileScheduleItem] = useState<Task | null>(null);
  const [mobileScheduleDay, setMobileScheduleDay] = useState("");
  const [mobileScheduleTime, setMobileScheduleTime] = useState("09:00");

  // Auth Listener
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Tasks Listener & Offline Sync Queue
  React.useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    if (!user?.uid) {
      setTasks([]);
      return;
    }
    const unsubscribe = subscribeToTasks(user.uid, setTasks);

    // Initial flush if we loaded while online
    if (typeof navigator !== "undefined" && navigator.onLine) {
      setIsSyncing(true);
      flushSyncQueue().finally(() => setIsSyncing(false));
    }

    // Flush queue on reconnect
    const handleOnline = async () => {
      setIsOffline(false);
      setIsSyncing(true);
      await flushSyncQueue();
      setIsSyncing(false);
    };

    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user?.uid]);

  const inboxItems = tasks.filter((t) => t.status === "inbox");
  const scheduledEvents = tasks.filter((t) => t.status === "scheduled");
  const weekdayEvents = scheduledEvents.filter((t) => t.scheduledDay && !isWeekend(parseISO(t.scheduledDay)));
  const weekendEvents = scheduledEvents.filter((t) => t.scheduledDay && isWeekend(parseISO(t.scheduledDay)));

  // Phase 3 States
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showEodModal, setShowEodModal] = useState(false);

  // Drag States
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Smart Suggest State
  const [isSmartSuggestRunning, setIsSmartSuggestRunning] = useState(false);

  // Cognitive Load Warning state
  const [cognitiveWarning, setCognitiveWarning] = useState<{
    pendingUpdate: { id: string; startTime: string; endTime: string; scheduledDay?: string } | null;
    message: string;
  } | null>(null);

  // ── Sprint Mode global toggle ─────────────────────────────────────────────
  const [isSprintMode, setIsSprintMode] = useState(false);

  // Setup sensors with activation constraint to prevent blocking button/input clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  const isWeekendDay = isWeekend(currentDate);
  const currentDateStr = format(currentDate, "yyyy-MM-dd");

  const handleAddInboxItem = (
    text: string,
    duration?: number,
    isFrog?: boolean,
    energyLevel?: Task["energyLevel"],
    isSprintCritical?: boolean,
    isBatchTask?: boolean,
    batchTotal?: number,
    batchUnitName?: string,
  ) => {
    const newItem: Task = {
      id: `inbox-item-${Date.now()}`,
      title: text,
      status: "inbox",
      createdAt: "now",
      duration,
      isFrog,
      energyLevel: energyLevel ?? "MEDIUM",
      isSprintCritical: isSprintCritical ?? false,
      isBatchTask: isBatchTask ?? false,
      batchTotal: isBatchTask ? (batchTotal ?? 10) : undefined,
      batchCompleted: isBatchTask ? 0 : undefined,
      batchUnitName: isBatchTask ? (batchUnitName ?? "items") : undefined,
      userId: user.uid,
    };

    // Optimistically update local React state immediately so the task appears
    // without waiting for the Firestore onSnapshot round-trip.
    setTasks((prev) => [...prev, newItem]);

    addTask(newItem);

    if (shouldTriggerSpacedRepetition(text)) {
      // Sprint Mode → accelerated +12h/+24h/+48h recall schedule
      // Normal Mode  → standard 2357 schedule
      const reviewItems = isSprintMode
        ? generateSprintRecallReviews(text)
        : generate2357Reviews(text);

      const reviews = reviewItems.map((r) => ({
        id: `inbox-item-${Date.now()}-${Math.random()}`,
        title: r.text,
        status: "inbox" as const,
        createdAt: r.createdAt,
        duration: isSprintMode ? 20 : 30,  // shorter sprint recall blocks
        energyLevel: "HIGH" as const,
        isSprintCritical: true,
        userId: user.uid,
      }));
      reviews.forEach((r) => addTask(r));
    }
  };

  const handleDeleteInboxItem = (id: string) => {
    // Optimistically remove from local state immediately
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTask(id);
  };

  const handleAddProject = (projectName: string) => {
    const projectGroupId = `proj-${Date.now()}`;
    const deepBlock: Task = {
      id: `inbox-item-deep-${Date.now()}`,
      title: `${projectName} - Deep Work (4h)`,
      status: "inbox",
      createdAt: "now",
      duration: 240,
      projectGroupId,
      projectBlockType: "deep",
      userId: user.uid,
    };
    const polishBlock: Task = {
      id: `inbox-item-polish-${Date.now()}`,
      title: `${projectName} - Polish/Editing (2h)`,
      status: "inbox",
      createdAt: "now",
      duration: 120,
      projectGroupId,
      projectBlockType: "polish",
      userId: user.uid,
    };
    addTask(deepBlock);
    addTask(polishBlock);
  };

  // Handle Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  // ── Smart Suggest ─────────────────────────────────────────────────────────
  /**
   * Uses frictionAnalyzer to build a list of friction-zone hours, then
   * iterates inbox items, assigns Frogs to the earliest pre-noon slot and
   * other items to the next available non-friction slot.
   */
  const WEEKDAY_SLOTS: string[] = [
    "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
    "19:00", "19:30", "20:00",
  ];

  const handleSmartSuggest = async () => {
    if (isSmartSuggestRunning || inboxItems.length === 0) return;
    setIsSmartSuggestRunning(true);

    // 1. Run friction analysis on ALL tasks
    const analysis = analyzeFriction(tasks);
    const frictionHours = new Set<number>();
    for (const zone of analysis.identifiedFrictionZones) {
      for (let h = zone.startHour; h < zone.endHour; h++) {
        frictionHours.add(h);
      }
    }

    // 2. Build a set of already-occupied minutes for the selected day
    //    Fixed anchors are always included (they lock their window)
    const occupiedMinutes = new Set<number>();
    for (const ev of weekdayEvents.filter((e) => e.scheduledDay === currentDateStr)) {
      if (!ev.startTime || !ev.endTime) continue;
      const [sh, sm] = ev.startTime.split(":").map(Number);
      const [eh, em] = ev.endTime.split(":").map(Number);
      for (let m = sh * 60 + sm; m < eh * 60 + em; m++) {
        occupiedMinutes.add(m);
      }
    }

    // helper: check if a time window is free of conflicts, friction, and energy routing
    const isSlotAvailable = (startMins: number, durationMins: number, isFrogTask: boolean, energy?: Task["energyLevel"]): boolean => {
      const startH = Math.floor(startMins / 60);
      // Frog tasks must stay before noon
      if (isFrogTask && startH >= 12) return false;
      // Energy routing:
      //   HIGH  → peak morning window 07:00–12:00 (can also share 08:00-12:00 prime block)
      //   LOW   → afternoon/evening 13:00+
      if (energy === "HIGH" && startH >= 12) return false;
      if (energy === "LOW" && startH < 13) return false;
      // Reject friction-zone slots for high-focus tasks (MEDIUM and HIGH)
      if (energy !== "LOW" && frictionHours.has(startH)) return false;
      for (let m = startMins; m < startMins + durationMins; m++) {
        if (occupiedMinutes.has(m)) return false;
      }
      return true;
    };

    // 3. Separate and order items: Frogs first, then others
    //    Smart Suggest NEVER targets weekend days (Sat/Sun) for deep/frog work
    if (isWeekendDay) {
      setIsSmartSuggestRunning(false);
      window.alert("Smart Suggest respects Weekend Flexibility — deep work and Frog tasks are never auto-scheduled on weekends. Switch to a weekday to use Smart Suggest.");
      return;
    }

    // 3. Separate and order items: Frogs first, then others
    const frogs = inboxItems.filter((t) => t.isFrog);
    const others = inboxItems.filter((t) => !t.isFrog);
    const ordered = [...frogs, ...others];

    // 4. Assign each item to the earliest available slot
    const updates: Array<{ id: string; startTime: string; endTime: string; type: Task["type"]; colorClass: string }> = [];

    for (const item of ordered) {
      const durationMins = item.duration || 60;
      let scheduled = false;

      for (const slot of WEEKDAY_SLOTS) {
        const [sh, sm] = slot.split(":").map(Number);
        const startMins = sh * 60 + sm;

        if (!isSlotAvailable(startMins, durationMins, !!item.isFrog, item.energyLevel)) continue;

        // Mark these minutes as occupied
        for (let m = startMins; m < startMins + durationMins; m++) {
          occupiedMinutes.add(m);
        }

        const endMins = Math.min(startMins + durationMins, 23 * 60 + 59);
        const endH = Math.floor(endMins / 60);
        const endM = endMins % 60;
        const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
        const taskType: Task["type"] = item.isFrog ? "frog" : item.projectBlockType === "polish" ? "polish" : "deep";

        updates.push({ id: item.id, startTime: slot, endTime, type: taskType, colorClass: taskType ?? "deep" });
        scheduled = true;
        break;
      }

      if (!scheduled) {
        console.warn(`[SmartSuggest] Could not find a slot for task: ${item.title}`);
      }
    }

    // 5. Optimistically apply all updates to React state immediately
    const scheduledMap = new Map(updates.map(({ id, startTime, endTime, type, colorClass }) => [
      id,
      { status: "scheduled" as const, scheduledDay: currentDateStr, startTime, endTime, type, colorClass, description: "Auto-scheduled by Smart Suggest (friction-aware)." },
    ]));
    setTasks((prev) => prev.map((t) => scheduledMap.has(t.id) ? { ...t, ...scheduledMap.get(t.id) } : t));
    setIsSmartSuggestRunning(false);

    // Fire Firestore writes in the background (non-blocking)
    updates.forEach(({ id, startTime, endTime, type, colorClass }) =>
      updateTask(id, {
        status: "scheduled",
        scheduledDay: currentDateStr,
        startTime,
        endTime,
        type,
        colorClass,
        description: "Auto-scheduled by Smart Suggest (friction-aware).",
      })
    );
  };

  // Handle Drag End
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Case 1: Dragged from Inbox to Calendar time slot
    if (activeId.startsWith("inbox-item-") && overId.startsWith("slot-")) {
      const itemId = activeId;

      let targetDateStr = "";
      let targetSlot = "";
      let isWeekendDrop = false;

      if (overId.startsWith("slot-weekend-")) {
        isWeekendDrop = true;
        targetDateStr = overId.replace("slot-weekend-", "");
      } else {
        const parts = overId.split("-");
        // slot-2026-06-17-09:00
        targetSlot = parts.pop()!;
        targetDateStr = parts.slice(1).join("-");
      }

      const draggedItem = inboxItems.find((item) => item.id === itemId);
      if (!draggedItem) return;

      if (isWeekendDrop) {
        const updates = {
          status: "scheduled" as const,
          scheduledDay: targetDateStr,
          startTime: "09:00",
          endTime: "17:00",
          type: "flex" as const,
          colorClass: "flex",
          description: "Flexible weekend buffer item. Self-directed scheduling.",
        };
        // Optimistic UI update
        setTasks((prev) => prev.map((t) => t.id === itemId ? { ...t, ...updates } : t));
        updateTask(itemId, updates);
      } else {
        const [hourStr, minStr] = targetSlot.split(":");
        const startH = Number(hourStr);
        const startM = Number(minStr);

        // 1. Frog Validation
        if (draggedItem.isFrog && startH >= 12) {
          window.alert("Frogs must be eaten in the morning! Please schedule before 12:00 PM.");
          return;
        }

        // 1b. Fixed-Anchor Overlap Guard
        const durationMinsEarly = draggedItem.duration || 60;
        const newStartMins = startH * 60 + startM;
        const newEndMins = newStartMins + durationMinsEarly;
        const overlapsAnchor = weekdayEvents
          .filter((e) => e.scheduledDay === targetDateStr && e.isFixedAnchor)
          .some((anchor) => {
            if (!anchor.startTime || !anchor.endTime) return false;
            const [ash, asm] = anchor.startTime.split(":").map(Number);
            const [aeh, aem] = anchor.endTime.split(":").map(Number);
            const anchorStart = ash * 60 + asm;
            const anchorEnd = aeh * 60 + aem;
            return newStartMins < anchorEnd && newEndMins > anchorStart;
          });
        if (overlapsAnchor) {
          window.alert("That time slot is blocked by a Fixed Anchor (immutable event). Please choose a different time.");
          return;
        }

        // 2. 4:2 Splitter Validation
        if (draggedItem.projectBlockType === "polish") {
          const deepBlock = weekdayEvents.find(
            (e) => e.projectGroupId === draggedItem.projectGroupId && e.projectBlockType === "deep"
          );
          if (!deepBlock) {
            window.alert("You must schedule the Deep Work (4h) block before the Polish (2h) block.");
            return;
          }
          if (deepBlock.endTime) {
            const [deepEndH, deepEndM] = deepBlock.endTime.split(":").map(Number);
            const deepEndMinutes = deepEndH * 60 + deepEndM;
            const targetMinutes = startH * 60 + startM;
            if (targetMinutes < deepEndMinutes) {
              window.alert("The Polish (2h) block must start after the Deep Work block finishes.");
              return;
            }
          }
        }

        const durationMins = draggedItem.duration || 60;
        const totalEndMins = Math.min(startH * 60 + startM + durationMins, 23 * 60 + 59);
        const endH = Math.floor(totalEndMins / 60);
        const endM = totalEndMins % 60;

        const startTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
        const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

        // 3. Cognitive Load Warning
        const HIGH_FOCUS_TYPES: Array<Task["type"]> = ["frog", "deep"];
        const HEAVY_THRESHOLD_MINS = 120;
        const taskEndMins = startH * 60 + startM + durationMins;

        const adjacentHeavyBlock = weekdayEvents
          .filter((e) => e.scheduledDay === targetDateStr && HIGH_FOCUS_TYPES.includes(e.type))
          .find((e) => {
            if (!e.startTime || !e.endTime) return false;
            const [esh, esm] = e.startTime.split(":").map(Number);
            const [eeh, eem] = e.endTime.split(":").map(Number);
            const evStartMins = esh * 60 + esm;
            const evEndMins = eeh * 60 + eem;
            const evDuration = evEndMins - evStartMins;
            if (evDuration < HEAVY_THRESHOLD_MINS) return false;
            return (
              Math.abs(taskEndMins - evStartMins) <= 5 ||
              Math.abs(evEndMins - (startH * 60 + startM)) <= 5
            );
          });

        if (adjacentHeavyBlock && (draggedItem.isFrog || draggedItem.projectBlockType === "deep" || durationMins >= HEAVY_THRESHOLD_MINS)) {
          setCognitiveWarning({
            pendingUpdate: { id: itemId, startTime, endTime, scheduledDay: targetDateStr },
            message: `Stacking "${draggedItem.title}" directly after "${adjacentHeavyBlock.title}" creates ${Math.round((durationMins + ((Number(adjacentHeavyBlock.endTime?.split(":")[0]) - Number(adjacentHeavyBlock.startTime?.split(":")[0])) * 60)) / 60 * 10) / 10}h of uninterrupted high-concentration work. A 15-minute buffer is strongly recommended.`,
          });
          return;
        }

        const taskType = draggedItem.isFrog ? "frog" : draggedItem.projectBlockType === "polish" ? "polish" : "deep";
        const scheduledUpdates = {
          status: "scheduled" as const,
          scheduledDay: targetDateStr,
          startTime,
          endTime,
          type: taskType as Task["type"],
          colorClass: taskType,
          description: "Structured work scheduled from Capture Inbox.",
        };
        // Optimistic UI update — task moves to calendar immediately
        setTasks((prev) => prev.map((t) => t.id === itemId ? { ...t, ...scheduledUpdates } : t));
        updateTask(itemId, scheduledUpdates);
      }
    }

    // Case 2: Dragged existing Calendar Event to another Calendar time slot (Rescheduling)
    else if (activeId.startsWith("event-") && overId.startsWith("slot-")) {
      const eventId = activeId;

      let targetDateStr = "";
      let targetSlot = "";
      let isWeekendDrop = false;

      if (overId.startsWith("slot-weekend-")) {
        isWeekendDrop = true;
        targetDateStr = overId.replace("slot-weekend-", "");
      } else {
        const parts = overId.split("-");
        targetSlot = parts.pop()!;
        targetDateStr = parts.slice(1).join("-");
      }

      if (isWeekendDrop) {
        // In weekend mode, items are list-based flex items, dragging to grid isn't active
        return;
      }

      const evt = weekdayEvents.find((e) => e.id === eventId);
      if (!evt || !evt.startTime || !evt.endTime) return;

      // Fixed Anchor guard — silently abort, the card is visually locked already
      if (evt.isFixedAnchor) return;

      const [newStartH, newStartM] = targetSlot.split(":").map(Number);
      const newStartMinutes = newStartH * 60 + newStartM;

      // 1. Frog Validation
      if (evt.type === "frog" && newStartH >= 12) {
        window.alert("Frogs must be eaten in the morning! Please schedule before 12:00 PM.");
        return;
      }

      // 2. 4:2 Splitter Validation
      if (evt.projectBlockType === "polish") {
        const deepBlock = weekdayEvents.find(
          (e) => e.projectGroupId === evt.projectGroupId && e.projectBlockType === "deep"
        );
        if (deepBlock && deepBlock.endTime) {
          const [deepEndH, deepEndM] = deepBlock.endTime.split(":").map(Number);
          const deepEndMinutes = deepEndH * 60 + deepEndM;
          if (newStartMinutes < deepEndMinutes) {
            window.alert("The Polish (2h) block must start after the Deep Work block finishes.");
            return;
          }
        }
      } else if (evt.projectBlockType === "deep") {
        const polishBlock = weekdayEvents.find(
          (e) => e.projectGroupId === evt.projectGroupId && e.projectBlockType === "polish"
        );
        if (polishBlock && polishBlock.startTime) {
          const [startH, startM] = evt.startTime.split(":").map(Number);
          const [endH, endM] = evt.endTime.split(":").map(Number);
          const durationMins = (endH - startH) * 60 + (endM - startM);
          const newEndMinutes = newStartMinutes + durationMins;

          const [polishStartH, polishStartM] = polishBlock.startTime.split(":").map(Number);
          const polishStartMinutes = polishStartH * 60 + polishStartM;

          if (newEndMinutes > polishStartMinutes) {
            window.alert("The Deep Work block cannot end after the scheduled Polish block starts.");
            return;
          }
        }
      }

      const [startH, startM] = evt.startTime.split(":").map(Number);
      const [endH, endM] = evt.endTime.split(":").map(Number);
      const durationMins = (endH - startH) * 60 + (endM - startM);

      const newEndMinutes = Math.min(newStartMinutes + durationMins, 23 * 60 + 59);
      const newEndH = Math.floor(newEndMinutes / 60);
      const newEndM = newEndMinutes % 60;

      const startTime = `${String(newStartH).padStart(2, "0")}:${String(newStartM).padStart(2, "0")}`;
      const endTime = `${String(newEndH).padStart(2, "0")}:${String(newEndM).padStart(2, "0")}`;

      updateTask(eventId, { startTime, endTime, scheduledDay: targetDateStr });
    }

    // Case 3: Dragged existing Calendar Event back to Inbox (Un-scheduling)
    else if (activeId.startsWith("event-") && overId === "inbox-zone") {
      // Optimistic UI update
      setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, status: "inbox" as const, scheduledDay: undefined, startTime: undefined, endTime: undefined } : t));
      updateTask(activeId, { status: "inbox" });
    }
  };

  // Find dragged item text for overlay preview
  const getDragOverlayContent = () => {
    if (!activeDragId) return null;

    if (activeDragId.startsWith("inbox-item-")) {
      const item = inboxItems.find((itm) => itm.id === activeDragId);
      if (!item) return null;
      return (
        <div className="flex gap-2.5 items-start p-3.5 bg-white border border-accent-violet rounded-lg shadow-xl opacity-90 cursor-grabbing select-none text-zinc-600">
          <div className="mt-1 text-zinc-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-900 break-words">{item.title}</p>
          </div>
        </div>
      );
    }

    if (activeDragId.startsWith("event-")) {
      let eventItem = weekdayEvents.find((evt) => evt.id === activeDragId);
      if (!eventItem) {
        eventItem = weekendEvents.find((evt) => evt.id === activeDragId);
      }
      if (!eventItem) return null;

      const isFrog = eventItem.type === "frog";
      return (
        <div
          className={`p-3 rounded-lg border shadow-xl opacity-95 w-80 text-left select-none ${isFrog
              ? "bg-white border-accent-frog"
              : "bg-white border-accent-violet"
            }`}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-xs font-bold text-zinc-900 truncate">{eventItem.title}</h4>
            <span className="text-[10px] text-zinc-400 font-mono">
              {eventItem.startTime} - {eventItem.endTime}
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 truncate">{eventItem.description}</p>
        </div>
      );
    }

    return null;
  };

  const activeTask = weekdayEvents.find((e) => e.id === activeEventId) || weekendEvents.find((e) => e.id === activeEventId) || null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen max-h-screen overflow-hidden">
        {/* Navigation Header */}
        <header className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-violet to-indigo-400 flex items-center justify-center font-extrabold text-white text-sm shadow-sm shadow-accent-violet/20">
              F
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-slate-900 text-sm sm:text-base">
                Flow
              </span>
              <span className="text-[10px] font-medium text-slate-400 ml-2 hidden sm:inline border border-slate-200 rounded px-1.5 py-0.5">
                v1.0.0-phase11
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-accent-violet rounded-full" />
              <span>GTD Inbox</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-accent-success rounded-full" />
              <span>Time Blocks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-accent-frog rounded-full" />
              <span>50:10 Micro</span>
            </div>

            {/* Network Status Indicator */}
            {isOffline && (
              <div className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border bg-rose-50 text-rose-600 border-rose-200" title="Offline - Changes saved locally">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.163a1.5 1.5 0 013.141.386M5.5 1.5L22 18" />
                </svg>
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}
            {!isOffline && isSyncing && (
              <div className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border bg-indigo-50 text-indigo-600 border-indigo-200" title="Syncing...">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">Syncing...</span>
              </div>
            )}

            <button
              onClick={() => setCurrentView(currentView === "workspace" ? "analytics" : "workspace")}
              className="ml-2 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors shadow-sm"
            >
              {currentView === "workspace" ? "Kaizen Analytics" : "Workspace"}
            </button>

            {/* Sprint Mode Toggle */}
            <button
              onClick={() => setIsSprintMode((prev) => !prev)}
              className={`ml-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200 ${isSprintMode
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/30 animate-pulse"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              title={isSprintMode ? "Deactivate Sprint Mode" : "Activate Sprint Mode"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="hidden sm:inline">{isSprintMode ? "Sprint ON" : "Sprint"}</span>
            </button>
            <button
              onClick={() => setShowEodModal(true)}
              className="ml-2 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
            >
              EOD Reflection
            </button>
            <button
              onClick={() => signOut(auth)}
              className="ml-2 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Sprint Mode Alert Banner */}
        {isSprintMode && (
          <div className="shrink-0 flex items-center gap-3 px-6 py-2.5 bg-amber-500 text-white text-xs font-bold select-none">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>⚡ SPRINT MODE ACTIVE — High-focus execution phase. Non-critical tasks suppressed. Recall schedule accelerated (+12h/+24h/+48h).</span>
            <button onClick={() => setIsSprintMode(false)} className="ml-auto text-white/80 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Main Workspace or Dashboard */}
        {currentView === "analytics" ? (
          <main className="flex-1 overflow-hidden bg-white pb-16 md:pb-0">
            <AnalyticsDashboard tasks={tasks} />
          </main>
        ) : (
          <main className="flex-1 flex overflow-hidden bg-white pb-16 md:pb-0">
            {/* Left column (Capture Zone / Inbox) */}
            <section className={`w-full md:w-1/4 ${mobileTab === 'inbox' ? 'block' : 'hidden'} md:block h-full overflow-hidden`}>
              <CaptureZone
                items={inboxItems}
                onAddItem={handleAddInboxItem}
                onDeleteItem={handleDeleteInboxItem}
                onAddProject={handleAddProject}
                onSeedDatabase={() => user && seedDatabase(user.uid)}
                onItemTap={(item) => {
                  setActiveMobileScheduleItem(item);
                  setMobileScheduleDay(currentDateStr);
                }}
                onSmartSuggest={handleSmartSuggest}
                isSmartSuggestRunning={isSmartSuggestRunning}
                isSprintMode={isSprintMode}
              />
            </section>

            {/* Center column (Time Block Canvas / Calendar) */}
            <section className={`w-full md:w-2/4 ${mobileTab === 'calendar' ? 'block' : 'hidden'} md:block h-full overflow-hidden border-x border-slate-200`}>
              <TimeBlockCanvas
                weekdayEvents={weekdayEvents}
                weekendEvents={weekendEvents}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                viewMode={viewMode}
                setViewMode={setViewMode}
                onSelectEvent={(event) => setActiveEventId(event.id)}
                activeEventId={activeEventId}
              />
            </section>

            {/* Right column (Micro-Execution Panel) */}
            <section className={`w-full md:w-1/4 ${mobileTab === 'focus' ? 'block' : 'hidden'} md:block h-full overflow-hidden`}>
              <MicroExecutionPanel activeTask={activeTask} />
            </section>
          </main>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around z-50 px-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button onClick={() => setMobileTab("inbox")} className={`flex flex-col items-center gap-1 p-2 transition-colors ${mobileTab === "inbox" ? "text-accent-violet" : "text-slate-400 hover:text-slate-600"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          <span className="text-[10px] font-bold">Inbox</span>
        </button>
        <button onClick={() => setMobileTab("calendar")} className={`flex flex-col items-center gap-1 p-2 transition-colors ${mobileTab === "calendar" ? "text-accent-success" : "text-slate-400 hover:text-slate-600"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="text-[10px] font-bold">Calendar</span>
        </button>
        <button onClick={() => setMobileTab("focus")} className={`flex flex-col items-center gap-1 p-2 transition-colors ${mobileTab === "focus" ? "text-accent-frog" : "text-slate-400 hover:text-slate-600"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="text-[10px] font-bold">Focus</span>
        </button>
      </div>

      {/* Mobile Schedule Modal */}
      {activeMobileScheduleItem && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-bold text-lg mb-1 text-slate-900">Schedule Task</h3>
            <p className="text-sm text-slate-500 mb-6 truncate">{activeMobileScheduleItem.title}</p>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Day</label>
                <select
                  value={mobileScheduleDay}
                  onChange={(e) => setMobileScheduleDay(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-accent-violet focus:ring-1 focus:ring-accent-violet/30 transition-all"
                >
                  {Array.from({ length: 7 }).map((_, i) => {
                    const d = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i);
                    return <option key={i} value={format(d, "yyyy-MM-dd")}>{format(d, "EEEE (MMM d)")}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Time</label>
                <input
                  type="time"
                  value={mobileScheduleTime}
                  onChange={(e) => setMobileScheduleTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-accent-violet focus:ring-1 focus:ring-accent-violet/30 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActiveMobileScheduleItem(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const itemId = activeMobileScheduleItem.id;
                  const isWeekendDay = mobileScheduleDay === "Sat" || mobileScheduleDay === "Sun";

                  if (isWeekendDay) {
                    updateTask(itemId, {
                      status: "scheduled",
                      scheduledDay: mobileScheduleDay,
                      startTime: "09:00",
                      endTime: "17:00",
                      type: "flex",
                      colorClass: "flex",
                      description: "Flexible weekend buffer item. Self-directed scheduling.",
                    });
                  } else {
                    const [startHStr, startMStr] = mobileScheduleTime.split(":");
                    const startH = Number(startHStr) || 9;
                    const startM = Number(startMStr) || 0;

                    const durationMins = activeMobileScheduleItem.duration || 60;
                    const totalEndMins = Math.min(startH * 60 + startM + durationMins, 23 * 60 + 59);
                    const endH = Math.floor(totalEndMins / 60);
                    const endM = totalEndMins % 60;

                    const startTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
                    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

                    updateTask(itemId, {
                      status: "scheduled",
                      scheduledDay: mobileScheduleDay,
                      startTime,
                      endTime,
                      type: activeMobileScheduleItem.isFrog ? "frog" : activeMobileScheduleItem.projectBlockType === "polish" ? "polish" : "deep",
                      colorClass: activeMobileScheduleItem.isFrog ? "frog" : activeMobileScheduleItem.projectBlockType === "polish" ? "polish" : "deep",
                      description: "Structured work scheduled via Tap-to-Assign.",
                    });
                  }
                  setActiveMobileScheduleItem(null);
                }}
                className="px-5 py-2 text-sm font-bold text-white bg-accent-violet hover:bg-violet-600 rounded-lg shadow-md shadow-accent-violet/20 transition-all"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium floating overlay preview while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeDragId ? getDragOverlayContent() : null}
      </DragOverlay>

      <EodReflectionModal isOpen={showEodModal} onClose={() => setShowEodModal(false)} />

      {/* ── Cognitive Load Warning Modal ─────────────────────────────── */}
      {cognitiveWarning && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">⚠️ Cognitive Load Warning</h3>
                <p className="text-xs text-slate-500 mt-0.5">Your schedule may be working against your brain.</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed mb-6">
              {cognitiveWarning.message}
            </p>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-amber-700 mb-1">🧠 Research-backed guidance</p>
              <p className="text-xs text-amber-600 leading-relaxed">
                The brain&apos;s prefrontal cortex requires recovery time between high-intensity tasks. A 15-minute buffer significantly reduces decision fatigue and improves output quality in subsequent blocks.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // User accepts: schedule anyway
                  if (cognitiveWarning.pendingUpdate) {
                    const { id, startTime, endTime, scheduledDay } = cognitiveWarning.pendingUpdate;
                    const draggedItem = inboxItems.find((t) => t.id === id);
                    updateTask(id, {
                      status: "scheduled",
                      scheduledDay: scheduledDay || currentDateStr,
                      startTime,
                      endTime,
                      type: draggedItem?.isFrog ? "frog" : draggedItem?.projectBlockType === "polish" ? "polish" : "deep",
                      colorClass: draggedItem?.isFrog ? "frog" : draggedItem?.projectBlockType === "polish" ? "polish" : "deep",
                      description: "Scheduled despite cognitive load warning.",
                    });
                  }
                  setCognitiveWarning(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Schedule Anyway
              </button>
              <button
                onClick={() => setCognitiveWarning(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 transition-all"
              >
                Add 15-min Buffer
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
