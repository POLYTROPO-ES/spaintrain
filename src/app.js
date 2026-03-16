import { APP_CONFIG } from './core/config.js';
import { CronLikeScheduler } from './core/scheduler.js';
import { calculateBearing, estimateSpeedKmh, simulateMovement } from './core/interpolation.js';
import { FeedService } from './data/feedService.js';
import { MapManager } from './map/mapManager.js';
import { LocalStore } from './storage/db.js';
import { I18n } from './i18n/index.js';
import { buildMenu } from './ui/menu.js';
import { PlaybackPlayer } from './playback/player.js';
import { loadRailPaths } from './paths/railPathService.js';
import { validateImportPayload } from './storage/importSchema.js';
import { logger } from './core/logger.js';
import { VERSION_INFO } from './generated/version.js';
import { AlertsService } from './data/alertsService.js';
import { normalizeLineCode } from './core/lineCode.js';

const SETTINGS_KEYS = ['language', 'theme', 'platformMode', 'retentionDays', 'lineFilters', 'searchText', 'showImpactedOnly'];
const TRAIN_HISTORY_ROW_LIMIT = 8;
const SNAPSHOT_HISTORY_LIMIT = 18;

export class SpainTrainApp {
  constructor(root) {
    this.root = root;
    this.store = new LocalStore();
    this.platformMemory = {
      byVehicle: new Map(),
      byStopLine: new Map(),
    };
    const primaryFeedUrl = '/api/vehicle_positions';
    const fallbackUrls = import.meta.env.DEV ? [APP_CONFIG.feedUrl] : [];

    this.feedService = new FeedService({
      feedUrl: primaryFeedUrl,
      fallbackUrls,
      bounds: APP_CONFIG.spainBounds,
      platformMemory: this.platformMemory,
    });
    this.alertsService = new AlertsService({
      alertsUrl: '/api/alerts',
      fallbackUrls: import.meta.env.DEV ? [APP_CONFIG.alertsUrl] : [],
    });

    this.playback = new PlaybackPlayer();
    this.i18n = new I18n(APP_CONFIG.defaults.language);

    this.state = {
      settings: { ...APP_CONFIG.defaults },
      previousSnapshot: null,
      currentSnapshot: null,
      liveRenderMode: true,
      menuOpen: false,
      latestTickId: 0,
      nextUpdateAt: Date.now(),
      isStale: false,
      metrics: {
        fetchLatencyMs: 0,
      },
      discardedOutOfOrderCount: 0,
      alerts: [],
      alertsMetrics: {
        source: '/api/alerts',
        count: 0,
      },
      disruptionLineCodes: new Set(),
      storageMetrics: {
        count: 0,
        oldestSnapshotTimeMs: null,
        newestSnapshotTimeMs: null,
      },
      trainHistoryRowsById: new Map(),
    };

    this.animationFrame = null;
    this.scheduler = null;
  }

