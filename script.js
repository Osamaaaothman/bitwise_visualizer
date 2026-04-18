const state = {
  size: 16,
  operation: "AND",
  stepMode: false,
  speedLevel: 2,
  isDrawing: false,
  drawValue: 1,
  drawGrid: "A",
  syncMode: false,
  showGridLines: true,
  showNumbers: true,
  showBinary: true,
  showColumns: false,
  animating: false,
  gridEventsBound: false,
  onboardingIndex: 0,
  grids: {
    A: new Uint8Array(16 * 16),
    B: new Uint8Array(16 * 16),
    R: new Uint8Array(16 * 16)
  },
  domCells: {
    A: [],
    B: [],
    R: []
  }
};

const ui = {
  root: document.body,
  gridSize: document.getElementById("gridSize"),
  operationSelect: document.getElementById("operationSelect"),
  applyBtn: document.getElementById("applyBtn"),
  operatorHint: document.getElementById("operatorHint"),
  stepMode: document.getElementById("stepMode"),
  speedControl: document.getElementById("speedControl"),
  speedLabel: document.getElementById("speedLabel"),
  toggleGridLines: document.getElementById("toggleGridLines"),
  toggleNumbers: document.getElementById("toggleNumbers"),
  toggleBinary: document.getElementById("toggleBinary"),
  toggleColumns: document.getElementById("toggleColumns"),
  syncMode: document.getElementById("syncMode"),
  shapeTarget: document.getElementById("shapeTarget"),
  shapeButtons: document.querySelectorAll(".shape-btn"),
  copyAToB: document.getElementById("copyAToB"),
  ioData: document.getElementById("ioData"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  exportPngA: document.getElementById("exportPngA"),
  exportPngB: document.getElementById("exportPngB"),
  exportPngR: document.getElementById("exportPngR"),
  exportPngAll: document.getElementById("exportPngAll"),
  onboardingBtn: document.getElementById("onboardingBtn"),
  onboardingOverlay: document.getElementById("onboardingOverlay"),
  onboardingClose: document.getElementById("onboardingClose"),
  onboardingStep: document.getElementById("onboardingStep"),
  onboardingTitle: document.getElementById("onboardingTitle"),
  onboardingText: document.getElementById("onboardingText"),
  onboardingPrev: document.getElementById("onboardingPrev"),
  onboardingNext: document.getElementById("onboardingNext"),
  onboardingDone: document.getElementById("onboardingDone"),
  statusBar: document.getElementById("statusBar"),
  gridNodes: {
    A: document.getElementById("gridA"),
    B: document.getElementById("gridB"),
    R: document.getElementById("gridR")
  },
  rows: {
    A: document.getElementById("rowsA"),
    B: document.getElementById("rowsB"),
    R: document.getElementById("rowsR")
  },
  cols: {
    A: document.getElementById("colsA"),
    B: document.getElementById("colsB"),
    R: document.getElementById("colsR")
  },
  traceTooltip: document.getElementById("traceTooltip")
};

const OPERATOR_HINTS = {
  AND: "AND: 1 فقط عندما تكون القيمتان 1",
  OR: "OR: 1 عندما تكون واحدة على الأقل 1",
  XOR: "XOR: 1 عندما تكون القيمتان مختلفتين",
  NOT: "NOT: عكس القيمة 0↔1 (يطبّق على Grid A فقط)"
};

const SPEED_MAP = {
  1: { label: "بطيء", delay: 620 },
  2: { label: "متوسط", delay: 260 },
  3: { label: "سريع", delay: 90 }
};

const GRID_KEYS = ["A", "B", "R"];

const ONBOARDING_STEPS = [
  {
    target: ".controls",
    title: "لوحة التحكم الرئيسية",
    text: "من هنا تختار حجم الشبكة، العملية البتّية، وتفعّل وضع الخطوات مع السرعة المناسبة."
  },
  {
    target: "#gridA",
    title: "Grid A",
    text: "ارسم بالنقر أو بالسحب لتكوين الصورة الثنائية الأولى. الأبيض = 1 والأسود = 0."
  },
  {
    target: "#gridB",
    title: "Grid B",
    text: "استخدم الشبكة الثانية للمقارنة، أو انسخ A إلى B بسرعة عبر زر النسخ أو الاختصار C."
  },
  {
    target: "#gridR",
    title: "Grid Result",
    text: "بعد التطبيق ستظهر النتيجة هنا. حرّك المؤشر على أي بكسل لرؤية أثر الحساب على A وB."
  },
  {
    target: ".shortcut-hints",
    title: "اختصارات لوحة المفاتيح",
    text: "A للتطبيق، R لإعادة ضبط الكل، I لعكس A، C للنسخ، S لتبديل المزامنة، و? للمساعدة."
  },
  {
    target: ".io-area",
    title: "تصدير واستيراد",
    text: "صدّر الحالة بصيغة JSON أو كصور PNG لكل شبكة أو صورة مجمعة للثلاث شبكات."
  }
];

function createGrid(size) {
  state.size = size;
  const total = size * size;
  state.grids.A = new Uint8Array(total);
  state.grids.B = new Uint8Array(total);
  state.grids.R = new Uint8Array(total);
  state.domCells.A = [];
  state.domCells.B = [];
  state.domCells.R = [];

  GRID_KEYS.forEach((key) => {
    const host = ui.gridNodes[key];
    host.innerHTML = "";
    host.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    for (let i = 0; i < total; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "pixel off";
      cell.textContent = "0";
      cell.dataset.grid = key;
      cell.dataset.index = String(i);
      const x = i % size;
      const y = Math.floor(i / size);
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      state.domCells[key].push(cell);
      host.appendChild(cell);
    }
  });

  if (!state.gridEventsBound) {
    bindGridEvents();
    state.gridEventsBound = true;
  }
  applyVisualToggles();
  renderAll();
  setStatus(`تم إنشاء شبكة ${size}x${size}`);
}

function togglePixel(cell, forcedValue = null) {
  const gridKey = cell.dataset.grid;
  if (!gridKey || gridKey === "R") {
    return;
  }

  const index = Number(cell.dataset.index);
  const current = state.grids[gridKey][index];
  const next = forcedValue === null ? (current ? 0 : 1) : forcedValue;
  state.grids[gridKey][index] = next;
  renderPixel(gridKey, index);

  if (state.syncMode && gridKey === "A") {
    state.grids.B[index] = next;
    renderPixel("B", index);
  }

  if (state.operation === "NOT") {
    applyOperation("NOT", true);
  }

  updateBinaryViews();
}

function renderPixel(gridKey, index) {
  const value = state.grids[gridKey][index];
  const cell = state.domCells[gridKey][index];
  if (!cell) {
    return;
  }
  cell.classList.toggle("on", value === 1);
  cell.classList.toggle("off", value === 0);
  cell.textContent = value ? "1" : "0";
}

function renderAll() {
  GRID_KEYS.forEach((key) => {
    const total = state.grids[key].length;
    for (let i = 0; i < total; i += 1) {
      renderPixel(key, i);
    }
  });
  updateBinaryViews();
}

function clearHighlights() {
  GRID_KEYS.forEach((key) => {
    state.domCells[key].forEach((cell) => {
      cell.classList.remove("active-source", "active-result");
    });
  });
}

function applyOperation(op = state.operation, silent = false) {
  if (state.animating) {
    return;
  }

  if (state.stepMode) {
    runStepMode(op);
    return;
  }

  const total = state.size * state.size;
  for (let i = 0; i < total; i += 1) {
    const a = state.grids.A[i];
    const b = state.grids.B[i];
    state.grids.R[i] = computeOperation(op, a, b);
    renderPixel("R", i);
  }
  updateBinaryViews();

  if (!silent) {
    setStatus(`تم تطبيق ${op} على جميع البكسلات.`);
  }
}

function computeOperation(op, a, b) {
  if (op === "AND") {
    return a & b;
  }
  if (op === "OR") {
    return a | b;
  }
  if (op === "XOR") {
    return a ^ b;
  }
  if (op === "NOT") {
    return a ? 0 : 1;
  }
  return 0;
}

async function runStepMode(op) {
  state.animating = true;
  ui.applyBtn.disabled = true;
  setStatus("وضع الخطوات: يتم الحساب تدريجيًا...");
  clearHighlights();

  const total = state.size * state.size;
  const delay = SPEED_MAP[state.speedLevel].delay;

  for (let i = 0; i < total; i += 1) {
    const a = state.grids.A[i];
    const b = state.grids.B[i];
    const result = computeOperation(op, a, b);
    state.grids.R[i] = result;
    renderPixel("R", i);
    animateStep(i, op, a, b, result);
    updateTraceTooltip(op, i, a, b, result);

    // eslint-disable-next-line no-await-in-loop
    await sleep(delay);
  }

  clearHighlights();
  hideTraceTooltip();
  ui.applyBtn.disabled = false;
  state.animating = false;
  updateBinaryViews();
  setStatus(`اكتمل تطبيق ${op} بنمط الخطوات.`);
}

function animateStep(index, op, a, b, result) {
  clearHighlights();
  const cellA = state.domCells.A[index];
  const cellB = state.domCells.B[index];
  const cellR = state.domCells.R[index];
  if (cellA) {
    cellA.classList.add("active-source");
  }
  if (cellB && op !== "NOT") {
    cellB.classList.add("active-source");
  }
  if (cellR) {
    cellR.classList.add("active-result", "step-reveal");
    window.setTimeout(() => cellR.classList.remove("step-reveal"), 280);
  }
  updateTraceTooltip(op, index, a, b, result);
}

function highlightSource(x, y) {
  const index = y * state.size + x;
  clearHighlights();

  const cellA = state.domCells.A[index];
  const cellB = state.domCells.B[index];
  const cellR = state.domCells.R[index];
  if (cellA) {
    cellA.classList.add("active-source");
  }
  if (cellB && state.operation !== "NOT") {
    cellB.classList.add("active-source");
  }
  if (cellR) {
    cellR.classList.add("active-result");
  }

  const a = state.grids.A[index];
  const b = state.grids.B[index];
  const r = state.grids.R[index];
  updateTraceTooltip(state.operation, index, a, b, r);
}

function updateTraceTooltip(op, index, a, b, result) {
  const x = index % state.size;
  const y = Math.floor(index / state.size);
  const expression = op === "NOT" ? `~${a} = ${result}` : `${a} ${symbolFor(op)} ${b} = ${result}`;
  ui.traceTooltip.textContent = `(${x}, ${y})  ${expression}`;
  ui.traceTooltip.classList.add("show");
}

function hideTraceTooltip() {
  ui.traceTooltip.classList.remove("show");
}

function symbolFor(op) {
  if (op === "AND") {
    return "&";
  }
  if (op === "OR") {
    return "|";
  }
  if (op === "XOR") {
    return "^";
  }
  if (op === "NOT") {
    return "~";
  }
  return "?";
}

function generateShape(type, target = ui.shapeTarget.value) {
  const key = target === "B" ? "B" : "A";
  const size = state.size;
  const arr = state.grids[key];
  arr.fill(0);

  if (type === "square") {
    const start = Math.floor(size * 0.2);
    const end = Math.ceil(size * 0.8);
    for (let y = start; y < end; y += 1) {
      for (let x = start; x < end; x += 1) {
        arr[y * size + x] = 1;
      }
    }
  }

  if (type === "diagonal") {
    for (let i = 0; i < size; i += 1) {
      arr[i * size + i] = 1;
      const anti = size - 1 - i;
      if (anti !== i) {
        arr[i * size + anti] = 1;
      }
    }
  }

  if (type === "circle") {
    const c = (size - 1) / 2;
    const r = size * 0.33;
    const rr = r * r;
    const inner = (r - 1.5) * (r - 1.5);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - c;
        const dy = y - c;
        const d = dx * dx + dy * dy;
        if (d <= rr && d >= inner) {
          arr[y * size + x] = 1;
        }
      }
    }
  }

  for (let i = 0; i < arr.length; i += 1) {
    renderPixel(key, i);
  }
  if (state.operation === "NOT") {
    applyOperation("NOT", true);
  }
  updateBinaryViews();
  setStatus(`تم توليد شكل ${type} في Grid ${key}.`);
}

