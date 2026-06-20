import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Task } from './db';

export type SyncActionType = 'ADD' | 'UPDATE' | 'DELETE';

export interface SyncAction {
  id?: number;
  type: SyncActionType;
  payload: any;
  timestamp: number;
  userId: string;
}

interface KaizenFlowDB extends DBSchema {
  tasksCache: {
    key: string;
    value: Task;
    indexes: { 'by-user': string };
  };
  syncQueue: {
    key: number;
    value: SyncAction;
  };
}

let dbPromise: Promise<IDBPDatabase<KaizenFlowDB>> | null = null;

export function initDB() {
  if (typeof window === 'undefined') return null;
  
  if (!dbPromise) {
    dbPromise = openDB<KaizenFlowDB>('kaizenflow-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasksCache')) {
          const tasksStore = db.createObjectStore('tasksCache', { keyPath: 'id' });
          tasksStore.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// --- tasksCache operations ---

export async function getLocalTasks(userId: string): Promise<Task[]> {
  const db = await initDB();
  if (!db) return [];
  return db.getAllFromIndex('tasksCache', 'by-user', userId);
}

export async function getLocalTask(taskId: string): Promise<Task | undefined> {
  const db = await initDB();
  if (!db) return undefined;
  return db.get('tasksCache', taskId);
}

export async function clearUserTasks(userId: string) {
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction('tasksCache', 'readwrite');
  const index = tx.store.index('by-user');
  let cursor = await index.openCursor(IDBKeyRange.only(userId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function saveLocalTask(task: Task) {
  const db = await initDB();
  if (!db) return;
  await db.put('tasksCache', task);
}

export async function saveLocalTasksBatch(tasks: Task[]) {
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction('tasksCache', 'readwrite');
  for (const task of tasks) {
    tx.store.put(task);
  }
  await tx.done;
}

export async function deleteLocalTask(taskId: string) {
  const db = await initDB();
  if (!db) return;
  await db.delete('tasksCache', taskId);
}

// --- syncQueue operations ---

export async function pushSyncAction(action: Omit<SyncAction, 'id'>) {
  const db = await initDB();
  if (!db) return;
  await db.add('syncQueue', action);
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  const db = await initDB();
  if (!db) return [];
  return db.getAll('syncQueue');
}

export async function clearSyncAction(id: number) {
  const db = await initDB();
  if (!db) return;
  await db.delete('syncQueue', id);
}
