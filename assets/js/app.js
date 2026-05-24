const REST_FREQ_MHZ = 1420.40575177;
const C_KM_S = 299792.458;
const COLUMN_FACTOR = 1.823e18;

const R0_KPC = 8.2;

const ids = ["longitude", "rotationSpeed", "redshift", "spinTemperature", "tauPeak", "sigmaVelocity", "continuum"];
const inputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const out = {
  redshift: document.getElementById("redshiftOut"),
  longitude: document.getElementById("longitudeOut"),
  rotation: document.getElementById("rotationOut"),
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
  const longitude = value("longitude");
  const rotationSpeed = value("rotationSpeed");
  const redshift = value("redshift");
  const spinTemperature = value("spinTemperature");
  const tauPeak = value("tauPeak");
  const sigmaVelocity = value("sigmaVelocity");
  const continuum = value("continuum");
  const observedFreq = REST_FREQ_MHZ / (1 + redshift);
  const velocity = C_KM_S * (REST_FREQ_MHZ - observedFreq) / REST_FREQ_MHZ;
  const samples = 520;
  const span = 360;
  const points = [];
  const components = galacticComponents(longitude, rotationSpeed, tauPeak);
  let integral = 0;
  let lastV = null;
  let lastTb = null;

  for (let i = 0; i < samples; i += 1) {
    const v = -span / 2 + (span * i) / (samples - 1);
    const tau = components.reduce((sum, component) => {
      const sigma = sigmaVelocity * component.widthScale;
      return sum + component.tau * Math.exp(-0.5 * ((v - component.velocity) / sigma) ** 2);
    }, 0);
    const tb = (spinTemperature - continuum) * (1 - Math.exp(-tau));
    const thinTb = (spinTemperature - continuum) * tau;
    points.push({ velocity: v, brightness: tb, thinBrightness: thinTb, tau });
    if (lastV !== null) integral += 0.5 * (tb + lastTb) * (v - lastV);
    lastV = v;
    lastTb = tb;
  }

  return { longitude, rotationSpeed, redshift, spinTemperature, tauPeak, sigmaVelocity, continuum, observedFreq, velocity, points, components, columnDensity: COLUMN_FACTOR * integral };
}

function galacticComponents(longitudeDeg, theta0, tauPeak) {
  const l = longitudeDeg * Math.PI / 180;
  const sinL = Math.max(0.05, Math.sin(l));
  const tangentVelocity = theta0 * (1 - sinL);
  const localArm = 8 * Math.sin(2 * l);
  const perseusArm = longitudeDeg < 95 ? -45 * Math.sin(l) : -25 * Math.sin(l);
  const innerArm = longitudeDeg < 90 ? tangentVelocity : -0.35 * theta0 * Math.sin(l);
  return [
    { name: "local gas", velocity: localArm, tau: tauPeak * 0.85, widthScale: 1.1, radius: R0_KPC },
    { name: "inner/tangent gas", velocity: innerArm, tau: tauPeak * (longitudeDeg < 90 ? 1.25 : 0.45), widthScale: 0.85, radius: Math.max(R0_KPC * sinL, 2.2) },
    { name: "outer arm", velocity: perseusArm, tau: tauPeak * 0.55, widthScale: 1.35, radius: 10.8 },
  ];
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
  ctx.fillStyle = "#83e6a2";
  data.components.forEach((component) => {
    const x = px(component.velocity);
    ctx.strokeStyle = "rgba(131,230,162,.32)";
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.fillText(component.name, Math.min(x + 6, width - 120), pad.top + 16);
  });
  ctx.fillStyle = "#aab5bd";
  ctx.fillText("cyan: radiative transfer   gold: optically thin approximation   green: H I components", pad.left, height - 14);
}

function plotGalaxy(data) {
  const { ctx, width, height } = setup(document.getElementById("galaxyCanvas"));
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 30;
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  for (let r = 4; r <= 14; r += 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let arm = 0; arm < 4; arm += 1) {
    ctx.strokeStyle = arm % 2 ? "rgba(102,217,239,.28)" : "rgba(131,230,162,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 260; i += 1) {
      const t = i / 24 + arm * Math.PI / 2;
      const r = 2.1 + 0.42 * t;
      const x = cx + r * Math.cos(t) * scale;
      const y = cy + r * Math.sin(t) * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const sunX = cx + R0_KPC * scale;
  const sunY = cy;
  const l = data.longitude * Math.PI / 180;
  const rayLength = 16 * scale;
  const rayX = sunX - Math.cos(l) * rayLength;
  const rayY = sunY - Math.sin(l) * rayLength;
  ctx.strokeStyle = "#f4bf75";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sunX, sunY);
  ctx.lineTo(rayX, rayY);
  ctx.stroke();
  ctx.fillStyle = "#f4bf75";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aab5bd";
  ctx.font = "12px system-ui";
  ctx.fillText("Sun", sunX + 8, sunY - 8);
  ctx.fillText(`l = ${data.longitude.toFixed(0)} deg`, 16, 24);
}

function plotLongitudeVelocity(data) {
  const { ctx, width, height } = setup(document.getElementById("lvCanvas"));
  ctx.fillStyle = "#0d1116";
  ctx.fillRect(0, 0, width, height);
  const lMin = 0;
  const lMax = 180;
  const vMin = -180;
  const vMax = 180;
  const rows = 120;
  const cols = 180;
  for (let ix = 0; ix < cols; ix += 1) {
    const longitude = lMin + (lMax - lMin) * ix / (cols - 1);
    const components = galacticComponents(longitude, data.rotationSpeed, data.tauPeak);
    for (let iy = 0; iy < rows; iy += 1) {
      const velocity = vMax - (vMax - vMin) * iy / (rows - 1);
      let intensity = 0;
      components.forEach((component) => {
        const sigma = data.sigmaVelocity * component.widthScale;
        intensity += component.tau * Math.exp(-0.5 * ((velocity - component.velocity) / sigma) ** 2);
      });
      intensity = Math.min(1, intensity / Math.max(0.1, data.tauPeak * 1.4));
      ctx.fillStyle = heat(intensity);
      ctx.fillRect(ix * width / cols, iy * height / rows, width / cols + 1, height / rows + 1);
    }
  }
  const selectedX = (data.longitude - lMin) / (lMax - lMin) * width;
  ctx.strokeStyle = "#f4bf75";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(selectedX, 0);
  ctx.lineTo(selectedX, height);
  ctx.stroke();
  ctx.fillStyle = "#aab5bd";
  ctx.font = "12px system-ui";
  ctx.fillText("Galactic longitude", width - 128, height - 14);
  ctx.fillText("v_los", 12, 22);
}

function heat(t) {
  const r = Math.round(13 + 230 * t);
  const g = Math.round(29 + 160 * Math.max(0, t - 0.1));
  const b = Math.round(48 + 170 * (1 - t));
  return `rgb(${r},${g},${b})`;
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
  out.longitude.textContent = `${data.longitude.toFixed(0)} deg`;
  out.rotation.textContent = `${data.rotationSpeed.toFixed(0)} km/s`;
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
  plotGalaxy(data);
  plotLongitudeVelocity(data);
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