function invertGrid(key) {
  const arr = state.grids[key];
  for (let i = 0; i < arr.length; i += 1) {
    arr[i] = arr[i] ? 0 : 1;
    renderPixel(key, i);
  }
  if (state.operation === "NOT" && key === "A") {
    applyOperation("NOT", true);
  }
  updateBinaryViews();
  setStatus(`تم عكس Grid ${key}.`);
}

function resetGrid(key) {
  state.grids[key].fill(0);
  for (let i = 0; i < state.grids[key].length; i += 1) {
    renderPixel(key, i);
  }
  updateBinaryViews();
  setStatus(`تمت إعادة ضبط Grid ${key}.`);
}

function copyGridAToB() {
  state.grids.B.set(state.grids.A);
  for (let i = 0; i < state.grids.B.length; i += 1) {
    renderPixel("B", i);
  }
  updateBinaryViews();
  setStatus("تم نسخ محتوى Grid A إلى Grid B.");
}

function resetAllGrids() {
  GRID_KEYS.forEach((key) => {
    state.grids[key].fill(0);
    for (let i = 0; i < state.grids[key].length; i += 1) {
      renderPixel(key, i);
    }
  });
  updateBinaryViews();
  setStatus("تمت إعادة ضبط جميع الشبكات.");
}

function exportGridAsPNG(gridKey) {
  const size = state.size;
  const cellSize = Math.max(8, Math.floor(640 / size));
  const padding = 14;
  const width = size * cellSize + padding * 2;
  const height = size * cellSize + padding * 2 + 26;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a1220";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#d9e6ff";
  ctx.font = "600 16px Segoe UI";
  ctx.fillText(`Grid ${gridKey}`, padding, 18);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const value = state.grids[gridKey][index];
      const px = padding + x * cellSize;
      const py = padding + 12 + y * cellSize;

      ctx.fillStyle = value ? "#f5f7fb" : "#0d0f14";
      ctx.fillRect(px, py, cellSize - 1, cellSize - 1);

      if (cellSize >= 10) {
        ctx.fillStyle = value ? "#061021" : "#e4edff";
        ctx.font = `${Math.max(8, Math.floor(cellSize * 0.45))}px Consolas`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(value ? "1" : "0", px + (cellSize - 1) / 2, py + (cellSize - 1) / 2);
      }
    }
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `bitwise-grid-${gridKey.toLowerCase()}-${state.size}x${state.size}.png`;
  link.click();
}

