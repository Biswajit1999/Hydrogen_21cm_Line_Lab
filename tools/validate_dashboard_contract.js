const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'assets/js/dashboard.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const frequency = fs.readFileSync(path.join(root, 'assets/js/frequency-conventions.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'assets/css/viewport-rebuild.css'), 'utf8');

function requireMatch(label, pattern, source) {
  if (!pattern.test(source)) throw new Error(`Missing dashboard contract: ${label}`);
}

requireMatch('interactive phase-space canvas', /id="phaseSpaceCanvas"/, index);
requireMatch('explicit synthetic intensity-map title', /Synthetic H I longitude–velocity intensity map/, index);
requireMatch('explicit synthetic intensity-map title', /Synthetic(?: H I)? longitude–velocity intensity map/, index);
requireMatch('map mode control', /id="mapViewButton"/, index);
requireMatch('surface mode control', /id="surfaceViewButton"/, index);
requireMatch('CSV and 1D FITS import label', /CSV \+ 1D FITS/, index);
requireMatch('no 3D inference from imported spectrum', /no optical depth, distance, or 3D H I position is inferred/, index);
requireMatch('FITS velocity-axis warning', /VELO\/VRAD\/VOPT axis/, index);
requireMatch('frequency convention renderer is loaded', /assets\/js\/frequency-conventions\.js/, index);
requireMatch('FITS parser is loaded before app', /fits-import\.js[\s\S]*app\.js/, index);
requireMatch('map cells are generated from longitude and velocity', /for \(let col = 0; col < cols; col \+= 1\)/, dashboard);
requireMatch('field brightness is derived from slab transfer', /\(spinTemperature - continuum\) \* \(1 - Math\.exp\(-tau\)\)/, dashboard);
requireMatch('surface uses orthographic projection', /Orthographic surface/, dashboard);
requireMatch('surface height uses intensity', /z: Math\.max\(0, intensity\) \* 0\.95/, dashboard);
requireMatch('imported spectrum remains spectrum-only', /Spectrum-only overlay; no 3D position inferred/, dashboard);
requireMatch('dashboard redraws on import state change', /hi21:import-change/, dashboard);
requireMatch('no automatic rotation in science viewport', /state = \{ mode: "map", yaw:/, dashboard);
requireMatch('frequency panel uses three labelled conventions', /Relativistic/, frequency);
requireMatch('drag-drop import binding', /dropZone\.addEventListener\("drop"/, app);
requireMatch('viewport has responsive styling', /field-panel canvas/, styles);

console.log('Dashboard provenance and map/surface interaction contract checks passed.');
