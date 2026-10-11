import { supabase } from './supabase';

const DB_NAME = 'nirdhoom-offline';
const STORE = 'evidence';
const VERSION = 1;

export interface QueuedEvidence {
  id: string;
  /** Authenticated actor who captured the evidence; prevents cross-account replay. */
  ownerUserId: string;
  fieldId: string;
  fileName: string;
  fileType: string;
  blob: Blob;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueEvidence(item: Omit<QueuedEvidence, 'id'>) {
  const db = await openDb();
  const value: QueuedEvidence = { ...item, id: crypto.randomUUID() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function queuedEvidenceCount() {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return count;
}

async function listQueued(): Promise<QueuedEvidence[]> {
  const db = await openDb();
  const rows = await new Promise<QueuedEvidence[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueuedEvidence[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

async function removeQueued(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function sha256(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function flushEvidenceQueue() {
  if (!supabase || !navigator.onLine) return 0;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return 0;

  let flushed = 0;
  for (const item of await listQueued()) {
    // Never upload evidence under whichever account happens to be signed in now.
    // Legacy queue rows without ownerUserId are intentionally held for manual recovery.
    if (!item.ownerUserId || item.ownerUserId !== user.id) continue;
    const path = `${user.id}/${item.fieldId}/${item.id}-${item.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // A previous replay may have uploaded the object or committed its metadata
    // before the client lost the response. Detect committed metadata first so
    // retries are idempotent instead of leaving a permanent duplicate-object loop.
    const existing = await supabase.from('evidence_assets')
      .select('id')
      .eq('storage_path', path)
      .maybeSingle();
    if (existing.error) continue;
    if (existing.data) {
      await removeQueued(item.id);
      flushed += 1;
      continue;
    }

    const upload = await supabase.storage.from('evidence').upload(path, item.blob, {
      contentType: item.fileType,
      upsert: false,
    });
    // A 409 means this deterministic per-queue-item object was uploaded by a
    // previous attempt. Continue to metadata insertion; other errors are retryable.
    if (upload.error && upload.error.statusCode !== '409') continue;

    const { error } = await supabase.from('evidence_assets').insert({
      field_id: item.fieldId,
      kind: 'field_photo',
      storage_path: path,
      source: 'operator-pwa',
      captured_at: item.capturedAt,
      latitude: item.latitude,
      longitude: item.longitude,
      gps_accuracy_m: item.accuracyM,
      sha256: await sha256(item.blob),
      created_by: user.id,
      sync_source: 'indexeddb-replay',
      metadata: { file_name: item.fileName, mime_type: item.fileType },
    });
    if (error) continue;

    await removeQueued(item.id);
    flushed += 1;
  }
  return flushed;
}

export async function registerEvidenceQueueReplay() {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => { void flushEvidenceQueue(); };
  window.addEventListener('online', handler);
  void flushEvidenceQueue();
  return () => window.removeEventListener('online', handler);
}