function exportAllAsPNG() {
  const size = state.size;
  const cellSize = Math.max(6, Math.floor(500 / size));
  const gridWidth = size * cellSize;
  const blockPadding = 12;
  const titleH = 24;
  const sectionGap = 18;
  const width = blockPadding * 2 + gridWidth * 3 + sectionGap * 2;
  const height = blockPadding * 2 + titleH + gridWidth;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a1220";
  ctx.fillRect(0, 0, width, height);

  const order = ["A", "B", "R"];
  order.forEach((gridKey, idx) => {
    const offsetX = blockPadding + idx * (gridWidth + sectionGap);
    const offsetY = blockPadding + titleH;

    ctx.fillStyle = "#d9e6ff";
    ctx.font = "600 15px Segoe UI";
    ctx.textAlign = "start";
    ctx.fillText(`Grid ${gridKey}`, offsetX, blockPadding + 16);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = y * size + x;
        const value = state.grids[gridKey][index];
        const px = offsetX + x * cellSize;
        const py = offsetY + y * cellSize;
        ctx.fillStyle = value ? "#f5f7fb" : "#0d0f14";
        ctx.fillRect(px, py, cellSize - 1, cellSize - 1);
      }
    }
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `bitwise-all-${state.size}x${state.size}.png`;
  link.click();
}

