"use strict";

const REST_FREQUENCY_MHZ = 1420.40575177;
const SPEED_OF_LIGHT_KM_S = 299792.458;
const PATH_STEPS = 180;
const VELOCITY_MIN = -300;
const VELOCITY_MAX = 300;
const MAP_EXTENT_KPC = 18;

const runtime = {
  parameters: null,
  dataset: null,
  dataPromise: null,
  longitudeVelocity: null,
  latestObserved: null,
  latestModel: null,
};

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "configure") {
    void configure(message.parameters);
  } else if (message.type === "setLongitude" && runtime.parameters) {
    runtime.parameters.longitudeDegrees = clamp(number(message.longitude, 32), -180, 180);
    if (runtime.dataset) emitSelectedProducts(performance.now());
  } else if (message.type === "exportSpectrum") {
    exportSpectrum();
  }
});

async function configure(raw) {
  runtime.parameters = sanitise(raw);
  const started = performance.now();
  try {
    await ensureDataset();
    emitSelectedProducts(started);
  } catch (error) {
    self.postMessage({ type: "dataError", message: `LAB observational dataset error: ${error.message}` });
  }
}

async function ensureDataset() {
  if (runtime.dataset) return runtime.dataset;
  if (!runtime.dataPromise) {
    runtime.dataPromise = fetch("../../data/observations/lab_plane_profiles.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((raw) => {
        if (!Array.isArray(raw.velocityKmS) || !Array.isArray(raw.profiles) || raw.profiles.length < 2) {
          throw new Error("profile structure is invalid");
        }
        const velocity = Float32Array.from(raw.velocityKmS);
        const frequencyMHz = Float32Array.from(raw.frequencyMHz);
        const profiles = raw.profiles.map((profile) => ({
          longitudeDeg: number(profile.longitudeDeg, 0),
          brightnessK: Float32Array.from(profile.brightnessK),
        }));
        if (profiles.some((profile) => profile.brightnessK.length !== velocity.length)) {
          throw new Error("spectral axis and profile lengths do not match");
        }
        runtime.dataset = {
          velocity,
          frequencyMHz,
          profiles,
          beamFwhmDeg: raw.beamFwhmDeg,
          latitudeDeg: raw.latitudeDeg,
        };
        runtime.longitudeVelocity = makeObservedLongitudeVelocity(runtime.dataset);
        return runtime.dataset;
      });
  }
  return runtime.dataPromise;
}

function sanitise(raw) {
  return {
    modelOverlay: Boolean(raw.modelOverlay),
    longitudeDegrees: clamp(number(raw.longitude, 32), -180, 180),
    pathLengthKpc: clamp(number(raw.pathLength, 24), 0.1, 60),
    velocityDispersionKmS: clamp(number(raw.velocityDispersion, 7), 0.1, 100),
    rotationModel: ["flat", "rising", "declining"].includes(raw.rotationModel) ? raw.rotationModel : "flat",
    solarRadiusKpc: clamp(number(raw.solarRadius, 8.2), 1, 30),
    localSpeedKmS: clamp(number(raw.localSpeed, 236), 1, 500),
    diskScaleKpc: clamp(number(raw.diskScale, 3.5), 0.1, 30),
    spiralContrast: clamp(number(raw.spiralContrast, 0.55), 0, 4),
    brightnessKelvinPerKpc: clamp(number(raw.brightnessScale, 38), 0.01, 1000),
  };
}

