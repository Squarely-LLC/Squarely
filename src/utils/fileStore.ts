// Minimal IndexedDB helper to store file blobs locally.
const DB_NAME = "squarely-files";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(file: File): Promise<string> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const payload = {
    blob: file,
    name: file.name,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const req = store.put(payload, key);
    req.onsuccess = () => {
      tx.oncomplete = () => {
        db.close();
        resolve(key);
      };
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getFileRecord(
  key: string
): Promise<{ blob: Blob; name?: string } | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => {
      const val = req.result ?? null;
      db.close();
      if (!val) return resolve(null);
      resolve({ blob: val.blob, name: val.name });
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getFileObjectUrl(key: string): Promise<string | null> {
  const rec = await getFileRecord(key);
  if (!rec) return null;
  try {
    return URL.createObjectURL(rec.blob);
  } catch {
    return null;
  }
}

export async function getFileInfo(
  key: string
): Promise<{ name?: string; size?: number } | null> {
  const rec = await getFileRecord(key);
  if (!rec) return null;
  return {
    name: rec.name,
    size: rec.blob ? (rec.blob as Blob).size : undefined,
  };
}

export async function deleteFile(key: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function getFileName(key: string): Promise<string | undefined> {
  const rec = await getFileRecord(key);
  return rec?.name;
}