function updateBinaryViews() {
  if (!state.showBinary) {
    return;
  }

  GRID_KEYS.forEach((key) => {
    const rowStrings = [];
    for (let y = 0; y < state.size; y += 1) {
      let row = "";
      const base = y * state.size;
      for (let x = 0; x < state.size; x += 1) {
        row += state.grids[key][base + x] ? "1" : "0";
      }
      rowStrings.push(row);
    }
    ui.rows[key].textContent = rowStrings.join("\n");

    if (state.showColumns) {
      const colStrings = [];
      for (let x = 0; x < state.size; x += 1) {
        let col = "";
        for (let y = 0; y < state.size; y += 1) {
          col += state.grids[key][y * state.size + x] ? "1" : "0";
        }
        colStrings.push(col);
      }
      ui.cols[key].textContent = colStrings.join("\n");
    } else {
      ui.cols[key].textContent = "";
    }
  });
}

function exportGrid() {
  const payload = {
    size: state.size,
    operation: state.operation,
    stepMode: state.stepMode,
    speedLevel: state.speedLevel,
    syncMode: state.syncMode,
    grids: {
      A: Array.from(state.grids.A),
      B: Array.from(state.grids.B),
      R: Array.from(state.grids.R)
    }
  };
  ui.ioData.value = JSON.stringify(payload, null, 2);
  setStatus("تم تصدير الحالة بصيغة JSON.");
}

