(() => {
  const REST_FREQ_MHZ = 1420.40575177;
  const C_KM_S = 299792.458;
  const R0_KPC = 8.2;
  const canvas = document.getElementById("phaseSpaceCanvas");
  const autoButton = document.getElementById("autoRotateButton");
  const resetButton = document.getElementById("resetViewButton");
  const fieldStatus = document.getElementById("fieldStatus");
  const state = { yaw: -0.58, pitch: 0.34, zoom: 1, rotating: false, drag: null, frame: null };

  function value(id) { return Number(document.getElementById(id).value); }
  function setup() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, width * 660 / 1080);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }
  function components(longitude, theta0, tauPeak) {
    const l = longitude * Math.PI / 180;
    const sinL = Math.max(0.05, Math.sin(l));
    return [
      { velocity: 8 * Math.sin(2 * l), tau: tauPeak * .85, width: 1.1 },
      { velocity: longitude < 90 ? theta0 * (1 - sinL) : -.35 * theta0 * Math.sin(l), tau: tauPeak * (longitude < 90 ? 1.25 : .45), width: .85 },
      { velocity: longitude < 95 ? -45 * Math.sin(l) : -25 * Math.sin(l), tau: tauPeak * .55, width: 1.35 },
    ];
  }
  function brightness(parts, velocity, ts, tc, sigma) {
    const tau = parts.reduce((sum, part) => sum + part.tau * Math.exp(-.5 * ((velocity - part.velocity) / (sigma * part.width)) ** 2), 0);
    return (ts - tc) * (1 - Math.exp(-tau));
  }
  function project(x, y, z, width, height) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const p = state.zoom * 1.36 / Math.max(1.35, 2.55 + z2);
    return { x: width * .5 + x1 * width * .39 * p, y: height * .53 - y1 * height * .44 * p, depth: z2, scale: p };
  }
  function stroke3d(ctx, points, width, height, stroke, dash = []) {
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.setLineDash(dash); ctx.beginPath();
    points.forEach((point, index) => { const p = project(point[0], point[1], point[2], width, height); if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  function fieldColor(intensity, alpha) {
    const t = Math.max(0, Math.min(1, intensity));
    return `rgba(${Math.round(55 + 195 * t)},${Math.round(179 + 54 * (1 - t))},${Math.round(255 - 120 * t)},${alpha})`;
  }
  function drawAxes(ctx, width, height) {
    for (let y = -1; y <= 1; y += .5) stroke3d(ctx, [[-1.2, y, -.7], [1.2, y, -.7]], width, height, "rgba(126,156,190,.12)", [3, 4]);
    for (let x = -1; x <= 1; x += .5) stroke3d(ctx, [[x, -1.15, -.7], [x, 1.15, -.7]], width, height, "rgba(126,156,190,.10)", [3, 4]);
    stroke3d(ctx, [[-1.22, -1.15, -.7], [1.22, -1.15, -.7]], width, height, "rgba(72,216,255,.78)");
    stroke3d(ctx, [[-1.22, -1.15, -.7], [-1.22, 1.15, -.7]], width, height, "rgba(117,232,169,.74)");
    stroke3d(ctx, [[-1.22, -1.15, -.7], [-1.22, -1.15, .95]], width, height, "rgba(248,197,110,.74)");
    const a = project(-1.22, -1.15, -.7, width, height), b = project(1.22, -1.15, -.7, width, height), c = project(-1.22, 1.15, -.7, width, height), d = project(-1.22, -1.15, .95, width, height);
    ctx.font = "11px system-ui";
    ctx.fillStyle = "#82dff4"; ctx.fillText("l = 0 deg", a.x - 18, a.y + 18); ctx.fillText("l = 180 deg", b.x - 27, b.y + 18);
    ctx.fillStyle = "#aaf0c6"; ctx.fillText("radio velocity", c.x - 24, c.y - 8);
    ctx.fillStyle = "#ffdb9b"; ctx.fillText("T_B", d.x - 14, d.y - 8);
  }
  function sourceMode() { return /Imported overlay/.test(document.getElementById("dataStatus").textContent || ""); }
  function updateProvenance(imported) {
    document.getElementById("sidebarMode").textContent = imported ? "Synthetic + imported overlay" : "Synthetic model";
    document.getElementById("provenancePill").textContent = imported ? "Synthetic model + imported overlay" : "Synthetic model active";
    document.getElementById("spectrumMode").textContent = imported ? "overlay loaded" : "synthetic only";
    document.getElementById("dataMode").textContent = "Synthetic l-v-TB field";
    document.getElementById("importedMode").textContent = imported ? "Spectrum-only overlay; no 3D position inferred" : "No user spectrum loaded";
    fieldStatus.textContent = imported ? "Drag to rotate · wheel to zoom · imported spectrum remains spectrum-only, with no 3D placement inferred" : "Drag to rotate · wheel to zoom · visualisation uses the current synthetic model";
  }
  function draw() {
    const { ctx, width, height } = setup();
    const longitude = value("longitude"), theta0 = value("rotationSpeed"), ts = value("spinTemperature"), tauPeak = value("tauPeak"), sigma = value("sigmaVelocity"), tc = value("continuum");
    ctx.fillStyle = "#050a11"; ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, Math.max(width, height) * .66);
    glow.addColorStop(0, "rgba(24,72,106,.18)"); glow.addColorStop(1, "rgba(4,8,14,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    drawAxes(ctx, width, height);
    const points = [], brightnessScale = Math.max(1, ts - tc);
    for (let ix = 0; ix < 86; ix += 1) {
      const l = 180 * ix / 85, parts = components(l, theta0, tauPeak);
      for (let iy = 0; iy < 54; iy += 1) {
        const v = -180 + 360 * iy / 53, intensity = Math.max(0, Math.min(1, brightness(parts, v, ts, tc, sigma) / brightnessScale));
        if (intensity < .018) continue;
        const p = project((l / 90 - 1) * 1.18, v / 180 * 1.08, intensity * 1.42 - .67, width, height);
        points.push({ ...p, intensity });
      }
    }
    points.sort((a, b) => a.depth - b.depth).forEach((point) => {
      ctx.fillStyle = fieldColor(point.intensity, .12 + .7 * point.intensity);
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(.7, 1 + point.intensity * 2.45) * point.scale, 0, Math.PI * 2); ctx.fill();
    });
    const selected = components(longitude, theta0, tauPeak), path = [];
    for (let i = 0; i < 70; i += 1) {
      const v = -180 + 360 * i / 69, intensity = Math.max(0, Math.min(1, brightness(selected, v, ts, tc, sigma) / brightnessScale));
      path.push([(longitude / 90 - 1) * 1.18, v / 180 * 1.08, intensity * 1.42 - .67]);
    }
    stroke3d(ctx, path, width, height, "rgba(248,197,110,.95)");
    ctx.fillStyle = "#b4c6d8"; ctx.font = "11px system-ui";
    ctx.fillText(sourceMode() ? "Imported spectrum remains spectrum-only; no 3D placement is inferred." : "Synthetic field derived from the current teaching-model parameters.", 16, height - 16);
    ctx.fillStyle = "rgba(255,255,255,.62)"; ctx.fillText(`selected model longitude: ${longitude.toFixed(0)} deg`, width - 198, height - 16);
    updateProvenance(sourceMode());
  }
  function setRotate(next) {
    state.rotating = next; autoButton.setAttribute("aria-pressed", String(next)); autoButton.textContent = `Auto rotate: ${next ? "on" : "off"}`; autoButton.classList.toggle("is-active", next);
    if (next && !state.frame) animate();
  }
  function animate() { if (!state.rotating) { state.frame = null; return; } state.yaw += .0032; draw(); state.frame = requestAnimationFrame(animate); }
  canvas.addEventListener("pointerdown", (event) => { state.drag = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", (event) => { if (!state.drag) return; state.yaw += (event.clientX - state.drag.x) * .008; state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch + (event.clientY - state.drag.y) * .006)); state.drag = { x: event.clientX, y: event.clientY }; draw(); });
  canvas.addEventListener("pointerup", () => { state.drag = null; });
  canvas.addEventListener("pointercancel", () => { state.drag = null; });
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); state.zoom = Math.max(.64, Math.min(1.9, state.zoom * (event.deltaY > 0 ? .91 : 1.1))); draw(); }, { passive: false });
  autoButton.addEventListener("click", () => setRotate(!state.rotating));
  resetButton.addEventListener("click", () => { state.yaw = -.58; state.pitch = .34; state.zoom = 1; draw(); });
  ["longitude", "rotationSpeed", "redshift", "spinTemperature", "tauPeak", "sigmaVelocity", "continuum"].forEach((id) => document.getElementById(id).addEventListener("input", draw));
  window.addEventListener("hi21:import-change", draw);
  window.addEventListener("resize", draw);
  draw();
})();
