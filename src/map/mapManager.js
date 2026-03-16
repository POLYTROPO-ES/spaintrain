import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const statusColor = {
  STOPPED_AT: '#b45309',
  INCOMING_AT: '#0f766e',
  IN_TRANSIT_TO: '#1d4ed8',
  UNKNOWN: '#64748b',
};

function buildTrainIcon(color) {
  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g>
        <path d="M8 11c0-3 2.4-5 5.4-5h9.2C25.6 6 28 8 28 11v9.2c0 2.6-2.1 4.8-4.8 4.8H22l3 4h-3.4l-3-4h-1.2l-3 4H11l3-4H12.8C10.1 25 8 22.8 8 20.2V11z" fill="${color}" stroke="#0f172a" stroke-width="1.2"/>
        <rect x="11.2" y="9.2" width="5.7" height="4.8" rx="1" fill="#e2e8f0"/>
        <rect x="19.1" y="9.2" width="5.7" height="4.8" rx="1" fill="#e2e8f0"/>
        <rect x="11" y="16.5" width="14" height="2.2" rx="1.1" fill="#e2e8f0" opacity="0.95"/>
        <circle cx="13.2" cy="21.2" r="1.5" fill="#0f172a"/>
        <circle cx="22.8" cy="21.2" r="1.5" fill="#0f172a"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: 'train-svg-icon',
    html: svg,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
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
      const popup = this.createPopup(vehicle);

      if (marker) {
        marker.setLatLng([vehicle.lat, vehicle.lon]);
        marker.setIcon(buildTrainIcon(color));
        marker.bindPopup(popup);
        return;
      }

      const newMarker = L.marker([vehicle.lat, vehicle.lon], {
        icon: buildTrainIcon(color),
      }).addTo(this.markerLayer);

      newMarker.bindPopup(popup);
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

    return `
      <strong>${vehicle.lineCode}</strong><br>
      Train: ${vehicle.id}<br>
      Trip: ${vehicle.tripId || '-'}<br>
      Stop: ${vehicle.stopId || '-'}<br>
      Platform: ${platformText}<br>
      Platform confidence: ${confidence}<br>
      Status: ${vehicle.status}
    `;
  }
}
