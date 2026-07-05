(() => {
  const canvas = document.getElementById("phaseSpaceCanvas");
  const mapButton = document.getElementById("mapViewButton");
  const surfaceButton = document.getElementById("surfaceViewButton");
  const resetButton = document.getElementById("resetViewButton");
  const fieldStatus = document.getElementById("fieldStatus");
  const state = { mode: "map", yaw: -0.72, pitch: 0.60, drag: null };

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
      { velocity: 8 * Math.sin(2 * l), tau: tauPeak * 0.85, width: 1.10 },
      { velocity: longitude < 90 ? rotationSpeed * (1 - sinL) : -0.35 * rotationSpeed * Math.sin(l), tau: tauPeak * (longitude < 90 ? 1.25 : 0.45), width: 0.85 },
      { velocity: longitude < 95 ? -45 * Math.sin(l) : -25 * Math.sin(l), tau: tauPeak * 0.55, width: 1.35 },
    ];
  }

  function brightnessAt(longitude, velocity, rotationSpeed, tauPeak, sigma, spinTemperature, continuum) {
    const tau = components(longitude, rotationSpeed, tauPeak).reduce(
      (sum, component) => sum + component.tau * Math.exp(-0.5 * ((velocity - component.velocity) / (sigma * component.width)) ** 2),
      0,
    );
    return (spinTemperature - continuum) * (1 - Math.exp(-tau));
  }

  function colour(value, alpha = 1) {
    const t = Math.max(0, Math.min(1, value));
    let r; let g; let b;
    if (t < 0.32) {
      const u = t / 0.32; r = 11 + 22 * u; g = 27 + 87 * u; b = 52 + 145 * u;
    } else if (t < 0.68) {
      const u = (t - 0.32) / 0.36; r = 33 + 32 * u; g = 114 + 107 * u; b = 197 - 71 * u;
    } else {
      const u = (t - 0.68) / 0.32; r = 65 + 190 * u; g = 221 + 26 * u; b = 126 - 38 * u;
    }
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
  }

  function modelState() {
    const rotationSpeed = value("rotationSpeed");
    const tauPeak = value("tauPeak");
    const sigma = value("sigmaVelocity");
    const spinTemperature = value("spinTemperature");
    const continuum = value("continuum");
    return {
      longitude: value("longitude"), rotationSpeed, tauPeak, sigma, spinTemperature, continuum,
      brightnessScale: Math.max(1, spinTemperature - continuum),
    };
  }

  function xForLongitude(longitude, pad, plotWidth) {
    return pad.left + ((longitude - limits.longitude[0]) / (limits.longitude[1] - limits.longitude[0])) * plotWidth;
  }

  function yForVelocity(velocity, pad, plotHeight) {
    return pad.top + ((limits.velocity[1] - velocity) / (limits.velocity[1] - limits.velocity[0])) * plotHeight;
  }

  function drawMap(ctx, width, height, data) {
    const pad = { left: 64, right: 78, top: 36, bottom: 54 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const cols = Math.max(96, Math.round(plotWidth / 5));
    const rows = Math.max(72, Math.round(plotHeight / 5));
    const cellWidth = plotWidth / cols;
    const cellHeight = plotHeight / rows;

    ctx.fillStyle = "#050a11";
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, width * 0.65);
    glow.addColorStop(0, "rgba(47, 127, 170, .11)");
    glow.addColorStop(1, "rgba(5, 10, 17, 0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);

    for (let col = 0; col < cols; col += 1) {
      const longitude = (col + 0.5) * 180 / cols;
      for (let row = 0; row < rows; row += 1) {
        const velocity = 180 - (row + 0.5) * 360 / rows;
        const intensity = brightnessAt(longitude, velocity, data.rotationSpeed, data.tauPeak, data.sigma, data.spinTemperature, data.continuum) / data.brightnessScale;
        ctx.fillStyle = colour(intensity, intensity < 0.018 ? 0.28 : 0.98);
        ctx.fillRect(pad.left + col * cellWidth, pad.top + row * cellHeight, cellWidth + 0.45, cellHeight + 0.45);
      }
    }

    ctx.strokeStyle = "rgba(170, 202, 230, .13)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    [0, 45, 90, 135, 180].forEach((longitude) => {
      const x = xForLongitude(longitude, pad, plotWidth);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotHeight); ctx.stroke();
      ctx.fillStyle = "#9db2c9"; ctx.font = "11px system-ui"; ctx.fillText(`${longitude}°`, x - 8, height - 28);
    });
    [-180, -90, 0, 90, 180].forEach((velocity) => {
      const y = yForVelocity(velocity, pad, plotHeight);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotWidth, y); ctx.stroke();
      ctx.fillStyle = "#9db2c9"; ctx.font = "11px system-ui"; ctx.fillText(`${velocity}`, 18, y + 4);
    });
    ctx.setLineDash([]);

    const selectedX = xForLongitude(data.longitude, pad, plotWidth);
    ctx.strokeStyle = "rgba(248, 197, 110, .97)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(selectedX, pad.top); ctx.lineTo(selectedX, pad.top + plotHeight); ctx.stroke();
    ctx.fillStyle = "#ffda8e";
    ctx.fillRect(Math.min(selectedX + 7, width - 176), pad.top + 8, 150, 22);
    ctx.fillStyle = "#101319"; ctx.font = "700 11px system-ui";
    ctx.fillText(`selected l = ${data.longitude.toFixed(0)}°`, Math.min(selectedX + 14, width - 169), pad.top + 23);

    const barX = width - 36;
    const barY = pad.top;
    const barH = plotHeight;
    for (let y = 0; y < barH; y += 1) {
      const t = 1 - y / Math.max(1, barH - 1);
      ctx.fillStyle = colour(t);
      ctx.fillRect(barX, barY + y, 11, 1.2);
    }
    ctx.strokeStyle = "rgba(207, 225, 240, .34)"; ctx.strokeRect(barX, barY, 11, barH);
    ctx.fillStyle = "#9db2c9"; ctx.font = "10px system-ui";
    ctx.fillText("high", barX - 7, barY - 7); ctx.fillText("low", barX - 5, barY + barH + 15);

    ctx.fillStyle = "#c7d7e7"; ctx.font = "600 12px system-ui";
    ctx.fillText("radio velocity (km s⁻¹)", 18, 20);
    ctx.fillText("Galactic longitude, l (deg)", Math.max(pad.left, width * 0.5 - 75), height - 9);
    ctx.fillStyle = "#8fa8c0"; ctx.font = "11px system-ui";
    ctx.fillText("Synthetic Tᴮ(l, v) from the active optical-depth and slab-transfer model", pad.left, height - 28);
  }

  function project(point, width, height) {
    const cy = Math.cos(state.yaw); const sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch); const sp = Math.sin(state.pitch);
    const x1 = point.x * cy - point.y * sy;
    const y1 = point.x * sy + point.y * cy;
    const y2 = y1 * cp - point.z * sp;
    const z2 = y1 * sp + point.z * cp;
    const scale = Math.min(width / 3.55, height / 2.9);
    return { x: width * 0.51 + x1 * scale, y: height * 0.59 - y2 * scale, depth: z2 };
  }

  function surfacePoint(longitude, velocity, intensity) {
    return {
      x: ((longitude / 180) - 0.5) * 2.2,
      y: (velocity / 180) * 1.65,
      z: Math.max(0, intensity) * 0.95,
    };
  }

  function fillPolygon(ctx, points, colourValue) {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath(); ctx.fillStyle = colour(colourValue, 0.90); ctx.fill();
  }

  function drawSurface(ctx, width, height, data) {
    ctx.fillStyle = "#050a11"; ctx.fillRect(0, 0, width, height);
    const cols = 42; const rows = 42; const cells = [];
    for (let col = 0; col < cols - 1; col += 1) {
      const l0 = col * 180 / (cols - 1); const l1 = (col + 1) * 180 / (cols - 1);
      for (let row = 0; row < rows - 1; row += 1) {
        const v0 = -180 + row * 360 / (rows - 1); const v1 = -180 + (row + 1) * 360 / (rows - 1);
        const samples = [[l0, v0], [l1, v0], [l1, v1], [l0, v1]].map(([longitude, velocity]) => {
          const intensity = brightnessAt(longitude, velocity, data.rotationSpeed, data.tauPeak, data.sigma, data.spinTemperature, data.continuum) / data.brightnessScale;
          return { source: surfacePoint(longitude, velocity, intensity), intensity };
        });
        const projected = samples.map((sample) => project(sample.source, width, height));
        cells.push({ projected, intensity: samples.reduce((sum, sample) => sum + sample.intensity, 0) / samples.length, depth: projected.reduce((sum, point) => sum + point.depth, 0) / projected.length });
      }
    }
    cells.sort((a, b) => a.depth - b.depth).forEach((cell) => fillPolygon(ctx, cell.projected, cell.intensity));

    const planeLines = [];
    for (let longitude = 0; longitude <= 180; longitude += 30) {
      const line = [];
      for (let velocity = -180; velocity <= 180; velocity += 12) line.push(project(surfacePoint(longitude, velocity, 0), width, height));
      planeLines.push(line);
    }
    for (let velocity = -180; velocity <= 180; velocity += 60) {
      const line = [];
      for (let longitude = 0; longitude <= 180; longitude += 6) line.push(project(surfacePoint(longitude, velocity, 0), width, height));
      planeLines.push(line);
    }
    ctx.strokeStyle = "rgba(179, 210, 235, .15)"; ctx.lineWidth = 1;
    planeLines.forEach((line) => { ctx.beginPath(); line.forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); }); ctx.stroke(); });

    const selected = [];
    for (let velocity = -180; velocity <= 180; velocity += 5) {
      const intensity = brightnessAt(data.longitude, velocity, data.rotationSpeed, data.tauPeak, data.sigma, data.spinTemperature, data.continuum) / data.brightnessScale;
      selected.push(project(surfacePoint(data.longitude, velocity, intensity), width, height));
    }
    ctx.strokeStyle = "#f8c56e"; ctx.lineWidth = 2.4; ctx.beginPath(); selected.forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); }); ctx.stroke();

    const a = project(surfacePoint(0, -180, 0), width, height);
    const b = project(surfacePoint(180, -180, 0), width, height);
    const c = project(surfacePoint(0, 180, 0), width, height);
    const d = project({ x: -1.1, y: -1.65, z: 0.95 }, width, height);
    ctx.strokeStyle = "rgba(72, 216, 255, .72)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = "rgba(248, 197, 110, .78)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    ctx.fillStyle = "#9ec5e6"; ctx.font = "600 11px system-ui";
    ctx.fillText("l = 0°", a.x - 21, a.y + 18); ctx.fillText("l = 180°", b.x - 29, b.y + 18); ctx.fillText("radio velocity", c.x - 25, c.y - 9);
    ctx.fillStyle = "#ffda8e"; ctx.fillText("Tᴮ height", d.x - 10, d.y - 9);
    ctx.fillStyle = "#b8cce0"; ctx.font = "11px system-ui";
    ctx.fillText("Orthographic surface: height and colour encode the same synthetic Tᴮ(l, v).", 16, height - 15);
  }

  function importedMode() { return /Imported overlay/.test(document.getElementById("dataStatus").textContent || ""); }

  function updateProvenance(imported) {
    document.getElementById("sidebarMode").textContent = imported ? "Synthetic + imported overlay" : "Synthetic model";
    document.getElementById("provenancePill").textContent = imported ? "Synthetic model + imported overlay" : "Synthetic model active";
    document.getElementById("spectrumMode").textContent = imported ? "overlay loaded" : "synthetic only";
    document.getElementById("dataMode").textContent = "Synthetic l-v-TB field";
    document.getElementById("importedMode").textContent = imported ? "Spectrum-only overlay; no 3D position inferred" : "No user spectrum loaded";
  }

  function draw() {
    const { ctx, width, height } = setupCanvas();
    const data = modelState();
    if (state.mode === "map") drawMap(ctx, width, height, data); else drawSurface(ctx, width, height, data);
    updateProvenance(importedMode());
    fieldStatus.textContent = state.mode === "map"
      ? "Map mode · selected longitude is shown in gold · colour encodes relative synthetic brightness temperature"
      : "Surface mode · drag to orbit the orthographic surface · height and colour encode the same synthetic intensity";
  }

  function setMode(mode) {
    state.mode = mode;
    const mapActive = mode === "map";
    mapButton.classList.toggle("is-active", mapActive); mapButton.setAttribute("aria-pressed", String(mapActive));
    surfaceButton.classList.toggle("is-active", !mapActive); surfaceButton.setAttribute("aria-pressed", String(!mapActive));
    canvas.style.cursor = mapActive ? "default" : "grab";
    draw();
  }

  mapButton.addEventListener("click", () => setMode("map"));
  surfaceButton.addEventListener("click", () => setMode("surface"));
  resetButton.addEventListener("click", () => { state.yaw = -0.72; state.pitch = 0.60; if (state.mode !== "surface") setMode("surface"); else draw(); });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "surface") return;
    state.drag = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.drag || state.mode !== "surface") return;
    state.yaw += (event.clientX - state.drag.x) * 0.008;
    state.pitch = Math.max(0.24, Math.min(1.12, state.pitch + (event.clientY - state.drag.y) * 0.006));
    state.drag = { x: event.clientX, y: event.clientY }; draw();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => canvas.addEventListener(name, () => { state.drag = null; if (state.mode === "surface") canvas.style.cursor = "grab"; }));

  ["longitude", "rotationSpeed", "redshift", "spinTemperature", "tauPeak", "sigmaVelocity", "continuum"].forEach((id) => document.getElementById(id).addEventListener("input", draw));
  window.addEventListener("hi21:import-change", draw);
  window.addEventListener("resize", draw);
  draw();
})();
