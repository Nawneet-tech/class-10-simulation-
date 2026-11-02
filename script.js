"use strict";

const canvas = document.querySelector("#rayCanvas");
const context = canvas.getContext("2d");
const systemSelect = document.querySelector("#systemSelect");
const objectDistanceInput = document.querySelector("#objectDistance");
const focalLengthInput = document.querySelector("#focalLength");
const toggleButton = document.querySelector("#toggleSimulation");
const resetButton = document.querySelector("#resetSimulation");
const systemState = document.querySelector("#systemState");
const stateLabel = document.querySelector("#stateLabel");
const toggleLabel = document.querySelector("#toggleLabel");
const diagramMessage = document.querySelector("#diagramMessage");
const objectDistanceValue = document.querySelector("#objectDistanceValue");
const focalLengthValue = document.querySelector("#focalLengthValue");
const readoutU = document.querySelector("#readoutU");
const readoutF = document.querySelector("#readoutF");
const readoutV = document.querySelector("#readoutV");
const readoutM = document.querySelector("#readoutM");
const imageNature = document.querySelector("#imageNature");
const imagePosition = document.querySelector("#imagePosition");
const equationText = document.querySelector("#equationText");

const systems = {
  "concave-mirror": { kind: "mirror", label: "Concave Mirror", focalSign: -1 },
  "convex-mirror": { kind: "mirror", label: "Convex Mirror", focalSign: 1 },
  "concave-lens": { kind: "lens", label: "Concave Lens", focalSign: -1 },
  "convex-lens": { kind: "lens", label: "Convex Lens", focalSign: 1 }
};

const defaults = { system: "concave-mirror", objectDistance: 60, focalLength: 30 };
let isRunning = false;
let canvasWidth = 0;
let canvasHeight = 0;

function currentSystem() {
  return systems[systemSelect.value];
}

function signedCm(value) {
  return `${value < 0 ? "−" : "+"}${Math.abs(value)}`;
}

function getSetup() {
  const system = currentSystem();
  const u = -Number(objectDistanceInput.value);
  const f = system.focalSign * Number(focalLengthInput.value);
  const isMirror = system.kind === "mirror";
  const denominator = isMirror ? (1 / f) - (1 / u) : (1 / f) + (1 / u);
  const atInfinity = Math.abs(denominator) < 1e-10;
  const v = atInfinity ? Infinity : 1 / denominator;
  const magnification = atInfinity
    ? (isMirror ? Infinity : -Infinity)
    : (isMirror ? -v / u : v / u);

  return { system, u, f, v, magnification, atInfinity };
}

function setRangeFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const percent = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(90deg, #348be0 0%, #348be0 ${percent}%, #293950 ${percent}%, #293950 100%)`;
}

function formatValue(value, digits = 1) {
  if (!Number.isFinite(value)) return value < 0 ? "−∞" : "∞";
  const rounded = Math.round(value * (10 ** digits)) / (10 ** digits);
  return `${rounded < 0 ? "−" : "+"}${Math.abs(rounded).toFixed(digits)}`;
}

