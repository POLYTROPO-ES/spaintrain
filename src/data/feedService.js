import { normalizePayload } from './parser.js';
import { logger } from '../core/logger.js';
import { fetchJsonWithFallback } from './http.js';

export class FeedService {
  constructor({ feedUrl, fallbackUrls = [], bounds, platformMemory }) {
    this.feedUrl = feedUrl;
    this.fallbackUrls = fallbackUrls;
    this.bounds = bounds;
    this.platformMemory = platformMemory;
  }

  async fetchSnapshot(platformMode) {
    const now = Date.now();
    const started = performance.now();
    const { payload, source } = await fetchJsonWithFallback({
      primaryUrl: this.feedUrl,
      fallbackUrls: this.fallbackUrls,
      primaryLabel: 'Feed request',
      fallbackLabel: 'Feed request',
      warnPrefix: 'Feed',
    });
    logger.debug('Feed fetched', { source });

    const normalized = normalizePayload(payload, {
      platformMode,
      platformMemory: this.platformMemory,
      nowMs: now,
      bounds: this.bounds,
    });

    return {
      ...normalized,
      metrics: {
        fetchLatencyMs: Math.round(performance.now() - started),
        vehicleCount: normalized.vehicles.length,
        source,
      },
    };
  }
}
