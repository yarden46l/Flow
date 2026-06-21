# Flow - Development Log

## Rules of Engagement (AI Instruction)
**CRITICAL PROTOCOL:** From this moment forward, EVERY time a new feature is added, a bug is fixed, or a major logic change is implemented, this file MUST be updated simultaneously. 
Each update must include a new timestamped entry explaining the exact changes made to the codebase. 
Failure to update this log during active development is a violation of the project's documentation protocol.

---

## Historical Log

### [2026-06-21] Feature: Delete Inbox Tasks
- **`src/components/CaptureZone.tsx`:** Added `onDeleteItem?: (id: string) => void` prop to `CaptureZoneProps` and `DraggableInboxItem`. Each task card now renders a hover-reveal ✕ button (top-right, visible only on mouse-over) using `opacity-0 group-hover:opacity-100` transition. Clicking it shows a `window.confirm` guard before invoking the delete handler. The button uses `stopPropagation` to avoid triggering drag or tap handlers.
- **`src/app/page.tsx`:** Added `handleDeleteInboxItem` — optimistically removes the task from local React state immediately (`setTasks` filter), then calls `deleteTask(id)` which removes from IndexedDB and Firestore. Imported `deleteTask` from `@/lib/db`. Passed `onDeleteItem={handleDeleteInboxItem}` to `<CaptureZone>`.

### [2026-06-21] Bug Fix: Optimistic Task Add (Enter Key)
- **Root Cause (`src/app/page.tsx`):** When pressing Enter to add a new inbox task, the UI only updated via the Firestore `onSnapshot` callback. If Firestore rejected the write (permissions, network blip) or the round-trip was slow, the SDK would roll back the optimistic local write and fire `onSnapshot` without the new task — causing it to silently disappear.
- **Fix:** Added an immediate optimistic `setTasks((prev) => [...prev, newItem])` call inside `handleAddInboxItem` before the async `addTask()` call. The task now appears in the UI instantly on Enter, and Firestore syncs in the background as before. If the server later reconciles, the `onSnapshot` listener normalises the state.
- **Code Style Cleanup (`src/app/page.tsx`):** Minor whitespace and formatting fixes (trailing spaces on blank lines, consistent template literal formatting) made alongside the bug fix.

### [2026-06-20] Phase 14: Calendar Pagination & View Modes
- **Date Handling & Navigation**: Introduced `date-fns` for robust ISO date handling. Replaced static abstract days (`"Wed"`) with absolute ISO strings (`"yyyy-MM-dd"`) across the application (`page.tsx`, `db.ts`).
- **Dynamic Date Ribbon**: The horizontal day selector in `TimeBlockCanvas` now dynamically generates the 7 days of the current week relative to a `currentDate` state. 
- **View Toggles & Week Grid**: Implemented fully functional toggles between "Day View" and a new "Week View". In Week View, a 7-column layout is rendered with distinct drag-and-drop droppable IDs encoded with their respective dates (`slot-yyyy-MM-dd-HH:MM`).
- **Drag & Drop Engine Update**: Refactored `handleDragEnd` in `page.tsx` to decode the target date and time string from the drop zone ID, enabling precise scheduling across any future or past dates.
### [2026-06-20] Phase 13.3: Sync Reconciliation & Offline UI
- **Reconciliation Engine & Conflict Resolution (`src/lib/db.ts`):** 
  - Added an `updatedAt?: number` field to the `Task` schema.
  - Automatically injected `updatedAt: Date.now()` into all `addTask` and `updateTask` payloads.
  - Upgraded `flushSyncQueue` to fetch the remote document via `getDoc` before performing any `UPDATE` operation.
  - Implemented timestamp comparison: if the local queued change's `updatedAt` is older than the remote Firebase `updatedAt`, the queued action is safely discarded without mutating the server.
- **Offline UI & Network Event Listeners (`src/app/page.tsx`):** 
  - Added robust `online` and `offline` event listeners tied to component state (`isOffline`, `isSyncing`).
  - The UI now automatically triggers `flushSyncQueue()` asynchronously upon reconnection, setting the syncing state.
  - Built conditional header badges to reflect network status: 
    - 🚫 **Offline**: Red badge (Offline - Changes saved locally).
    - 🔄 **Syncing**: Indigo badge with a spinning SVG icon.
    - Badges hide gracefully once synchronization reaches consensus.
