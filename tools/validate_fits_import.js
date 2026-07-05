const assert = require('assert');
const { parseFitsVelocitySpectrum } = require('../assets/js/fits-import.js');

function card(key, value) {
  const rendered = value === null ? key : `${key.padEnd(8, ' ')}= ${value}`;
  return rendered.padEnd(80, ' ');
}

function makeFits({ ctype = "'VELO-LSR'", cunit = "'m/s'", bunit = "'K'", bitpix = -32, values = [1, 2, 3, 4] } = {}) {
  const cards = [
    card('SIMPLE', 'T'), card('BITPIX', String(bitpix)), card('NAXIS', '1'), card('NAXIS1', String(values.length)),
    card('BUNIT', bunit), card('CTYPE1', ctype), card('CUNIT1', cunit), card('CRVAL1', '1000'),
    card('CDELT1', '500'), card('CRPIX1', '1'), card('BSCALE', '2'), card('BZERO', '1'),
    card('SPECSYS', "'LSRK'"), card('OBJECT', "'fixture spectrum'"), card('END', null),
  ].join('');
  const headerBytes = new TextEncoder().encode(cards.padEnd(Math.ceil(cards.length / 2880) * 2880, ' '));
  const bytesPer = Math.abs(bitpix) / 8;
  const buffer = new ArrayBuffer(headerBytes.length + values.length * bytesPer);
  new Uint8Array(buffer).set(headerBytes, 0);
  const view = new DataView(buffer, headerBytes.length);
  values.forEach((value, index) => {
    const offset = index * bytesPer;
    if (bitpix === -32) view.setFloat32(offset, value, false);
    else if (bitpix === -64) view.setFloat64(offset, value, false);
    else if (bitpix === 16) view.setInt16(offset, value, false);
    else if (bitpix === 32) view.setInt32(offset, value, false);
    else if (bitpix === 8) view.setUint8(offset, value);
  });
  return buffer;
}

const spectrum = parseFitsVelocitySpectrum(makeFits(), 'fixture.fits');
assert.deepStrictEqual(spectrum.points.map((point) => point.velocity), [1, 1.5, 2, 2.5]);
assert.deepStrictEqual(spectrum.points.map((point) => point.temperature), [3, 5, 7, 9]);
assert.strictEqual(spectrum.metadata.axisType, 'VELO-LSR');
assert.strictEqual(spectrum.metadata.velocityUnit, 'km/s');
assert.strictEqual(spectrum.metadata.frame, 'LSRK');

assert.throws(() => parseFitsVelocitySpectrum(makeFits({ ctype: "'FREQ'" }), 'frequency.fits'), /frequency-only FITS/);
assert.throws(() => parseFitsVelocitySpectrum(makeFits({ bunit: "'Jy/beam'" }), 'flux.fits'), /brightness temperature must be in K/);
assert.throws(() => parseFitsVelocitySpectrum(makeFits({ cunit: "'Hz'" }), 'units.fits'), /use km\/s or m\/s/);

console.log('PASS FITS import contract: 1D VELO-LSR, m/s-to-km/s, BSCALE/BZERO, and conservative rejection guards.');
