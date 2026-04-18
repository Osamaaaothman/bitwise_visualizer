const state = {
  size: 16,
  operation: "AND",
  isDrawing: false,
  drawGrid: "A",
  drawValue: 1,
  showNumbers: true,
  grids: {
    A: new Uint8Array(16 * 16),
    B: new Uint8Array(16 * 16),
    R: new Uint8Array(16 * 16)
  },
  cells: {
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
  clearBtn: document.getElementById("clearBtn"),
  copyAToB: document.getElementById("copyAToB"),
  toggleNumbers: document.getElementById("toggleNumbers"),
  shapeTarget: document.getElementById("shapeTarget"),
  shapeButtons: document.querySelectorAll(".shape-btn"),
  operatorHint: document.getElementById("operatorHint"),
  statusBar: document.getElementById("statusBar"),
  exportPngR: document.getElementById("exportPngR"),
  trace: document.getElementById("traceTooltip"),
  grids: {
    A: document.getElementById("gridA"),
    B: document.getElementById("gridB"),
    R: document.getElementById("gridR")
  }
};

const HINTS = {
  AND: "AND: 1 فقط إذا كانت القيمتان 1",
  OR: "OR: 1 إذا كانت واحدة على الأقل 1",
  XOR: "XOR: 1 إذا كانت القيمتان مختلفتين",
  NOT: "NOT: تعكس قيم Grid A فقط"
};

const KEYS = ["A", "B", "R"];

function createGrid(size) {
  state.size = size;
  const total = size * size;
  state.grids.A = new Uint8Array(total);
  state.grids.B = new Uint8Array(total);
  state.grids.R = new Uint8Array(total);
  state.cells.A = [];
  state.cells.B = [];
  state.cells.R = [];

  KEYS.forEach((key) => {
    const host = ui.grids[key];
    host.innerHTML = "";
    host.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    for (let i = 0; i < total; i += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "pixel off";
      cell.textContent = "0";
      cell.dataset.grid = key;
      cell.dataset.index = String(i);
      cell.dataset.x = String(i % size);
      cell.dataset.y = String(Math.floor(i / size));
      host.appendChild(cell);
      state.cells[key].push(cell);
    }
  });

  bindGridEvents();
  renderAll();
  setStatus(`تم إنشاء شبكة ${size}x${size}`);
}

function bindGridEvents() {
  KEYS.forEach((key) => {
    const node = ui.grids[key];
    node.onpointerdown = onPointerDown;
    node.onpointermove = onPointerMove;
    node.onpointerup = stopDrawing;
    node.onpointerleave = stopDrawing;
  });

  ui.grids.R.onpointermove = onResultHover;
  ui.grids.R.onpointerleave = clearTrace;
  document.onpointerup = stopDrawing;
}

function onPointerDown(event) {
  const cell = event.target.closest(".pixel");
  if (!cell || cell.dataset.grid === "R") {
    return;
  }
  event.preventDefault();
  const grid = cell.dataset.grid;
  const index = Number(cell.dataset.index);
  state.isDrawing = true;
  state.drawGrid = grid;
  state.drawValue = state.grids[grid][index] ? 0 : 1;
  togglePixel(cell, state.drawValue);
}

function onPointerMove(event) {
  if (!state.isDrawing) {
    return;
  }
  const cell = event.target.closest(".pixel");
  if (!cell || cell.dataset.grid !== state.drawGrid) {
    return;
  }
  togglePixel(cell, state.drawValue);
}

function stopDrawing() {
  state.isDrawing = false;
}

function togglePixel(cell, force = null) {
  const grid = cell.dataset.grid;
  if (!grid || grid === "R") {
    return;
  }
  const index = Number(cell.dataset.index);
  const current = state.grids[grid][index];
  const next = force === null ? (current ? 0 : 1) : force;
  if (current === next) {
    return;
  }
  state.grids[grid][index] = next;
  renderPixel(grid, index, "draw");

  if (state.operation === "NOT") {
    applyOperation("NOT", true);
  }
}

function playCellAnimation(cell, className) {
  cell.classList.remove(className);
  void cell.offsetWidth;
  cell.classList.add(className);
  window.setTimeout(() => {
    cell.classList.remove(className);
  }, className === "shape-pop" ? 380 : 260);
}

function renderPixel(grid, index, animationType = "", delay = 0) {
  const value = state.grids[grid][index];
  const cell = state.cells[grid][index];
  if (!cell) {
    return;
  }
  cell.classList.toggle("on", value === 1);
  cell.classList.toggle("off", value === 0);
  cell.textContent = value ? "1" : "0";

  if (animationType === "draw") {
    playCellAnimation(cell, "draw-pop");
    return;
  }

  if (animationType === "shape") {
    window.setTimeout(() => {
      playCellAnimation(cell, "shape-pop");
    }, delay);
  }
}

function renderAll() {
  KEYS.forEach((key) => {
    for (let i = 0; i < state.grids[key].length; i += 1) {
      renderPixel(key, i);
    }
  });
}

function compute(op, a, b) {
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

function symbol(op) {
  if (op === "AND") {
    return "&";
  }
  if (op === "OR") {
    return "|";
  }
  if (op === "XOR") {
    return "^";
  }
  return "~";
}

function applyOperation(op = state.operation, silent = false) {
  for (let i = 0; i < state.grids.R.length; i += 1) {
    const a = state.grids.A[i];
    const b = state.grids.B[i];
    state.grids.R[i] = compute(op, a, b);
    renderPixel("R", i);
  }
  if (!silent) {
    setStatus(`تم تطبيق ${op}`);
  }
}

function clearGrid(key) {
  state.grids[key].fill(0);
  for (let i = 0; i < state.grids[key].length; i += 1) {
    renderPixel(key, i);
  }
}

function clearAll() {
  KEYS.forEach(clearGrid);
  setStatus("تم مسح جميع الشبكات");
}

function invertGrid(key) {
  for (let i = 0; i < state.grids[key].length; i += 1) {
    state.grids[key][i] = state.grids[key][i] ? 0 : 1;
    renderPixel(key, i);
  }
  if (state.operation === "NOT" && key === "A") {
    applyOperation("NOT", true);
  }
  setStatus(`تم عكس ${key}`);
}

function copyAToB() {
  state.grids.B.set(state.grids.A);
  for (let i = 0; i < state.grids.B.length; i += 1) {
    renderPixel("B", i);
  }
  setStatus("تم نسخ A إلى B");
}

function generateShape(type, target = ui.shapeTarget.value) {
  const key = target === "B" ? "B" : "A";
  const size = state.size;
  const previous = Uint8Array.from(state.grids[key]);
  state.grids[key].fill(0);

  if (type === "square") {
    const start = Math.floor(size * 0.25);
    const end = Math.ceil(size * 0.75);
    for (let y = start; y < end; y += 1) {
      for (let x = start; x < end; x += 1) {
        state.grids[key][y * size + x] = 1;
      }
    }
  }

  if (type === "diagonal") {
    for (let i = 0; i < size; i += 1) {
      state.grids[key][i * size + i] = 1;
    }
  }

  if (type === "circle") {
    const c = (size - 1) / 2;
    const r = size * 0.3;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - c;
        const dy = y - c;
        if (dx * dx + dy * dy <= r * r) {
          state.grids[key][y * size + x] = 1;
        }
      }
    }
  }

  for (let i = 0; i < state.grids[key].length; i += 1) {
    if (state.grids[key][i] === previous[i]) {
      renderPixel(key, i);
      continue;
    }
    const x = i % size;
    const y = Math.floor(i / size);
    const waveDelay = Math.floor((x + y) * 6);
    renderPixel(key, i, "shape", waveDelay);
  }
  if (state.operation === "NOT") {
    applyOperation("NOT", true);
  }
  setStatus(`تم توليد ${type} في ${key}`);
}