- **TypeScript Validation:** `npx tsc --noEmit` passed cleanly with the updated schema and imports.

### [2026-06-20] Phase 13.2: IndexedDB Local State & Action Queue
- **IndexedDB Setup (`src/lib/idb.ts`):** 
  - Integrated the `idb` package to provide a lightweight Promise wrapper over IndexedDB.
  - Initialized database `kaizenflow-db` with two object stores: `tasksCache` (with `id` as keyPath and a `userId` index) and `syncQueue` (auto-incrementing `id`).
  - Created robust helper functions for interacting with both stores (`getLocalTasks`, `saveLocalTask`, `pushSyncAction`, `flushSyncQueue`, etc.).
- **Read Interception (`src/lib/db.ts`):** 
  - Modified `subscribeToTasks` to query `tasksCache` via `idb` immediately. This triggers an initial callback for instant, zero-latency rendering using local state.
  - Maintained the Firestore `onSnapshot` listener as a background sync process, which safely wipes and refreshes the local cache whenever network state mutates.
- **Write Interception (Action Queue):** 
  - Modified all CRUD operations (`addTask`, `updateTask`, `deleteTask`) in `src/lib/db.ts` to implement Optimistic UI caching.
  - Intercepted `!navigator.onLine`. When offline, mutations are applied instantly to `tasksCache` and serialized action objects (`{ type, payload, timestamp, userId }`) are pushed to `syncQueue`, bypassing Firebase execution safely.
- **Reconnect Sync Logic (`src/app/page.tsx`):** Added a `'online'` event listener to the main component's effect hook, which calls `flushSyncQueue()`. This loops through all pending actions in `syncQueue` when the user regains connection, applying them sequentially to Firebase and clearing the queue.
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors.


### [2026-06-20] Phase 13.1: PWA Shell & Static Caching
- **Manifest Configuration (`public/manifest.json`):** Created a PWA manifest defining KaizenFlow as a standalone application. Configured theme colors (`#4f46e5`), display mode, and provided high-contrast abstract minimal icons (`192x192` and `512x512`). Includes a shortcut to jump directly to the Inbox.
- **Service Worker Implementation (`public/sw.js`):** 
  - Authored a custom service worker to circumvent Next.js 16/Turbopack tooling conflicts.
  - Implemented a robust "Cache First, Network Fallback" strategy.
  - Caches core static assets upon install (`/`, `/manifest.json`, `/offline.html`, icons).
  - Intercepts `fetch` events. If the network and cache both fail (offline state) and the request is a navigation request, it gracefully falls back to `/offline.html`.
- **Client Registration (`src/components/PWARegister.tsx`):** Added a new React component to register `/sw.js` safely on the client side (with a `typeof window !== "undefined"` guard). Mounted inside `layout.tsx`.
- **Offline Fallback UI (`public/offline.html`):** Created a branded, standalone offline fallback page that matches the KaizenFlow design language, complete with an SVG icon and a "Try again" reload button.
- **Next.js Configuration:** Cleaned up `next.config.ts` and successfully tested the production build without Webpack plugin interference.

### [2026-06-20] Phase 12: Universal Batch Processing Engine
- **Schema Update (`src/lib/db.ts`):** Added four optional fields to `Task` with JSDoc:
  - `isBatchTask?: boolean` — activates the Batch Engine in the Micro-Execution Panel.
  - `batchTotal?: number` — target volume (e.g. 40 pages, 20 equations).
  - `batchCompleted?: number` — current progress, persisted to Firestore on every increment.
  - `batchUnitName?: string` — display label for the unit (e.g. "pages", "problems", "items").
- **CaptureZone UI (`src/components/CaptureZone.tsx`):**
  - Added a "Batch" toggle button (bar-chart icon) to Row 2 of capture controls, inline with Energy and Sprint buttons. Activates `isBatchTask` state.
  - When active, a conditional indigo panel appears with two inputs: "Total" (number) and "Unit" (text). Both are threaded through `onAddItem` and reset on submit.
  - `onAddItem` prop extended to accept `isBatchTask`, `batchTotal`, `batchUnitName`.
  - Inbox item cards show a live progress badge (`0/40 pages`) when `isBatchTask` is true.
