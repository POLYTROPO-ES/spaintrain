import { logger } from '../core/logger.js';

export async function requestJson(url, label = 'request') {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text();
    throw new Error(`${label} did not return JSON (content-type: ${contentType}, preview: ${text.slice(0, 80)})`);
  }

  return response.json();
}

export async function fetchJsonWithFallback({
  primaryUrl,
  fallbackUrls = [],
  primaryLabel,
  fallbackLabel,
  warnPrefix,
}) {
  try {
    const payload = await requestJson(primaryUrl, primaryLabel);
    return { payload, source: primaryUrl };
  } catch (error) {
    logger.warn(`${warnPrefix} primary fetch failed`, { message: String(error?.message || error) });

    if (!fallbackUrls.length) {
      throw error;
    }

    let lastError = error;
    for (const fallbackUrl of fallbackUrls) {
      try {
        const payload = await requestJson(fallbackUrl, fallbackLabel);
        logger.warn(`${warnPrefix} fallback source activated`, { source: fallbackUrl });
        return { payload, source: fallbackUrl };
      } catch (nested) {
        lastError = nested;
        logger.warn(`${warnPrefix} fallback source failed`, {
          source: fallbackUrl,
          message: String(nested?.message || nested),
        });
      }
    }

    throw lastError;
  }
}
