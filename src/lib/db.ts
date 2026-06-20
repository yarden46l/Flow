import { db } from "./firebase";
import { format, addDays, nextSaturday, isSaturday } from "date-fns";
import {
  getLocalTasks,
  saveLocalTask,
  saveLocalTasksBatch,
  deleteLocalTask,
  clearUserTasks,
  pushSyncAction,
  getLocalTask,
  getSyncQueue,
  clearSyncAction,
} from "./idb";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  writeBatch,
  where,
} from "firebase/firestore";

// The unified Task interface
export interface Task {
  id: string;
  userId: string;
  title: string;
  status: "inbox" | "scheduled" | "archived";
  createdAt: string;
  isFrog?: boolean;
  duration?: number;
  projectGroupId?: string;
  projectBlockType?: "deep" | "polish";
  scheduledDay?: string; // "Wed", "Sat", etc.
  startTime?: string;
  endTime?: string;
  type?: "fixed" | "frog" | "deep" | "polish" | "flex";
  colorClass?: string;
  description?: string;
  isCompleted?: boolean;
  completedAt?: string;
  /**
   * When true, this block is immutable: it cannot be dragged to a new slot,
   * and the auto-scheduler will treat its time window as occupied.
   * Defaults to false / undefined (treated as false).
   */
  isFixedAnchor?: boolean;
  /**
   * Cognitive energy demand of this task.
   *  HIGH   — complex problem-solving, physics, deep coding, heavy calculations
   *  MEDIUM — standard focused work, reading, writing
   *  LOW    — admin, email, organising notes, errands
   * Used by the Energy-Aware Smart Suggest to route tasks to appropriate time windows.
   */
  energyLevel?: "HIGH" | "MEDIUM" | "LOW";
  /**
   * When true, this task is critical during an active Sprint Mode period.
   * Non-critical tasks are grayed-out / filtered when Sprint Mode is enabled.
   */
  isSprintCritical?: boolean;
  /**
   * Batch Processing Engine fields.
   * When isBatchTask is true, the Micro-Execution Panel replaces the 50:10
   * timer with a quantitative stepper UI that tracks progress toward batchTotal.
   */
  isBatchTask?: boolean;
  /** The target volume (e.g. 40 pages, 20 equations). */
  batchTotal?: number;
  /** Completed volume so far — updated incrementally via the stepper. */
  batchCompleted?: number;
  /** Human-readable unit label displayed on the progress bar (e.g. "pages", "problems"). */
  batchUnitName?: string;
  /** Timestamp for offline sync conflict resolution */
  updatedAt?: number;
}

const TASKS_COLLECTION = "tasks";

export const subscribeToTasks = (userId: string, callback: (tasks: Task[]) => void) => {
  // 1. Instantly return local cached tasks for optimistic fast-boot
  getLocalTasks(userId).then((localTasks) => {
    if (localTasks && localTasks.length > 0) {
      callback(localTasks);
    }
  });

  // 2. Setup Firebase listener
  const q = query(
    collection(db, TASKS_COLLECTION),
    where("userId", "==", userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const tasks: Task[] = [];
    snapshot.forEach((docSnap) => {
      tasks.push(docSnap.data() as Task);
    });
    // Wipe local cache for this user and rewrite to ensure no stale data remains
    clearUserTasks(userId).then(() => {
      saveLocalTasksBatch(tasks).then(() => {
        // Fire callback again with fresh synchronized data
        callback(tasks);
      });
    });
  });
};

export const addTask = async (task: Task) => {
  task.updatedAt = Date.now();

  // Optimistically save to local IDB cache
  await saveLocalTask(task);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Offline mode: push to SyncQueue and return immediately
    await pushSyncAction({ type: "ADD", payload: task, timestamp: Date.now(), userId: task.userId });
    return;
  }

  // Online mode: execute Firebase transaction
  const docRef = doc(db, TASKS_COLLECTION, task.id);
  await setDoc(docRef, task);
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
  updates.updatedAt = Date.now();

  // Optimistically update local IDB cache
  const existingTask = await getLocalTask(id);
  if (existingTask) {
    const updatedTask = { ...existingTask, ...updates };
    await saveLocalTask(updatedTask);
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Offline mode: push to SyncQueue and return immediately
    const userId = existingTask ? existingTask.userId : "unknown"; // best effort fallback
    await pushSyncAction({ type: "UPDATE", payload: { id, updates }, timestamp: Date.now(), userId });
    return;
  }

  // Online mode: execute Firebase transaction
  const docRef = doc(db, TASKS_COLLECTION, id);
  await updateDoc(docRef, updates);
};

