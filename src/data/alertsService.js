import { normalizeLineCode } from '../core/lineCode.js';
import { fetchJsonWithFallback } from './http.js';

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
          .filter(Boolean);
        const normalizedInformedLines = Array.from(
          new Set(informedLines.map((lineCode) => normalizeLineCode(lineCode)).filter(Boolean))
        );

        return {
          id: String(entity?.id || ''),
          header,
          description,
          effect: String(alert?.effect || 'UNKNOWN'),
          cause: String(alert?.cause || 'UNKNOWN'),
          lines: informedLines.slice(0, 4),
          normalizedLines: normalizedInformedLines,
          updatedAtMs: Number(payload?.header?.timestamp || 0) * 1000,
        };
      })
      .filter(Boolean);
  }

  async fetchAlerts(language = 'es') {
    const { payload, source } = await fetchJsonWithFallback({
      primaryUrl: this.alertsUrl,
      fallbackUrls: this.fallbackUrls,
      primaryLabel: 'Alerts request',
      fallbackLabel: 'Alerts request',
      warnPrefix: 'Alerts',
    });

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