function updateReadings(setup) {
  const { system, u, f, v, magnification, atInfinity } = setup;
  const sign = system.focalSign < 0 ? "−" : "+";

  objectDistanceValue.value = `${signedCm(u)} cm`;
  focalLengthValue.value = `${sign}${Math.abs(f)} cm`;
  readoutU.innerHTML = `${signedCm(u)} <small>cm</small>`;
  readoutF.innerHTML = `${sign}${Math.abs(f)} <small>cm</small>`;
  equationText.textContent = system.kind === "mirror"
    ? "Mirror: 1/f = 1/v + 1/u"
    : "Lens: 1/f = 1/v − 1/u";
  setRangeFill(objectDistanceInput);
  setRangeFill(focalLengthInput);

  if (!isRunning) {
    readoutV.innerHTML = "— <small>cm</small>";
    readoutM.textContent = "—";
    readoutV.classList.add("muted-reading");
    readoutM.classList.add("muted-reading");
    imageNature.textContent = "Turn on simulation to calculate";
    imagePosition.textContent = "Image position: —";
    diagramMessage.textContent = "Simulation OFF — No Rays";
    return;
  }

  readoutV.classList.remove("muted-reading");
  readoutM.classList.remove("muted-reading");
  if (atInfinity) {
    readoutV.innerHTML = "∞ <small>cm</small>";
    readoutM.textContent = system.kind === "mirror" ? "∞" : "−∞";
    imageNature.textContent = "Real, inverted & highly enlarged — image at infinity";
    imagePosition.textContent = "Image position: At infinity";
    diagramMessage.textContent = "Rays emerge parallel — image is formed at infinity.";
    return;
  }

  readoutV.innerHTML = `${formatValue(v)} <small>cm</small>`;
  readoutM.textContent = formatValue(magnification, 2);

  const isReal = system.kind === "mirror" ? v < 0 : v > 0;
  const isInverted = magnification < 0;
  const absoluteMagnification = Math.abs(magnification);
  const size = Math.abs(absoluteMagnification - 1) < 0.015
    ? "same size"
    : absoluteMagnification > 1
      ? "magnified"
      : "diminished";
  const nature = `${isReal ? "Real" : "Virtual"} & ${isInverted ? "Inverted" : "Erect"}`;

  imageNature.textContent = `${nature} · ${size}`;
  imagePosition.textContent = `Image position: ${isReal ? "real side" : "virtual side"} of the ${system.kind}`;
  diagramMessage.textContent = `${nature} image, ${size} — v = ${formatValue(v)} cm, m = ${formatValue(magnification, 2)}.`;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  draw();
}

function drawArrow(ctx, x, axisY, height, color, label, width) {
  const tipY = axisY - height;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x, axisY);
  ctx.lineTo(x, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  const arrowBaseY = tipY + (height >= 0 ? 10 : -10);
  ctx.lineTo(x - 6, arrowBaseY);
  ctx.lineTo(x + 6, arrowBaseY);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "600 10px Inter, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, Math.abs(height) >= 20 ? tipY + (height >= 0 ? -12 : 20) : axisY + 23);
  ctx.restore();
}

