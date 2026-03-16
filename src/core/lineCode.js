export function normalizeLineCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