function importGrid() {
  let parsed;
  try {
    parsed = JSON.parse(ui.ioData.value);
  } catch (error) {
    setStatus("فشل الاستيراد: تنسيق JSON غير صحيح.");
    return;
  }

  if (!parsed || !parsed.size || !parsed.grids || !parsed.grids.A || !parsed.grids.B || !parsed.grids.R) {
    setStatus("فشل الاستيراد: بيانات ناقصة.");
    return;
  }

  if (![16, 32, 64].includes(parsed.size)) {
    setStatus("فشل الاستيراد: حجم الشبكة يجب أن يكون 16 أو 32 أو 64.");
    return;
  }

  createGrid(parsed.size);
  ui.gridSize.value = String(parsed.size);

  GRID_KEYS.forEach((key) => {
    const source = parsed.grids[key];
    if (!Array.isArray(source) || source.length !== state.size * state.size) {
      return;
    }
    for (let i = 0; i < source.length; i += 1) {
      state.grids[key][i] = source[i] ? 1 : 0;
    }
  });

  state.operation = ["AND", "OR", "XOR", "NOT"].includes(parsed.operation) ? parsed.operation : "AND";
  state.stepMode = Boolean(parsed.stepMode);
  state.syncMode = Boolean(parsed.syncMode);
  state.speedLevel = [1, 2, 3].includes(parsed.speedLevel) ? parsed.speedLevel : 2;

  ui.operationSelect.value = state.operation;
  ui.stepMode.checked = state.stepMode;
  ui.syncMode.checked = state.syncMode;
  ui.speedControl.value = String(state.speedLevel);
  ui.speedLabel.textContent = SPEED_MAP[state.speedLevel].label;
  ui.operatorHint.textContent = OPERATOR_HINTS[state.operation];

  applyOperationModeClass();
  renderAll();
  setStatus("تم الاستيراد بنجاح.");
}

function setStatus(message) {
  ui.statusBar.textContent = message;
}

function bindGridEvents() {
  GRID_KEYS.forEach((key) => {
    const node = ui.gridNodes[key];
    node.addEventListener("pointerdown", onGridPointerDown);
    node.addEventListener("pointermove", onGridPointerMove);
    node.addEventListener("pointerup", onGridPointerUp);
    node.addEventListener("pointerleave", onGridPointerLeave);
  });

  ui.gridNodes.R.addEventListener("pointermove", onResultHover);
  ui.gridNodes.R.addEventListener("pointerdown", onResultHover);
  ui.gridNodes.R.addEventListener("pointerleave", () => {
    clearHighlights();
    hideTraceTooltip();
  });

  document.addEventListener("pointerup", onGridPointerUp);
}

function onGridPointerDown(event) {
  const cell = event.target.closest(".pixel");
  if (!cell) {
    return;
  }
  if (cell.dataset.grid === "R") {
    return;
  }

  event.preventDefault();
  state.isDrawing = true;
  state.drawGrid = cell.dataset.grid;
  const index = Number(cell.dataset.index);
  const current = state.grids[state.drawGrid][index];
  state.drawValue = current ? 0 : 1;

  togglePixel(cell, state.drawValue);
}

