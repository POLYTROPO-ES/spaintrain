import sampleRailPaths from './rail-paths-spain-sample.geojson?raw';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// Split Spain into smaller regions to avoid gateway timeouts on huge single queries.
const SPAIN_BBOX_TILES = [
  { minLat: 35.5, minLon: -10.0, maxLat: 38.2, maxLon: -5.5 },
  { minLat: 35.5, minLon: -5.5, maxLat: 38.2, maxLon: -0.5 },
  { minLat: 35.5, minLon: -0.5, maxLat: 38.2, maxLon: 4.5 },
  { minLat: 38.2, minLon: -10.0, maxLat: 40.8, maxLon: -5.5 },
  { minLat: 38.2, minLon: -5.5, maxLat: 40.8, maxLon: -0.5 },
  { minLat: 38.2, minLon: -0.5, maxLat: 40.8, maxLon: 4.5 },
  { minLat: 40.8, minLon: -10.0, maxLat: 44.5, maxLon: -5.5 },
  { minLat: 40.8, minLon: -5.5, maxLat: 44.5, maxLon: -0.5 },
  { minLat: 40.8, minLon: -0.5, maxLat: 44.5, maxLon: 4.5 },
];

function parseSample() {
  return JSON.parse(sampleRailPaths);
}

function buildQuery(tile) {
  return `[out:json][timeout:25];(way["railway"~"^(rail|light_rail|subway|narrow_gauge)$"](${tile.minLat},${tile.minLon},${tile.maxLat},${tile.maxLon}););out geom;`;
}

async function fetchOverpassTile(endpoint, tile) {
  const query = buildQuery(tile);
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Overpass failed with ${response.status}`);
  }

  return response.json();
}

function toGeoJsonFeatures(elements) {
  return (elements || [])
    .filter((element) => element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length > 1)
    .map((element) => ({
      type: 'Feature',
      id: `way-${element.id}`,
      properties: {
        name: element.tags?.name || 'Rail segment',
        railway: element.tags?.railway || 'rail',
      },
      geometry: {
        type: 'LineString',
        coordinates: element.geometry.map((pt) => [pt.lon, pt.lat]),
      },
    }));
}

function dedupeFeatures(features) {
  const byId = new Map();
  features.forEach((feature) => {
    const key = feature.id || JSON.stringify(feature.geometry.coordinates[0]);
    if (!byId.has(key)) {
      byId.set(key, feature);
    }
  });
  return Array.from(byId.values());
}

export async function loadRailPaths() {
  const allFeatures = [];

  for (const tile of SPAIN_BBOX_TILES) {
    let tileLoaded = false;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const overpass = await fetchOverpassTile(endpoint, tile);
        const tileFeatures = toGeoJsonFeatures(overpass.elements);
        if (tileFeatures.length > 0) {
          allFeatures.push(...tileFeatures);
        }
        tileLoaded = true;
        break;
      } catch {
        // Try the next mirror for this tile.
      }
    }

    if (!tileLoaded) {
      // Continue with other tiles even if one tile fails due to temporary server load.
      continue;
    }
  }

  try {
    const features = dedupeFeatures(allFeatures);
    if (features.length > 0) {
      return {
        type: 'FeatureCollection',
        features,
      };
    }
    return parseSample();
  } catch {
    return parseSample();
  }
}
