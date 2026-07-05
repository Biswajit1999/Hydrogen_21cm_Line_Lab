const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const style = fs.readFileSync(path.join(root, 'assets/css/style.css'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'assets/css/reference-dashboard.css'), 'utf8');
const widgets = fs.readFileSync(path.join(root, 'assets/css/model-stream.css'), 'utf8');

function requireMatch(label, pattern, source) {
  if (!pattern.test(source)) throw new Error(`Missing reference dashboard contract: ${label}`);
}

function requireAbsent(label, pattern, source) {
  if (pattern.test(source)) throw new Error(`Invalid reference dashboard content: ${label}`);
}

requireMatch('reference theme import', /reference-dashboard\.css/, style);
requireMatch('model widget import', /model-stream\.css/, style);
requireMatch('dense three-column dashboard grid', /grid-template-columns:\s*14\.4rem minmax\(0, 1fr\) 18\.8rem/, theme);
requireMatch('cyan-violet palette', /--ref-cyan:\s*#26d9ff[\s\S]*--ref-violet:\s*#a668ff/, theme);
requireMatch('dominant centre phase-space console', /H I phase-space console/, index);
requireMatch('real synthetic model layers', /Synthetic H I components/, index);
requireMatch('non-catalogue component disclaimer', /not catalogue detections/, index);
requireMatch('real import provenance limitation', /no optical depth, distance, or 3D H I position is inferred/, index);
requireAbsent('fake API or live-stream claims', /API credit|API usage|Live data stream/i, index);
requireMatch('model layer status widgets', /model-layer-list/, widgets);
requireMatch('small-screen responsive redesign', /@media \(max-width: 820px\)/, theme);

console.log('Reference dashboard visual and provenance contract checks passed.');
