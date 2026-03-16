import { normalizePayload } from './parser.js';
import { logger } from '../core/logger.js';

export class FeedService {
  constructor({ feedUrl, fallbackUrls = [], bounds, platformMemory }) {
    this.feedUrl = feedUrl;
    this.fallbackUrls = fallbackUrls;
    this.bounds = bounds;
    this.platformMemory = platformMemory;
  }

  async requestJson(url) {
    logger.debug('Requesting feed URL', { url });
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const text = await response.text();
      throw new Error(`Feed endpoint did not return JSON (content-type: ${contentType}, preview: ${text.slice(0, 80)})`);
    }

    return response.json();
  }

  async fetchSnapshot(platformMode) {
    const now = Date.now();
    const started = performance.now();
    let payload;
    let source = this.feedUrl;

    try {
      payload = await this.requestJson(this.feedUrl);
      logger.debug('Feed fetched from primary source', { source });
    } catch (error) {
      logger.warn('Primary feed fetch failed', { message: String(error?.message || error) });
      if (this.fallbackUrls.length === 0) {
        throw error;
      }

      let fallbackError = error;
      for (const fallbackUrl of this.fallbackUrls) {
        try {
          payload = await this.requestJson(fallbackUrl);
          source = fallbackUrl;
          logger.warn('Feed fallback source activated', { source });
          break;
        } catch (nested) {
          fallbackError = nested;
          logger.warn('Fallback source failed', { source: fallbackUrl, message: String(nested?.message || nested) });
        }
      }

      if (!payload) {
        throw fallbackError;
      }
    }

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
