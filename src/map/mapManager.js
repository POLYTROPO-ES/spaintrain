import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { normalizeLineCode } from '../core/lineCode.js';

const statusColor = {
  STOPPED_AT: '#b45309',
  INCOMING_AT: '#0f766e',
  IN_TRANSIT_TO: '#1d4ed8',
  UNKNOWN: '#64748b',
};

const STOPPED_ORANGE = '#ea580c';

function buildTrainIcon(color, isDisrupted = false) {
  const iconClass = isDisrupted ? 'train-svg-icon train-disruption' : 'train-svg-icon';
  const disruptionBadge = isDisrupted
    ? '<circle cx="27" cy="8" r="4.8" fill="#dc2626" stroke="#ffffff" stroke-width="1.2"/><text x="27" y="10.3" font-size="6.8" font-weight="700" text-anchor="middle" fill="#ffffff">!</text>'
    : '';
  const svg = `
    <svg width="34" height="32" viewBox="0 0 38 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g>
        <rect x="7" y="8" width="24" height="20" rx="2.8" fill="${color}" stroke="#0f172a" stroke-width="1.3"/>
        <rect x="9" y="11" width="7" height="7" rx="1" fill="#e2e8f0"/>
        <rect x="22" y="11" width="7" height="7" rx="1" fill="#e2e8f0"/>
        <rect x="17" y="11" width="4" height="7" rx="0.8" fill="#cbd5e1"/>
        <line x1="10" y1="22" x2="28" y2="22" stroke="#e2e8f0" stroke-width="1.4" stroke-linecap="round"/>
        <rect x="8" y="27" width="3.2" height="2" fill="#0f172a"/>
        <rect x="26.8" y="27" width="3.2" height="2" fill="#0f172a"/>
        ${disruptionBadge}
      </g>
    </svg>
  `;

  return L.divIcon({
    className: iconClass,
    html: svg,
    iconSize: [34, 32],
    iconAnchor: [17, 16],
    popupAnchor: [0, -18],
  });
}

function normalizeHeadingForIcon(headingDeg) {
  if (headingDeg == null || !Number.isFinite(Number(headingDeg))) {
    return 0;
  }

  // The icon is drawn pointing east; convert navigation bearing (0=N, 90=E) to icon rotation.
  return Number(headingDeg) - 90;
}

function buildHighSpeedTrainIcon(color, isDisrupted = false, headingDeg = null) {
  const iconClass = isDisrupted
    ? 'train-svg-icon train-svg-icon-highspeed train-disruption'
    : 'train-svg-icon train-svg-icon-highspeed';
  const disruptionBadge = isDisrupted
    ? '<circle cx="49" cy="8" r="4.8" fill="#dc2626" stroke="#ffffff" stroke-width="1.2"/><text x="49" y="10.3" font-size="6.8" font-weight="700" text-anchor="middle" fill="#ffffff">!</text>'
    : '';
  const rotationDeg = normalizeHeadingForIcon(headingDeg);
  const svg = `
    <svg width="48" height="34" viewBox="0 0 54 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="rotate(${rotationDeg} 27 19)">
        <path d="M6 13Q5 13 5 16V22Q5 25 8 25H36Q47 25 47 20.5V17.5Q47 13 36 13Z" fill="${color}" stroke="#111827" stroke-width="1.4"/>
        <path d="M41 14.5Q45.5 15.5 45.5 19Q45.5 22.5 41 23.5" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.9"/>
        <rect x="10" y="15" width="8" height="8" rx="2" fill="#e2e8f0"/>
        <rect x="20.5" y="15" width="6" height="8" rx="2" fill="#e2e8f0"/>
        <line x1="8" y1="18.5" x2="34" y2="18.5" stroke="#111827" stroke-width="0.7" opacity="0.25"/>
        ${disruptionBadge}
      </g>
    </svg>
  `;

  return L.divIcon({
    className: iconClass,
    html: svg,
    iconSize: [48, 34],
    iconAnchor: [24, 17],
    popupAnchor: [0, -18],
  });
}

