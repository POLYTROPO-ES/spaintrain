export function buildMenu(app, i18n, settings) {
  const panel = document.createElement('aside');
  panel.className = 'menu-root';

  panel.innerHTML = `
    <div class="quick-controls">
      <button id="menu-toggle" class="menu-icon-btn" aria-label="Toggle menu" title="Toggle menu">☰</button>
      <label class="quick-inline" for="quick-language" id="quick-language-label"></label>
      <select id="quick-language">
        <option value="es">Espanol</option>
        <option value="en">English</option>
        <option value="fr">Francais</option>
        <option value="it">Italiano</option>
        <option value="pt">Portugues</option>
      </select>
      <button id="quick-theme" title="Theme"></button>
      <button id="legend-toggle" class="menu-icon-btn" aria-label="Legend" aria-expanded="false" title="Legend">?</button>
    </div>

    <div class="legend-card" id="legend-card" hidden>
      <h3 id="legend-title"></h3>
      <div class="legend-block">
        <div class="legend-block-title" id="legend-speed-title"></div>
        <div class="legend-row"><span class="legend-icon legend-icon-low">🚆</span><span id="legend-speed-low"></span></div>
        <div class="legend-row"><span class="legend-icon legend-icon-high">🚄</span><span id="legend-speed-high"></span></div>
      </div>
      <div class="legend-block">
        <div class="legend-block-title" id="legend-status-title"></div>
        <div class="legend-row"><span class="legend-dot legend-stopped"></span><span id="legend-status-stopped"></span></div>
        <div class="legend-row"><span class="legend-dot legend-incoming"></span><span id="legend-status-incoming"></span></div>
        <div class="legend-row"><span class="legend-dot legend-transit"></span><span id="legend-status-transit"></span></div>
        <div class="legend-row"><span class="legend-dot legend-unknown"></span><span id="legend-status-unknown"></span></div>
      </div>
      <label class="legend-impact-toggle" for="legend-impact-only">
        <input type="checkbox" id="legend-impact-only" />
        <span id="legend-impact-only-label"></span>
      </label>
    </div>

    <div class="menu-drawer collapsed" id="menu-drawer">
      <div class="brand-wrap">
        <h1 id="title"></h1>
        <p id="subtitle"></p>
        <div class="mode-pill" id="mode-pill"></div>
      </div>

      <div class="menu-section">
        <label for="platform-select" id="label-platform"></label>
        <select id="platform-select">
          <option value="strict" id="platform-strict"></option>
          <option value="inferred" id="platform-inferred"></option>
        </select>
      </div>

      <div class="menu-section">
        <label for="retention-days" id="label-retention"></label>
        <input id="retention-days" type="number" min="1" max="90" step="1" />
      </div>

      <div class="menu-section">
        <label for="line-filter" id="label-line-filter"></label>
        <select id="line-filter" multiple size="6">
          <option value="all" id="line-filter-all"></option>
        </select>
        <small id="line-filter-help"></small>
      </div>

      <div class="menu-section">
        <label for="search-input" id="label-search"></label>
        <input id="search-input" type="text" />
      </div>

      <div class="menu-section">
        <button id="export-data"></button>
        <button id="import-data"></button>
        <input id="import-file" type="file" accept="application/json" hidden />
      </div>

      <button id="delete-data" class="danger-btn"></button>

      <div class="stats-wrap">
        <div><span id="label-countdown"></span>: <strong id="countdown">-</strong></div>
        <div><span id="label-last-update"></span>: <strong id="last-update">-</strong></div>
        <div><span id="label-vehicles"></span>: <strong id="vehicles">0</strong></div>
        <div><span id="label-snapshots-stored"></span>: <strong id="snapshots-stored">0</strong></div>
        <div><span id="label-oldest-snapshot"></span>: <strong id="oldest-snapshot">-</strong></div>
        <div><span id="label-newest-snapshot"></span>: <strong id="newest-snapshot">-</strong></div>
        <div><span id="label-alerts-count"></span>: <strong id="alerts-count">0</strong></div>
        <div><span id="label-source"></span>: <strong id="source">-</strong></div>
        <div><span id="label-version"></span>: <strong id="version">-</strong></div>
        <div class="warning" id="stale-warning"></div>
      </div>

      <div class="menu-section alerts-section">
        <h3 id="alerts-title"></h3>
        <div id="alerts-empty" class="alerts-empty"></div>
        <ul id="alerts-list" class="alerts-list"></ul>
      </div>

      <div class="menu-section playback">
        <h3 id="playback-title"></h3>
        <label for="playback-from" id="label-from"></label>
        <input id="playback-from" type="datetime-local" />
        <label for="playback-to" id="label-to"></label>
        <input id="playback-to" type="datetime-local" />
        <button id="load-playback"></button>

        <div class="row">
          <button id="play"></button>
          <button id="pause"></button>
        </div>

        <label for="playback-speed" id="label-speed"></label>
        <select id="playback-speed">
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="4">4x</option>
        </select>

        <input id="playback-seek" type="range" min="0" max="0" value="0" />
      </div>
    </div>
  `;

  const refs = {
    panel,
    menuDrawer: panel.querySelector('#menu-drawer'),
    menuToggle: panel.querySelector('#menu-toggle'),
    quickLanguageLabel: panel.querySelector('#quick-language-label'),
    quickLanguage: panel.querySelector('#quick-language'),
    quickTheme: panel.querySelector('#quick-theme'),
    legendToggle: panel.querySelector('#legend-toggle'),
    legendCard: panel.querySelector('#legend-card'),
    legendImpactOnly: panel.querySelector('#legend-impact-only'),
    platformSelect: panel.querySelector('#platform-select'),
    retentionDays: panel.querySelector('#retention-days'),
    lineFilter: panel.querySelector('#line-filter'),
    searchInput: panel.querySelector('#search-input'),
    exportData: panel.querySelector('#export-data'),
    importData: panel.querySelector('#import-data'),
    importFile: panel.querySelector('#import-file'),
    deleteData: panel.querySelector('#delete-data'),
    countdown: panel.querySelector('#countdown'),
    lastUpdate: panel.querySelector('#last-update'),
    vehicles: panel.querySelector('#vehicles'),
    snapshotsStored: panel.querySelector('#snapshots-stored'),
    oldestSnapshot: panel.querySelector('#oldest-snapshot'),
    newestSnapshot: panel.querySelector('#newest-snapshot'),
    alertsCount: panel.querySelector('#alerts-count'),
    source: panel.querySelector('#source'),
    version: panel.querySelector('#version'),
    alertsList: panel.querySelector('#alerts-list'),
    alertsEmpty: panel.querySelector('#alerts-empty'),
    staleWarning: panel.querySelector('#stale-warning'),
    modePill: panel.querySelector('#mode-pill'),
    playbackFrom: panel.querySelector('#playback-from'),
    playbackTo: panel.querySelector('#playback-to'),
    loadPlayback: panel.querySelector('#load-playback'),
    play: panel.querySelector('#play'),
    pause: panel.querySelector('#pause'),
    speed: panel.querySelector('#playback-speed'),
    seek: panel.querySelector('#playback-seek'),
  };

  refs.quickLanguage.value = settings.language;
  refs.platformSelect.value = settings.platformMode;
  refs.retentionDays.value = settings.retentionDays;
  refs.legendImpactOnly.checked = Boolean(settings.showImpactedOnly);
  const selectedFilters = Array.isArray(settings.lineFilters) && settings.lineFilters.length > 0
    ? settings.lineFilters
    : ['all'];
  Array.from(refs.lineFilter.options).forEach((option) => {
    option.selected = selectedFilters.includes(option.value);
  });
  refs.searchInput.value = settings.searchText || '';

  refs.menuToggle.addEventListener('click', () => {
    const isCollapsed = refs.menuDrawer.classList.toggle('collapsed');
    refs.menuDrawer.hidden = isCollapsed;
    app.onMenuToggle(!isCollapsed);
  });
  refs.quickLanguage.addEventListener('change', (event) => app.onLanguageChange(event.target.value));
  refs.quickTheme.addEventListener('click', () => app.onQuickThemeToggle());
  refs.legendToggle.addEventListener('click', () => {
    const willOpen = refs.legendCard.hidden;
    refs.legendCard.hidden = !willOpen;
    refs.legendToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    refs.legendToggle.classList.toggle('active', willOpen);
  });
  refs.legendImpactOnly.addEventListener('change', (event) => app.onShowImpactedOnlyChange(event.target.checked));
  refs.platformSelect.addEventListener('change', (event) => app.onPlatformModeChange(event.target.value));
  refs.retentionDays.addEventListener('change', (event) => app.onRetentionChange(Number(event.target.value)));
  refs.lineFilter.addEventListener('change', (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
    app.onLineFilterChange(selected.length > 0 ? selected : ['all']);
  });
  refs.searchInput.addEventListener('input', (event) => app.onSearchChange(event.target.value));
  refs.exportData.addEventListener('click', () => app.onExportData());
  refs.importData.addEventListener('click', () => refs.importFile.click());
  refs.importFile.addEventListener('change', (event) => {
    const [file] = event.target.files || [];
    if (file) {
      app.onImportData(file);
    }
    event.target.value = '';
  });
  refs.deleteData.addEventListener('click', () => app.onDeleteData());

  refs.loadPlayback.addEventListener('click', () => {
    app.onLoadPlayback(refs.playbackFrom.value, refs.playbackTo.value);
  });

  refs.play.addEventListener('click', () => app.onPlaybackPlay());
  refs.pause.addEventListener('click', () => app.onPlaybackPause());
  refs.speed.addEventListener('change', (event) => app.onPlaybackSpeed(Number(event.target.value)));
  refs.seek.addEventListener('input', (event) => app.onPlaybackSeek(Number(event.target.value)));

  // Force collapsed-by-default behavior even if stale CSS is cached.
  refs.menuDrawer.hidden = true;

  const setText = (selector, key) => {
    panel.querySelector(selector).textContent = i18n.t(key);
  };

  const applyTexts = () => {
    setText('#title', 'title');
    setText('#subtitle', 'subtitle');
    refs.quickLanguageLabel.textContent = i18n.t('language');
    refs.quickTheme.textContent = `${i18n.t('theme')}: ${settings.theme === 'dark' ? i18n.t('dark') : i18n.t('light')}`;
    refs.legendToggle.title = i18n.t('legend_title');
    setText('#legend-title', 'legend_title');
    setText('#legend-speed-title', 'legend_speed_title');
    setText('#legend-speed-low', 'legend_speed_low');
    setText('#legend-speed-high', 'legend_speed_high');
    setText('#legend-status-title', 'legend_status_title');
    setText('#legend-status-stopped', 'legend_status_stopped');
    setText('#legend-status-incoming', 'legend_status_incoming');
    setText('#legend-status-transit', 'legend_status_transit');
    setText('#legend-status-unknown', 'legend_status_unknown');
    setText('#legend-impact-only-label', 'legend_filter_impacted_only');
    setText('#label-platform', 'platform_mode');
    setText('#label-retention', 'retention_days');
    setText('#label-line-filter', 'line_filter');
    setText('#line-filter-help', 'line_filter_help');
    setText('#line-filter-all', 'all_lines');
    setText('#label-search', 'search');
    panel.querySelector('#search-input').placeholder = i18n.t('search');
    setText('#export-data', 'export_data');
    setText('#import-data', 'import_data');
    setText('#delete-data', 'delete_data');
    setText('#platform-strict', 'strict');
    setText('#platform-inferred', 'inferred');
    setText('#label-countdown', 'countdown');
    setText('#label-last-update', 'last_update');
    setText('#label-vehicles', 'vehicles');
    setText('#label-snapshots-stored', 'snapshots_stored');
    setText('#label-oldest-snapshot', 'oldest_snapshot');
    setText('#label-newest-snapshot', 'newest_snapshot');
    setText('#label-alerts-count', 'alerts_count');
    setText('#label-source', 'data_source');
    setText('#label-version', 'app_version');
    setText('#alerts-title', 'service_alerts');
    if (!refs.alertsList.children.length) {
      setText('#alerts-empty', 'alerts_none');
    }
    setText('#playback-title', 'playback');
    setText('#label-from', 'from');
    setText('#label-to', 'to');
    setText('#load-playback', 'load');
    setText('#play', 'play');
    setText('#pause', 'pause');
    setText('#label-speed', 'speed');
    panel.querySelector('#menu-toggle').title = i18n.t('menu');
  };

  applyTexts();

  return {
    refs,
    applyTexts,
    syncQuickControls(nextSettings) {
      refs.quickLanguage.value = nextSettings.language;
      refs.quickTheme.textContent = `${i18n.t('theme')}: ${nextSettings.theme === 'dark' ? i18n.t('dark') : i18n.t('light')}`;
    },
    setLineOptions(lineCodes) {
      const currentSelected = Array.from(refs.lineFilter.selectedOptions).map((option) => option.value);
      refs.lineFilter.innerHTML = '';

      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = i18n.t('all_lines');
      refs.lineFilter.appendChild(allOption);

      lineCodes.forEach((lineCode) => {
        const option = document.createElement('option');
        option.value = lineCode;
        option.textContent = lineCode;
        refs.lineFilter.appendChild(option);
      });

      const validSelected = currentSelected.filter((item) => item === 'all' || lineCodes.includes(item));
      const finalSelection = validSelected.length > 0 ? validSelected : ['all'];
      Array.from(refs.lineFilter.options).forEach((option) => {
        option.selected = finalSelection.includes(option.value);
      });
    },
  };
}