function onGridPointerMove(event) {
  if (!state.isDrawing) {
    return;
  }
  const cell = event.target.closest(".pixel");
  if (!cell || cell.dataset.grid === "R") {
    return;
  }
  if (cell.dataset.grid !== state.drawGrid) {
    return;
  }
  togglePixel(cell, state.drawValue);
}

function onGridPointerUp() {
  state.isDrawing = false;
}

function onGridPointerLeave(event) {
  const related = event.relatedTarget;
  if (!related || !related.closest || !related.closest(".pixel-grid")) {
    state.isDrawing = false;
  }
}

function onResultHover(event) {
  const cell = event.target.closest(".pixel");
  if (!cell) {
    return;
  }
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  highlightSource(x, y);
}

function applyVisualToggles() {
  GRID_KEYS.forEach((key) => {
    ui.gridNodes[key].classList.toggle("no-lines", !state.showGridLines);
  });

  ui.root.classList.toggle("hide-numbers", !state.showNumbers);
  ui.root.classList.toggle("hide-binary", !state.showBinary);
  ui.root.classList.toggle("hide-columns", !state.showColumns);
}

function applyOperationModeClass() {
  ui.root.classList.toggle("not-mode", state.operation === "NOT");
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function openOnboarding(startIndex = 0) {
  state.onboardingIndex = Math.min(Math.max(startIndex, 0), ONBOARDING_STEPS.length - 1);
  ui.onboardingOverlay.classList.add("show");
  ui.onboardingOverlay.setAttribute("aria-hidden", "false");
  renderOnboardingStep();
}

function closeOnboarding() {
  ui.onboardingOverlay.classList.remove("show");
  ui.onboardingOverlay.setAttribute("aria-hidden", "true");
  clearOnboardingFocus();
}

function clearOnboardingFocus() {
  document.querySelectorAll(".tour-focus").forEach((node) => {
    node.classList.remove("tour-focus");
  });
}

function renderOnboardingStep() {
  clearOnboardingFocus();
  const step = ONBOARDING_STEPS[state.onboardingIndex];
  if (!step) {
    closeOnboarding();
    return;
  }

  const target = document.querySelector(step.target);
  if (target) {
    target.classList.add("tour-focus");
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  ui.onboardingStep.textContent = `الخطوة ${state.onboardingIndex + 1} من ${ONBOARDING_STEPS.length}`;
  ui.onboardingTitle.textContent = step.title;
  ui.onboardingText.textContent = step.text;

  ui.onboardingPrev.disabled = state.onboardingIndex === 0;
  ui.onboardingNext.disabled = state.onboardingIndex === ONBOARDING_STEPS.length - 1;
}

function nextOnboarding() {
  if (state.onboardingIndex < ONBOARDING_STEPS.length - 1) {
    state.onboardingIndex += 1;
    renderOnboardingStep();
  }
}

function prevOnboarding() {
  if (state.onboardingIndex > 0) {
    state.onboardingIndex -= 1;
    renderOnboardingStep();
  }
}

function handleKeyboardShortcuts(event) {
  const target = event.target;
  const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  if (isTyping) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "a") {
    event.preventDefault();
    applyOperation(state.operation);
    return;
  }

  if (key === "r") {
    event.preventDefault();
    resetAllGrids();
    return;
  }

  if (key === "i") {
    event.preventDefault();
    invertGrid("A");
    return;
  }

  if (key === "c") {
    event.preventDefault();
    copyGridAToB();
    return;
  }

  if (key === "s") {
    event.preventDefault();
    state.syncMode = !state.syncMode;
    ui.syncMode.checked = state.syncMode;
    setStatus(state.syncMode ? "مزامنة الرسم مفعّلة." : "مزامنة الرسم معطّلة.");
    return;
  }

  if (event.key === "?") {
    event.preventDefault();
    openOnboarding(0);
    return;
  }

  if (event.key === "Escape" && ui.onboardingOverlay.classList.contains("show")) {
    event.preventDefault();
    closeOnboarding();
  }
}

function setupEvents() {
  ui.gridSize.addEventListener("change", () => {
    const size = Number(ui.gridSize.value);
    createGrid(size);
  });

  ui.operationSelect.addEventListener("change", () => {
    state.operation = ui.operationSelect.value;
    ui.operatorHint.textContent = OPERATOR_HINTS[state.operation];
    applyOperationModeClass();
    if (state.operation === "NOT") {
      applyOperation("NOT", true);
    }
  });

  ui.applyBtn.addEventListener("click", () => {
    applyOperation(state.operation);
  });

  ui.stepMode.addEventListener("change", () => {
    state.stepMode = ui.stepMode.checked;
    setStatus(state.stepMode ? "تم تفعيل وضع الخطوات." : "تم إيقاف وضع الخطوات.");
  });

  ui.speedControl.addEventListener("input", () => {
    state.speedLevel = Number(ui.speedControl.value);
    ui.speedLabel.textContent = SPEED_MAP[state.speedLevel].label;
  });

  ui.toggleGridLines.addEventListener("change", () => {
    state.showGridLines = ui.toggleGridLines.checked;
    applyVisualToggles();
  });

  ui.toggleNumbers.addEventListener("change", () => {
    state.showNumbers = ui.toggleNumbers.checked;
    applyVisualToggles();
  });

  ui.toggleBinary.addEventListener("change", () => {
    state.showBinary = ui.toggleBinary.checked;
    applyVisualToggles();
    updateBinaryViews();
  });

  ui.toggleColumns.addEventListener("change", () => {
    state.showColumns = ui.toggleColumns.checked;
    applyVisualToggles();
    updateBinaryViews();
  });

  ui.syncMode.addEventListener("change", () => {
    state.syncMode = ui.syncMode.checked;
    setStatus(state.syncMode ? "مزامنة الرسم مفعّلة." : "مزامنة الرسم معطّلة.");
  });

  ui.shapeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      generateShape(btn.dataset.shape);
    });
  });

  ui.copyAToB.addEventListener("click", copyGridAToB);

  document.querySelectorAll("[data-action='reset']").forEach((btn) => {
    btn.addEventListener("click", () => {
      resetGrid(btn.dataset.grid);
    });
  });

  document.querySelectorAll("[data-action='invert']").forEach((btn) => {
    btn.addEventListener("click", () => {
      invertGrid(btn.dataset.grid);
    });
  });

  ui.exportBtn.addEventListener("click", exportGrid);
  ui.importBtn.addEventListener("click", importGrid);
  ui.exportPngA.addEventListener("click", () => {
    exportGridAsPNG("A");
    setStatus("تم تصدير PNG للشبكة A.");
  });
  ui.exportPngB.addEventListener("click", () => {
    exportGridAsPNG("B");
    setStatus("تم تصدير PNG للشبكة B.");
  });
  ui.exportPngR.addEventListener("click", () => {
    exportGridAsPNG("R");
    setStatus("تم تصدير PNG لشبكة الناتج.");
  });
  ui.exportPngAll.addEventListener("click", () => {
    exportAllAsPNG();
    setStatus("تم تصدير PNG مجمّع للشبكات الثلاث.");
  });

  ui.onboardingBtn.addEventListener("click", () => {
    openOnboarding(0);
  });
  ui.onboardingClose.addEventListener("click", closeOnboarding);
  ui.onboardingDone.addEventListener("click", closeOnboarding);
  ui.onboardingNext.addEventListener("click", nextOnboarding);
  ui.onboardingPrev.addEventListener("click", prevOnboarding);
  ui.onboardingOverlay.addEventListener("click", (event) => {
    if (event.target === ui.onboardingOverlay) {
      closeOnboarding();
    }
  });

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function init() {
  setupEvents();
  createGrid(16);
  ui.operatorHint.textContent = OPERATOR_HINTS[state.operation];
  ui.speedLabel.textContent = SPEED_MAP[state.speedLevel].label;
  applyOperationModeClass();
  setStatus("جاهز للرسم والتجربة.");
}

init();
