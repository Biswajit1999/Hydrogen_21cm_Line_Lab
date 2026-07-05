/* Conservative browser-side FITS reader for a 1D H I brightness-temperature spectrum. */
(function (root) {
  "use strict";
  const BLOCK_BYTES = 2880;
  const CARD_BYTES = 80;

  function fail(message) { throw new Error(`FITS import rejected: ${message}`); }
  function parseCardValue(card) {
    const raw = card.slice(10, 80).split("/")[0].trim();
    if (!raw) return null;
    if (raw.startsWith("'")) {
      const end = raw.indexOf("'", 1);
      return end >= 1 ? raw.slice(1, end).trim() : raw.slice(1).trim();
    }
    if (raw === "T") return true;
    if (raw === "F") return false;
    const number = Number(raw.replace(/D/g, "E"));
    return Number.isFinite(number) ? number : raw;
  }
  function parseHeader(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder("ascii");
    const header = {};
    let offset = 0;
    let ended = false;
    while (offset + CARD_BYTES <= bytes.length) {
      const card = decoder.decode(bytes.subarray(offset, offset + CARD_BYTES));
      offset += CARD_BYTES;
      const key = card.slice(0, 8).trim();
      if (key === "END") { ended = true; break; }
      if (key && card[8] === "=") header[key] = parseCardValue(card);
    }
    if (!ended) fail("header END card was not found");
    return { header, dataOffset: Math.ceil(offset / BLOCK_BYTES) * BLOCK_BYTES };
  }
  function floatOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function unitScaleToKmS(unit) {
    const normalised = String(unit || "").toLowerCase().replace(/\s/g, "");
    if (["km/s", "kms-1", "km.s-1"].includes(normalised)) return 1;
    if (["m/s", "ms-1", "m.s-1"].includes(normalised)) return 1e-3;
    fail(`CUNIT1='${unit || "missing"}' is unsupported; use km/s or m/s`);
  }
  function validateHeader(header) {
    if (Number(header.NAXIS) !== 1) fail("only a 1D primary Image HDU is supported");
    const count = Number(header.NAXIS1);
    if (!Number.isInteger(count) || count < 3) fail("NAXIS1 must contain at least three channels");
    const bitpix = Number(header.BITPIX);
    if (![8, 16, 32, -32, -64].includes(bitpix)) fail(`BITPIX=${header.BITPIX} is unsupported`);
    const ctype = String(header.CTYPE1 || "").toUpperCase();
    if (!/(VELO|VRAD|VOPT)/.test(ctype)) {
      fail("CTYPE1 must be an explicit velocity axis (VELO, VRAD, or VOPT); frequency-only FITS needs declared convention conversion");
    }
    const bunit = String(header.BUNIT || "").toLowerCase().replace(/\s/g, "");
    if (!/(^k$|kelvin|k\b)/.test(bunit)) fail(`BUNIT='${header.BUNIT || "missing"}' is unsupported; brightness temperature must be in K`);
    ["CRVAL1", "CDELT1", "CRPIX1", "CUNIT1"].forEach((key) => {
      if (header[key] === undefined || header[key] === null || header[key] === "") fail(`${key} is required for a calibrated velocity axis`);
    });
    return { count, bitpix, ctype, scale: unitScaleToKmS(header.CUNIT1) };
  }
  function readRawValue(view, offset, bitpix) {
    if (bitpix === 8) return view.getUint8(offset);
    if (bitpix === 16) return view.getInt16(offset, false);
    if (bitpix === 32) return view.getInt32(offset, false);
    if (bitpix === -32) return view.getFloat32(offset, false);
    if (bitpix === -64) return view.getFloat64(offset, false);
    fail(`unsupported BITPIX=${bitpix}`);
  }
  function bytesPerSample(bitpix) { return Math.abs(bitpix) / 8; }
  function parseFitsVelocitySpectrum(arrayBuffer, filename) {
    if (!(arrayBuffer instanceof ArrayBuffer)) fail("binary content is required");
    const { header, dataOffset } = parseHeader(arrayBuffer);
    const { count, bitpix, ctype, scale } = validateHeader(header);
    const bytes = new Uint8Array(arrayBuffer);
    const bytesPer = bytesPerSample(bitpix);
    if (dataOffset + count * bytesPer > bytes.length) fail("file ends before the declared primary-array data");
    const view = new DataView(arrayBuffer, dataOffset, count * bytesPer);
    const bscale = floatOrDefault(header.BSCALE, 1);
    const bzero = floatOrDefault(header.BZERO, 0);
    const blank = Number.isFinite(Number(header.BLANK)) ? Number(header.BLANK) : null;
    const crval = Number(header.CRVAL1) * scale;
    const cdelt = Number(header.CDELT1) * scale;
    const crpix = Number(header.CRPIX1);
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const raw = readRawValue(view, index * bytesPer, bitpix);
      if ((blank !== null && raw === blank) || !Number.isFinite(raw)) continue;
      const temperature = bzero + bscale * raw;
      const velocity = crval + ((index + 1) - crpix) * cdelt;
      if (Number.isFinite(velocity) && Number.isFinite(temperature)) points.push({ velocity, temperature });
    }
    if (points.length < 3) fail("fewer than three finite channels remain after FITS null handling");
    points.sort((a, b) => a.velocity - b.velocity);
    return {
      filename,
      points,
      metadata: {
        format: "FITS primary 1D image",
        axisType: ctype,
        velocityUnit: "km/s",
        inputVelocityUnit: String(header.CUNIT1),
        bunit: String(header.BUNIT),
        frame: String(header.SPECSYS || header.VELREF || "not supplied"),
        object: String(header.OBJECT || "not supplied"),
        channelsDeclared: count,
        channelsAccepted: points.length
      }
    };
  }
  const api = { parseFitsVelocitySpectrum };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HI21FitsImport = api;
})(typeof window !== "undefined" ? window : globalThis);