function buildStationaryHighSpeedIcon(color, isDisrupted = false) {
  const iconClass = isDisrupted
    ? 'train-svg-icon train-svg-icon-highspeed train-stationary train-disruption'
    : 'train-svg-icon train-svg-icon-highspeed train-stationary';
  const disruptionBadge = isDisrupted
    ? '<circle cx="49" cy="8" r="4.8" fill="#dc2626" stroke="#ffffff" stroke-width="1.2"/><text x="49" y="10.3" font-size="6.8" font-weight="700" text-anchor="middle" fill="#ffffff">!</text>'
    : '';
  const svg = `
    <svg width="48" height="34" viewBox="0 0 54 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g>
        <path d="M6 13Q5 13 5 16V22Q5 25 8 25H36Q47 25 47 20.5V17.5Q47 13 36 13Z" fill="${color}" stroke="#111827" stroke-width="1.4"/>
        <path d="M41 14.5Q45.5 15.5 45.5 19Q45.5 22.5 41 23.5" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.9"/>
        <rect x="10" y="15" width="8" height="8" rx="2" fill="#e2e8f0"/>
        <rect x="20.5" y="15" width="6" height="8" rx="2" fill="#e2e8f0"/>
        <line x1="8" y1="18.5" x2="34" y2="18.5" stroke="#111827" stroke-width="0.7" opacity="0.25"/>
        <line x1="8" y1="28" x2="46" y2="28" stroke="#111827" stroke-width="1.2" stroke-dasharray="2.5 2.5" opacity="0.7"/>
        ${disruptionBadge}
      </g>
    </svg>
  `;

  return L.divIcon({
    className: iconClass,
    html: svg,
    iconSize: [48, 34],
    iconAnchor: [24, 17],
    popupAnchor: [0, -18],
  });
}

function resolveServiceType(vehicle) {
  return String(vehicle.serviceType || 'cercanias').toLowerCase() === 'ld' ? 'ld' : 'cercanias';
}

function buildIconForVehicle(vehicle, color, isDisrupted) {
  if (resolveServiceType(vehicle) !== 'ld') {
    return buildTrainIcon(color, isDisrupted);
  }

  if (vehicle.status === 'STOPPED_AT') {
    return buildStationaryHighSpeedIcon(STOPPED_ORANGE, isDisrupted);
  }

  return buildHighSpeedTrainIcon(color, isDisrupted, vehicle.estimatedHeadingDeg);
}

function getHeadingBucket(vehicle) {
  if (vehicle?.estimatedHeadingDeg == null || !Number.isFinite(Number(vehicle.estimatedHeadingDeg))) {
    return 'na';
  }
  return String(Math.round(Number(vehicle.estimatedHeadingDeg) / 12));
}

function formatRowTimestamp(timestampMs) {
  if (!timestampMs || !Number.isFinite(Number(timestampMs))) {
    return '-';
  }
  return new Date(Number(timestampMs)).toLocaleString();
}

