import { APP_CONFIG } from '../core/config.js';
import { compactSnapshot } from './compact.js';

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function awaitTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_CONFIG.storage.dbName, APP_CONFIG.storage.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_CONFIG.storage.snapshotStore)) {
        const snapshots = db.createObjectStore(APP_CONFIG.storage.snapshotStore, {
          keyPath: 'snapshotTimeMs',
        });
        snapshots.createIndex('by_date', 'snapshotTimeMs', { unique: true });
      }

      if (!db.objectStoreNames.contains(APP_CONFIG.storage.settingsStore)) {
        db.createObjectStore(APP_CONFIG.storage.settingsStore, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class LocalStore {
  constructor() {
    this.dbPromise = openDatabase();
  }

  async getDb() {
    try {
      return await this.dbPromise;
    } catch {
      this.dbPromise = openDatabase();
      return this.dbPromise;
    }
  }

  async saveSnapshot(snapshot) {
    const compact = compactSnapshot(snapshot);
    if (!compact) {
      return;
    }
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    tx.objectStore(APP_CONFIG.storage.snapshotStore).put(compact);
    await awaitTransaction(tx);
  }

  async loadSnapshots(fromMs, toMs) {
    if (
      typeof fromMs !== 'number' || typeof toMs !== 'number' ||
      Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs
    ) {
      return [];
    }
    const range = IDBKeyRange.bound(fromMs, toMs);
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readonly');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    return promisifyRequest(store.getAll(range));
  }

  async getAllSnapshots() {
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readonly');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    const request = store.getAll();
    return promisifyRequest(request);
  }

  async getStorageInsights(recentLimit = 18) {
    const limit = Number.isFinite(Number(recentLimit))
      ? Math.max(1, Math.trunc(Number(recentLimit)))
      : 18;
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readonly');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    // Queue every request before awaiting; continue cursors only in their callbacks.
    const countPromise = promisifyRequest(store.count());
    const oldestPromise = promisifyRequest(store.openKeyCursor());
    const recentPromise = new Promise((resolve, reject) => {
      const recent = [];
      const request = store.openCursor(null, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          recent.push(cursor.value);
          if (recent.length < limit) {
            cursor.continue();
            return;
          }
        }
        resolve(recent);
      };
    });
    const [count, oldest, recent] = await Promise.all([
      countPromise, oldestPromise, recentPromise,
    ]);
    const newestSnapshotTimeMs = recent.length ? Number(recent[0].snapshotTimeMs) : null;

    return {
      count,
      oldestSnapshotTimeMs: oldest ? Number(oldest.key) : null,
      newestSnapshotTimeMs,
      recent: recent.reverse(),
    };
  }

  async importSnapshots(snapshots) {
    if (!Array.isArray(snapshots)) {
      throw new Error('Invalid import payload');
    }

    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);

    snapshots.forEach((snapshot) => {
      if (
        snapshot &&
        typeof snapshot.snapshotTimeMs === 'number' &&
        Array.isArray(snapshot.vehicles)
      ) {
        const compact = compactSnapshot(snapshot);
        if (compact) {
          store.put(compact);
        }
      }
    });

    await awaitTransaction(tx);
  }

  async pruneOlderThan(cutoffMs) {
    const range = IDBKeyRange.upperBound(cutoffMs, true);
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    store.delete(range);
    await awaitTransaction(tx);
  }

  async clearSnapshots() {
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    tx.objectStore(APP_CONFIG.storage.snapshotStore).clear();
    await awaitTransaction(tx);
  }

  async setSetting(key, value) {
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.settingsStore, 'readwrite');
    tx.objectStore(APP_CONFIG.storage.settingsStore).put({ key, value });
    await awaitTransaction(tx);
  }

  async getSetting(key) {
    const db = await this.getDb();
    const tx = db.transaction(APP_CONFIG.storage.settingsStore, 'readonly');
    const request = tx.objectStore(APP_CONFIG.storage.settingsStore).get(key);
    const row = await promisifyRequest(request);
    return row?.value;
  }

  async getSettings(keys, defaults) {
    const settings = { ...defaults };
    for (const key of keys) {
      const value = await this.getSetting(key);
      if (value !== undefined) {
        settings[key] = value;
      }
    }
    return settings;
  }

  async clearAll() {
    const db = await this.getDb();
    const tx = db.transaction([APP_CONFIG.storage.snapshotStore, APP_CONFIG.storage.settingsStore], 'readwrite');
    tx.objectStore(APP_CONFIG.storage.snapshotStore).clear();
    tx.objectStore(APP_CONFIG.storage.settingsStore).clear();
    await awaitTransaction(tx);
  }
}
