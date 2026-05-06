import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'ht:offline:queue';
const MAX_ATTEMPTS = 5;

// ============================================================
// Types
// ============================================================

export type QueuedOperation = {
  id: string;
  type: string;
  payload: unknown;
  queuedAt: number;   // Date.now()
  attempts: number;
};

export type FlushResult = {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;  // ops still in queue after flush
};

// ============================================================
// Internal helpers
// ============================================================

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOperation[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ============================================================
// Public API
// ============================================================

/** Add an operation to the offline queue. */
export async function enqueueOperation(type: string, payload: unknown): Promise<void> {
  const queue = await readQueue();
  queue.push({ id: uid(), type, payload, queuedAt: Date.now(), attempts: 0 });
  await writeQueue(queue);
}

/** Return the full queue without modifying it. */
export async function getQueue(): Promise<QueuedOperation[]> {
  return readQueue();
}

/** How many operations are waiting. */
export async function getQueueSize(): Promise<number> {
  return (await readQueue()).length;
}

/** Remove a single operation by id (call after a successful manual retry). */
export async function removeFromQueue(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((op) => op.id !== id));
}

/** Wipe the entire queue (e.g. on sign-out). */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Attempt to replay every queued operation through `handler`.
 *
 * handler must return:
 *   true  → success, remove from queue
 *   false → failure, keep and increment attempt counter
 *
 * Operations that reach MAX_ATTEMPTS are silently dropped.
 */
export async function flushQueue(
  handler: (op: QueuedOperation) => Promise<boolean>
): Promise<FlushResult> {
  const queue = await readQueue();
  if (!queue.length) return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };

  let succeeded = 0;
  let failed = 0;
  const keep: QueuedOperation[] = [];

  for (const op of queue) {
    let ok = false;
    try {
      ok = await handler(op);
    } catch {
      ok = false;
    }

    if (ok) {
      succeeded++;
    } else {
      failed++;
      const next = { ...op, attempts: op.attempts + 1 };
      if (next.attempts < MAX_ATTEMPTS) keep.push(next);
      // else: drop — exceeded retry budget
    }
  }

  await writeQueue(keep);

  return { processed: queue.length, succeeded, failed, remaining: keep.length };
}

// ============================================================
// Network error detection
// ============================================================

/**
 * Returns true when an error looks like a connectivity failure rather than
 * a server/auth rejection.  Used to decide whether to enqueue vs. surface
 * the error to the user.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    typeof error === 'string'
      ? error
      : (error as { message?: string }).message ?? String(error);
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('Network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('Load failed') ||
    msg.includes('ERR_INTERNET_DISCONNECTED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNREFUSED')
  );
}