function emitSelectedProducts(started) {
  const parameters = runtime.parameters;
  const observed = observedSpectrumAtLongitude(parameters.longitudeDegrees);
  const model = parameters.modelOverlay ? modelSpectrumAtLongitude(parameters.longitudeDegrees, parameters, true) : null;
  runtime.latestObserved = cloneSpectrum(observed);
  runtime.latestModel = model ? cloneSpectrum(model) : null;
  const peakIndex = maximumIndex(observed.brightness);
  const peakVelocity = observed.velocity[peakIndex];
  const velocityRange = detectedVelocityRange(observed);
  const message = {
    type: "products",
    telemetry: {
      longitudeDegrees: parameters.longitudeDegrees,
      peakBrightnessKelvin: observed.brightness[peakIndex],
      peakVelocityKmS: peakVelocity,
      peakFrequencyMHz: observed.frequencyMHz[peakIndex],
      velocityMinimumKmS: velocityRange.minimum,
      velocityMaximumKmS: velocityRange.maximum,
      integratedBrightnessKkms: integrateSpectrum(observed),
      computeMilliseconds: performance.now() - started,
    },
    observedSpectrum: {
      velocity: observed.velocity,
      frequencyMHz: observed.frequencyMHz,
      brightness: observed.brightness,
    },
    modelSpectrum: model ? {
      velocity: model.velocity,
      frequencyMHz: model.frequencyMHz,
      brightness: model.brightness,
    } : null,
    modelComponents: model ? model.components.slice(0, 10) : [],
    peakInterpretation: interpretPeaks(
      observed,
      parameters.longitudeDegrees,
      parameters.solarRadiusKpc,
      parameters.localSpeedKmS
    ),
    longitudeVelocity: {
      rgba: runtime.longitudeVelocity.rgba.slice(),
      width: runtime.longitudeVelocity.width,
      height: runtime.longitudeVelocity.height,
    },
  };
  const transfers = [
    message.observedSpectrum.velocity.buffer,
    message.observedSpectrum.frequencyMHz.buffer,
    message.observedSpectrum.brightness.buffer,
    message.longitudeVelocity.rgba.buffer,
  ];
  if (message.modelSpectrum) {
    transfers.push(
      message.modelSpectrum.velocity.buffer,
      message.modelSpectrum.frequencyMHz.buffer,
      message.modelSpectrum.brightness.buffer
    );
  }
  self.postMessage(message, transfers);
}

function observedSpectrumAtLongitude(longitudeDegrees) {
  const profiles = runtime.dataset.profiles;
  const position = (clamp(longitudeDegrees, -180, 180) + 180) / 5;
  const lowerIndex = Math.min(profiles.length - 1, Math.floor(position));
  const upperIndex = Math.min(profiles.length - 1, lowerIndex + 1);
  const fraction = position - lowerIndex;
  const brightness = new Float32Array(runtime.dataset.velocity.length);
  const lower = profiles[lowerIndex].brightnessK;
  const upper = profiles[upperIndex].brightnessK;
  for (let index = 0; index < brightness.length; index += 1) {
    brightness[index] = lower[index] + fraction * (upper[index] - lower[index]);
  }
  return {
    velocity: runtime.dataset.velocity.slice(),
    frequencyMHz: runtime.dataset.frequencyMHz.slice(),
    brightness,
  };
}

function makeObservedLongitudeVelocity(dataset) {
  const width = dataset.profiles.length;
  const height = dataset.velocity.length;
  let maximum = 0;
  for (const profile of dataset.profiles) {
    for (const temperature of profile.brightnessK) maximum = Math.max(maximum, temperature);
  }
  const scaleMaximum = Math.asinh(maximum / 5);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let column = 0; column < width; column += 1) {
    const brightness = dataset.profiles[column].brightnessK;
    for (let row = 0; row < height; row += 1) {
      const value = Math.max(0, brightness[height - 1 - row]);
      const scaled = Math.asinh(value / 5) / (scaleMaximum || 1);
      observedColour(scaled, rgba, (row * width + column) * 4);
    }
  }
  return { rgba, width, height };
}

function detectedVelocityRange(spectrum) {
  const maximum = spectrum.brightness[maximumIndex(spectrum.brightness)];
  const threshold = Math.max(1, maximum * 0.05);
  let first = 0;
  let last = spectrum.brightness.length - 1;
  while (first < last && spectrum.brightness[first] < threshold) first += 1;
  while (last > first && spectrum.brightness[last] < threshold) last -= 1;
  return { minimum: spectrum.velocity[first], maximum: spectrum.velocity[last] };
}

function rotationSpeed(radiusKpc, parameters) {
  const safeRadius = Math.max(0.08, radiusKpc);
  if (parameters.rotationModel === "rising") {
    const normaliser = 1 - Math.exp(-parameters.solarRadiusKpc / 2.4);
    return parameters.localSpeedKmS * (1 - Math.exp(-safeRadius / 2.4)) / normaliser;
  }
  if (parameters.rotationModel === "declining") {
    const inner = 1 - Math.exp(-safeRadius / 1.8);
    const outer = Math.pow(Math.max(safeRadius, parameters.solarRadiusKpc) / parameters.solarRadiusKpc, -0.12);
    const normaliser = 1 - Math.exp(-parameters.solarRadiusKpc / 1.8);
    return parameters.localSpeedKmS * inner / normaliser * outer;
  }
  return parameters.localSpeedKmS;
}

function radialVelocityKmS(radiusKpc, longitudeRadians, parameters) {
  if (radiusKpc < 0.04) return 0;
  return (
    (rotationSpeed(radiusKpc, parameters) * parameters.solarRadiusKpc / radiusKpc -
      parameters.localSpeedKmS) *
    Math.sin(longitudeRadians)
  );
}

