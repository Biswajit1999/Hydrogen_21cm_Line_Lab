const REST_FREQ_MHZ = 1420.40575177;
const C_KM_S = 299792.458;
const COLUMN_FACTOR = 1.823e18;

const ids = ["redshift", "spinTemperature", "tauPeak", "sigmaVelocity", "continuum"];
const inputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const out = {
  redshift: document.getElementById("redshiftOut"),
  spin: document.getElementById("spinOut"),
  tau: document.getElementById("tauOut"),
  sigma: document.getElementById("sigmaOut"),
  continuum: document.getElementById("continuumOut"),
  observedFrequency: document.getElementById("observedFrequency"),
  velocity: document.getElementById("velocity"),
  columnDensity: document.getElementById("columnDensity"),
};

let latestSpectrum = [];

function value(id) {
  return Number(inputs[id].value);
}

function setup(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = width * Number(canvas.height) / Number(canvas.width);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function drawAxes(ctx, width, height, yLabel, xLabel) {
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,.09)";
  for (let i = 1; i < 5; i += 1) {
    const y = (height * i) / 5;
    ctx.beginPath();
    ctx.moveTo(52, y);
    ctx.lineTo(width - 18, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#aab5bd";
  ctx.font = "12px system-ui";
  ctx.fillText(yLabel, 12, 22);
  ctx.fillText(xLabel, width - 140, height - 14);
}

function model() {
  const redshift = value("redshift");
  const spinTemperature = value("spinTemperature");
  const tauPeak = value("tauPeak");
  const sigmaVelocity = value("sigmaVelocity");
  const continuum = value("continuum");
  const observedFreq = REST_FREQ_MHZ / (1 + redshift);
  const velocity = C_KM_S * (REST_FREQ_MHZ - observedFreq) / REST_FREQ_MHZ;
  const samples = 420;
  const span = Math.max(80, sigmaVelocity * 8);
  const points = [];
  let integral = 0;
  let lastV = null;
  let lastTb = null;

  for (let i = 0; i < samples; i += 1) {
    const v = -span / 2 + (span * i) / (samples - 1);
    const tau = tauPeak * Math.exp(-0.5 * (v / sigmaVelocity) ** 2);
    const tb = (spinTemperature - continuum) * (1 - Math.exp(-tau));
    const thinTb = (spinTemperature - continuum) * tau;
    points.push({ velocity: v, brightness: tb, thinBrightness: thinTb, tau });
    if (lastV !== null) integral += 0.5 * (tb + lastTb) * (v - lastV);
    lastV = v;
    lastTb = tb;
  }

  return { redshift, spinTemperature, tauPeak, sigmaVelocity, continuum, observedFreq, velocity, points, columnDensity: COLUMN_FACTOR * integral };
}

function plotSpectrum(data) {
  const { ctx, width, height } = setup(document.getElementById("spectrumCanvas"));
  drawAxes(ctx, width, height, "brightness temperature (K)", "velocity (km/s)");
  const pad = { left: 52, right: 18, top: 22, bottom: 40 };
  const ys = data.points.flatMap((p) => [p.brightness, p.thinBrightness]);
  const yMax = Math.max(1, ...ys) * 1.12;
  const xMin = data.points[0].velocity;
  const xMax = data.points[data.points.length - 1].velocity;
  const px = (x) => pad.left + ((x - xMin) / (xMax - xMin)) * (width - pad.left - pad.right);
  const py = (y) => height - pad.bottom - (y / yMax) * (height - pad.top - pad.bottom);

  function line(key, color, widthPx) {
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    data.points.forEach((p, index) => {
      const x = px(p.velocity);
      const y = py(p[key]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  line("thinBrightness", "rgba(244,191,117,.7)", 1.7);
  line("brightness", "#66d9ef", 2.5);
  ctx.fillStyle = "#aab5bd";
  ctx.fillText("cyan: radiative transfer   gold: optically thin approximation", pad.left, height - 14);
}

function plotFrequency(data) {
  const { ctx, width, height } = setup(document.getElementById("frequencyCanvas"));
  drawAxes(ctx, width, height, "receiver frequency", "redshifted line");
  const pad = { left: 52, right: 18, top: 22, bottom: 42 };
  const x0 = pad.left;
  const x1 = width - pad.right;
  const y = height / 2;
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const maxShift = REST_FREQ_MHZ - REST_FREQ_MHZ / 1.25;
  const shift = REST_FREQ_MHZ - data.observedFreq;
  const xObs = x0 + (shift / maxShift) * (x1 - x0);
  ctx.fillStyle = "#83e6a2";
  ctx.beginPath();
  ctx.arc(xObs, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aab5bd";
  ctx.font = "13px system-ui";
  ctx.fillText(`${REST_FREQ_MHZ.toFixed(4)} MHz rest`, x0, y - 24);
  ctx.fillText(`${data.observedFreq.toFixed(4)} MHz observed`, Math.min(xObs + 14, width - 190), y + 32);
}

function updateLabels(data) {
  out.redshift.textContent = data.redshift.toFixed(3);
  out.spin.textContent = `${data.spinTemperature.toFixed(0)} K`;
  out.tau.textContent = data.tauPeak.toFixed(3);
  out.sigma.textContent = `${data.sigmaVelocity.toFixed(1)} km/s`;
  out.continuum.textContent = `${data.continuum.toFixed(2)} K`;
  out.observedFrequency.textContent = `${data.observedFreq.toFixed(3)} MHz`;
  out.velocity.textContent = `${data.velocity.toFixed(1)} km/s`;
  out.columnDensity.textContent = data.columnDensity.toExponential(2).replace("e+", "e+");
}

function render() {
  const data = model();
  latestSpectrum = data.points;
  updateLabels(data);
  plotSpectrum(data);
  plotFrequency(data);
}

function exportSpectrum() {
  const rows = ["velocity_km_s,brightness_temperature_K,optically_thin_brightness_K,optical_depth"];
  latestSpectrum.forEach((p) => rows.push(`${p.velocity.toFixed(6)},${p.brightness.toFixed(6)},${p.thinBrightness.toFixed(6)},${p.tau.toFixed(8)}`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "synthetic_21cm_spectrum.csv";
  link.click();
  URL.revokeObjectURL(url);
}

ids.forEach((id) => inputs[id].addEventListener("input", render));
document.getElementById("exportButton").addEventListener("click", exportSpectrum);
window.addEventListener("resize", render);
render();
