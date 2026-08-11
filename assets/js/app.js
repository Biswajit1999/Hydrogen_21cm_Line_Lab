(() => {
  "use strict";

  // --- Spectral-line physics reference contract -----------------------------------
  // Shared constants and formulas for the imported-spectrum analysis panel. Mirrors
  // tools/radiative_transfer_contract.py so the browser and the independently-tested
  // Python reference implementation agree on every formula (see validate_science_contract.py
  // and validate_velocity_conventions.py in tools/, and RESEARCH_QUALITY.md).
  const REST_FREQ_MHZ = 1420.40575177;
  const C_KM_S = 299792.458;
  // Optically-thin HI column density conversion constant [cm^-2 / (K km/s)]
  // (Draine, 2011, "Physics of the Interstellar and Intergalactic Medium", eq. 8.16).
  const COLUMN_FACTOR = 1.823e18;
  const CONTINUUM_K = 2.73;

  function observedFrequencyMHz(redshift) { return REST_FREQ_MHZ / (1 + redshift); }
  function radioVelocityKmS(redshift) { return C_KM_S * redshift / (1 + redshift); }
  function opticalVelocityKmS(redshift) { return C_KM_S * redshift; }
  function relativisticVelocityKmS(redshift) {
    return C_KM_S * (((1 + redshift) ** 2 - 1) / ((1 + redshift) ** 2 + 1));
  }
  function radioFrequencyFromVelocity(velocityKmS) {
    return REST_FREQ_MHZ * (1 - velocityKmS / C_KM_S);
  }
  function slabBrightnessK(spinTemperature, continuum, tau) {
    return (spinTemperature - continuum) * (1 - Math.exp(-tau));
  }
  function thinBrightnessK(spinTemperature, continuum, tau) {
    return (spinTemperature - continuum) * tau;
  }
  // Reference-generator display resolution (tools/generate_21cm_spectrum.py SPECTRUM_SAMPLES /
  // VELOCITY_SPAN_KM_S): the browser panel independently resamples an imported spectrum onto
  // this many channels across this velocity span for the trapezoid column-density estimate.
  const samples = 520; const span = 360;
  function trapezoidColumn(points) {
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      const [v0, y0] = points[index - 1];
      const [v1, y1] = points[index];
      total += 0.5 * (y0 + y1) * (v1 - v0);
    }
    return COLUMN_FACTOR * total;
  }
  function parseSpectrumCsv(text, filename) {
    const points = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",").map(Number))
      .filter(([v, y]) => Number.isFinite(v) && Number.isFinite(y))
      .sort((a, b) => a[0] - b[0]);
    if (points.length < 2) throw new Error("CSV needs at least two valid velocity,brightness rows");
    return { filename, points, thinColumn: trapezoidColumn(points) };
  }

  const defaults = {
    modelOverlay: false,
    longitude: 32,
    pathLength: 24,
    velocityDispersion: 7,
    rotationModel: "flat",
    solarRadius: 8.2,
    localSpeed: 236,
    diskScale: 3.5,
    spiralContrast: 0.55,
    brightnessScale: 38,
  };
  const controls = Object.fromEntries(Object.keys(defaults).map((id) => [id, document.getElementById(id)]));
  const readout = {
    engineLight: document.getElementById("engine-light"),
    engine: document.getElementById("engine"),
    longitudeLive: document.getElementById("longitude-live"),
    fps: document.getElementById("fps"),
    peakTemperature: document.getElementById("peak-temperature"),
    peakVelocity: document.getElementById("peak-velocity"),
    peakFrequency: document.getElementById("peak-frequency"),
    velocityRange: document.getElementById("velocity-range"),
    compute: document.getElementById("compute"),
    spectrumNote: document.getElementById("spectrum-note"),
    components: document.getElementById("components"),
    log: document.getElementById("log"),
    status: document.getElementById("status"),
  };
  const buttons = {
    export: document.getElementById("export"),
    reset: document.getElementById("reset"),
  };

  class Surface {
    constructor(id) {
      this.canvas = document.getElementById(id);
      this.ctx = this.canvas.getContext("2d", { alpha: false, desynchronized: true });
      this.geometry = null;
    }

    begin() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(20, Math.round(rect.width));
      const height = Math.max(20, Math.round(rect.height));
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.ctx.fillStyle = "#171a21";
      this.ctx.fillRect(0, 0, width, height);
      return { ctx: this.ctx, width, height };
    }
  }

  const surfaces = {
    galaxy: new Surface("galaxy"),
    spectrum: new Surface("spectrum"),
    lv: new Surface("longitude-velocity"),
  };
  const state = {
    worker: null,
    timeout: 0,
    products: null,
    logs: [],
    frames: 0,
    frameStart: performance.now(),
    skyImage: null,
  };

  function value(id) {
    if (controls[id].type === "checkbox") return controls[id].checked;
    return controls[id].type === "select-one" ? controls[id].value : Number(controls[id].value);
  }

  function parameters() {
    return Object.fromEntries(Object.keys(defaults).map((key) => [key, value(key)]));
  }

  function labels() {
    const curve = { flat: "FLAT", rising: "RISING", declining: "DECLINING" };
    const overlay = value("modelOverlay");
    document.getElementById("modelOverlay-value").textContent = overlay ? "ON" : "OFF";
    document.getElementById("longitude-value").textContent = `${value("longitude").toFixed(1)} deg`;
    document.getElementById("pathLength-value").textContent = `${value("pathLength").toFixed(1)} kpc`;
    document.getElementById("velocityDispersion-value").textContent = `${value("velocityDispersion").toFixed(1)} km/s`;
    document.getElementById("rotationModel-value").textContent = curve[value("rotationModel")];
    document.getElementById("solarRadius-value").textContent = `${value("solarRadius").toFixed(2)} kpc`;
    document.getElementById("localSpeed-value").textContent = `${value("localSpeed").toFixed(1)} km/s`;
    document.getElementById("diskScale-value").textContent = `${value("diskScale").toFixed(2)} kpc`;
    document.getElementById("spiralContrast-value").textContent = value("spiralContrast").toFixed(2);
    document.getElementById("brightnessScale-value").textContent = `${value("brightnessScale").toFixed(0)} K/kpc`;
    document.querySelectorAll(".model-parameters").forEach((section) => {
      section.classList.toggle("active", overlay);
    });
  }

  function engine(name, className, text) {
    readout.engine.textContent = name;
    readout.engineLight.className = className;
    readout.status.textContent = text;
  }

  function log(message) {
    state.logs.unshift(`${new Date().toISOString().slice(11, 19)}  ${message}`);
    state.logs.length = Math.min(state.logs.length, 7);
    readout.log.replaceChildren(...state.logs.map((line) => {
      const row = document.createElement("li");
      row.textContent = line;
      return row;
    }));
  }

  function configure(immediate = false) {
    labels();
    if (!state.worker) return;
    clearTimeout(state.timeout);
    const send = () => {
      engine("LOADING", "busy", "READING LAB DATA AND SOLVING OVERLAY");
      state.worker.postMessage({ type: "configure", parameters: parameters() });
    };
    if (immediate) send(); else state.timeout = setTimeout(send, 45);
  }

  function setLongitude() {
    labels();
    if (state.worker && state.products) {
      state.worker.postMessage({ type: "setLongitude", longitude: value("longitude") });
    } else {
      configure(true);
    }
  }

  function rgbaCanvas(bytes, width, height) {
    const buffer = document.createElement("canvas");
    buffer.width = width;
    buffer.height = height;
    buffer.getContext("2d").putImageData(new ImageData(bytes, width, height), 0, 0);
    return buffer;
  }

  function drawSky(products) {
    const { ctx, width, height } = surfaces.galaxy.begin();
    if (!state.skyImage) {
      ctx.fillStyle = "#8b93a3";
      ctx.font = '11px "Roboto Mono", Consolas, monospace';
      ctx.fillText("LOADING HI4PI OBSERVED SKY...", 18, height / 2);
      return;
    }
    const marginX = 14;
    const marginY = 28;
    const scale = Math.min(
      (width - marginX * 2) / state.skyImage.naturalWidth,
      (height - marginY * 2) / state.skyImage.naturalHeight
    );
    const drawWidth = state.skyImage.naturalWidth * scale;
    const drawHeight = state.skyImage.naturalHeight * scale;
    const left = (width - drawWidth) / 2;
    const top = (height - drawHeight) / 2;
    surfaces.galaxy.geometry = { left, top, width: drawWidth, height: drawHeight };
    ctx.drawImage(state.skyImage, left, top, drawWidth, drawHeight);
    ctx.strokeStyle = "rgba(73,223,160,.55)";
    ctx.strokeRect(left - 1, top - 1, drawWidth + 2, drawHeight + 2);
    const longitude = products.telemetry.longitudeDegrees;
    const markerX = left + (0.5 - longitude / 360) * drawWidth;
    const markerY = top + drawHeight * 0.5;
    ctx.strokeStyle = "#f2b866";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(markerX, top + drawHeight * 0.18);
    ctx.lineTo(markerX, top + drawHeight * 0.82);
    ctx.stroke();
    ctx.fillStyle = "#f2b866";
    ctx.beginPath();
    ctx.arc(markerX, markerY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eef1f6";
    ctx.font = '10px "Roboto Mono", Consolas, monospace';
    ctx.fillText(`l=${longitude.toFixed(1)} deg`, Math.min(markerX + 6, width - 80), Math.max(top + 13, markerY - 8));
    ctx.fillStyle = "#8b93a3";
    ctx.fillText("HI4PI / OBSERVED SKY PROJECTION", left + 6, top + drawHeight + 16);
  }

  function axes(ctx, width, height, xLabel, yLabel) {
    const box = { left: 60, top: 15, w: width - 77, h: height - 44 };
    ctx.strokeStyle = "rgba(129,150,173,.25)";
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = box.top + box.h * tick / 4;
      ctx.beginPath();
      ctx.moveTo(box.left, y);
      ctx.lineTo(box.left + box.w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#8b93a3";
    ctx.font = '10px "Roboto Mono", Consolas, monospace';
    ctx.fillText(yLabel, 10, box.top + 8);
    ctx.textAlign = "right";
    ctx.fillText(xLabel, width - 12, height - 8);
    ctx.textAlign = "left";
    return box;
  }

  function plotLine(ctx, data, maximum, box, colour, lineWidth) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let index = 0; index < data.velocity.length; index += 1) {
      const x = box.left + (data.velocity[index] + 300) / 600 * box.w;
      const y = box.top + (1 - data.brightness[index] / maximum) * box.h;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawSpectrum(products) {
    const { ctx, width, height } = surfaces.spectrum.begin();
    const observed = products.observedSpectrum;
    let maximum = 1;
    for (const item of observed.brightness) maximum = Math.max(maximum, item);
    if (products.modelSpectrum) {
      for (const item of products.modelSpectrum.brightness) maximum = Math.max(maximum, item);
    }
    const box = axes(ctx, width, height, "V_LSR (km/s)", "T_B K");
    ctx.fillStyle = "#8b93a3";
    ctx.font = '10px "Roboto Mono", Consolas, monospace';
    for (let tick = 0; tick <= 4; tick += 1) {
      const velocity = -300 + tick * 150;
      const x = box.left + tick / 4 * box.w;
      ctx.textAlign = tick === 0 ? "left" : tick === 4 ? "right" : "center";
      ctx.fillText(velocity.toFixed(0), x, box.top + box.h + 17);
      ctx.textAlign = "right";
      ctx.fillText((maximum * (1 - tick / 4)).toFixed(1), box.left - 8, box.top + tick / 4 * box.h + 3);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(52,215,229,.14)";
    ctx.beginPath();
    ctx.moveTo(box.left, box.top + box.h);
    for (let index = 0; index < observed.velocity.length; index += 1) {
      const x = box.left + (observed.velocity[index] + 300) / 600 * box.w;
      const y = box.top + (1 - observed.brightness[index] / maximum) * box.h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(box.left + box.w, box.top + box.h);
    ctx.closePath();
    ctx.fill();
    plotLine(ctx, observed, maximum, box, "#5fb3c9", 1.7);
    ctx.fillStyle = "#5fb3c9";
    ctx.fillText("LAB OBSERVED", box.left + 8, box.top + 14);
    if (products.modelSpectrum) {
      plotLine(ctx, products.modelSpectrum, maximum, box, "#f2b866", 1.35);
      ctx.fillStyle = "#f2b866";
      ctx.fillText("MODEL OVERLAY", box.left + 98, box.top + 14);
    }
  }

  function drawLongitudeVelocity(products) {
    const { ctx, width, height } = surfaces.lv.begin();
    const box = axes(ctx, width, height, "GALACTIC LONGITUDE (deg)", "V_LSR");
    const image = products.longitudeVelocity;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rgbaCanvas(image.rgba, image.width, image.height), box.left, box.top, box.w, box.h);
    ctx.imageSmoothingEnabled = true;
    const x = box.left + (products.telemetry.longitudeDegrees + 180) / 360 * box.w;
    ctx.strokeStyle = "#eef1f6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, box.top);
    ctx.lineTo(x, box.top + box.h);
    ctx.stroke();
    ctx.fillStyle = "#8b93a3";
    ctx.font = '10px "Roboto Mono", Consolas, monospace';
    ctx.textAlign = "left";
    ctx.fillText("-180", box.left, box.top + box.h + 17);
    ctx.textAlign = "center";
    ctx.fillText("0", box.left + box.w / 2, box.top + box.h + 17);
    ctx.textAlign = "right";
    ctx.fillText("+180", box.left + box.w, box.top + box.h + 17);
    ctx.textAlign = "left";
  }

  function showComponents(products) {
    if (!products.modelComponents.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "empty";
      cell.textContent = "ENABLE MODEL OVERLAY FOR COMPUTED CELLS";
      row.appendChild(cell);
      readout.components.replaceChildren(row);
      return;
    }
    readout.components.replaceChildren(...products.modelComponents.map((component) => {
      const row = document.createElement("tr");
      [
        component.distanceKpc.toFixed(2),
        component.radiusKpc.toFixed(2),
        component.radialVelocityKmS.toFixed(1),
        component.weightKelvin.toFixed(3),
      ].forEach((numberText) => {
        const cell = document.createElement("td");
        cell.textContent = numberText;
        row.appendChild(cell);
      });
      return row;
    }));
  }

  function updateProducts(products) {
    state.products = products;
    const telemetry = products.telemetry;
    controls.longitude.value = String(telemetry.longitudeDegrees);
    labels();
    readout.longitudeLive.textContent = `${telemetry.longitudeDegrees.toFixed(2)} deg`;
    readout.peakTemperature.textContent = `${telemetry.peakBrightnessKelvin.toFixed(2)} K`;
    readout.peakVelocity.textContent = `${telemetry.peakVelocityKmS.toFixed(2)} km/s`;
    readout.peakFrequency.textContent = `${telemetry.peakFrequencyMHz.toFixed(5)} MHz`;
    readout.velocityRange.textContent =
      `${telemetry.velocityMinimumKmS.toFixed(1)} / ${telemetry.velocityMaximumKmS.toFixed(1)} km/s`;
    readout.compute.textContent = `${telemetry.computeMilliseconds.toFixed(2)} ms`;
    readout.spectrumNote.textContent =
      `LAB l=${telemetry.longitudeDegrees.toFixed(2)} deg / integral ${telemetry.integratedBrightnessKkms.toFixed(1)} K km/s`;
    showComponents(products);
    drawSky(products);
    drawSpectrum(products);
    drawLongitudeVelocity(products);
    engine("ONLINE", "online", products.modelSpectrum ? "LAB DATA + MODEL OVERLAY CURRENT" : "LAB OBSERVATIONS CURRENT");
  }

  function loadSkyImage() {
    const image = new Image();
    image.onload = () => {
      state.skyImage = image;
      if (state.products) drawSky(state.products);
      log("HI4PI observed all-sky image loaded");
    };
    image.onerror = () => log("HI4PI image asset could not be loaded");
    image.src = "data/observations/hi4pi_allsky.jpg";
  }

  function start() {
    labels();
    loadSkyImage();
    try {
      state.worker = new Worker("assets/js/physicsWorker.js");
      state.worker.addEventListener("message", (event) => {
        if (event.data.type === "products") {
          updateProducts(event.data);
        } else if (event.data.type === "csv") {
          const url = URL.createObjectURL(new Blob([event.data.content], { type: "text/csv;charset=utf-8" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = event.data.filename;
          link.click();
          URL.revokeObjectURL(url);
          log(`Exported ${event.data.rows} LAB spectral channels`);
        } else if (event.data.type === "dataError") {
          engine("FAILED", "failed", "LAB DATASET LOAD FAILED");
          log(event.data.message);
        }
      });
      state.worker.addEventListener("error", (event) => {
        engine("FAILED", "failed", "WORKER FAILURE");
        log(event.message);
      });
      configure(true);
      log("Loading LAB observational spectra");
    } catch (error) {
      engine("FAILED", "failed", "SERVE OVER HTTP TO START WORKER");
      log(error.message);
    }
    const animate = (timestamp) => {
      state.frames += 1;
      if (timestamp - state.frameStart >= 1000) {
        readout.fps.textContent = `${(state.frames * 1000 / (timestamp - state.frameStart)).toFixed(0)} FPS`;
        state.frames = 0;
        state.frameStart = timestamp;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  controls.longitude.addEventListener("input", setLongitude);
  controls.longitude.addEventListener("change", setLongitude);
  Object.entries(controls).filter(([id]) => id !== "longitude").forEach(([, control]) => {
    control.addEventListener("input", () => configure(false));
    control.addEventListener("change", () => configure(true));
  });
  surfaces.galaxy.canvas.addEventListener("click", (event) => {
    if (!surfaces.galaxy.geometry || !state.worker) return;
    const bounds = surfaces.galaxy.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const geometry = surfaces.galaxy.geometry;
    if (x >= geometry.left && x <= geometry.left + geometry.width) {
      const longitude = Math.max(-180, Math.min(180, (0.5 - (x - geometry.left) / geometry.width) * 360));
      controls.longitude.value = longitude.toFixed(1);
      setLongitude();
      log("Galactic longitude selected on HI4PI sky projection");
    }
  });
  buttons.export.addEventListener("click", () => state.worker?.postMessage({ type: "exportSpectrum" }));
  buttons.reset.addEventListener("click", () => {
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (controls[key].type === "checkbox") controls[key].checked = defaultValue;
      else controls[key].value = String(defaultValue);
    }
    configure(true);
    log("Observed view and model settings restored");
  });
  window.addEventListener("resize", () => {
    if (state.products) updateProducts(state.products);
  });

  const csvImport = document.getElementById("csvImport");
  const importStatus = document.getElementById("importStatus");
  const importReadout = document.getElementById("importReadout");
  csvImport?.addEventListener("change", async () => {
    const file = csvImport.files?.[0];
    if (!file) return;
    try {
      const overlay = parseSpectrumCsv(await file.text(), file.name);
      const [peakVelocity] = overlay.points.reduce((a, b) => (b[1] > a[1] ? b : a));
      const frequencyAtPeak = radioFrequencyFromVelocity(peakVelocity);
      const redshiftAtPeak = REST_FREQ_MHZ / frequencyAtPeak - 1;
      document.getElementById("importColumn").textContent =
        `${overlay.thinColumn.toExponential(3)} cm^-2 (${overlay.points.length} channels)`;
      document.getElementById("importVelocities").textContent =
        `${radioVelocityKmS(redshiftAtPeak).toFixed(2)} / ${opticalVelocityKmS(redshiftAtPeak).toFixed(2)} / ${relativisticVelocityKmS(redshiftAtPeak).toFixed(2)} km/s`;
      importReadout.hidden = false;
      importStatus.textContent = `Imported overlay: ${overlay.filename}`;
      log(`Imported ${overlay.points.length}-channel spectrum; thin-limit N(HI) = ${overlay.thinColumn.toExponential(3)} cm^-2`);
    } catch (error) {
      importStatus.textContent = `Import rejected: ${error.message}`;
      importReadout.hidden = true;
      log(`CSV import rejected: ${error.message}`);
    }
  });

  start();
})();