function gasDensity(xKpc, yKpc, parameters) {
  const radius = Math.hypot(xKpc, yKpc);
  if (radius > MAP_EXTENT_KPC * 1.05) return 0;
  const radial = Math.exp(-(radius - parameters.solarRadiusKpc) / parameters.diskScaleKpc);
  const hole = 1 - Math.exp(-Math.pow(radius / 2.4, 2));
  const theta = Math.atan2(yKpc, xKpc);
  const spiralPhase = 2 * (theta - Math.log(Math.max(radius, 0.3) / parameters.solarRadiusKpc) / Math.tan(0.22));
  const arms = 1 + parameters.spiralContrast * Math.pow((1 + Math.cos(spiralPhase)) / 2, 3);
  return Math.max(0, radial * hole * arms);
}

function modelSpectrumAtLongitude(longitudeDegrees, parameters, retainComponents) {
  const velocity = runtime.dataset.velocity.slice();
  const frequencyMHz = runtime.dataset.frequencyMHz.slice();
  const brightness = new Float32Array(velocity.length);
  const binWidth = velocity[1] - velocity[0];
  const longitude = longitudeDegrees * Math.PI / 180;
  const ds = parameters.pathLengthKpc / PATH_STEPS;
  const components = [];
  for (let index = 0; index < PATH_STEPS; index += 1) {
    const distance = (index + 0.5) * ds;
    const x = parameters.solarRadiusKpc - distance * Math.cos(longitude);
    const y = distance * Math.sin(longitude);
    const radius = Math.hypot(x, y);
    const density = gasDensity(x, y, parameters);
    if (density <= 1e-8) continue;
    const radialVelocity = radialVelocityKmS(radius, longitude, parameters);
    const weight = density * parameters.brightnessKelvinPerKpc * ds /
      (Math.sqrt(2 * Math.PI) * parameters.velocityDispersionKmS);
    addGaussianLine(brightness, radialVelocity, weight, parameters.velocityDispersionKmS, binWidth);
    if (retainComponents) {
      components.push({
        distanceKpc: distance,
        radiusKpc: radius,
        radialVelocityKmS: radialVelocity,
        weightKelvin: weight,
      });
    }
  }
  components.sort((first, second) => second.weightKelvin - first.weightKelvin);
  return { velocity, frequencyMHz, brightness, components };
}

function addGaussianLine(brightness, centreVelocity, weight, sigma, binWidth) {
  const centreBin = Math.round((centreVelocity - VELOCITY_MIN) / binWidth);
  const radius = Math.ceil(4.5 * sigma / binWidth);
  for (let bin = Math.max(0, centreBin - radius); bin <= Math.min(brightness.length - 1, centreBin + radius); bin += 1) {
    const sampleVelocity = VELOCITY_MIN + bin * binWidth;
    brightness[bin] += weight * Math.exp(-0.5 * Math.pow((sampleVelocity - centreVelocity) / sigma, 2));
  }
}

function integrateSpectrum(spectrum) {
  let integral = 0;
  for (let index = 1; index < spectrum.velocity.length; index += 1) {
    integral += 0.5 * (spectrum.brightness[index] + spectrum.brightness[index - 1]) *
      (spectrum.velocity[index] - spectrum.velocity[index - 1]);
  }
  return integral;
}

function maximumIndex(values) {
  let selected = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[selected]) selected = index;
  }
  return selected;
}

function cloneSpectrum(spectrum) {
  return {
    velocity: spectrum.velocity.slice(),
    frequencyMHz: spectrum.frequencyMHz.slice(),
    brightness: spectrum.brightness.slice(),
  };
}

// Detects local-maximum velocity components in the observed spectrum (distinct gas
// clouds/spiral-arm crossings along the line of sight show up as separate peaks in a
// longitude-velocity profile). A peak must exceed both a noise floor and a minimum
// prominence above its neighbouring local minima to be counted, so a single broad hump
// is not reported as several spurious peaks.
function detectPeaks(spectrum) {
  const brightness = spectrum.brightness;
  const noiseFloor = Math.max(1.5, maximumValue(brightness) * 0.06);
  const peaks = [];
  for (let index = 2; index < brightness.length - 2; index += 1) {
    const value = brightness[index];
    if (value < noiseFloor) continue;
    const isLocalMax =
      value >= brightness[index - 1] && value >= brightness[index + 1] &&
      value > brightness[index - 2] && value > brightness[index + 2];
    if (!isLocalMax) continue;
    peaks.push({ index, velocityKmS: spectrum.velocity[index], brightnessK: value });
  }
  // merge peaks that are within 8 km/s of a higher neighbour (same blended component)
  const merged = [];
  for (const peak of peaks.sort((a, b) => b.brightnessK - a.brightnessK)) {
    if (merged.some((kept) => Math.abs(kept.velocityKmS - peak.velocityKmS) < 8)) continue;
    merged.push(peak);
  }
  return merged.sort((a, b) => a.velocityKmS - b.velocityKmS).slice(0, 6);
}