  async init() {
    logger.info('Initializing app', { debug: logger.isDebugEnabled() });
    await this.loadSettings();
    this.mountLayout();
    this.applyTheme(this.state.settings.theme);

    this.map = new MapManager('map');
    this.loadRailPathsInBackground();
    await this.refreshStorageInsights();
    this.refreshStats();

    this.configurePlayback();
    this.startAnimationLoop();
    this.startScheduler();

    if ('serviceWorker' in navigator) {
      if (import.meta.env.PROD) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      } else {
        // Prevent stale dev assets (for example old dot markers) from service worker cache.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        }).catch(() => {});
      }
    }
  }

  async loadRailPathsInBackground() {
    if (import.meta.env.PROD && !APP_CONFIG.loadRailPathsInProduction) {
      logger.info('Skipping external rail-path loading in production');
      return;
    }

    try {
      const railPaths = await loadRailPaths();
      if (railPaths) {
        this.map.setRailPaths(railPaths);
        logger.debug('Rail path overlay loaded', { featureCount: railPaths.features?.length || 0 });
      } else {
        logger.warn('Rail path overlay unavailable, continuing without overlay');
      }
    } catch (error) {
      logger.warn('Rail path background load failed, continuing without overlay', {
        message: String(error?.message || error),
      });
    }
  }

  async loadSettings() {
    this.state.settings = await this.store.getSettings(SETTINGS_KEYS, APP_CONFIG.defaults);

    if (!Array.isArray(this.state.settings.lineFilters) || this.state.settings.lineFilters.length === 0) {
      this.state.settings.lineFilters = ['all'];
    }
    this.i18n.setLanguage(this.state.settings.language);
  }

  mountLayout() {
    this.root.innerHTML = `
      <div class="app-shell">
        <div id="map" class="map-area"></div>
        <div id="first-load-overlay" class="first-load-overlay" role="status" aria-live="polite">
          <div class="first-load-card">
            <div class="first-load-icon" aria-hidden="true">🚆</div>
            <div id="first-load-text" class="first-load-text"></div>
            <div class="first-load-spinner" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    `;

    const { refs, applyTexts, setLineOptions, syncQuickControls } = buildMenu(this, this.i18n, this.state.settings);
    this.ui = { refs, applyTexts, setLineOptions, syncQuickControls };
    this.root.querySelector('.app-shell').appendChild(refs.panel);
    this.firstLoadOverlay = this.root.querySelector('#first-load-overlay');
    this.firstLoadText = this.root.querySelector('#first-load-text');
    this.updateFirstLoadOverlayText();
    this.ui.refs.version.textContent = VERSION_INFO.displayVersion;
    this.refreshStats();
  }

  configurePlayback() {
    this.playback.onFrame = (snapshot) => {
      this.state.liveRenderMode = false;
      this.map.updateVehicles(this.applyVehicleFilters(snapshot.vehicles));
      this.ui.refs.modePill.textContent = this.i18n.t('status_playback');
    };

    this.playback.onState = (state) => {
      this.ui.refs.seek.max = String(Math.max(0, state.total - 1));
      this.ui.refs.seek.value = String(state.index);
      this.ui.refs.speed.value = String(state.speed);
    };
  }

  startScheduler() {
    this.scheduler = new CronLikeScheduler({
      intervalMs: APP_CONFIG.updateIntervalMs,
      onTick: (tickId) => this.fetchCycle(tickId),
      onError: () => {
        this.state.isStale = true;
        this.refreshStats();
      },
    });
    this.scheduler.start();
  }

  async fetchCycle(tickId) {
    this.state.nextUpdateAt = Date.now() + APP_CONFIG.updateIntervalMs;
    const [snapshot, alertsPayload] = await Promise.all([
      this.fetchWithBackoff(this.state.settings.platformMode),
      this.fetchAlertsSafe(this.state.settings.language),
    ]);

    if (tickId < this.state.latestTickId) {
      return;
    }

    if (this.shouldDiscardSnapshot(snapshot)) {
      this.state.latestTickId = tickId;
      this.state.discardedOutOfOrderCount += 1;
      logger.warn('Discarding out-of-order snapshot', {
        tickId,
        discardedOutOfOrderCount: this.state.discardedOutOfOrderCount,
        incomingHeaderTimestampMs: Number(snapshot?.headerTimestampMs || 0),
        currentHeaderTimestampMs: Number(this.state.currentSnapshot?.headerTimestampMs || 0),
      });
      this.refreshStats();
      return;
    }

    this.state.latestTickId = tickId;
    this.state.previousSnapshot = this.state.currentSnapshot;
    this.state.currentSnapshot = snapshot;
    this.state.liveRenderMode = true;
    this.state.metrics = snapshot.metrics;
    this.state.alerts = alertsPayload.alerts;
    this.state.alertsMetrics = alertsPayload.metrics;
    this.state.isStale = false;
    this.state.disruptionLineCodes = this.collectDisruptionLineCodes(this.state.alerts);
    this.map.setDisruptionLineCodes(this.state.disruptionLineCodes);

    this.ui.refs.modePill.textContent = this.i18n.t('status_live');
    this.refreshLineOptions(snapshot.vehicles);
    this.renderAlerts();
    this.hideFirstLoadOverlay();
    logger.debug('Snapshot applied', {
      tickId,
      vehicles: snapshot.vehicles.length,
      source: snapshot.metrics?.source,
      latencyMs: snapshot.metrics?.fetchLatencyMs,
    });

    await this.store.saveSnapshot(snapshot);
    const retentionCutoff = Date.now() - Number(this.state.settings.retentionDays) * 24 * 60 * 60 * 1000;
    await this.store.pruneOlderThan(retentionCutoff);
    await this.refreshStorageInsights();

    this.refreshStats();
  }

  async refreshStorageInsights() {
    try {
      const [storageMetrics, recentSnapshots] = await Promise.all([
        this.store.getSnapshotMetrics(),
        this.store.getRecentSnapshots(SNAPSHOT_HISTORY_LIMIT),
      ]);
      this.state.storageMetrics = storageMetrics;
      this.state.trainHistoryRowsById = this.buildTrainHistoryRowsById(recentSnapshots, TRAIN_HISTORY_ROW_LIMIT);
    } catch (error) {
      logger.warn('Failed to refresh local storage metrics', { message: String(error?.message || error) });
    }
  }

  buildTrainHistoryRowsById(snapshots, rowLimit) {
    const byTrainId = new Map();

    (snapshots || []).forEach((snapshot) => {
      const snapshotTimeMs = Number(snapshot?.snapshotTimeMs || 0);
      const vehicles = Array.isArray(snapshot?.vehicles) ? snapshot.vehicles : [];
      vehicles.forEach((vehicle) => {
        const trainId = String(vehicle?.id || '');
        if (!trainId) {
          return;
        }

        const row = {
          timestampMs: snapshotTimeMs,
          lat: Number(vehicle?.lat || 0),
          lon: Number(vehicle?.lon || 0),
          sourceTimestampMs: Number(vehicle?.sourceTimestampMs || 0),
        };

        if (!byTrainId.has(trainId)) {
          byTrainId.set(trainId, []);
        }
        byTrainId.get(trainId).push(row);
      });
    });

    byTrainId.forEach((rows, trainId) => {
      rows.sort((a, b) => a.timestampMs - b.timestampMs);
      const sliced = rows.slice(-rowLimit);
      const withSpeed = sliced.map((row, index) => {
        if (index === 0) {
          return {
            timestampMs: row.timestampMs,
            lat: row.lat,
            lon: row.lon,
            speedKmh: 0,
          };
        }

        const prev = sliced[index - 1];
        const speedKmh = estimateSpeedKmh(
          {
            lat: prev.lat,
            lon: prev.lon,
            sourceTimestampMs: prev.sourceTimestampMs || prev.timestampMs,
          },
          {
            lat: row.lat,
            lon: row.lon,
            sourceTimestampMs: row.sourceTimestampMs || row.timestampMs,
          },
          Math.max(1, row.timestampMs - prev.timestampMs)
        );

        return {
          timestampMs: row.timestampMs,
          lat: row.lat,
          lon: row.lon,
          speedKmh,
        };
      });

      byTrainId.set(trainId, withSpeed);
    });

    return byTrainId;
  }

  shouldDiscardSnapshot(incomingSnapshot) {
    if (!this.state.currentSnapshot) {
      return false;
    }

    const incomingTs = Number(incomingSnapshot?.headerTimestampMs || 0);
    const currentTs = Number(this.state.currentSnapshot?.headerTimestampMs || 0);

    // Only accept strictly newer source timestamps to keep movement interpolation monotonic.
    if (incomingTs > 0 && currentTs > 0) {
      return incomingTs <= currentTs;
    }

    const incomingFallbackTs = Number(incomingSnapshot?.snapshotTimeMs || 0);
    const currentFallbackTs = Number(this.state.currentSnapshot?.snapshotTimeMs || 0);
    return incomingFallbackTs <= currentFallbackTs;
  }

  async fetchAlertsSafe(language) {
    try {
      return await this.alertsService.fetchAlerts(language);
    } catch (error) {
      logger.warn('Alerts fetch failed', { message: String(error?.message || error) });
      return {
        alerts: [],
        metrics: {
          source: 'unavailable',
          count: 0,
        },
      };
    }
  }

  async fetchWithBackoff(platformMode) {
    const delays = [0, 2000, 4000, 8000];
    let lastError = null;

    for (const delay of delays) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        return await this.feedService.fetchSnapshot(platformMode);
      } catch (error) {
        lastError = error;
        logger.warn('Fetch attempt failed', { delay, message: String(error?.message || error) });
      }
    }

    throw lastError || new Error('Feed fetch failed');
  }

  startAnimationLoop() {
    const frame = () => {
      this.renderLiveInterpolated();
      this.refreshStats();
      this.animationFrame = requestAnimationFrame(frame);
    };

    frame();
  }

  renderLiveInterpolated() {
    if (!this.state.liveRenderMode || !this.state.currentSnapshot) {
      return;
    }

    const current = this.state.currentSnapshot;
    const previousById = new Map(
      (this.state.previousSnapshot?.vehicles || []).map((vehicle) => [vehicle.id, vehicle])
    );

    const progress = Math.max(
      0,
      Date.now() - current.snapshotTimeMs
    );

    const vehicles = current.vehicles.map((vehicle) => {
      const prev = previousById.get(vehicle.id);
      if (!prev) {
        return {
          ...vehicle,
          estimatedSpeedKmh: 0,
          estimatedHeadingDeg: null,
          motionModel: 'insufficient_history',
        };
      }

      const simulated = simulateMovement(prev, vehicle, progress, {
        updateIntervalMs: APP_CONFIG.updateIntervalMs,
        jumpThresholdKm: APP_CONFIG.jumpThresholdKm,
      });

      const estimatedSpeedKmh = estimateSpeedKmh(prev, vehicle, APP_CONFIG.updateIntervalMs);
      const estimatedHeadingDeg = calculateBearing(
        { lat: prev.lat, lon: prev.lon },
        { lat: vehicle.lat, lon: vehicle.lon }
      );

      return {
        ...vehicle,
        lat: simulated.lat,
        lon: simulated.lon,
        estimatedSpeedKmh,
        estimatedHeadingDeg,
        motionModel: 'kinematic_status_aware',
      };
    });

    this.renderVehicles(vehicles, current.vehicles.length);

    const staleMs = Date.now() - current.snapshotTimeMs;
    this.state.isStale = staleMs > APP_CONFIG.staleAfterMs;
  }

  refreshStats() {
    if (!this.ui) {
      return;
    }

    const countdownSec = Math.max(0, Math.ceil((this.state.nextUpdateAt - Date.now()) / 1000));
    this.ui.refs.countdown.textContent = `${countdownSec}s`;

    if (this.state.currentSnapshot) {
      this.ui.refs.lastUpdate.textContent = new Date(this.state.currentSnapshot.snapshotTimeMs).toLocaleTimeString();
    }

    this.ui.refs.staleWarning.textContent = this.state.isStale ? this.i18n.t('stale_warning') : '';
    this.ui.refs.source.textContent = this.state.metrics.source || 'direct';
    this.ui.refs.alertsCount.textContent = String(this.state.alertsMetrics.count || 0);
    this.ui.refs.discardedSnapshots.textContent = String(this.state.discardedOutOfOrderCount || 0);
    this.ui.refs.snapshotsStored.textContent = String(this.state.storageMetrics.count || 0);
    this.ui.refs.oldestSnapshot.textContent = this.formatMetricDate(this.state.storageMetrics.oldestSnapshotTimeMs);
    this.ui.refs.newestSnapshot.textContent = this.formatMetricDate(this.state.storageMetrics.newestSnapshotTimeMs);
  }

  formatMetricDate(valueMs) {
    if (!valueMs || !Number.isFinite(Number(valueMs))) {
      return '-';
    }
    return new Date(Number(valueMs)).toLocaleString();
  }

  renderAlerts() {
    if (!this.ui?.refs?.alertsList || !this.ui?.refs?.alertsEmpty) {
      return;
    }

    const alerts = this.state.alerts || [];
    const list = this.ui.refs.alertsList;
    list.innerHTML = '';

    if (alerts.length === 0) {
      this.ui.refs.alertsEmpty.textContent = this.i18n.t('alerts_none');
      return;
    }

    this.ui.refs.alertsEmpty.textContent = '';
    alerts.slice(0, 6).forEach((alertItem) => {
      const li = document.createElement('li');
      const title = alertItem.header || alertItem.description || alertItem.id;
      const lines = alertItem.lines.length > 0 ? ` [${alertItem.lines.join(', ')}]` : '';
      const body = alertItem.description || '';
      li.textContent = `${title}${lines}${body ? ` - ${body}` : ''}`;
      list.appendChild(li);
    });
  }

  collectDisruptionLineCodes(alerts) {
    const set = new Set();
    (alerts || []).forEach((alertItem) => {
      (alertItem.normalizedLines || []).forEach((lineCode) => set.add(lineCode));
    });
    return set;
  }

  async onLanguageChange(language) {
    this.state.settings.language = language;
    this.i18n.setLanguage(language);
    this.ui.applyTexts();
    this.ui.syncQuickControls(this.state.settings);
    this.updateFirstLoadOverlayText();
    this.refreshLineOptions(this.state.currentSnapshot?.vehicles || []);
    this.renderAlerts();
    await this.store.setSetting('language', language);
    logger.info('Language changed', { language });
  }

  async onThemeChange(theme) {
    this.state.settings.theme = theme;
    this.applyTheme(theme);
    this.ui.syncQuickControls(this.state.settings);
    await this.store.setSetting('theme', theme);
    logger.info('Theme changed', { theme });
  }

  onQuickThemeToggle() {
    const next = this.state.settings.theme === 'dark' ? 'light' : 'dark';
    this.onThemeChange(next);
  }

  onMenuToggle(isOpen) {
    this.state.menuOpen = Boolean(isOpen);
    logger.debug('Menu toggled', { isOpen: this.state.menuOpen });
  }

  async onPlatformModeChange(mode) {
    this.state.settings.platformMode = mode;
    await this.store.setSetting('platformMode', mode);
    await this.fetchCycle(this.state.latestTickId + 1);
  }

  async onRetentionChange(days) {
    const safe = Math.max(1, Math.min(90, Number(days || APP_CONFIG.defaults.retentionDays)));
    this.state.settings.retentionDays = safe;
    this.ui.refs.retentionDays.value = String(safe);
    await this.store.setSetting('retentionDays', safe);
  }

  async onDeleteData() {
    try {
      await this.store.clearAll();
      this.platformMemory.byVehicle.clear();
      this.platformMemory.byStopLine.clear();
      this.state.previousSnapshot = null;
      this.state.currentSnapshot = null;
      this.state.alerts = [];
      this.state.alertsMetrics = { source: '/api/alerts', count: 0 };
      this.state.discardedOutOfOrderCount = 0;
      this.state.disruptionLineCodes = new Set();
      this.state.storageMetrics = { count: 0, oldestSnapshotTimeMs: null, newestSnapshotTimeMs: null };
      this.state.trainHistoryRowsById = new Map();
      this.map.setDisruptionLineCodes(this.state.disruptionLineCodes);

      this.ui.refs.vehicles.textContent = '0';
      this.ui.refs.lastUpdate.textContent = '-';
      this.ui.refs.modePill.textContent = this.i18n.t('status_live');
      this.ui.refs.alertsCount.textContent = '0';
      this.ui.refs.discardedSnapshots.textContent = '0';
      this.ui.refs.snapshotsStored.textContent = '0';
      this.ui.refs.oldestSnapshot.textContent = '-';
      this.ui.refs.newestSnapshot.textContent = '-';
      this.ui.refs.alertsList.innerHTML = '';
      this.ui.refs.alertsEmpty.textContent = this.i18n.t('alerts_none');

      alert(this.i18n.t('delete_data_success'));
      logger.info('Local database cleared');
    } catch (error) {
      const message = String(error?.message || error);
      alert(`${this.i18n.t('delete_data_failed')}: ${message}`);
      logger.error('Local database clear failed', { message });
    }
  }

  async onLineFilterChange(lineFilters) {
    const normalized = (lineFilters || []).map((item) => String(item).trim()).filter(Boolean);
    this.state.settings.lineFilters = normalized.length > 0 ? normalized : ['all'];
    await this.store.setSetting('lineFilters', this.state.settings.lineFilters);
    logger.debug('Line filters updated', { lineFilters: this.state.settings.lineFilters });
  }

  async onSearchChange(searchText) {
    this.state.settings.searchText = searchText;
    await this.store.setSetting('searchText', searchText);
    logger.debug('Search updated', { searchText });
  }

  async onShowImpactedOnlyChange(enabled) {
    this.state.settings.showImpactedOnly = Boolean(enabled);
    await this.store.setSetting('showImpactedOnly', this.state.settings.showImpactedOnly);
    this.renderLiveInterpolated();
    if (!this.state.liveRenderMode && this.state.currentSnapshot) {
      this.renderVehicles(this.state.currentSnapshot.vehicles, this.state.currentSnapshot.vehicles.length);
    }
  }

  async onExportData() {
    const snapshots = await this.store.getAllSnapshots();
    const payload = {
      app: 'spaintrain',
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshots,
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `spaintrain-history-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async onImportData(file) {
    try {
      logger.info('Import started', { fileName: file.name, size: file.size });
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = validateImportPayload(parsed);

      if (!validation.valid && validation.snapshots.length === 0) {
        alert(`${this.i18n.t('import_invalid_schema')}: ${validation.errors.join('; ')}`);
        return;
      }

      await this.store.importSnapshots(validation.snapshots);
      await this.refreshStorageInsights();
      this.refreshStats();
      if (validation.errors.length > 0) {
        alert(`${this.i18n.t('import_partial')}: ${validation.errors.join('; ')}`);
        logger.warn('Import completed with warnings', { errors: validation.errors, imported: validation.snapshots.length });
      } else {
        alert(this.i18n.t('imported_ok'));
        logger.info('Import completed', { imported: validation.snapshots.length });
      }
    } catch {
      alert(this.i18n.t('import_failed'));
      logger.error('Import failed');
    }
  }

  async onLoadPlayback(fromIso, toIso) {
    const fromMs = fromIso ? new Date(fromIso).getTime() : Date.now() - 24 * 60 * 60 * 1000;
    const toMs = toIso ? new Date(toIso).getTime() : Date.now();

    const snapshots = await this.store.loadSnapshots(fromMs, toMs);
    this.playback.loadSnapshots(snapshots);
    if (snapshots.length) {
      this.playback.seek(0);
    }
  }

  onPlaybackPlay() {
    this.playback.play();
  }

  onPlaybackPause() {
    this.playback.pause();
    this.state.liveRenderMode = true;
    this.ui.refs.modePill.textContent = this.i18n.t('status_live');
  }

  onPlaybackSpeed(speed) {
    this.playback.setSpeed(speed);
  }

  onPlaybackSeek(index) {
    this.playback.seek(index);
  }

  applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  updateFirstLoadOverlayText() {
    if (this.firstLoadText) {
      this.firstLoadText.textContent = this.i18n.t('updating_first_data');
    }
  }

  hideFirstLoadOverlay() {
    if (!this.firstLoadOverlay) {
      return;
    }
    this.firstLoadOverlay.classList.add('hidden');
  }

  refreshLineOptions(vehicles) {
    const codes = Array.from(new Set(vehicles.map((vehicle) => vehicle.lineCode).filter(Boolean))).sort();
    this.ui.setLineOptions(codes);
  }

  renderVehicles(vehicles, totalCount = vehicles.length) {
    const vehiclesWithHistory = vehicles.map((vehicle) => ({
      ...vehicle,
      historyRows: this.state.trainHistoryRowsById.get(vehicle.id) || [],
    }));
    const filtered = this.applyVehicleFilters(vehiclesWithHistory);
    this.map.updateVehicles(filtered);
    this.ui.refs.vehicles.textContent = `${filtered.length} / ${totalCount}`;
  }

  applyVehicleFilters(vehicles) {
    const lineFilters = new Set((this.state.settings.lineFilters || ['all']).map((item) => item.toLowerCase()));
    const search = (this.state.settings.searchText || '').trim().toLowerCase();
    const showImpactedOnly = Boolean(this.state.settings.showImpactedOnly);
    const disruptionLineCodes = this.state.disruptionLineCodes || new Set();
    const hasImpactedLines = disruptionLineCodes.size > 0;

    return vehicles.filter((vehicle) => {
      const lineCode = String(vehicle.lineCode || '');
      const lineCodeLower = lineCode.toLowerCase();

      if (showImpactedOnly && hasImpactedLines) {
        const normalizedLine = normalizeLineCode(lineCode);
        if (!normalizedLine || !disruptionLineCodes.has(normalizedLine)) {
          return false;
        }
      }

      if (!lineFilters.has('all') && !lineFilters.has(lineCodeLower)) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        vehicle.id.toLowerCase().includes(search) ||
        lineCodeLower.includes(search) ||
        vehicle.label.toLowerCase().includes(search)
      );
    });
  }
}
