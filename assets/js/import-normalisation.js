function normaliseHeader(value) {
  const blank = "";
  const separator = "_";
  return value
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, blank)
    .replace(/[\s()\[\]{}]/g, separator)
    .replace(/[^a-z0-9_]+/g, separator)
    .replace(/_+/g, separator)
    .replace(/^_+|_+$/g, blank);
}
