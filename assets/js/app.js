const REST_FREQ_MHZ = 1420.40575177;
const C_KM_S = 299792.458;
const COLUMN_FACTOR = 1.823e18;
const R0_KPC = 8.2;

const ids = ["longitude", "rotationSpeed", "redshift", "spinTemperature", "tauPeak", "sigmaVelocity", "continuum"];
const inputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const out = {
  redshift: document.getElementById("redshiftOut"), longitude: document.getElementById("longitudeOut"), rotation: document.getElementById("rotationOut"), spin: document.getElementById("spinOut"), tau: document.getElementById("tauOut"), sigma: document.getElementById("sigmaOut"), continuum: document.getElementById("continuumOut"), observedFrequency: document.getElementById("observedFrequency"), velocity: document.getElementById("velocity"), columnDensity: document.getElementById("columnDensity"), tangentRadius: document.getElementById("tangentRadius"), tangentVelocity: document.getElementById("tangentVelocity"), tangentFrequency: document.getElementById("tangentFrequency"), peakChannels: document.getElementById("peakChannels"),
};
let latestSpectrum = [];

function value(id) { return Number(inputs[id].value); }
function setup(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const aspect = Number(canvas.getAttribute("height")) / Number(canvas.getAttribute("width"));
  const height = Math.max(1, width * aspect);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}
