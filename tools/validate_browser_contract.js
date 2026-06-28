const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'tools/generate_21cm_spectrum.py'), 'utf8');

function requireMatch(label, pattern) {
  if (!pattern.test(app)) {
    throw new Error(`Missing browser contract: ${label}`);
  }
}

requireMatch('rest frequency 1420.40575177 MHz', /const REST_FREQ_MHZ = 1420\.40575177;/);
requireMatch('speed of light in km/s', /const C_KM_S = 299792\.458;/);
requireMatch('optically thin NHI factor', /const COLUMN_FACTOR = 1\.823e18;/);
requireMatch('cosmological frequency relation', /REST_FREQ_MHZ \/ \(1 \+ redshift\)/);
requireMatch('radio velocity convention', /C_KM_S \* redshift \/ \(1 \+ redshift\)/);
requireMatch('optical velocity convention', /C_KM_S \* redshift/);
requireMatch('relativistic velocity convention', /\(\(1 \+ redshift\) \*\* 2 - 1\) \/ \(\(1 \+ redshift\) \*\* 2 \+ 1\)/);
requireMatch('radio frequency coordinate for tangent point', /REST_FREQ_MHZ \* \(1 - velocityKmS \/ C_KM_S\)/);
requireMatch('uniform slab radiative transfer', /\(spinTemperature - continuum\) \* \(1 - Math\.exp\(-tau\)\)/);
requireMatch('optically thin brightness branch', /\(spinTemperature - continuum\) \* tau/);
requireMatch('browser spectrum channel count', /const samples = 520;/);
requireMatch('browser velocity span', /const samples = 520; const span = 360;/);
requireMatch('imported spectra only use thin-column trapezoid', /function trapezoidColumn\(points\)/);
requireMatch('CSV overlay returns thinColumn only', /return \{ filename, points, thinColumn: trapezoidColumn\(points\) \};/);

if (!/SPECTRUM_SAMPLES = 520/.test(generator)) {
  throw new Error('Python generator no longer matches the browser 520-channel contract.');
}
if (!/VELOCITY_SPAN_KM_S = 360\.0/.test(generator)) {
  throw new Error('Python generator no longer matches the browser 360 km/s velocity span.');
}

console.log('Browser physics contract checks passed.');