- **`handleAddInboxItem` (`src/app/page.tsx`):** Extended to accept and persist all batch fields. `batchCompleted` is initialised to `0`; `batchTotal` defaults to `10` if blank.
- **Micro-Execution Panel (`src/components/MicroExecutionPanel.tsx`):** Full architectural refactor into three sub-components:
  - **`EmptyState`** — unchanged empty panel.
  - **`BatchEngine`** — replaces the 50:10 timer when `activeTask.isBatchTask === true`:
    - Animated gradient linear progress bar (indigo → violet, transitions to emerald at 100%).
    - Large numeric readout: `{completed} / {total} {unit}` + percentage.
    - 3-button grid quick-stepper: `+1`, `+5`, `+10` with unit label.
    - Custom numeric input + "Add" button (Enter key supported).
    - "Mark Batch Complete" button for manual override.
    - On every increment: calls `updateTask(id, { batchCompleted })`. On reaching `batchTotal`: auto-calls `updateTask(id, { isCompleted: true, completedAt: now })` — single Firestore write, fires only once via `isDone` guard.
    - Task-switch guard: `isFirstRender` ref prevents a spurious Firestore write on initial mount; `useEffect([task.id])` resets state on active task change.
  - **`PomodoroTimer`** — extracted from old monolithic component; logic unchanged (50:10 timer, circular SVG ring, reset/play/complete controls).
  - Root export `MicroExecutionPanel` acts as a router: `if (!activeTask) EmptyState; if (isBatchTask) BatchEngine; else PomodoroTimer`.
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors.

### [2026-06-20] Phase 11: Sprint Mode & Energy-Based Scheduling
- **Schema Update (`src/lib/db.ts`):** Added two new optional fields to `Task`:
  - `energyLevel?: "HIGH" | "MEDIUM" | "LOW"` — cognitive demand classification with JSDoc describing routing intent.
  - `isSprintCritical?: boolean` — marks tasks as mandatory during a Sprint period; non-critical tasks are suppressed in Sprint Mode.
  - Updated all 7 seed tasks with appropriate defaults (lecture/frog/fixed→HIGH/true; inbox errands→LOW/false; photo editing→MEDIUM or HIGH/false).
- **Sprint Recall Engine (`src/utils/spacedRepetition.ts`):** Added `generateSprintRecallReviews(baseTitle)` — produces 3 accelerated recall items at +12h, +24h, +48h (labelled "⚡ Sprint Recall") instead of the standard 7-day 2357 spread. Review blocks are 20 min (vs 30 min standard) and auto-tagged `isSprintCritical: true, energyLevel: "HIGH"`.
- **Global Sprint Mode Toggle (`src/app/page.tsx`):**
  - `isSprintMode` boolean state added.
  - **Header button:** amber pulsing button (⚡ Sprint / Sprint ON) toggles the state. Visual: `bg-amber-500 animate-pulse` when active.
  - **Alert banner:** Full-width amber strip pinned below the header when active — "⚡ SPRINT MODE ACTIVE — High-focus execution phase. Non-critical tasks suppressed. Recall schedule accelerated (+12h/+24h/+48h)." with an ✕ dismiss button.
  - **Recall routing:** `handleAddInboxItem` now branches on `isSprintMode` — sprint path calls `generateSprintRecallReviews`, normal path calls `generate2357Reviews`.
- **Energy-Aware Smart Suggest (`src/app/page.tsx`):** Extended `isSlotAvailable()` with an `energy` parameter:
  - `HIGH` → restricted to pre-noon slots (07:00–11:59) — peak morning cognitive window.
  - `LOW`  → restricted to afternoon/evening (13:00+) — low-stakes buffer.
  - `MEDIUM` → full-day access minus friction zones.
  - `isSlotAvailable()` called with `item.energyLevel` for every inbox item during scheduling.