function clearHighlights() {
  KEYS.forEach((key) => {
    state.cells[key].forEach((cell) => cell.classList.remove("active"));
  });
}

function onResultHover(event) {
  const cell = event.target.closest(".pixel");
  if (!cell) {
    return;
  }

  clearHighlights();
  const index = Number(cell.dataset.index);
  state.cells.A[index].classList.add("active");
  if (state.operation !== "NOT") {
    state.cells.B[index].classList.add("active");
  }
  state.cells.R[index].classList.add("active");

  const a = state.grids.A[index];
  const b = state.grids.B[index];
  const r = state.grids.R[index];
  const text = state.operation === "NOT" ? `~${a} = ${r}` : `${a} ${symbol(state.operation)} ${b} = ${r}`;
  ui.trace.textContent = text;
  ui.trace.classList.add("show");
}

function clearTrace() {
  clearHighlights();
  ui.trace.classList.remove("show");
}

function exportResultPNG() {
  const size = state.size;
  const px = Math.max(10, Math.floor(620 / size));
  const canvas = document.createElement("canvas");
  canvas.width = size * px;
  canvas.height = size * px;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const value = state.grids.R[index];
      ctx.fillStyle = value ? "#ffffff" : "#0d0f12";
      ctx.fillRect(x * px, y * px, px, px);
    }
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `bitwise-result-${size}x${size}.png`;
  link.click();
  setStatus("تم تصدير صورة الناتج");
}

function setStatus(text) {
  ui.statusBar.textContent = text;
}

function setupEvents() {
  ui.gridSize.addEventListener("change", () => {
    createGrid(Number(ui.gridSize.value));
  });

  ui.operationSelect.addEventListener("change", () => {
    state.operation = ui.operationSelect.value;
    ui.operatorHint.textContent = HINTS[state.operation];
    if (state.operation === "NOT") {
      applyOperation("NOT", true);
    }
  });

  ui.applyBtn.addEventListener("click", () => applyOperation(state.operation));
  ui.clearBtn.addEventListener("click", clearAll);
  ui.copyAToB.addEventListener("click", copyAToB);

  ui.toggleNumbers.addEventListener("change", () => {
    state.showNumbers = ui.toggleNumbers.checked;
    ui.root.classList.toggle("hide-numbers", !state.showNumbers);
  });

  ui.shapeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      generateShape(btn.dataset.shape);
    });
  });

  document.querySelectorAll("[data-action='reset']").forEach((btn) => {
    btn.addEventListener("click", () => clearGrid(btn.dataset.grid));
  });

  document.querySelectorAll("[data-action='invert']").forEach((btn) => {
    btn.addEventListener("click", () => invertGrid(btn.dataset.grid));
  });

  ui.exportPngR.addEventListener("click", exportResultPNG);
}

function init() {
  setupEvents();
  createGrid(16);
  ui.operatorHint.textContent = HINTS[state.operation];
  setStatus("جاهز");
}

init();