function drawAxes(ctx, width, height, yLabel, xLabel) {
  ctx.fillStyle = "#0d1116"; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,.09)";
  for (let i = 1; i < 5; i += 1) { const y = (height * i) / 5; ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(width - 18, y); ctx.stroke(); }
  ctx.fillStyle = "#aab5bd"; ctx.font = "12px system-ui"; ctx.fillText(yLabel, 12, 22); ctx.fillText(xLabel, width - 150, height - 14);
}
function frequencyFromRadioVelocity(velocityKmS) { return REST_FREQ_MHZ * (1 - velocityKmS / C_KM_S); }
function velocityConventions(redshift) {
  return {
    radio: C_KM_S * redshift / (1 + redshift),
    optical: C_KM_S * redshift,
    relativistic: C_KM_S * (((1 + redshift) ** 2 - 1) / ((1 + redshift) ** 2 + 1)),
  };
}
function tangentPoint(longitudeDeg, theta0) {
  const l = longitudeDeg * Math.PI / 180;
  const sinL = Math.sin(l);
  const radius = Math.max(0, R0_KPC * Math.abs(sinL));
  const velocity = longitudeDeg > 0 && longitudeDeg < 90 ? theta0 * (1 - Math.abs(sinL)) : null;
  return { radius, velocity, frequency: velocity === null ? null : frequencyFromRadioVelocity(velocity) };
}
function galacticComponents(longitudeDeg, theta0, tauPeak) {
  const l = longitudeDeg * Math.PI / 180;
  const sinL = Math.max(0.05, Math.sin(l));
  const tangentVelocity = theta0 * (1 - sinL);
  return [
    { name: "local gas", velocity: 8 * Math.sin(2 * l), tau: tauPeak * 0.85, widthScale: 1.1 },
    { name: "inner or tangent gas", velocity: longitudeDeg < 90 ? tangentVelocity : -0.35 * theta0 * Math.sin(l), tau: tauPeak * (longitudeDeg < 90 ? 1.25 : 0.45), widthScale: 0.85 },
    { name: "outer arm", velocity: longitudeDeg < 95 ? -45 * Math.sin(l) : -25 * Math.sin(l), tau: tauPeak * 0.55, widthScale: 1.35 },
  ];
}
function model() {
  const longitude = value("longitude"); const rotationSpeed = value("rotationSpeed"); const redshift = value("redshift"); const spinTemperature = value("spinTemperature"); const tauPeak = value("tauPeak"); const sigmaVelocity = value("sigmaVelocity"); const continuum = value("continuum");
  const observedFreq = REST_FREQ_MHZ / (1 + redshift);
  const conventions = velocityConventions(redshift);
  const components = galacticComponents(longitude, rotationSpeed, tauPeak);
  const tangent = tangentPoint(longitude, rotationSpeed);
  const samples = 520; const span = 360; const points = [];
  let integralTb = 0; let integralTau = 0; let last = null;
  for (let i = 0; i < samples; i += 1) {
    const velocity = -span / 2 + (span * i) / (samples - 1);
    const tau = components.reduce((sum, component) => sum + component.tau * Math.exp(-0.5 * ((velocity - component.velocity) / (sigmaVelocity * component.widthScale)) ** 2), 0);
    const brightness = (spinTemperature - continuum) * (1 - Math.exp(-tau));
    const thinBrightness = (spinTemperature - continuum) * tau;
    points.push({ velocity, brightness, thinBrightness, tau });
    if (last) { const dv = velocity - last.velocity; integralTb += 0.5 * (brightness + last.brightness) * dv; integralTau += 0.5 * (tau + last.tau) * dv; }
    last = { velocity, brightness, tau };
  }
  const columnThin = COLUMN_FACTOR * integralTb;
  const columnSlab = COLUMN_FACTOR * spinTemperature * integralTau;
  return { longitude, rotationSpeed, redshift, spinTemperature, tauPeak, sigmaVelocity, continuum, observedFreq, conventions, components, tangent, points, columnThin, columnSlab, opacityCorrection: columnSlab / Math.max(columnThin, 1e-30) };
}
function plotSpectrum(data) {
  const { ctx, width, height } = setup(document.getElementById("spectrumCanvas"));
  drawAxes(ctx, width, height, "brightness temperature (K)", "radio velocity (km/s)");
  const pad = { left: 52, right: 18, top: 22, bottom: 40 }; const yMax = Math.max(1, ...data.points.flatMap((p) => [p.brightness, p.thinBrightness])) * 1.12;
  const px = (x) => pad.left + ((x + 180) / 360) * (width - pad.left - pad.right); const py = (y) => height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);
  const line = (key, stroke, lineWidth) => { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.beginPath(); data.points.forEach((p, i) => { const x = px(p.velocity); const y = py(p[key]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); };
  line("thinBrightness", "rgba(244,191,117,.72)", 1.6); line("brightness", "#66d9ef", 2.4);
  ctx.fillStyle = "#83e6a2"; data.components.forEach((component) => { const x = px(component.velocity); ctx.strokeStyle = "rgba(131,230,162,.32)"; ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, height - pad.bottom); ctx.stroke(); ctx.fillText(component.name, Math.min(x + 5, width - 130), pad.top + 16); });
  ctx.fillStyle = "#aab5bd"; ctx.font = "12px system-ui";
  ctx.fillText(`thin NHI=${data.columnThin.toExponential(2)}   slab NHI=${data.columnSlab.toExponential(2)}   tau correction=${data.opacityCorrection.toFixed(2)}`, pad.left, height - 14);
}
function plotGalaxy(data) {
  const { ctx, width, height } = setup(document.getElementById("galaxyCanvas"));
  ctx.fillStyle = "#0d1116"; ctx.fillRect(0, 0, width, height);
  const cx = width / 2; const cy = height / 2; const scale = Math.min(width, height) / 30;
  ctx.strokeStyle = "rgba(255,255,255,.08)"; for (let r = 4; r <= 14; r += 2) { ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, Math.PI * 2); ctx.stroke(); }
  for (let arm = 0; arm < 4; arm += 1) { ctx.strokeStyle = arm % 2 ? "rgba(102,217,239,.28)" : "rgba(131,230,162,.22)"; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 260; i += 1) { const t = i / 24 + arm * Math.PI / 2; const r = 2.1 + 0.42 * t; const x = cx + r * Math.cos(t) * scale; const y = cy + r * Math.sin(t) * scale; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  const sunX = cx + R0_KPC * scale; const sunY = cy; const l = data.longitude * Math.PI / 180; const rayX = sunX - Math.cos(l) * 16 * scale; const rayY = sunY - Math.sin(l) * 16 * scale;
  ctx.strokeStyle = "#f4bf75"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(rayX, rayY); ctx.stroke(); ctx.fillStyle = "#f4bf75"; ctx.beginPath(); ctx.arc(sunX, sunY, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#aab5bd"; ctx.font = "12px system-ui"; ctx.fillText("Sun", sunX + 8, sunY - 8); ctx.fillText(`synthetic l = ${data.longitude.toFixed(0)} deg`, 16, 24);
}
function heat(t) { return `rgb(${Math.round(13 + 230 * t)},${Math.round(29 + 160 * Math.max(0, t - .1))},${Math.round(48 + 170 * (1 - t))})`; }
function plotLongitudeVelocity(data) {
  const { ctx, width, height } = setup(document.getElementById("lvCanvas")); ctx.fillStyle = "#0d1116"; ctx.fillRect(0, 0, width, height);
  const rows = 120; const cols = 180;
  for (let ix = 0; ix < cols; ix += 1) { const longitude = 180 * ix / (cols - 1); const components = galacticComponents(longitude, data.rotationSpeed, data.tauPeak); for (let iy = 0; iy < rows; iy += 1) { const velocity = 180 - 360 * iy / (rows - 1); let intensity = 0; components.forEach((component) => { intensity += component.tau * Math.exp(-.5 * ((velocity - component.velocity) / (data.sigmaVelocity * component.widthScale)) ** 2); }); ctx.fillStyle = heat(Math.min(1, intensity / Math.max(.1, data.tauPeak * 1.4))); ctx.fillRect(ix * width / cols, iy * height / rows, width / cols + 1, height / rows + 1); } }
  const x = data.longitude / 180 * width; ctx.strokeStyle = "#f4bf75"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); ctx.fillStyle = "#aab5bd"; ctx.font = "12px system-ui"; ctx.fillText("synthetic longitude-velocity ridge", 12, 22);
}
function plotFrequency(data) {
  const { ctx, width, height } = setup(document.getElementById("frequencyCanvas")); drawAxes(ctx, width, height, "receiver frequency", "cosmological redshift");
  const pad = { left: 52, right: 18, top: 22, bottom: 42 }; const x0 = pad.left; const x1 = width - pad.right; const y = height / 2; const maxShift = REST_FREQ_MHZ - REST_FREQ_MHZ / 1.25; const shift = REST_FREQ_MHZ - data.observedFreq; const xObs = x0 + (shift / maxShift) * (x1 - x0);
  ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = "#83e6a2"; ctx.beginPath(); ctx.arc(xObs, y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#aab5bd"; ctx.font = "12px system-ui"; ctx.fillText(`${REST_FREQ_MHZ.toFixed(4)} MHz rest`, x0, y - 24); ctx.fillText(`${data.observedFreq.toFixed(4)} MHz observed`, Math.min(xObs + 14, width - 190), y + 32);
  ctx.fillText(`z=${data.redshift.toFixed(3)}: radio=${data.conventions.radio.toFixed(0)}, optical=${data.conventions.optical.toFixed(0)}, relativistic=${data.conventions.relativistic.toFixed(0)} km/s`, pad.left, height - 14);
}
function plotRotationDiagnostic(data) {
  const { ctx, width, height } = setup(document.getElementById("rotationCanvas")); drawAxes(ctx, width, height, "v tangent (km/s)", "R tangent (kpc)");
  const pad = { left: 52, right: 18, top: 22, bottom: 40 }; const px = (x) => pad.left + x / R0_KPC * (width - pad.left - pad.right); const py = (y) => height - pad.bottom - y / data.rotationSpeed * (height - pad.top - pad.bottom);
  ctx.strokeStyle = "#66d9ef"; ctx.lineWidth = 2.4; ctx.beginPath(); for (let l = 5, i = 0; l <= 88; l += 1, i += 1) { const tp = tangentPoint(l, data.rotationSpeed); if (i === 0) ctx.moveTo(px(tp.radius), py(tp.velocity)); else ctx.lineTo(px(tp.radius), py(tp.velocity)); } ctx.stroke();
  if (data.tangent.velocity !== null) { ctx.fillStyle = "#f4bf75"; ctx.beginPath(); ctx.arc(px(data.tangent.radius), py(data.tangent.velocity), 6, 0, Math.PI * 2); ctx.fill(); }
}
function updateLabels(data) {
  out.redshift.textContent = data.redshift.toFixed(3); out.longitude.textContent = `${data.longitude.toFixed(0)} deg`; out.rotation.textContent = `${data.rotationSpeed.toFixed(0)} km/s`; out.spin.textContent = `${data.spinTemperature.toFixed(0)} K`; out.tau.textContent = data.tauPeak.toFixed(3); out.sigma.textContent = `${data.sigmaVelocity.toFixed(1)} km/s`; out.continuum.textContent = `${data.continuum.toFixed(2)} K`; out.observedFrequency.textContent = `${data.observedFreq.toFixed(3)} MHz`; out.velocity.textContent = `radio ${data.conventions.radio.toFixed(0)} km/s`; out.columnDensity.textContent = data.columnSlab.toExponential(2).replace("e+", "e+"); out.tangentRadius.textContent = `${data.tangent.radius.toFixed(2)} kpc`; out.tangentVelocity.textContent = data.tangent.velocity === null ? "not inner Galaxy" : `${data.tangent.velocity.toFixed(1)} km/s`; out.tangentFrequency.textContent = data.tangent.frequency === null ? "n/a" : `${data.tangent.frequency.toFixed(3)} MHz`; out.peakChannels.textContent = String(data.components.length);
}
function render() { const data = model(); latestSpectrum = data.points; updateLabels(data); plotSpectrum(data); plotGalaxy(data); plotLongitudeVelocity(data); plotFrequency(data); plotRotationDiagnostic(data); }
function exportSpectrum() { const rows = ["velocity_km_s,brightness_temperature_K,optically_thin_brightness_K,optical_depth"]; latestSpectrum.forEach((p) => rows.push(`${p.velocity.toFixed(6)},${p.brightness.toFixed(6)},${p.thinBrightness.toFixed(6)},${p.tau.toFixed(8)}`)); const blob = new Blob([rows.join("\n")], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "synthetic_21cm_spectrum.csv"; link.click(); URL.revokeObjectURL(url); }
ids.forEach((id) => inputs[id].addEventListener("input", render)); document.getElementById("exportButton").addEventListener("click", exportSpectrum); window.addEventListener("resize", render); render();