- **CaptureZone UI (`src/components/CaptureZone.tsx`):** Full rewrite adding:
  - **Energy Level 3-way toggle** (⚡ HIGH / 🔵 Med / 🌿 Low) — inline compact control below the capture input. Selected level highlighted with colour-coded border. Resets to MEDIUM after submission.
  - **Sprint Critical toggle** (⚡ Sprint) — amber badge button; resets after submission.
  - **Energy badges** on inbox item cards — colour-coded pill next to the Frog badge.
  - **"⚡ Sprint" badge** on sprint-critical items.
  - **Sprint suppression:** Non-critical items are rendered at `opacity-35 grayscale-[60%]` in Sprint Mode with a "Non-critical" overlay badge. A suppressed count indicator appears in the list header.
  - Sprint Mode shifts the Smart Suggest button to amber (`⚡ Sprint Suggest`) and the pane background to a subtle `slate-900/[0.03]` tint.
- **Version Badge:** Updated from `v1.0.0-phase9` → `v1.0.0-phase11`.
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors.

### [2026-06-20] Phase 10: Fixed Anchors & Weekend Flexibility
- **Schema Update (`src/lib/db.ts`):** Added `isFixedAnchor?: boolean` to the `Task` interface with a JSDoc comment explaining its semantics. Updated `seedDatabase()` to set `isFixedAnchor: true` on the two `type: "fixed"` events (`event-e1` Morning Workout, `event-e3` Industrial Engineering Lectures), giving them immutable status out of the box.
- **Immutable Block Logic (`src/app/page.tsx`):**
  - **Case 1 (Inbox → Slot):** After the Frog time validation, added a Fixed-Anchor Overlap Guard. Computes the proposed task's minute range and checks it against all `isFixedAnchor === true` events on the selected day. If any overlap is found, the drop is rejected with a clear alert; no Firestore write occurs.
  - **Case 2 (Event → Slot / Rescheduling):** Added an early `if (evt.isFixedAnchor) return;` guard at the top of the rescheduling branch. Since the card's `useDraggable` is already `disabled` for locked events, this is a belt-and-suspenders server-side guard that prevents a race condition from ever committing a move.
- **Smart Suggest Weekend Guard (`src/app/page.tsx`):** Added an early return in `handleSmartSuggest` if `selectedDay` is `"Sat"` or `"Sun"`, alerting the user that weekends are Flexibility Zones and to switch to a weekday. Fixed anchors' occupied minutes are always included in the conflict map regardless.
- **Visual Differentiation (`src/components/TimeBlockCanvas.tsx`):**
  - **Lock Icon:** `DraggableEvent` now checks `isLocked = isFixed || !!event.isFixedAnchor`. Locked cards render a padlock SVG icon next to the title, a dashed `border-slate-300` muted background, `cursor: default`, and a "🔒 Fixed Anchor" badge with a padlock icon in the footer.
  - **Weekend Day Buttons:** Saturday and Sunday pills in the week-selector bar now use emerald styling (`border-emerald-200`, `bg-emerald-50/60`, `text-emerald-600`) and display a small "Flex" sub-label, clearly distinguishing them from Deep Work weekdays.
  - **Weekend Panel:** The weekend flex view now opens with a green info banner reading "Weekend Flexibility Zone — No Deep Work or Frog tasks are auto-scheduled here. This time is yours." The outer panel border also shifts to `border-emerald-200 bg-emerald-50/20`.
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors.

