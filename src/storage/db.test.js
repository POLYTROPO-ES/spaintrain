import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBCursor, IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { APP_CONFIG } from '../core/config.js';
import { LocalStore } from './db.js';

function snapshot(snapshotTimeMs) {
  return { snapshotTimeMs, headerTimestampMs: snapshotTimeMs, vehicles: [] };
}

function times(rows) {
  return rows.map((row) => row.snapshotTimeMs);
}

describe('LocalStore', () => {
  let store;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    store = new LocalStore();
  });

  afterEach(async () => {
    (await store.getDb()).close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves the v1 stores, key paths and date index', async () => {
    const db = await store.getDb();
    expect(db.version).toBe(1);
    expect(Array.from(db.objectStoreNames)).toEqual(['settings', 'snapshots']);
    const tx = db.transaction(['snapshots', 'settings'], 'readonly');
    const snapshots = tx.objectStore('snapshots');
    expect(snapshots.keyPath).toBe('snapshotTimeMs');
    expect(Array.from(snapshots.indexNames)).toEqual(['by_date']);
    expect(snapshots.index('by_date').keyPath).toBe('snapshotTimeMs');
    expect(snapshots.index('by_date').unique).toBe(true);
    expect(tx.objectStore('settings').keyPath).toBe('key');
  });

  it('returns empty history and null insight boundaries for an empty database', async () => {
    expect(await store.loadSnapshots(0, 100)).toEqual([]);
    expect(await store.getAllSnapshots()).toEqual([]);
    expect(await store.getStorageInsights()).toEqual({
      count: 0, oldestSnapshotTimeMs: null, newestSnapshotTimeMs: null, recent: [],
    });
    await store.pruneOlderThan(100);
    await store.clearAll();
    expect(await store.getAllSnapshots()).toEqual([]);
  });

  it('loads an inclusive key range without reading unrelated snapshots', async () => {
    await store.importSnapshots([40, 10, 30, 20, 0].map(snapshot));
    const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    expect(times(await store.loadSnapshots(10, 30))).toEqual([10, 20, 30]);
    expect(getAll).toHaveBeenCalledTimes(1);
    const [range] = getAll.mock.calls[0];
    expect(range).toBeInstanceOf(IDBKeyRange);
    expect(range.lower).toBe(10);
    expect(range.upper).toBe(30);
    expect(range.lowerOpen).toBe(false);
    expect(range.upperOpen).toBe(false);
    expect(times(await store.loadSnapshots(20, 20))).toEqual([20]);
    expect(times(await store.loadSnapshots(0, 0))).toEqual([0]);
    expect(await store.loadSnapshots(21, 29)).toEqual([]);
  });

  it.each([[30, 10], [NaN, 10], [0, NaN], [undefined, 10], [0, null]])(
    'returns [] without opening a read transaction for invalid range %s..%s',
    async (fromMs, toMs) => {
      const db = await store.getDb();
      const transaction = vi.spyOn(db, 'transaction');
      expect(await store.loadSnapshots(fromMs, toMs)).toEqual([]);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('returns all snapshots in natural ascending primary-key order', async () => {
    await store.importSnapshots([50, 0, 30, 10, 20].map(snapshot));
    expect(times(await store.getAllSnapshots())).toEqual([0, 10, 20, 30, 50]);
  });

  it('counts all rows but reads only the newest limited rows, returning ascending recent', async () => {
    await store.importSnapshots([40, 0, 30, 20, 10].map(snapshot));
    const count = vi.spyOn(IDBObjectStore.prototype, 'count');
    const firstKey = vi.spyOn(IDBObjectStore.prototype, 'openKeyCursor');
    const reverse = vi.spyOn(IDBObjectStore.prototype, 'openCursor');
    const next = vi.spyOn(IDBCursor.prototype, 'continue');
    const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const insights = await store.getStorageInsights(3);
    expect(insights).toEqual({
      count: 5,
      oldestSnapshotTimeMs: 0,
      newestSnapshotTimeMs: 40,
      recent: [20, 30, 40].map(snapshot),
    });
    expect(count).toHaveBeenCalledExactlyOnceWith();
    expect(firstKey).toHaveBeenCalledExactlyOnceWith();
    expect(reverse).toHaveBeenCalledExactlyOnceWith(null, 'prev');
    expect(next).toHaveBeenCalledTimes(2);
    expect(getAll).not.toHaveBeenCalled();
  });

  it('defaults to at most 18 recent snapshots', async () => {
    await store.importSnapshots(Array.from({ length: 25 }, (_, i) => snapshot(i)));
    const next = vi.spyOn(IDBCursor.prototype, 'continue');
    const insights = await store.getStorageInsights();
    expect(insights.count).toBe(25);
    expect(insights.oldestSnapshotTimeMs).toBe(0);
    expect(insights.newestSnapshotTimeMs).toBe(24);
    expect(times(insights.recent)).toEqual(Array.from({ length: 18 }, (_, i) => i + 7));
    expect(next).toHaveBeenCalledTimes(17);
  });

  it('handles limits of one and larger than history and preserves minimum-one behavior', async () => {
    await store.importSnapshots([30, 10, 20].map(snapshot));
    expect(times((await store.getStorageInsights(1)).recent)).toEqual([30]);
    expect(times((await store.getStorageInsights(10)).recent)).toEqual([10, 20, 30]);
    expect(times((await store.getStorageInsights(0)).recent)).toEqual([30]);
    expect(times((await store.getStorageInsights(-1)).recent)).toEqual([30]);
  });

  it('prunes through an exclusive upper-bound delete without deserializing history', async () => {
    await store.importSnapshots([0, 10, 20, 30, 40].map(snapshot));
    const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const cursor = vi.spyOn(IDBObjectStore.prototype, 'openCursor');
    const remove = vi.spyOn(IDBObjectStore.prototype, 'delete');
    await store.pruneOlderThan(20);
    expect(getAll).not.toHaveBeenCalled();
    expect(cursor).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    const [range] = remove.mock.calls[0];
    expect(range).toBeInstanceOf(IDBKeyRange);
    expect(range.upper).toBe(20);
    expect(range.upperOpen).toBe(true);
    expect(range.includes(19)).toBe(true);
    expect(range.includes(20)).toBe(false);
    expect(times(await store.getAllSnapshots())).toEqual([20, 30, 40]);
    expect((await store.getStorageInsights()).count).toBe(3);
  });

  it('keeps the exact pruning cutoff and commits deletion before returning', async () => {
    await store.importSnapshots([0, 10, 20].map(snapshot));
    await store.pruneOlderThan(0);
    expect(times(await store.getAllSnapshots())).toEqual([0, 10, 20]);
    await store.pruneOlderThan(20);
    expect(times(await store.getAllSnapshots())).toEqual([20]);
    await store.pruneOlderThan(21);
    expect(await store.getAllSnapshots()).toEqual([]);
  });

  it('preserves save, import, settings and clearSnapshots APIs', async () => {
    await store.saveSnapshot(snapshot(20));
    await store.saveSnapshot(null);
    await store.importSnapshots([snapshot(10), null, {}, { snapshotTimeMs: 15 }]);
    await expect(store.importSnapshots(null)).rejects.toThrow('Invalid import payload');
    expect(times(await store.getAllSnapshots())).toEqual([10, 20]);
    await store.setSetting('theme', 'dark');
    expect(await store.getSettings(['theme', 'language'], { theme: 'light', language: 'es' }))
      .toEqual({ theme: 'dark', language: 'es' });
    await store.clearSnapshots();
    expect(await store.getAllSnapshots()).toEqual([]);
    expect(await store.getSetting('theme')).toBe('dark');
  });

  it('clears snapshots and settings together and remains usable afterward', async () => {
    await store.importSnapshots([10, 20].map(snapshot));
    await store.setSetting('platformMode', 'inferred');
    await store.clearAll();
    expect(await store.getAllSnapshots()).toEqual([]);
    expect(await store.getSetting('platformMode')).toBeUndefined();
    expect(await store.getStorageInsights()).toEqual({
      count: 0, oldestSnapshotTimeMs: null, newestSnapshotTimeMs: null, recent: [],
    });
    await store.saveSnapshot(snapshot(30));
    await store.setSetting('platformMode', 'strict');
    expect(times(await store.getAllSnapshots())).toEqual([30]);
    expect(await store.getSetting('platformMode')).toBe('strict');
    expect((await store.getDb()).version).toBe(APP_CONFIG.storage.dbVersion);
  });
});