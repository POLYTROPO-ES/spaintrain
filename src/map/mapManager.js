import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const statusColor = {
  STOPPED_AT: '#b45309',
  INCOMING_AT: '#0f766e',
  IN_TRANSIT_TO: '#1d4ed8',
  UNKNOWN: '#64748b',
};

function buildTrainIcon(color) {
  const iconClass = arguments.length > 1 && arguments[1] ? 'train-svg-icon train-disruption' : 'train-svg-icon';
  const disruptionBadge = arguments.length > 1 && arguments[1]
    ? '<circle cx="28" cy="8" r="5" fill="#dc2626" stroke="#ffffff" stroke-width="1.2"/><text x="28" y="10.5" font-size="7" font-weight="700" text-anchor="middle" fill="#ffffff">!</text>'
    : '';
  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g>
        <path d="M8 11c0-3 2.4-5 5.4-5h9.2C25.6 6 28 8 28 11v9.2c0 2.6-2.1 4.8-4.8 4.8H22l3 4h-3.4l-3-4h-1.2l-3 4H11l3-4H12.8C10.1 25 8 22.8 8 20.2V11z" fill="${color}" stroke="#0f172a" stroke-width="1.2"/>
        <rect x="11.2" y="9.2" width="5.7" height="4.8" rx="1" fill="#e2e8f0"/>
        <rect x="19.1" y="9.2" width="5.7" height="4.8" rx="1" fill="#e2e8f0"/>
        <rect x="11" y="16.5" width="14" height="2.2" rx="1.1" fill="#e2e8f0" opacity="0.95"/>
        <circle cx="13.2" cy="21.2" r="1.5" fill="#0f172a"/>
        <circle cx="22.8" cy="21.2" r="1.5" fill="#0f172a"/>
        ${disruptionBadge}
      </g>
    </svg>
  `;

  return L.divIcon({
    className: iconClass,
    html: svg,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function buildHighSpeedTrainIcon(color) {
  const iconClass = arguments.length > 1 && arguments[1]
    ? 'train-svg-icon train-svg-icon-highspeed train-disruption'
    : 'train-svg-icon train-svg-icon-highspeed';
  const disruptionBadge = arguments.length > 1 && arguments[1]
    ? '<circle cx="31" cy="8" r="5" fill="#dc2626" stroke="#ffffff" stroke-width="1.2"/><text x="31" y="10.5" font-size="7" font-weight="700" text-anchor="middle" fill="#ffffff">!</text>'
    : '';
  const svg = `
    <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g>
        <path d="M6 22.2c0-6.8 4.7-12.2 11.2-13.4L30 6.4c1.1-.2 2 .8 1.7 1.8l-2.8 9.4c-.6 2-2.1 3.6-4 4.5l-8.8 4c-1.1.5-2.4.8-3.6.8H7.8A1.8 1.8 0 0 1 6 25.1v-2.9z" fill="${color}" stroke="#0f172a" stroke-width="1.2"/>
        <path d="M16.2 11.1 27 9.2l-1.3 4.4-10.9 2z" fill="#e2e8f0" opacity="0.95"/>
        <rect x="10" y="23.7" width="10.5" height="1.9" rx="0.95" fill="#e2e8f0"/>
        <circle cx="12.4" cy="27.5" r="1.4" fill="#0f172a"/>
        <circle cx="20.1" cy="27.5" r="1.4" fill="#0f172a"/>
        ${disruptionBadge}
      </g>
    </svg>
  `;

  return L.divIcon({
    className: iconClass,
    html: svg,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });
}

function resolveServiceType(vehicle) {
  return String(vehicle.serviceType || 'cercanias').toLowerCase() === 'ld' ? 'ld' : 'cercanias';
}

function normalizeLineCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildIconForVehicle(vehicle, color, isDisrupted) {
  return resolveServiceType(vehicle) === 'ld'
    ? buildHighSpeedTrainIcon(color, isDisrupted)
    : buildTrainIcon(color, isDisrupted);
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
      const markerSignature = `${vehicle.status}|${color}|${serviceType}|${isDisrupted ? 'impact' : 'normal'}`;

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
      Status: ${vehicle.status}
    `;
  }
}