export const deleteTask = async (id: string) => {
  // Optimistically remove from local IDB cache
  const existingTask = await getLocalTask(id);
  await deleteLocalTask(id);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Offline mode: push to SyncQueue and return immediately
    const userId = existingTask ? existingTask.userId : "unknown";
    await pushSyncAction({ type: "DELETE", payload: { id }, timestamp: Date.now(), userId });
    return;
  }

  // Online mode: execute Firebase transaction
  const docRef = doc(db, TASKS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const seedDatabase = async (userId: string) => {
  const batch = writeBatch(db);
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekendStr = format(isSaturday(today) ? today : nextSaturday(today), "yyyy-MM-dd");

  const mockTasks: Omit<Task, 'userId'>[] = [
    {
      id: "inbox-item-1",
      title: "Research Sony a6700 vs EOS R7",
      status: "inbox",
      createdAt: "2h",
      energyLevel: "MEDIUM",
      isSprintCritical: false,
    },
    {
      id: "inbox-item-2",
      title: "Buy reusable coffee capsules",
      status: "inbox",
      createdAt: "4h",
      energyLevel: "LOW",
      isSprintCritical: false,
    },
    {
      id: "inbox-item-3",
      title: "Order Decathlon hiking gear",
      status: "inbox",
      createdAt: "1d",
      energyLevel: "LOW",
      isSprintCritical: false,
    },
    {
      id: "event-e1",
      title: "Morning Workout (Low Intensity)",
      status: "scheduled",
      createdAt: "now",
      scheduledDay: todayStr,
      startTime: "07:00",
      endTime: "08:30",
      type: "fixed",
      colorClass: "fixed",
      isFixedAnchor: true,
      energyLevel: "LOW",
      isSprintCritical: true,
      description: "Stretch, core stability, and light aerobic work. Clean starting routine.",
    },
    {
      id: "event-e2",
      title: "Electrostatics & Direct Current Spaced Repetition (Day 1)",
      status: "scheduled",
      createdAt: "now",
      scheduledDay: todayStr,
      startTime: "08:30",
      endTime: "10:00",
      type: "frog",
      colorClass: "frog",
      energyLevel: "HIGH",
      isSprintCritical: true,
      description: "Active recall on lectures, direct current problem-solving. Prime cognitive block.",
    },
    {
      id: "event-e3",
      title: "Industrial Engineering Lectures",
      status: "scheduled",
      createdAt: "now",
      scheduledDay: todayStr,
      startTime: "10:00",
      endTime: "13:00",
      type: "fixed",
      colorClass: "fixed",
      isFixedAnchor: true,
      energyLevel: "HIGH",
      isSprintCritical: true,
      description: "University lecture series on Optimization & Process Analysis.",
    },
    {
      id: "event-e4",
      title: "Process Football Game Action Shots in Lightroom (4h)",
      status: "scheduled",
      createdAt: "now",
      scheduledDay: todayStr,
      startTime: "14:00",
      endTime: "18:00",
      type: "deep",
      colorClass: "deep",
      energyLevel: "HIGH",
      isSprintCritical: false,
      description: "4:2 Project Split - Block 1: Crop, filter, color grade action photos.",
    },
    {
      id: "event-e5",
      title: "Final review and export crowd atmosphere gallery (2h)",
      status: "scheduled",
      createdAt: "now",
      scheduledDay: todayStr,
      startTime: "19:00",
      endTime: "21:00",
      type: "polish",
      colorClass: "polish",
      energyLevel: "MEDIUM",
      isSprintCritical: false,
      description: "4:2 Project Split - Block 2: Metadata tagging, final export, upload.",
    },
    {
      id: "event-w1",
      title: "Sarek National Park trail mapping via Gaia GPS",
      status: "scheduled",
      createdAt: "now",
      scheduledDay: weekendStr,
      startTime: "09:00",
      endTime: "17:00",
      type: "flex",
      colorClass: "flex",
      description: "Weekend Buffer/Flex Event. Trace routes, identify camp sites, export offline maps.",
    },
  ];

  mockTasks.forEach((task) => {
    const taskWithUser = { ...task, userId };
    const docRef = doc(db, TASKS_COLLECTION, task.id);
    batch.set(docRef, taskWithUser);
  });

  await batch.commit();
  window.alert("Database seeded successfully!");
};

export const flushSyncQueue = async () => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const queue = await getSyncQueue();
  if (!queue || queue.length === 0) return;

  for (const action of queue) {
    try {
      if (action.type === "ADD") {
        const docRef = doc(db, TASKS_COLLECTION, action.payload.id);
        await setDoc(docRef, action.payload);
      } else if (action.type === "UPDATE") {
        const docRef = doc(db, TASKS_COLLECTION, action.payload.id);
        const remoteDoc = await getDoc(docRef);
        
        let shouldUpdate = true;
        if (remoteDoc.exists()) {
          const remoteData = remoteDoc.data() as Task;
          const localTimestamp = action.payload.updates.updatedAt || action.timestamp;
          const remoteTimestamp = remoteData.updatedAt || 0;
          
          if (remoteTimestamp > localTimestamp) {
            shouldUpdate = false;
            console.log("Discarded older local update for", action.payload.id);
          }
        }
        
        if (shouldUpdate) {
          await updateDoc(docRef, action.payload.updates);
        }
      } else if (action.type === "DELETE") {
        const docRef = doc(db, TASKS_COLLECTION, action.payload.id);
        await deleteDoc(docRef);
      }
      if (action.id) {
        await clearSyncAction(action.id);
      }
    } catch (e) {
      console.error("Failed to sync action", action, e);
      // We might break here to not sync out of order, or let it continue. 
      // For now, continue but don't clear the failed action so it can retry later.
    }
  }
};
