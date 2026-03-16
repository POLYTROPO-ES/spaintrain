export const APP_CONFIG = {
  feedUrl: 'https://gtfsrt.renfe.com/vehicle_positions.json',
  feedFallbackUrls: ['/api/vehicle_positions'],
  updateIntervalMs: 20000,
  staleAfterMs: 40000,
  jumpThresholdKm: 15,
  spainBounds: {
    minLat: 35.5,
    maxLat: 44.5,
    minLon: -10,
    maxLon: 4.5,
  },
  storage: {
    dbName: 'spaintrain-db',
    dbVersion: 1,
    snapshotStore: 'snapshots',
    settingsStore: 'settings',
  },
  defaults: {
    language: 'es',
    theme: 'light',
    platformMode: 'strict',
    retentionDays: 7,
    lineFilters: ['all'],
    searchText: '',
  },
};
