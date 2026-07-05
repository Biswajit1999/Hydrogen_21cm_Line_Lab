const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'assets/js/dashboard.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'assets/css/dashboard.css'), 'utf8');

function requireMatch(label, pattern, source) {
  if (!pattern.test(source)) throw new Error(`Missing dashboard contract: ${label}`);
}

requireMatch('interactive phase-space canvas', /id="phaseSpaceCanvas"/, index);
requireMatch('explicit synthetic field title', /Synthetic H I longitude–velocity–brightness field/, index);
requireMatch('CSV and 1D FITS import label', /CSV \+ 1D FITS/, index);
requireMatch('no 3D inference from imported spectrum', /no optical depth, distance, or 3D H I position is inferred/, index);
requireMatch('FITS velocity-axis warning', /VELO\/VRAD\/VOPT axis/, index);
requireMatch('dashboard script is loaded', /assets\/js\/dashboard\.js/, index);
requireMatch('FITS parser is loaded before app', /fits-import\.js[\s\S]*app\.js/, index);
requireMatch('l-v-TB field construction', /for \(let ix = 0; ix < 86; ix \+= 1\)/, dashboard);
requireMatch('field brightness is derived from slab transfer', /\(ts - tc\) \* \(1 - Math\.exp\(-tau\)\)/, dashboard);
requireMatch('imported spectrum remains spectrum-only', /Imported spectrum remains spectrum-only; no 3D placement is inferred/, dashboard);
requireMatch('dashboard redraws on import state change', /hi21:import-change/, dashboard);
requireMatch('manual rotation only by explicit control', /Auto rotate/, dashboard);
requireMatch('drag-drop import binding', /dropZone\.addEventListener\("drop"/, app);
requireMatch('responsive dashboard grid', /dashboard-grid/, styles);

console.log('Dashboard provenance and interaction contract checks passed.');