### [2026-06-20] Phase 9.3: Kaizen Trend Visualizer
- **EOD Persistence (`EodReflectionModal.tsx`):** Extracted `EodEntry` type and `loadEodEntries()` as named exports. Added `saveEodEntry()` which persists each submission to `localStorage` under key `kaizenflow_eod_reflections`, keyed by ISO date (de-duplicates same-day entries). The dashboard can now read historical EOD data client-side with no new backend dependency.
- **SVG Line Chart (`AnalyticsDashboard.tsx`):** Built a fully responsive pure-SVG `ImprovementChart` component (no external charting library). Renders a 7-day trend of `improvementScore` with: gradient area fill, indigo-to-indigo-400 stroke gradient, labeled data points, Y-axis grid lines at 0/25/50/75/100, X-axis day labels, and green dot markers on days where an EOD reflection was submitted. Scales via `viewBox` + `w-full h-auto` to respect the `md:` responsive layout.
- **Improvement Score Badge:** Live score rendered in the dashboard header with a colour-coded badge (emerald ≥ 75, amber ≥ 50, red < 50) and a day-over-day delta indicator (▲/▼).
- **KPI Stat Cards:** Replaced the old 3-card grid with a 4-card responsive `2 cols → 4 cols md:` layout: Execution Rate, Frog Discipline, Blocks Completed, and Streak (consecutive active days derived from `completedAt` timestamps).
- **Frog Insight Banner:** Renders the `frogInsight` object from `frictionAnalyzer` as a coloured banner (emerald for good discipline, red for delay detected) with the completion-rate percentage.
- **EOD Correlation Panel:** Lists the last 7 EOD entries with their daily improvement score badge, `whatWorked`, and `improveTomorrow` fields. Shows an empty-state prompt when no reflections have been logged.
- **Friction Zone Cards:** Replaced the plain list with a 2-column responsive card grid. Each card shows a circular SVG miss-rate ring and the contextual reason from `frictionAnalyzer`.
- **Missed Blocks:** Updated styling to match the Phase 8 design system (slate/indigo, `rounded-2xl`, `shadow-md`, hover `transition-all duration-200`).
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors.

### [2026-06-20] Phase 9.2: Smart Scheduling Integration
- **Smart Suggest Button (`CaptureZone.tsx`):** Added `onSmartSuggest` and `isSmartSuggestRunning` props to `CaptureZone`. Rendered a full-width "✨ Smart Suggest" button above the inbox list (disabled + dimmed when inbox is empty; shows spinner while running). Uses Indigo-600 accent consistent with Phase 8 design system.
- **Auto-Scheduler Logic (`page.tsx` — `handleSmartSuggest`):** On click, calls `analyzeFriction(tasks)` from Phase 9.1 to identify friction-zone hours. Builds a conflict map of already-occupied minutes for the selected day. Iterates inbox items with Frogs ordered first; for each item finds the earliest 30-minute-aligned slot that is (a) not in a friction zone, and (b) conflict-free. Frog tasks are additionally hard-constrained to start before 12:00. All updates are committed in a single `Promise.all` batch.
- **Frog Enforcement:** `isSlotAvailable()` returns `false` for any slot ≥ 12:00 when `isFrogTask` is true, guaranteeing Frog tasks always land in the morning Deep Work window.
- **Cognitive Load Warning (`page.tsx`):** In `handleDragEnd`, after Frog and 4:2 validations pass, the code checks if the newly dropped task (type `frog` or `deep`, duration ≥ 120 min) would sit directly adjacent (≤ 5 min gap) to an existing heavy block on the same day. If so, instead of committing the update, it stores a `cognitiveWarning` state with a descriptive message and a `pendingUpdate`. A modal (`z-[70]`) renders with the warning, a research-backed rationale card, and two CTAs: "Add 15-min Buffer" (dismisses the drop, user repositions) and "Schedule Anyway" (commits the pending update regardless).
- **Version Badge:** Updated header badge from `v1.0.0-phase8` → `v1.0.0-phase9`.
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors.

### [2026-06-20] Phase 9.1: Friction Analysis Engine
- **New File:** Created `src/utils/frictionAnalyzer.ts` — a pure TypeScript logic module with zero UI side-effects.
- **Core Function:** `analyzeFriction(tasks: Task[]): FrictionAnalysisResult` accepts the full task array and filters internally to scheduled/archived tasks within a 7-day lookback window.
- **Friction Zone Detection:** Tasks are bucketed into 2-hour windows (00:00–02:00, 02:00–04:00, … 22:00–24:00). Any window where ≥ 40% of scheduled tasks were not completed is surfaced as a `FrictionZone` with a `missRate`, label, and contextual `reason` (e.g. afternoon slump, late-night fatigue). Zones are returned worst-first.
- **Frog Task Insight:** Separately tracks tasks where `isFrog === true` or `type === "frog"`. If frog completion rate is ≥ 15 percentage points below regular task completion rate, a `frogDelayDetected` flag is set with a plain-English summary encouraging earlier scheduling.
- **Improvement Score:** Holistic 0–100 score computed as: `base completion rate − frog delay penalty (10 pts) + no-friction-zone bonus (5 pts)`, clamped to [0, 100].
- **Type Exports:** Three new types exported — `FrictionZone`, `FrogInsight`, `FrictionAnalysisResult` — for use by the Kaizen Analytics UI in a future phase.
- **TypeScript Validation:** `npx tsc --noEmit` passed with zero errors against the existing `tsconfig.json`.

