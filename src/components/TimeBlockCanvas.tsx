"use client";

import React from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, addDays, subDays, startOfWeek, isSameDay, isWeekend, addWeeks, subWeeks, parseISO } from "date-fns";

import { Task } from "@/lib/db";

interface TimeBlockCanvasProps {
  weekdayEvents: Task[];
  weekendEvents: Task[];
  currentDate: Date;
  setCurrentDate: (day: Date) => void;
  viewMode: "day" | "week";
  setViewMode: (mode: "day" | "week") => void;
  onSelectEvent?: (event: Task) => void;
  activeEventId?: string | null;
}

// Droppable Hourly Row Component
function HourlyDropSlot({ hour, top, height, dateStr }: { hour: number; top: string; height: string; dateStr: string }) {
  const hourStr = `${String(hour).padStart(2, "0")}:00`;
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${dateStr}-${hourStr}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 border-b border-slate-100 flex items-center justify-end pr-4 transition-colors duration-150 ${
        isOver ? "bg-accent-violet/[0.06] border-y border-dashed border-accent-violet/30 z-10" : ""
      }`}
      style={{ top, height }}
    >
      {isOver && (
        <span className="text-[10px] font-bold text-accent-violet/70 uppercase tracking-widest pointer-events-none select-none">
          Schedule block for {hourStr}
        </span>
      )}
    </div>
  );
}

// Draggable Event Card Component
function DraggableEvent({ event, style, onSelect, isActive, isCompact = false }: { event: Task; style: React.CSSProperties; onSelect?: (event: Task) => void; isActive?: boolean; isCompact?: boolean }) {
  const isFixed = event.type === "fixed";
  const isLocked = isFixed || !!event.isFixedAnchor;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: isLocked,
  });

  const dragStyle = {
    ...style,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : undefined,
    cursor: isLocked ? "default" : isDragging ? "grabbing" : "grab",
  };

  const isFrog = event.type === "frog";

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(event);
      }}
      className={`absolute left-0 right-0 p-2 sm:p-3 rounded-xl border transition-all duration-200 ease-in-out flex flex-col justify-between group overflow-hidden ${
        isLocked
          ? "shadow-none"
          : "shadow-sm hover:shadow-md"
      } ${
        isFrog
          ? "bg-red-50/50 border-red-200 hover:border-red-300"
          : isLocked
          ? "bg-slate-100/80 border-slate-300 border-dashed opacity-80"
          : "bg-indigo-50/40 border-accent-violet/20 hover:border-accent-violet/40"
      } ${isDragging ? "shadow-2xl border-accent-violet/40 z-50 scale-[1.02]" : ""} ${
        isActive ? "ring-2 ring-accent-violet ring-offset-2 ring-offset-white z-20" : ""
      }`}
    >
      <div>
        {/* Event Header */}
        <div className={`flex ${isCompact ? 'flex-col items-start gap-0.5' : 'items-start justify-between gap-2'}`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {isLocked && !isCompact && (
              <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {isFrog && (
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-frog opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-frog"></span>
              </span>
            )}
            <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-clip group-hover:whitespace-normal select-none">
              {event.title}
            </h4>
          </div>
          {!isCompact && (
            <span className="text-[10px] text-slate-400 font-mono shrink-0 select-none">
              {event.startTime} - {event.endTime}
            </span>
          )}
        </div>
        {!isCompact && (
          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 select-none">{event.description}</p>
        )}
      </div>

      {/* Badge Indicator Footer */}
      {!isCompact && (
        <div className="flex items-center gap-2 mt-2 select-none flex-wrap">
          {isFrog && (
            <span className="text-[9px] font-bold bg-red-100 text-accent-frog px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider">
              Frog
            </span>
          )}
          {event.type === "deep" && (
            <span className="text-[9px] font-bold bg-indigo-100 text-accent-violet px-1.5 py-0.5 rounded border border-indigo-200 uppercase tracking-wider">
              Deep
            </span>
          )}
          {event.type === "polish" && (
            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Polish
            </span>
          )}
          {isLocked && (
            <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              Fixed
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Draggable Weekend Card
function DraggableWeekendCard({ event, onSelect, isActive }: { event: Task; onSelect?: (event: Task) => void; isActive?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
  });

  const dragStyle = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(event);
      }}
      className={`flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all duration-200 ease-in-out cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md ${
        isDragging ? "shadow-2xl border-accent-violet/40 z-50 scale-[1.02]" : ""
      } ${
        isActive ? "ring-2 ring-accent-violet ring-offset-2 ring-offset-white" : ""
      }`}
    >
      <div className="mt-1 w-2.5 h-2.5 rounded-full bg-accent-success shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
      <div className="flex-1 select-none min-w-0">
        <h4 className="text-sm font-semibold text-slate-800 truncate">{event.title}</h4>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{event.description || "Self-directed deep exploration."}</p>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[10px] font-medium bg-emerald-50 text-accent-success px-2 py-0.5 rounded border border-emerald-200 shrink-0">
            Flex Buffer
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">{event.startTime} - {event.endTime}</span>
        </div>
      </div>
    </div>
  );
}

export default function TimeBlockCanvas({
  weekdayEvents,
  weekendEvents,
  currentDate,
  setCurrentDate,
  viewMode,
  setViewMode,
  onSelectEvent,
  activeEventId,
}: TimeBlockCanvasProps) {
  // Navigation
  const handlePrev = () => {
    if (viewMode === "day") {
      setCurrentDate(subDays(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday is 1
  
  const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
    const dayDate = addDays(startOfCurrentWeek, i);
    return {
      dateObj: dayDate,
      key: format(dayDate, "yyyy-MM-dd"),
      label: format(dayDate, "EEEEE"), // M, T, W...
      date: format(dayDate, "d"),
      name: format(dayDate, "EEEE"),
    };
  });

  const currentDayInfo = daysOfWeek.find((d) => isSameDay(d.dateObj, currentDate)) || daysOfWeek[0];
  const isWeekendDay = isWeekend(currentDate);

  // Generate hourly slots from 06:00 to 22:00
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  // Helper to convert "HH:MM" to top position percentage relative to the grid
  const getEventStyle = (start: string, end: string) => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    
    const startMinutes = (startH - 6) * 60 + startM;
    const endMinutes = (endH - 6) * 60 + endM;
    const totalMinutes = 17 * 60;

    const top = (startMinutes / totalMinutes) * 100;
    const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return {
      top: `${top}%`,
      height: `${height}%`,
    };
  };

  const { setNodeRef: setWeekendDropRef, isOver: isWeekendOver } = useDroppable({
    id: `slot-weekend-${format(currentDate, "yyyy-MM-dd")}`,
  });

  const allEvents = [...weekdayEvents, ...weekendEvents];
  const eventsForCurrentDay = allEvents.filter((e) => e.scheduledDay === format(currentDate, "yyyy-MM-dd"));

  return (
    <div className="flex flex-col h-full bg-white p-6 overflow-y-auto">
      {/* Canvas Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-success" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Time Block Canvas</h2>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            <button onClick={handlePrev} className="p-1 rounded hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            {viewMode === "day" ? (
              <>{currentDayInfo.name}, {format(currentDate, "MMM d")}</>
            ) : (
              <>{format(daysOfWeek[0].dateObj, "MMM d")} - {format(daysOfWeek[6].dateObj, "MMM d")}</>
            )}
            <button onClick={handleNext} className="p-1 rounded hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </h1>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 p-1 rounded-lg border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode("day")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === "day" ? "bg-accent-violet text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            Day View
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === "week" ? "bg-accent-violet text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            Week View
          </button>
        </div>
      </div>

      {/* Week Selector Bar */}
      <div className="grid grid-cols-7 gap-2 mb-6 select-none">
        {daysOfWeek.map((day) => {
          const isActive = isSameDay(day.dateObj, currentDate);
          const isToday = isSameDay(day.dateObj, new Date());
          const isDayWeekend = isWeekend(day.dateObj);
          return (
            <button
              key={day.key}
              onClick={() => {
                setCurrentDate(day.dateObj);
                setViewMode("day");
              }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200 ${
                isActive && viewMode === "day"
                  ? isDayWeekend
                    ? "bg-emerald-500/10 border-emerald-400 text-emerald-800 shadow-sm"
                    : "bg-accent-violet/10 border-accent-violet text-slate-900 shadow-sm"
                  : isDayWeekend
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:shadow-sm"
                  : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:shadow-sm"
              } relative`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">{day.label}</span>
              <span className="text-base font-bold mt-0.5">{day.date}</span>
              {isDayWeekend && (!isActive || viewMode === "week") && (
                <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-500 mt-0.5">Flex</span>
              )}
              {isToday && (
                <span className="absolute -top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-violet opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-violet"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Grid View */}
      {viewMode === "day" ? (
        /* DAY VIEW */
        isWeekendDay ? (
          /* Weekend Flex UI */
          <div
            ref={setWeekendDropRef}
            className={`flex-1 flex flex-col justify-center items-center p-8 border border-dashed rounded-2xl transition-all duration-200 ${
              isWeekendOver
                ? "border-accent-success bg-emerald-50/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
                : "border-emerald-200 bg-emerald-50/20"
            }`}
          >
            {/* Weekend No-Deep-Work Banner */}
            <div className="w-full max-w-md mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-xs font-semibold text-emerald-700">
                <span className="font-bold">Weekend Flexibility Zone</span> — No Deep Work or Frog tasks are auto-scheduled here. This time is yours.
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4 text-accent-success">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Weekend Buffer & Flex Time</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm mt-1 mb-6">
              Saturdays and Sundays have no rigid scheduling. Drop tasks here to absorb them as flexible weekend items.
            </p>

            <div className="w-full max-w-md space-y-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest select-none">
                Flexible Actions scheduled for this date:
              </div>
              {eventsForCurrentDay.map((event) => (
                <DraggableWeekendCard key={event.id} event={event} onSelect={onSelectEvent} isActive={activeEventId === event.id} />
              ))}
              {eventsForCurrentDay.length === 0 && (
                <p className="text-xs text-slate-400 text-center italic mt-2">No items. Drop tasks here to add.</p>
              )}
            </div>
          </div>
        ) : (
          /* Weekday strict Focus Day View */
          <div className="flex-1 flex gap-4 min-h-[700px] border border-slate-200 rounded-2xl bg-white p-4 relative shadow-sm">
            {/* Deep Work Prime Hour Glow Indicator (08:00 - 12:00) */}
            <div className="absolute left-[70px] right-4 top-[11.76%] bottom-[64.7%] bg-indigo-50/30 border-y border-dashed border-accent-violet/10 rounded-lg pointer-events-none flex items-center justify-end pr-4 select-none">
              <span className="text-[9px] font-bold uppercase tracking-widest text-accent-violet/30 writing-mode-vertical">
                Prime Deep Work Window
              </span>
            </div>

            {/* Time Column */}
            <div className="w-12 flex flex-col justify-between text-[11px] font-semibold text-slate-400 font-mono pr-2 select-none">
              {hours.map((hour) => (
                <div key={hour} className="h-[5.88%] flex items-start justify-end pt-1">
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Grid Area with Droppable Hourly Slots */}
            <div className="flex-1 relative border-l border-slate-100">
              {hours.map((hour, idx) => {
                const top = `${(idx / hours.length) * 100}%`;
                const height = `${(1 / hours.length) * 100}%`;
                return (
                  <HourlyDropSlot
                    key={hour}
                    hour={hour}
                    top={top}
                    height={height}
                    dateStr={format(currentDate, "yyyy-MM-dd")}
                  />
                );
              })}

              {/* Events Overlay Container */}
              <div className="absolute inset-0 left-2 right-2 pointer-events-none">
                {eventsForCurrentDay.map((event) => {
                  if (!event.startTime || !event.endTime) return null;
                  const style = getEventStyle(event.startTime, event.endTime);
                  return (
                    <DraggableEvent
                      key={event.id}
                      event={event}
                      style={{ ...style, pointerEvents: "auto" }}
                      onSelect={onSelectEvent}
                      isActive={activeEventId === event.id}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )
      ) : (
        /* WEEK VIEW */
        <div className="flex-1 flex min-h-[700px] border border-slate-200 rounded-2xl bg-white relative shadow-sm overflow-x-auto">
          {/* Time Column */}
          <div className="w-12 shrink-0 flex flex-col justify-between text-[10px] font-semibold text-slate-400 font-mono pr-1 py-4 select-none sticky left-0 bg-white z-30 border-r border-slate-100">
            {hours.map((hour) => (
              <div key={hour} className="h-[5.88%] flex items-start justify-end pt-1">
                {String(hour).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* 7 Columns Container */}
          <div className="flex-1 flex min-w-[700px] py-4 pr-4">
            {daysOfWeek.map((day) => {
              const isDayWeekend = isWeekend(day.dateObj);
              const dayEvents = allEvents.filter((e) => e.scheduledDay === day.key);
              
              return (
                <div key={day.key} className="flex-1 relative border-l border-slate-100 first:border-l-0 min-w-[100px]">
                  {/* Column Header (Optional but good for clarity in grid) */}
                  <div className="absolute -top-4 left-0 right-0 text-center text-[10px] font-bold text-slate-400 mb-2 select-none">
                    {day.label}
                  </div>

                  {hours.map((hour, idx) => {
                    const top = `${(idx / hours.length) * 100}%`;
                    const height = `${(1 / hours.length) * 100}%`;
                    return (
                      <HourlyDropSlot
                        key={`${day.key}-${hour}`}
                        hour={hour}
                        top={top}
                        height={height}
                        dateStr={day.key}
                      />
                    );
                  })}

                  {/* Weekend Background Overlay */}
                  {isDayWeekend && (
                    <div className="absolute inset-0 bg-emerald-50/20 pointer-events-none" />
                  )}

                  {/* Events Overlay Container */}
                  <div className="absolute inset-0 left-1 right-1 pointer-events-none">
                    {dayEvents.map((event) => {
                      if (!event.startTime || !event.endTime) return null;
                      const style = getEventStyle(event.startTime, event.endTime);
                      return (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          style={{ ...style, pointerEvents: "auto" }}
                          onSelect={onSelectEvent}
                          isActive={activeEventId === event.id}
                          isCompact={true}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