function maximumValue(values) {
  let selected = -Infinity;
  for (const value of values) if (value > selected) selected = value;
  return selected;
}

// Converts an observed LSR radial velocity at a given Galactic longitude into an implied
// Galactocentric radius, inverting the flat-rotation-curve formula
// v_r(R, l) = V0 (R0/R - 1) sin(l)  =>  R = R0 / (1 + v_r / (V0 sin l)).
// This is the standard kinematic-distance relation used to read spiral structure off an
// HI longitude-velocity diagram (e.g. Binney & Merrifield, 1998, "Galactic Astronomy",
// section 9.1). It is only meaningful for |sin(l)| well away from zero and breaks down
// near non-circular motion (bar streaming, spiral shocks), which is stated explicitly.
function impliedRadiusKpc(velocityKmS, longitudeDegrees, solarRadiusKpc, localSpeedKmS) {
  const sinL = Math.sin((longitudeDegrees * Math.PI) / 180);
  if (Math.abs(sinL) < 0.05) return null;
  const denominator = 1 + velocityKmS / (localSpeedKmS * sinL);
  if (denominator <= 0.05) return null;
  return solarRadiusKpc / denominator;
}

function classifyRadius(radiusKpc, solarRadiusKpc) {
  if (radiusKpc === null) return "kinematically undefined near l = 0 deg or 180 deg (line of sight is radial, not orbital)";
  if (radiusKpc < solarRadiusKpc * 0.35) return "inner Galaxy / bar-influenced region -- flat-rotation-curve distance is unreliable here";
  if (radiusKpc < solarRadiusKpc * 0.85) return "inner disk, likely tangent-point gas near a spiral-arm crossing";
  if (radiusKpc < solarRadiusKpc * 1.15) return "solar neighbourhood -- local (Orion) spur gas";
  if (radiusKpc < solarRadiusKpc * 1.8) return "outer disk -- likely Perseus or outer-arm gas";
  return "far outer disk or non-circular motion -- flat-rotation-curve distance is increasingly uncertain";
}

function interpretPeaks(spectrum, longitudeDegrees, solarRadiusKpc, localSpeedKmS) {
  return detectPeaks(spectrum).map((peak) => {
    const radiusKpc = impliedRadiusKpc(peak.velocityKmS, longitudeDegrees, solarRadiusKpc, localSpeedKmS);
    return {
      velocityKmS: peak.velocityKmS,
      brightnessK: peak.brightnessK,
      radiusKpc,
      classification: classifyRadius(radiusKpc, solarRadiusKpc),
    };
  });
}

function exportSpectrum() {
  if (!runtime.latestObserved) return;
  const observed = runtime.latestObserved;
  const model = runtime.latestModel;
  const header = model
    ? "velocity_lsr_km_s,frequency_mhz,lab_observed_brightness_temperature_k,simulated_overlay_brightness_temperature_k"
    : "velocity_lsr_km_s,frequency_mhz,lab_observed_brightness_temperature_k";
  const rows = [header];
  for (let index = 0; index < observed.velocity.length; index += 1) {
    const base = `${observed.velocity[index].toFixed(6)},${observed.frequencyMHz[index].toFixed(9)},${observed.brightness[index].toFixed(8)}`;
    rows.push(model ? `${base},${model.brightness[index].toFixed(8)}` : base);
  }
  self.postMessage({
    type: "csv",
    filename: "lab_observed_hi_21cm_spectrum.csv",
    rows: observed.velocity.length,
    content: `${rows.join("\n")}\n`,
  });
}

function observedColour(value, rgba, offset) {
  const intensity = clamp(value, 0, 1);
  rgba[offset] = Math.round(6 + 250 * Math.pow(intensity, 1.8));
  rgba[offset + 1] = Math.round(10 + 205 * Math.pow(intensity, 0.72));
  rgba[offset + 2] = Math.round(21 + 197 * (1 - Math.abs(0.48 - intensity) * 1.4));
  rgba[offset + 3] = 255;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function number(value, fallback) {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : fallback;
}
