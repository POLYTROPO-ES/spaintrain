import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CronLikeScheduler } from './scheduler.js';

class FakeDocument extends EventTarget {
  hidden = false;

  setHidden(hidden) {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('CronLikeScheduler', () => {
  let document;
  let scheduler;
  let onTick;
  let onError;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    document = new FakeDocument();
    vi.stubGlobal('document', document);
    onTick = vi.fn().mockResolvedValue(undefined);
    onError = vi.fn();
    scheduler = new CronLikeScheduler({ intervalMs: 20000, onTick, onError });
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts immediately once and schedules strictly future exact boundaries', async () => {
    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(19999);
    expect(onTick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(onTick).toHaveBeenLastCalledWith(2);
    await vi.advanceTimersByTimeAsync(50);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(19950);
    expect(onTick).toHaveBeenLastCalledWith(3);
  });

  it('does not add a 50ms minimum delay just before a boundary', async () => {
    vi.setSystemTime(19990);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(9);
    expect(onTick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('replaces the pending timer for an immediate forced settings refresh', async () => {
    scheduler.start();
    await vi.advanceTimersByTimeAsync(1000);
    await scheduler.executeTick(true);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(19000);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('serializes forced refreshes and coalesces them into one follow-up', async () => {
    const first = deferred();
    const second = deferred();
    onTick.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    scheduler.start();
    await scheduler.executeTick(true);
    await scheduler.executeTick(true);
    await scheduler.executeTick(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenLastCalledWith(2);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    second.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('skips normal polls during a long fetch without queuing a catch-up', async () => {
    const first = deferred();
    onTick.mockReturnValueOnce(first.promise);
    scheduler.start();
    await scheduler.executeTick();
    await vi.advanceTimersByTimeAsync(45000);
    expect(onTick).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(15000);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('clears timers while hidden, skips forced polls, and refreshes once on resume', async () => {
    scheduler.start();
    await vi.advanceTimersByTimeAsync(1000);
    document.setHidden(true);
    expect(vi.getTimerCount()).toBe(0);
    await scheduler.executeTick(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTick).toHaveBeenCalledTimes(1);
    document.setHidden(false);
    document.setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    document.setHidden(false);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('defers a hidden startup until the first visible transition', async () => {
    document.setHidden(true);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    document.setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('queues only one post-hide follow-up without overlapping the old fetch', async () => {
    const first = deferred();
    const second = deferred();
    onTick.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    scheduler.start();
    document.setHidden(true);
    document.setHidden(false);
    document.setHidden(false);
    document.setHidden(true);
    document.setHidden(false);
    await scheduler.executeTick(true);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledTimes(2);
    document.setHidden(false);
    second.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('does not schedule or run queued refreshes if the fetch settles while hidden', async () => {
    const first = deferred();
    onTick.mockReturnValueOnce(first.promise);
    scheduler.start();
    await scheduler.executeTick(true);
    document.setHidden(true);
    first.resolve();
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    document.setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('stops without lingering timers and ignores visibility and explicit polls', async () => {
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();
    scheduler.stop();
    document.setHidden(true);
    document.setHidden(false);
    await scheduler.executeTick(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(scheduler.timer).toBeNull();
  });

  it('discards a queued refresh when stopped during a fetch', async () => {
    const first = deferred();
    onTick.mockReturnValueOnce(first.promise);
    scheduler.start();
    await scheduler.executeTick(true);
    scheduler.stop();
    first.resolve();
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('serializes a restart with a fetch still in flight from before stop', async () => {
    const first = deferred();
    onTick.mockReturnValueOnce(first.promise);
    scheduler.start();
    scheduler.stop();
    scheduler.start();
    scheduler.start();
    expect(onTick).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('reports errors with the tick id and continues with a queued refresh', async () => {
    const first = deferred();
    const error = new Error('Fetch failed');
    onTick.mockReturnValueOnce(first.promise);
    scheduler.start();
    await scheduler.executeTick(true);
    first.reject(error);
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error, 1);
    expect(onTick).toHaveBeenLastCalledWith(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('recovers from synchronous tick failures without requiring onError', async () => {
    scheduler.onError = undefined;
    onTick.mockImplementationOnce(() => { throw new Error('Failure'); });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(20000);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });
});