### [2026-06-20] Phase 8: UI/UX Visual Refinement (Pro Level)
- **Typography & Color System:** Replaced "Outfit" font with "Inter" for a cleaner, modern look. Updated the color palette to use `slate-50` for backgrounds, `slate-900` for high-contrast text, and a refined `indigo-600` for primary accents (replacing violet).
- **Depth & Elevation:** Replaced flat borders with subtle depth using `shadow-sm` and `shadow-md` utilities. Rounded all primary container corners to `rounded-2xl` and internal cards to `rounded-xl` for a sophisticated, softer appearance.
- **Micro-interactions:** Added global `transition-all duration-200 ease-in-out` utilities to interactive elements (buttons, drag items, nav icons) for smooth hover and active states. 
- **Component Polish:** Refined "Frog" tasks to use a subtle red left-border and light red background instead of harsh red boxes. Improved the Calendar grid with subtle `slate-100` lines and a clean `ring-indigo-500` active state ring.

### [2026-06-20] Phase 7: Mobile Responsiveness & Touch Support
- **Responsive Layout Refactoring:** Refactored the 3-pane desktop layout in `src/app/page.tsx` using Tailwind breakpoints (`md:`). On desktop, the 3-pane view is maintained. On mobile, only one active pane is shown at a time. The app layout is restricted to 100vh.
- **Mobile Bottom Navigation:** Added a sticky Bottom Navigation Bar visible only on mobile screens. Includes "Inbox", "Calendar", and "Focus" tabs that seamlessly switch the active pane.
- **Touch Support for Drag & Drop:** Integrated `TouchSensor` into the `@dnd-kit/core` `useSensors` configuration with appropriate constraints to allow touch dragging without blocking normal vertical scrolling.
- **"Tap to Assign" Mobile Fallback:** Added an `onItemTap` handler to Inbox items in `CaptureZone.tsx`. On mobile screens, tapping an inbox item opens a `MobileScheduleModal` allowing the user to select the day and time to quickly assign the task without needing to cross-tab drag.

### [2026-06-20] Phase 6: User Authentication & Kaizen Analytics Dashboard
- **Firebase Authentication:** Configured `src/lib/firebase.ts` to export `auth`. Built `src/components/AuthScreen.tsx` providing a clean UI for Email/Password sign-up and login.
- **Route Protection & User Sandboxing:** Refactored `src/app/page.tsx` to use `onAuthStateChanged`. The main 3-pane workspace is now protected behind authentication. Updated `src/lib/db.ts` `Task` schema to enforce `userId` tracking, and updated Firestore queries to use `where("userId", "==", userId)` ensuring users only access their own data.
- **Task Completion Mechanism:** Added a "Mark Complete" button to `src/components/MicroExecutionPanel.tsx` which updates the database with `isCompleted: true`.
- **Kaizen Analytics Dashboard (Module D):** Built `src/components/AnalyticsDashboard.tsx` to provide visual metrics (Completed vs Missed time blocks, Frog Completion Rate) and identify missed blocks as "Friction Points" for adaptation.
- **Navigation Toggle:** Added a dynamic UI toggle in the `page.tsx` header to seamlessly switch between the Workspace view and the Analytics Dashboard. Added a secure Logout button.
### [2026-06-20] Phase 5: Cloud Database Integration & Data Persistence
- **Firebase Initialization:** Installed the `firebase` package and configured `src/lib/firebase.ts` to initialize the app using credentials from `.env.local`.
- **Database Schema & CRUD:** Created `src/lib/db.ts` defining a unified `Task` interface replacing separate `InboxItem` and `CalendarEvent` types. Implemented `addTask`, `updateTask`, `deleteTask`, and `subscribeToTasks` for real-time Firestore synchronization. Included a `seedDatabase` batch operation for injecting initial mock data.
- **State Refactoring & Optimistic UI:** Completely refactored `src/app/page.tsx` to remove hardcoded mock arrays and client-side `useState` arrays. Integrated `onSnapshot` listener to map Firestore data directly to UI state, leveraging native latency compensation for seamless drag-and-drop experiences.
- **Component Updates:** Refactored `CaptureZone.tsx`, `TimeBlockCanvas.tsx`, and `MicroExecutionPanel.tsx` to adopt the new unified `Task` schema.
- **Engines Preserved:** Validated that the 50:10 Timer and 2357 Spaced Repetition Engine remain functional against the new Firestore data model.

