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
        <div><span id="label-source"></span>: <strong id="source">-</strong></div>
        <div class="warning" id="stale-warning"></div>
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
    source: panel.querySelector('#source'),
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
  const selectedFilters = Array.isArray(settings.lineFilters) && settings.lineFilters.length > 0
    ? settings.lineFilters
    : ['all'];
  Array.from(refs.lineFilter.options).forEach((option) => {
    option.selected = selectedFilters.includes(option.value);
  });
  refs.searchInput.value = settings.searchText || '';

  refs.menuToggle.addEventListener('click', () => {
    const isCollapsed = refs.menuDrawer.classList.toggle('collapsed');
    app.onMenuToggle(!isCollapsed);
  });
  refs.quickLanguage.addEventListener('change', (event) => app.onLanguageChange(event.target.value));
  refs.quickTheme.addEventListener('click', () => app.onQuickThemeToggle());
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

  const applyTexts = () => {
    panel.querySelector('#title').textContent = i18n.t('title');
    panel.querySelector('#subtitle').textContent = i18n.t('subtitle');
    refs.quickLanguageLabel.textContent = i18n.t('language');
    refs.quickTheme.textContent = `${i18n.t('theme')}: ${settings.theme === 'dark' ? i18n.t('dark') : i18n.t('light')}`;
    panel.querySelector('#label-platform').textContent = i18n.t('platform_mode');
    panel.querySelector('#label-retention').textContent = i18n.t('retention_days');
    panel.querySelector('#label-line-filter').textContent = i18n.t('line_filter');
    panel.querySelector('#line-filter-help').textContent = i18n.t('line_filter_help');
    panel.querySelector('#line-filter-all').textContent = i18n.t('all_lines');
    panel.querySelector('#label-search').textContent = i18n.t('search');
    panel.querySelector('#search-input').placeholder = i18n.t('search');
    panel.querySelector('#export-data').textContent = i18n.t('export_data');
    panel.querySelector('#import-data').textContent = i18n.t('import_data');
    panel.querySelector('#delete-data').textContent = i18n.t('delete_data');
    panel.querySelector('#platform-strict').textContent = i18n.t('strict');
    panel.querySelector('#platform-inferred').textContent = i18n.t('inferred');
    panel.querySelector('#label-countdown').textContent = i18n.t('countdown');
    panel.querySelector('#label-last-update').textContent = i18n.t('last_update');
    panel.querySelector('#label-vehicles').textContent = i18n.t('vehicles');
    panel.querySelector('#label-source').textContent = i18n.t('data_source');
    panel.querySelector('#playback-title').textContent = i18n.t('playback');
    panel.querySelector('#label-from').textContent = i18n.t('from');
    panel.querySelector('#label-to').textContent = i18n.t('to');
    panel.querySelector('#load-playback').textContent = i18n.t('load');
    panel.querySelector('#play').textContent = i18n.t('play');
    panel.querySelector('#pause').textContent = i18n.t('pause');
    panel.querySelector('#label-speed').textContent = i18n.t('speed');
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
