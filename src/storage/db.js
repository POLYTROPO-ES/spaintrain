import { APP_CONFIG } from '../core/config.js';

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

  async saveSnapshot(snapshot) {
    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    tx.objectStore(APP_CONFIG.storage.snapshotStore).put(snapshot);
    await awaitTransaction(tx);
  }

  async loadSnapshots(fromMs, toMs) {
    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readonly');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    const request = store.getAll();
    const all = await promisifyRequest(request);
    return all
      .filter((row) => row.snapshotTimeMs >= fromMs && row.snapshotTimeMs <= toMs)
      .sort((a, b) => a.snapshotTimeMs - b.snapshotTimeMs);
  }

  async getAllSnapshots() {
    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readonly');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    const request = store.getAll();
    const all = await promisifyRequest(request);
    return all.sort((a, b) => a.snapshotTimeMs - b.snapshotTimeMs);
  }

  async importSnapshots(snapshots) {
    if (!Array.isArray(snapshots)) {
      throw new Error('Invalid import payload');
    }

    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);

    snapshots.forEach((snapshot) => {
      if (
        snapshot &&
        typeof snapshot.snapshotTimeMs === 'number' &&
        Array.isArray(snapshot.vehicles)
      ) {
        store.put(snapshot);
      }
    });

    await awaitTransaction(tx);
  }

  async pruneOlderThan(cutoffMs) {
    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    const store = tx.objectStore(APP_CONFIG.storage.snapshotStore);
    const all = await promisifyRequest(store.getAll());
    all.filter((row) => row.snapshotTimeMs < cutoffMs).forEach((row) => store.delete(row.snapshotTimeMs));
    await awaitTransaction(tx);
  }

  async clearSnapshots() {
    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.snapshotStore, 'readwrite');
    tx.objectStore(APP_CONFIG.storage.snapshotStore).clear();
    await awaitTransaction(tx);
  }

  async setSetting(key, value) {
    const db = await this.dbPromise;
    const tx = db.transaction(APP_CONFIG.storage.settingsStore, 'readwrite');
    tx.objectStore(APP_CONFIG.storage.settingsStore).put({ key, value });
    await awaitTransaction(tx);
  }

  async getSetting(key) {
    const db = await this.dbPromise;
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
    const db = await this.dbPromise;
    const tx = db.transaction([APP_CONFIG.storage.snapshotStore, APP_CONFIG.storage.settingsStore], 'readwrite');
    tx.objectStore(APP_CONFIG.storage.snapshotStore).clear();
    tx.objectStore(APP_CONFIG.storage.settingsStore).clear();
    await awaitTransaction(tx);
  }
}
