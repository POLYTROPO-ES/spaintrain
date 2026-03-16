const DEBUG_ENABLED =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('spaintrain-debug') === '1');

function buildPrefix(level) {
  return `[SpainTrain:${level}]`;
}

export const logger = {
  debug(message, meta) {
    if (!DEBUG_ENABLED) {
      return;
    }
    if (meta !== undefined) {
      console.debug(buildPrefix('debug'), message, meta);
      return;
    }
    console.debug(buildPrefix('debug'), message);
  },
  info(message, meta) {
    if (meta !== undefined) {
      console.info(buildPrefix('info'), message, meta);
      return;
    }
    console.info(buildPrefix('info'), message);
  },
  warn(message, meta) {
    if (meta !== undefined) {
      console.warn(buildPrefix('warn'), message, meta);
      return;
    }
    console.warn(buildPrefix('warn'), message);
  },
  error(message, meta) {
    if (meta !== undefined) {
      console.error(buildPrefix('error'), message, meta);
      return;
    }
    console.error(buildPrefix('error'), message);
  },
  isDebugEnabled() {
    return DEBUG_ENABLED;
  },
};
