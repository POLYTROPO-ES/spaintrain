import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { normalizeLineCode } from '../core/lineCode.js';

const statusColor = {
  STOPPED_AT: '#b45309',
  INCOMING_AT: '#0f766e',
  IN_TRANSIT_TO: '#1d4ed8',
  UNKNOWN: '#64748b',
};

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
  if (!Number.isFinite(Number(headingDeg))) {
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
        <path d="M6 19 13 11h7.8v16H13z" fill="${color}" stroke="#111827" stroke-width="1.4"/>
        <rect x="20.8" y="11" width="12.4" height="16" rx="1.8" fill="${color}" stroke="#111827" stroke-width="1.4"/>
        <path d="M48 19 41 11h-7.8v16H41z" fill="${color}" stroke="#111827" stroke-width="1.4"/>

        <line x1="16.2" y1="13.8" x2="16.2" y2="24.2" stroke="#ffffff" stroke-width="0.9" opacity="0.9"/>
        <line x1="37.8" y1="13.8" x2="37.8" y2="24.2" stroke="#ffffff" stroke-width="0.9" opacity="0.9"/>

        <line x1="23.2" y1="19" x2="30.8" y2="19" stroke="#e2e8f0" stroke-width="1.5" opacity="0.95"/>
        <line x1="21.1" y1="19" x2="23.2" y2="19" stroke="#111827" stroke-width="1.1"/>
        <line x1="30.8" y1="19" x2="32.9" y2="19" stroke="#111827" stroke-width="1.1"/>

        <circle cx="14.1" cy="19" r="1" fill="#111827"/>
        <circle cx="39.9" cy="19" r="1" fill="#111827"/>

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
  return resolveServiceType(vehicle) === 'ld'
    ? buildHighSpeedTrainIcon(color, isDisrupted, vehicle.estimatedHeadingDeg)
    : buildTrainIcon(color, isDisrupted);
}

function getHeadingBucket(vehicle) {
  if (!Number.isFinite(Number(vehicle?.estimatedHeadingDeg))) {
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
    const speed = `${Math.round(Number(row.speedKmh || 0))} km/h`;
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

  updateVehicles(vehicles) {
    const activeIds = new Set();

    vehicles.forEach((vehicle) => {
      activeIds.add(vehicle.id);
      const marker = this.markerCache.get(vehicle.id);
      const color = statusColor[vehicle.status] || statusColor.UNKNOWN;
      const normalizedLine = normalizeLineCode(vehicle.lineCode);
      const isDisrupted = normalizedLine ? this.disruptionLineCodes.has(normalizedLine) : false;
      const popup = this.createPopup(vehicle);
      const serviceType = resolveServiceType(vehicle);
      const headingBucket = serviceType === 'ld' ? getHeadingBucket(vehicle) : 'na';
      const markerSignature = `${vehicle.status}|${color}|${serviceType}|${isDisrupted ? 'impact' : 'normal'}|${headingBucket}`;

      if (marker) {
        const wasPopupOpen = marker.isPopupOpen();
        marker.setLatLng([vehicle.lat, vehicle.lon]);

        // Avoid recreating icon/popup binding every frame; this keeps marker click interactions stable.
        if (marker.__signature !== markerSignature) {
          marker.setIcon(buildIconForVehicle(vehicle, color, isDisrupted));
          marker.__signature = markerSignature;
        }

        if (marker.getPopup()) {
          marker.setPopupContent(popup);
        } else {
          marker.bindPopup(popup);
        }

        if (wasPopupOpen) {
          marker.openPopup();
        }
        return;
      }

      const newMarker = L.marker([vehicle.lat, vehicle.lon], {
        icon: buildIconForVehicle(vehicle, color, isDisrupted),
      }).addTo(this.markerLayer);

      newMarker.bindPopup(popup);
      newMarker.__signature = markerSignature;
      this.markerCache.set(vehicle.id, newMarker);
    });

    Array.from(this.markerCache.keys()).forEach((id) => {
      if (!activeIds.has(id)) {
        const marker = this.markerCache.get(id);
        this.markerLayer.removeLayer(marker);
        this.markerCache.delete(id);
      }
    });
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
