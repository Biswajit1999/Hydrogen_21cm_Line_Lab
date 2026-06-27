/*
 * Imported survey tables often express units as "Tb (K)", "v_LSR [km/s]",
 * or similar. Override the base normaliser before any user file is parsed so
 * those headers map to the documented canonical column names.
 */
function normaliseHeader(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/[\s()\[\]{}]/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
