(() => {
  const REST_FREQ_MHZ = 1420.40575177;
  const C_KM_S = 299792.458;
  const canvas = document.getElementById("frequencyCanvas");
  const redshiftInput = document.getElementById("redshift");

  function setup() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, canvas.clientWidth);
    const aspect = Number(canvas.getAttribute("height")) / Number(canvas.getAttribute("width"));
    const height = Math.max(1, width * aspect);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    const { ctx, width, height } = setup();
    const z = Number(redshiftInput.value);
    const observed = REST_FREQ_MHZ / (1 + z);
    const coordinates = [
      { name: "Radio", formula: "c z / (1 + z)", value: C_KM_S * z / (1 + z), colour: "#66d9ef" },
      { name: "Optical", formula: "c z", value: C_KM_S * z, colour: "#b28cff" },
      { name: "Relativistic", formula: "Doppler coordinate", value: C_KM_S * (((1 + z) ** 2 - 1) / ((1 + z) ** 2 + 1)), colour: "#f4bf75" },
    ];
    ctx.fillStyle = "#070d15"; ctx.fillRect(0, 0, width, height);
    const pad = 16;
    ctx.fillStyle = "#95aabe"; ctx.font = "11px system-ui"; ctx.fillText("frequency mapping", pad, 18);
    const gaugeY = 48; const gaugeLeft = pad; const gaugeRight = width - pad; const shiftMax = REST_FREQ_MHZ - REST_FREQ_MHZ / 1.25;
    const shift = REST_FREQ_MHZ - observed; const x = gaugeLeft + (shift / Math.max(1e-12, shiftMax)) * (gaugeRight - gaugeLeft);
    ctx.strokeStyle = "rgba(171, 197, 220, .22)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gaugeLeft, gaugeY); ctx.lineTo(gaugeRight, gaugeY); ctx.stroke();
    ctx.fillStyle = "#75e8a9"; ctx.beginPath(); ctx.arc(x, gaugeY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#9cb1c7"; ctx.font = "10px system-ui"; ctx.fillText("1420.4058 MHz rest", gaugeLeft, gaugeY - 10);
    const observedLabel = `${observed.toFixed(4)} MHz observed`;
    ctx.fillText(observedLabel, Math.max(gaugeLeft, Math.min(x - 38, gaugeRight - 105)), gaugeY + 20);

    const top = 86; const gap = 7; const rowHeight = Math.max(35, (height - top - 14 - gap * 2) / 3);
    coordinates.forEach((entry, index) => {
      const y = top + index * (rowHeight + gap);
      roundedRect(ctx, pad, y, width - pad * 2, rowHeight, 8);
      ctx.fillStyle = "rgba(255,255,255,.025)"; ctx.fill();
      ctx.strokeStyle = "rgba(170, 197, 220, .13)"; ctx.stroke();
      ctx.fillStyle = entry.colour; ctx.fillRect(pad + 10, y + 10, 3, rowHeight - 20);
      ctx.fillStyle = "#d7e5f2"; ctx.font = "700 11px system-ui"; ctx.fillText(entry.name, pad + 22, y + 16);
      ctx.fillStyle = "#899eb5"; ctx.font = "10px system-ui"; ctx.fillText(entry.formula, pad + 22, y + 29);
      const label = `${entry.value.toFixed(1)} km s⁻¹`;
      ctx.fillStyle = entry.colour; ctx.font = "700 11px system-ui";
      const w = ctx.measureText(label).width; ctx.fillText(label, width - pad - w - 10, y + rowHeight / 2 + 4);
    });
  }

  redshiftInput.addEventListener("input", draw);
  window.addEventListener("resize", draw);
  draw();
})();