function renderHistoryTable(rows) {
  const safeRows = Array.isArray(rows) ? rows.slice(-8) : [];
  if (safeRows.length === 0) {
    return '<div class="popup-history-empty">No local history yet</div>';
  }

  const body = safeRows.map((row) => {
    const timestamp = formatRowTimestamp(row.timestampMs);
    const coordinates = `${Number(row.lat || 0).toFixed(5)}, ${Number(row.lon || 0).toFixed(5)}`;
    const speed = row.ignoredPosition
      ? '<abbr title="Repeated GPS position while moving; ignored for speed calculation" aria-label="Ignored: repeated GPS position while moving">Ignored</abbr>'
      : row.speedKmh == null
        ? '<span title="No earlier position available to calculate speed">—</span>'
        : `${Math.round(Number(row.speedKmh || 0))} km/h`;
    return `<tr><td>${timestamp}</td><td>${coordinates}</td><td>${speed}</td></tr>`;
  }).join('');

  return `
    <table class="popup-history-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Coordinates</th>
          <th>Calculated speed</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

export class MapManager {
  constructor(containerId) {
    this.map = L.map(containerId, {
      center: [40.4, -3.7],
      zoom: 6,
      minZoom: 5,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    this.pathLayer = L.layerGroup().addTo(this.map);
    this.markerCache = new Map();
    this.disruptionLineCodes = new Set();
    this.renderBounds = this.map.getBounds().pad(0.2);
    this.map.on('moveend zoomend', () => {
      this.renderBounds = this.map.getBounds().pad(0.2);
      this.positionsDirty = true;
    });
  }

  setDisruptionLineCodes(lineCodes) {
    this.disruptionLineCodes = lineCodes instanceof Set
      ? new Set(lineCodes)
      : new Set(Array.isArray(lineCodes) ? lineCodes : []);
  }

  setRailPaths(geojson) {
    this.pathLayer.clearLayers();
    L.geoJSON(geojson, {
      style: {
        color: '#334155',
        weight: 2,
        opacity: 0.55,
      },
    }).addTo(this.pathLayer);
  }

  clearVehicles() {
    this.markerLayer.clearLayers();
    this.markerCache.clear();
    this.lastVehicles = null;
  }

  updateVehicles(vehicles, now = performance.now()) {
    const membershipChanged = vehicles !== this.lastVehicles;
    const activeIds = membershipChanged ? new Set() : null;

    vehicles.forEach((vehicle) => {
      activeIds?.add(vehicle.id);
      const marker = this.markerCache.get(vehicle.id);
      const color = statusColor[vehicle.status] || statusColor.UNKNOWN;
      const normalizedLine = normalizeLineCode(vehicle.lineCode);
      const isDisrupted = normalizedLine ? this.disruptionLineCodes.has(normalizedLine) : false;
      const serviceType = resolveServiceType(vehicle);
      const headingBucket = serviceType === 'ld' && vehicle.status !== 'STOPPED_AT'
        ? getHeadingBucket(vehicle)
        : 'na';
      const markerSignature = `${vehicle.status}|${color}|${serviceType}|${isDisrupted ? 'impact' : 'normal'}|${headingBucket}`;

      if (marker) {
        const wasPopupOpen = marker.isPopupOpen();
        marker.__vehicle = vehicle;
        const oldPosition = marker.getLatLng();
        const moved = Math.abs(oldPosition.lat - vehicle.lat) > 0.000001
          || Math.abs(oldPosition.lng - vehicle.lon) > 0.000001;
        if (moved && (this.positionsDirty || wasPopupOpen
          || this.renderBounds.contains([vehicle.lat, vehicle.lon])
          || this.renderBounds.contains(oldPosition))) {
          marker.setLatLng([vehicle.lat, vehicle.lon]);
        }

        // Avoid recreating icon/popup binding every frame; this keeps marker click interactions stable.
        if (marker.__signature !== markerSignature) {
          marker.setIcon(buildIconForVehicle(vehicle, color, isDisrupted));
          marker.__signature = markerSignature;
        }
        this.updateFreshness(marker, vehicle);

        // Position follows the marker, but rebuilding table/layout needs only 1Hz.
        if (wasPopupOpen && marker.getPopup() && now - (marker.__popupUpdatedAt || 0) >= 1000) {
          marker.setPopupContent(this.createPopup(vehicle));
          marker.__popupUpdatedAt = now;
        }
        return;
      }

      const newMarker = L.marker([vehicle.lat, vehicle.lon], {
        icon: buildIconForVehicle(vehicle, color, isDisrupted),
      }).addTo(this.markerLayer);

      newMarker.__vehicle = vehicle;
      newMarker.__signature = markerSignature;
      newMarker.bindPopup('');
      newMarker.on('popupopen', () => {
        newMarker.setPopupContent(this.createPopup(newMarker.__vehicle));
        newMarker.__popupUpdatedAt = performance.now();
      });
      this.updateFreshness(newMarker, vehicle);
      this.markerCache.set(vehicle.id, newMarker);
    });

    if (membershipChanged) {
      for (const [id, marker] of this.markerCache) {
        if (!activeIds.has(id)) {
          this.markerLayer.removeLayer(marker);
          this.markerCache.delete(id);
        }
      }
    }
    this.lastVehicles = vehicles;
    this.positionsDirty = false;
  }

  updateFreshness(marker, vehicle) {
    const element = marker.getElement();
    const stale = Boolean(vehicle.motionStale);
    if (element && (marker.__stale !== stale || marker.__freshnessElement !== element)) {
      element.classList.toggle('train-data-stale', stale);
      element.setAttribute('aria-label', `Train ${vehicle.id}${stale ? ' — stale position report' : ''}`);
      marker.__stale = stale;
      marker.__freshnessElement = element;
    }
  }

  createPopup(vehicle) {
    const platformText = vehicle.platform
      ? `${vehicle.platform}${vehicle.platformInferred ? ' (inferred)' : ''}`
      : '-';
    const confidence = vehicle.platform ? `${Math.round((vehicle.platformConfidence || 0) * 100)}%` : '-';
    const speed = Math.round(Number(vehicle.estimatedSpeedKmh || 0));
    const heading = Number.isFinite(vehicle.estimatedHeadingDeg)
      ? `${Math.round(vehicle.estimatedHeadingDeg)}°`
      : '-';
    const serviceType = resolveServiceType(vehicle);
    const serviceLabel = serviceType === 'ld' ? 'HIGH_SPEED_DATASET' : 'CERCANIAS_DATASET';
    const impacted = this.disruptionLineCodes.has(normalizeLineCode(vehicle.lineCode));
    const historyTable = renderHistoryTable(vehicle.historyRows);

    return `
      <strong>${vehicle.lineCode}</strong><br>
      Train: ${vehicle.id}<br>
      Service type: ${serviceLabel}<br>
      Trip: ${vehicle.tripId || '-'}<br>
      Stop: ${vehicle.stopId || '-'}<br>
      Platform: ${platformText}<br>
      Platform confidence: ${confidence}<br>
      Estimated speed: ${speed} km/h<br>
      Estimated heading: ${heading}<br>
      Motion model: ${vehicle.motionModel || 'none'}<br>
      Position report: ${vehicle.motionStale ? 'STALE — prediction limited; awaiting fresh data' : 'Current'}<br>
      Data source type: ${vehicle.serviceType || 'cercanias'}<br>
      Disruption impact: ${impacted ? 'YES' : 'NO'}<br>
      Status: ${vehicle.status}<br>
      <div class="popup-history-wrap">
        <strong>Recent stored history</strong>
        ${historyTable}
      </div>
    `;
  }
}
