const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const style = fs.readFileSync(path.join(root, 'assets/css/style.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'assets/js/physicsWorker.js'), 'utf8');

function requireMatch(label, pattern, source) {
  if (!pattern.test(source)) throw new Error(`Missing dashboard contract: ${label}`);
}

function requireAbsent(label, pattern, source) {
  if (pattern.test(source)) throw new Error(`Invalid dashboard content: ${label}`);
}

requireMatch('observed LAB spectrum', /LAB OBSERVED 21CM PROFILE/, index);
requireMatch('observed longitude-velocity map', /LAB GALACTIC-PLANE L-V SURVEY/, index);
requireMatch('model-conditioned peak heading', /FLAT-CIRCULAR MODEL \/ NOT ARM IDS/, index);
requireMatch('near-far ambiguity disclosure', /near\/far ambiguity/, index);
requireMatch('twelve-setting sensitivity disclosure', /12 threshold\/merge settings/, index);
requireMatch('HI4PI provenance', /HI4PI OBSERVED H I SKY/, index);
requireMatch('responsive breakpoint', /@media\s*\(max-width:\s*980px\)/, style);
requireMatch('peak sensitivity grid', /\[0\.04, 0\.06, 0\.08, 0\.10\]/, worker);
requireMatch('distance solutions', /heliocentricDistanceSolutions/, worker);
requireAbsent('unsupported arm assignment', /likely (Perseus|tangent-point|Orion)/i, worker);
requireAbsent('reader-facing upgrade scorecard', /research upgrade|before and after|maturity score/i, index);

console.log('Current observational dashboard and inference-boundary checks passed.');
