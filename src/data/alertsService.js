import { logger } from '../core/logger.js';

function pickTranslation(translation, language) {
  if (!Array.isArray(translation) || translation.length === 0) {
    return '';
  }

  const lang = (language || '').toLowerCase();
  const exact = translation.find((item) => String(item?.language || '').toLowerCase() === lang);
  if (exact?.text) {
    return String(exact.text).trim();
  }

  const prefix = translation.find((item) => String(item?.language || '').toLowerCase().startsWith(lang));
  if (prefix?.text) {
    return String(prefix.text).trim();
  }

  const spanish = translation.find((item) => String(item?.language || '').toLowerCase().startsWith('es'));
  if (spanish?.text) {
    return String(spanish.text).trim();
  }

  return String(translation[0]?.text || '').trim();
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export class AlertsService {
  constructor({ alertsUrl, fallbackUrls = [] }) {
    this.alertsUrl = alertsUrl;
    this.fallbackUrls = fallbackUrls;
  }

  async requestJson(url) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Alerts request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const text = await response.text();
      throw new Error(`Alerts endpoint did not return JSON (content-type: ${contentType}, preview: ${text.slice(0, 80)})`);
    }

    return response.json();
  }

  parsePayload(payload, language) {
    const entities = Array.isArray(payload?.entity) ? payload.entity : [];

    return entities
      .map((entity) => {
        const alert = entity?.alert;
        if (!alert) {
          return null;
        }

        const header = normalizeText(pickTranslation(alert?.headerText?.translation, language));
        const description = normalizeText(pickTranslation(alert?.descriptionText?.translation, language));
        const informed = Array.isArray(alert?.informedEntity) ? alert.informedEntity : [];
        const informedLines = informed
          .map((item) => String(item?.routeId || '').trim())
          .filter(Boolean)
          .slice(0, 4);

        return {
          id: String(entity?.id || ''),
          header,
          description,
          effect: String(alert?.effect || 'UNKNOWN'),
          cause: String(alert?.cause || 'UNKNOWN'),
          lines: informedLines,
          updatedAtMs: Number(payload?.header?.timestamp || 0) * 1000,
        };
      })
      .filter(Boolean);
  }

  async fetchAlerts(language = 'es') {
    let payload;
    let source = this.alertsUrl;

    try {
      payload = await this.requestJson(this.alertsUrl);
    } catch (error) {
      logger.warn('Primary alerts fetch failed', { message: String(error?.message || error) });
      if (this.fallbackUrls.length === 0) {
        throw error;
      }

      let fallbackError = error;
      for (const fallbackUrl of this.fallbackUrls) {
        try {
          payload = await this.requestJson(fallbackUrl);
          source = fallbackUrl;
          break;
        } catch (nested) {
          fallbackError = nested;
          logger.warn('Alerts fallback source failed', { source: fallbackUrl, message: String(nested?.message || nested) });
        }
      }

      if (!payload) {
        throw fallbackError;
      }
    }

    const alerts = this.parsePayload(payload, language)
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));

    return {
      alerts,
      metrics: {
        source,
        count: alerts.length,
      },
    };
  }
}