function drawTick(ctx, x, axisY, label, color, isMajor = false) {
  const halfHeight = isMajor ? 7 : 5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = isMajor ? 1.5 : 1;
  ctx.beginPath();
  ctx.moveTo(x, axisY - halfHeight);
  ctx.lineTo(x, axisY + halfHeight);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `${isMajor ? "600" : "500"} 9px Inter, Segoe UI, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(label, x, axisY + 22);
  ctx.restore();
}

function drawElement(ctx, x, axisY, system, height) {
  ctx.save();
  if (system.kind === "mirror") {
    const concave = system.focalSign < 0;
    ctx.strokeStyle = "#b7c8dc";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(110, 183, 255, .52)";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.moveTo(x + 7, axisY - height / 2);
    ctx.quadraticCurveTo(x + (concave ? -8 : 24), axisY, x + 7, axisY + height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = concave ? "#6085aa" : "#7f9dbd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, axisY - height / 2 + 5);
    ctx.lineTo(x + 12, axisY + height / 2 - 5);
    ctx.stroke();
  } else {
    const convex = system.focalSign > 0;
    const halfHeight = height / 2;
    const edge = convex ? 5 : 11;
    const center = convex ? 16 : 4;
    ctx.beginPath();
    ctx.moveTo(x - edge, axisY - halfHeight);
    ctx.quadraticCurveTo(x - center, axisY, x - edge, axisY + halfHeight);
    ctx.lineTo(x + edge, axisY + halfHeight);
    ctx.quadraticCurveTo(x + center, axisY, x + edge, axisY - halfHeight);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    gradient.addColorStop(0, "rgba(93, 166, 230, .11)");
    gradient.addColorStop(.5, "rgba(115, 193, 255, .28)");
    gradient.addColorStop(1, "rgba(93, 166, 230, .11)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "#76b7ed";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(91, 177, 255, .42)";
    ctx.shadowBlur = 8;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRaySegment(ctx, x1, y1, x2, y2, options = {}) {
  ctx.save();
  ctx.strokeStyle = options.color || "#65baff";
  ctx.lineWidth = options.width || 1.8;
  ctx.globalAlpha = options.alpha === undefined ? 0.9 : options.alpha;
  ctx.setLineDash(options.dashed ? [6, 5] : []);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawLineThrough(ctx, startX, startY, endX, endY, left, right, options = {}) {
  const dx = endX - startX;
  if (Math.abs(dx) < 1e-9) return;
  const slope = (endY - startY) / dx;
  const x1 = options.startX === undefined ? left : options.startX;
  const x2 = options.endX === undefined ? right : options.endX;
  drawRaySegment(ctx, x1, startY + slope * (x1 - startX), x2, startY + slope * (x2 - startX), options);
}

function drawRays(ctx, setup, transform, axisY, objectHeightPx) {
  const { system, u, v, magnification, atInfinity } = setup;
  const { originX, scale, left, right } = transform;
  const objectX = originX + u * scale;
  const tipY = axisY - objectHeightPx;
  const surfaceX = originX;
  const imageX = atInfinity ? null : originX + v * scale;
  const imageTipY = atInfinity
    ? null
    : axisY - objectHeightPx * magnification;
  const rayColor = "#65baff";

  if (system.kind === "lens") {
    drawRaySegment(ctx, objectX, tipY, surfaceX, tipY, { color: rayColor });
    if (atInfinity) {
      const slope = -objectHeightPx / setup.f;
      drawRaySegment(ctx, surfaceX, tipY, right, tipY + slope * (right - surfaceX), { color: rayColor });
    } else {
      if (v < 0) {
        drawLineThrough(ctx, surfaceX, tipY, imageX, imageTipY, imageX, surfaceX, {
          color: rayColor, dashed: true, alpha: .58, width: 1.5
        });
      }
      drawLineThrough(ctx, surfaceX, tipY, imageX, imageTipY, surfaceX, right, { color: rayColor });
    }

    drawLineThrough(ctx, objectX, tipY, surfaceX, axisY, left, surfaceX, {
      color: "#91cfff", alpha: .75, width: 1.6
    });
    drawLineThrough(ctx, objectX, tipY, surfaceX, axisY, surfaceX, right, {
      color: "#91cfff", alpha: .75, width: 1.6
    });
    if (!atInfinity && v < 0) {
      drawLineThrough(ctx, objectX, tipY, surfaceX, axisY, imageX, surfaceX, {
        color: "#91cfff", dashed: true, alpha: .58, width: 1.5
      });
    }
    return;
  }

  const c = 2 * setup.f;
  const cX = originX + c * scale;
  const denom = u - c;
  const hitY = Math.abs(denom) < 1e-9 ? axisY : tipY + (axisY - tipY) * ((0 - u) / (c - u));

  drawRaySegment(ctx, objectX, tipY, surfaceX, tipY, { color: rayColor });
  if (atInfinity) {
    drawRaySegment(ctx, surfaceX, tipY, left, tipY, { color: rayColor });
  } else {
    if (v > 0) {
      drawLineThrough(ctx, surfaceX, tipY, imageX, imageTipY, surfaceX, imageX, {
        color: rayColor, dashed: true, alpha: .58, width: 1.5
      });
    }
    drawLineThrough(ctx, surfaceX, tipY, imageX, imageTipY, left, surfaceX, { color: rayColor });
  }

  drawLineThrough(ctx, objectX, tipY, cX, axisY, objectX, surfaceX, {
    color: "#91cfff", alpha: .75, width: 1.6
  });
  drawRaySegment(ctx, surfaceX, hitY, cX, axisY, {
    color: "#91cfff", alpha: .75, width: 1.6
  });
  if (!atInfinity) {
    drawLineThrough(ctx, surfaceX, hitY, imageX, imageTipY, left, surfaceX, {
      color: "#91cfff", alpha: .75, width: 1.6
    });
    if (v > 0) {
      drawLineThrough(ctx, surfaceX, hitY, imageX, imageTipY, surfaceX, imageX, {
        color: "#91cfff", dashed: true, alpha: .58, width: 1.5
      });
    }
  }
}

function draw() {
  if (!canvasWidth || !canvasHeight) return;
  const setup = getSetup();
  const { system, u, f, v, magnification, atInfinity } = setup;
  const width = canvasWidth;
  const height = canvasHeight;
  const axisY = Math.round(height * .53);
  const margin = 36;
  const focalDistance = Math.abs(f);
  const imageExtent = atInfinity ? 0 : Math.abs(v);
  const objectHeight = 10;
  const virtualImageHeight = atInfinity ? 0 : objectHeight * Math.abs(magnification);
  const leftExtent = Math.max(
    Math.abs(u),
    system.kind === "mirror" && f < 0 ? Math.abs(2 * f) : 0,
    system.kind === "lens" && f > 0 ? 2 * focalDistance : 0,
    system.kind === "mirror" && v < 0 ? imageExtent : 0,
    system.kind === "lens" && v < 0 ? imageExtent : 0,
    28
  ) + 12;
  const rightExtent = Math.max(
    system.kind === "mirror" && f > 0 ? Math.abs(2 * f) : 0,
    system.kind === "lens" ? 2 * focalDistance : 0,
    !atInfinity && v > 0 ? imageExtent : 0,
    24
  ) + 12;
  const worldRange = leftExtent + rightExtent;
  const pxPerCm = Math.min(
    (width - margin * 2) / worldRange,
    (height - 82) / Math.max(2 * virtualImageHeight + 20, 2 * objectHeight + 20)
  );
  const scale = Number.isFinite(pxPerCm) && pxPerCm > 0 ? pxPerCm : 1;
  const originX = margin + leftExtent * scale;
  const left = margin;
  const right = width - margin;
  const transform = { originX, scale, left, right };
  const objectX = originX + u * scale;
  const objectHeightPx = objectHeight * scale;

  context.clearRect(0, 0, width, height);
  context.save();
  context.strokeStyle = "rgba(116, 145, 180, .23)";
  context.lineWidth = 1;
  context.setLineDash([2, 7]);
  for (let x = margin; x < right; x += 32) {
    context.beginPath();
    context.moveTo(x, 24);
    context.lineTo(x, height - 23);
    context.stroke();
  }
  context.restore();

  context.save();
  context.strokeStyle = "#62748e";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(left, axisY);
  context.lineTo(right, axisY);
  context.stroke();
  context.fillStyle = "#778aa5";
  context.beginPath();
  context.moveTo(right, axisY);
  context.lineTo(right - 8, axisY - 4);
  context.lineTo(right - 8, axisY + 4);
  context.closePath();
  context.fill();
  context.restore();

  if (system.kind === "mirror") {
    drawTick(context, originX + f * scale, axisY, "F", "#9eb0c8", true);
    drawTick(context, originX + 2 * f * scale, axisY, "C", "#8397b3", false);
  } else {
    const nearF = -focalDistance;
    const farF = focalDistance;
    drawTick(context, originX + nearF * scale, axisY, "F₁", "#9eb0c8", true);
    drawTick(context, originX + 2 * nearF * scale, axisY, "2F₁", "#8397b3", false);
    drawTick(context, originX + farF * scale, axisY, "F₂", "#9eb0c8", true);
    drawTick(context, originX + 2 * farF * scale, axisY, "2F₂", "#8397b3", false);
  }

  drawElement(context, originX, axisY, system, Math.min(height * .37, 150));
  drawTick(context, originX, axisY, system.kind === "mirror" ? "P" : "O", "#c3d0e0", true);
  drawArrow(context, objectX, axisY, objectHeightPx, "#67e8a5", "Object", 3);

  if (isRunning) {
    drawRays(context, setup, transform, axisY, objectHeightPx);
    if (!atInfinity) {
      drawArrow(
        context,
        originX + v * scale,
        axisY,
        objectHeightPx * magnification,
        "#f27bcb",
        "Image",
        2.5
      );
    }
  }
}

function update() {
  const setup = getSetup();
  updateReadings(setup);
  systemState.dataset.active = String(isRunning);
  stateLabel.textContent = isRunning ? "SIMULATION ON" : "SIMULATION OFF";
  toggleButton.classList.toggle("is-running", isRunning);
  toggleButton.setAttribute("aria-pressed", String(isRunning));
  toggleLabel.textContent = isRunning ? "SWITCH OFF" : "START SIMULATION";
  draw();
}

systemSelect.addEventListener("change", update);
objectDistanceInput.addEventListener("input", update);
focalLengthInput.addEventListener("input", update);

toggleButton.addEventListener("click", () => {
  isRunning = !isRunning;
  update();
});

resetButton.addEventListener("click", () => {
  systemSelect.value = defaults.system;
  objectDistanceInput.value = String(defaults.objectDistance);
  focalLengthInput.value = String(defaults.focalLength);
  isRunning = false;
  update();
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvas);
update();
