(() => {
  const canvas = document.getElementById("phaseSpaceCanvas");
  const mapButton = document.getElementById("mapViewButton");
  const sliceButton = document.getElementById("surfaceViewButton");
  const resetButton = document.getElementById("resetViewButton");
  const fieldStatus = document.getElementById("fieldStatus");
  const state = { mode: "map" };
  const limits = { longitude: [0, 180], velocity: [-180, 180] };

  function value(id) { return Number(document.getElementById(id).value); }
  function setupCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, width * 640 / 1080);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }
  function components(longitude, rotationSpeed, tauPeak) {
    const l = longitude * Math.PI / 180;
    const sinL = Math.max(0.05, Math.sin(l));
    return [
      { name: "local gas", velocity: 8 * Math.sin(2 * l), tau: tauPeak * 0.85, width: 1.10, colour: "#70d7ff" },
      { name: "inner/tangent gas", velocity: longitude < 90 ? rotationSpeed * (1 - sinL) : -0.35 * rotationSpeed * Math.sin(l), tau: tauPeak * (longitude < 90 ? 1.25 : 0.45), width: 0.85, colour: "#ffd071" },
      { name: "outer-arm term", velocity: longitude < 95 ? -45 * Math.sin(l) : -25 * Math.sin(l), tau: tauPeak * 0.55, width: 1.35, colour: "#d8a4ff" },
    ];
  }
  function brightnessAt(longitude, velocity, rotationSpeed, tauPeak, sigma, spinTemperature, continuum) {
    const tau = components(longitude, rotationSpeed, tauPeak).reduce((sum, component) => sum + component.tau * Math.exp(-0.5 * ((velocity - component.velocity) / (sigma * component.width)) ** 2), 0);
    return (spinTemperature - continuum) * (1 - Math.exp(-tau));
  }
  function colour(value, alpha = 1) {
    const t = Math.max(0, Math.min(1, value));
    let r; let g; let b;
    if (t < 0.22) { const u = t / 0.22; r = 8 + 14 * u; g = 16 + 34 * u; b = 28 + 54 * u; }
    else if (t < 0.58) { const u = (t - 0.22) / 0.36; r = 22 + 38 * u; g = 50 + 105 * u; b = 82 + 128 * u; }
    else { const u = (t - 0.58) / 0.42; r = 60 + 188 * u; g = 155 + 83 * u; b = 210 - 122 * u; }
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
  }
  function modelState() {
    const rotationSpeed = value("rotationSpeed");
    const tauPeak = value("tauPeak");
    const sigma = value("sigmaVelocity");
    const spinTemperature = value("spinTemperature");
    const continuum = value("continuum");
    return { longitude: value("longitude"), rotationSpeed, tauPeak, sigma, spinTemperature, continuum, brightnessScale: Math.max(1, spinTemperature - continuum) };
  }
  function xForLongitude(longitude, pad, plotWidth) { return pad.left + (longitude / 180) * plotWidth; }
  function yForVelocity(velocity, pad, plotHeight) { return pad.top + ((limits.velocity[1] - velocity) / 360) * plotHeight; }
  function drawLabel(ctx, text, x, y, fill, textFill = "#081018") {
    ctx.font = "700 11px system-ui";
    const w = Math.min(218, ctx.measureText(text).width + 18);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, 22);
    ctx.fillStyle = textFill; ctx.fillText(text, x + 8, y + 15);
  }
  function drawMap(ctx, width, height, data) {
    const pad = { left: 72, right: 74, top: 44, bottom: 72 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const cols = 150; const rows = 108;
    const cellWidth = plotWidth / cols; const cellHeight = plotHeight / rows;
    ctx.fillStyle = "#050a11"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#07111d"; ctx.fillRect(pad.left, pad.top, plotWidth, plotHeight);
    for (let col = 0; col < cols; col += 1) {
      const longitude = (col + 0.5) * 180 / cols;
      for (let row = 0; row < rows; row += 1) {
        const velocity = 180 - (row + 0.5) * 360 / rows;
        const tb = brightnessAt(longitude, velocity, data.rotationSpeed, data.tauPeak, data.sigma, data.spinTemperature, data.continuum);
        const intensity = tb / data.brightnessScale;
        ctx.fillStyle = colour(intensity, intensity < 0.012 ? 0.18 : 0.96);
        ctx.fillRect(pad.left + col * cellWidth, pad.top + row * cellHeight, cellWidth + 0.35, cellHeight + 0.35);
      }
    }
    ctx.strokeStyle = "rgba(210,230,245,.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    [0, 45, 90, 135, 180].forEach((longitude) => { const x = xForLongitude(longitude, pad, plotWidth); ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotHeight); ctx.stroke(); ctx.fillStyle = "#b7c6d7"; ctx.font = "12px system-ui"; ctx.fillText(`${longitude} deg`, x - 14, height - 43); });
    [-180, -90, 0, 90, 180].forEach((velocity) => { const y = yForVelocity(velocity, pad, plotHeight); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotWidth, y); ctx.stroke(); ctx.fillStyle = "#b7c6d7"; ctx.font = "12px system-ui"; ctx.fillText(`${velocity}`, 24, y + 4); });
    ctx.setLineDash([]);
    const selectedX = xForLongitude(data.longitude, pad, plotWidth);
    ctx.strokeStyle = "#ffd071"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(selectedX, pad.top); ctx.lineTo(selectedX, pad.top + plotHeight); ctx.stroke();
    drawLabel(ctx, `selected sightline: l = ${data.longitude.toFixed(0)} deg`, Math.min(selectedX + 8, width - 240), pad.top + 10, "#ffd071");
    components(data.longitude, data.rotationSpeed, data.tauPeak).forEach((component, i) => {
      const y = yForVelocity(component.velocity, pad, plotHeight);
      ctx.fillStyle = component.colour; ctx.beginPath(); ctx.arc(selectedX, y, 4.5, 0, Math.PI * 2); ctx.fill();
      const labelY = Math.max(pad.top + 38, Math.min(pad.top + plotHeight - 18, y - 10 + i * 12));
      drawLabel(ctx, `${component.name}: ${component.velocity.toFixed(0)} km/s`, Math.min(selectedX + 18, width - 255), labelY, "rgba(9,20,34,.86)", component.colour);
    });
    const barX = width - 36; const barY = pad.top; const barH = plotHeight;
    for (let y = 0; y < barH; y += 1) { ctx.fillStyle = colour(1 - y / Math.max(1, barH - 1)); ctx.fillRect(barX, barY + y, 12, 1.2); }
    ctx.strokeStyle = "rgba(207,225,240,.34)"; ctx.strokeRect(barX, barY, 12, barH);
    ctx.fillStyle = "#b7c6d7"; ctx.font = "11px system-ui"; ctx.fillText("brighter", barX - 18, barY - 8); ctx.fillText("fainter", barX - 15, barY + barH + 16);
    ctx.fillStyle = "#d8e4ef"; ctx.font = "700 13px system-ui"; ctx.fillText("radio velocity (km/s)", 18, 24); ctx.fillText("Galactic longitude, l (deg)", Math.max(pad.left, width * 0.5 - 80), height - 16);
    ctx.fillStyle = "#9fb4c7"; ctx.font = "12px system-ui"; ctx.fillText("Synthetic model field only: colour is brightness temperature from slab transfer, not survey density or distance.", pad.left, height - 48);
  }
  function drawSlice(ctx, width, height, data) {
    ctx.fillStyle = "#050a11"; ctx.fillRect(0, 0, width, height);
    const pad = { left: 72, right: 36, top: 42, bottom: 66 };
    const plotWidth = width - pad.left - pad.right; const plotHeight = height - pad.top - pad.bottom;
    const comps = components(data.longitude, data.rotationSpeed, data.tauPeak);
    const samples = [];
    for (let i = 0; i < 420; i += 1) { const v = -180 + 360 * i / 419; samples.push({ velocity: v, brightness: brightnessAt(data.longitude, v, data.rotationSpeed, data.tauPeak, data.sigma, data.spinTemperature, data.continuum) }); }
    const yMax = Math.max(1, ...samples.map((p) => p.brightness)) * 1.12;
    const px = (v) => pad.left + ((v + 180) / 360) * plotWidth;
    const py = (tb) => pad.top + (1 - tb / yMax) * plotHeight;
    ctx.fillStyle = "#07111d"; ctx.fillRect(pad.left, pad.top, plotWidth, plotHeight);
    ctx.strokeStyle = "rgba(210,230,245,.16)"; ctx.lineWidth = 1;
    [-180, -90, 0, 90, 180].forEach((v) => { const x = px(v); ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotHeight); ctx.stroke(); ctx.fillStyle = "#b7c6d7"; ctx.font = "12px system-ui"; ctx.fillText(`${v}`, x - 14, height - 36); });
    [0, 0.5, 1].forEach((f) => { const y = pad.top + plotHeight * (1 - f); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotWidth, y); ctx.stroke(); ctx.fillText(`${(f * yMax).toFixed(0)} K`, 24, y + 4); });
    comps.forEach((component) => { const x = px(component.velocity); ctx.strokeStyle = component.colour; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotHeight); ctx.stroke(); ctx.setLineDash([]); drawLabel(ctx, component.name, Math.min(x + 6, width - 180), pad.top + 12, "rgba(9,20,34,.88)", component.colour); });
    ctx.strokeStyle = "#70d7ff"; ctx.lineWidth = 3; ctx.beginPath(); samples.forEach((p, i) => { if (i) ctx.lineTo(px(p.velocity), py(p.brightness)); else ctx.moveTo(px(p.velocity), py(p.brightness)); }); ctx.stroke();
    ctx.fillStyle = "#d8e4ef"; ctx.font = "700 13px system-ui"; ctx.fillText(`Selected sightline spectrum at l = ${data.longitude.toFixed(0)} deg`, 18, 24); ctx.fillText("radio velocity (km/s)", width * 0.5 - 60, height - 12); ctx.fillText("TB", 22, 22);
    ctx.fillStyle = "#9fb4c7"; ctx.font = "12px system-ui"; ctx.fillText("This is the same synthetic slab-transfer model shown as a 1D slice for easier interpretation.", pad.left, height - 46);
  }
  function importedMode() { return /Imported overlay/.test(document.getElementById("dataStatus").textContent || ""); }
  function updateProvenance(imported) {
    document.getElementById("sidebarMode").textContent = imported ? "Synthetic + imported overlay" : "Synthetic model";
    document.getElementById("provenancePill").textContent = imported ? "Synthetic model + imported overlay" : "Synthetic model active";
    document.getElementById("spectrumMode").textContent = imported ? "overlay loaded" : "synthetic only";
    document.getElementById("dataMode").textContent = "Synthetic l-v-TB field";
    document.getElementById("importedMode").textContent = imported ? "Spectrum-only overlay; no spatial position inferred" : "No user spectrum loaded";
  }
  function draw() {
    const { ctx, width, height } = setupCanvas(); const data = modelState();
    if (state.mode === "map") drawMap(ctx, width, height, data); else drawSlice(ctx, width, height, data);
    updateProvenance(importedMode());
    fieldStatus.textContent = state.mode === "map" ? "Readable map: colour encodes synthetic brightness temperature; gold line is the selected sightline" : "Selected slice: the same model reduced to one brightness-temperature spectrum";
  }
  function setMode(mode) {
    state.mode = mode;
    const mapActive = mode === "map";
    mapButton.classList.toggle("is-active", mapActive); mapButton.setAttribute("aria-pressed", String(mapActive));
    sliceButton.classList.toggle("is-active", !mapActive); sliceButton.setAttribute("aria-pressed", String(!mapActive));
    canvas.style.cursor = "default"; draw();
  }
  mapButton.addEventListener("click", () => setMode("map"));
  sliceButton.addEventListener("click", () => setMode("slice"));
  resetButton.addEventListener("click", () => setMode("map"));
  ["longitude", "rotationSpeed", "redshift", "spinTemperature", "tauPeak", "sigmaVelocity", "continuum"].forEach((id) => document.getElementById(id).addEventListener("input", draw));
  window.addEventListener("hi21:import-change", draw);
  window.addEventListener("resize", draw);
  draw();
})();