### [2026-06-20] Phase 4: Task Processing Logic & The 4:2 Project Splitter
- **2-Minute Rule Validation:** Added a duration input in the `CaptureZone` (Left Pane). Tasks estimated at < 2 minutes trigger an immediate `window.alert` suggesting "Do It Now!" and prevent the task from entering the Inbox queue.
- **"Eat the Frog" Tagging & Validation:** Implemented a Frog toggle button in the `CaptureZone`. Frog tasks are distinctively styled with red borders/badges in the Inbox. Enforced scheduling constraints via drag-and-drop validation in `page.tsx` preventing Frog tasks from being scheduled at or after 12:00 PM.
- **4:2 Project Splitter:** Added a "+ 4:2 Project" template button that prompts for a project name and auto-generates two dependent inbox items: a 4h "Deep Work" block and a 2h "Polish/Editing" block. Enhanced `CalendarEvent` generation to dynamically size blocks based on duration. Added complex dependency validation ensuring the 2h block cannot be scheduled before or overlap the 4h block finishes.
- **File Modifications:** 
  - `src/components/CaptureZone.tsx`: UI inputs for duration/frog/projects and validation interception.
  - `src/app/page.tsx`: Interface updates, state handlers, and robust validation rules within `handleDragEnd`.
  - `DEVELOPMENT_LOG.md`: Updated according to rules of engagement.


### [2026-06-20] Phase 3: The Micro-Execution Panel & Spaced Repetition Engine
- **Active Task Selection:** Implemented logic allowing users to click any scheduled task in the Center Pane (Calendar) to set it as the "Active Task" in the global state.
- **50:10 Timer Implementation:** Built a fully functional Pomodoro-style countdown timer (50 minutes work, 10 minutes break) in the Right Pane, complete with Start, Pause, and Reset controls. Engineered using React `useRef` and `useEffect` to ensure lifecycle stability without memory leaks.
- **"2357" Spaced Repetition Engine:** Created a utility (`src/utils/spacedRepetition.ts`) that listens for specific keywords ("Lecture", "Study Material", "Summary") added to the Inbox. Automatically generates and pushes future review tasks into the Inbox state corresponding to Day 1, 3, 5, and 7.
- **EOD Reflection Modal:** Created a togglable modal (`EodReflectionModal.tsx`) containing a simple form with the three EOD questions (What worked? Where was time wasted? How will I improve by 1% tomorrow?).

### [2026-06-20] Phase 2: Interactivity & Drag-and-Drop Implementation
- **Drag-and-Drop functionality:** Integrated `@dnd-kit/core` and utilities.
- **State management:** Implemented logic for moving tasks from the Left Pane (Inbox) into Center Pane (Calendar) time slots.
- **UX Feedback:** Added visual drag feedback (shadows, opacity, active borders) to improve user interaction during task allocation.

### [2026-06-20] Phase 1: Static UI Scaffolding & Core Layout
- **Initial Setup:** Scaffolded a React/Next.js application with Tailwind CSS.
- **Static 3-Pane Layout:** Created the core architecture:
  - Left Pane (Capture Zone): Placeholder for Inbox input field and list.
  - Center Pane (Time Block Canvas): Static daily/weekly calendar grid view.
  - Right Pane (Micro-Execution Panel): Static placeholders for timer and active task.
- **Mock Data Injection:** Populated the UI with initial PRD mock data to validate the layout structure.
- **Theming & Branding:** Renamed the app to "Flow" and established a clean, white-mode aesthetic.
