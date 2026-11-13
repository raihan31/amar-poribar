import { api } from "@/lib/api/client";
import { ApiProblem } from "@/lib/api/errors";

/** One entry waiting for the network. `id` is also the Idempotency-Key, so a retry never doubles it. */
export interface OutboxEntry {
  id: string;
  familyId: string;
  body: Record<string, unknown> & { id: string };
  queuedAt: string;
}

const DB_NAME = "outbox";
const STORE = "entries";

// Used when IndexedDB is missing (private windows, tests).
const memory = new Map<string, OutboxEntry>();

export function resetOutboxMemory() {
  memory.clear();
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(entry: OutboxEntry): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory.set(entry.id, entry);
    return;
  }
  try {
    await run(db, "readwrite", (s) => s.put(entry));
  } catch {
    memory.set(entry.id, entry);
  } finally {
    db.close();
  }
}

export async function listOutbox(familyId?: string): Promise<OutboxEntry[]> {
  const db = await openDb();
  let all: OutboxEntry[] = [...memory.values()];
  if (db) {
    try {
      all = [...all, ...(await run<OutboxEntry[]>(db, "readonly", (s) => s.getAll()))];
    } catch {
      /* fall back to memory only */
    } finally {
      db.close();
    }
  }
  return all.filter((e) => !familyId || e.familyId === familyId).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

async function remove(id: string): Promise<void> {
  memory.delete(id);
  const db = await openDb();
  if (!db) return;
  try {
    await run(db, "readwrite", (s) => s.delete(id));
  } catch {
    /* already gone */
  } finally {
    db.close();
  }
}

/** Client errors other than "slow down" will never succeed on retry, so they are dropped. */
function isPermanent(e: unknown): boolean {
  return e instanceof ApiProblem && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
}

let flushing = false;

/**
 * Sends queued entries oldest first. Stops at the first network or server failure so order is kept;
 * returns how many were delivered.
 */
export async function flushOutbox(familyId?: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const e of await listOutbox(familyId)) {
      try {
        await api(`/v1/families/${e.familyId}/transactions`, { body: e.body, idempotencyKey: e.id });
        await remove(e.id);
        sent += 1;
      } catch (err) {
        if (isPermanent(err)) {
          await remove(e.id);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
