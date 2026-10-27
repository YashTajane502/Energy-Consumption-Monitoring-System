/* =====================================================
   Energy Consumption Monitoring System - frontend demo
   All values come from the single `records` array below.
   Data is saved in the browser's localStorage only
   (it is NOT connected to the C++ energy_data.txt file).
   ===================================================== */

const STORAGE_KEY = "energyDemoRecords";

// Demonstration data (not real measurements)
const SAMPLE_RECORDS = [
  { id: 1,  device: "Air Conditioner",  date: "05-03-2025", units: 85.5 },
  { id: 2,  device: "Refrigerator",     date: "05-03-2025", units: 42 },
  { id: 3,  device: "Washing Machine",  date: "08-03-2025", units: 18.25 },
  { id: 4,  device: "Television",       date: "10-03-2025", units: 22 },
  { id: 5,  device: "Laptop",           date: "12-03-2025", units: 15.5 },
  { id: 6,  device: "Water Heater",     date: "15-03-2025", units: 60 },
  { id: 7,  device: "Ceiling Fan",      date: "18-03-2025", units: 30 },
  { id: 8,  device: "Lights",           date: "20-03-2025", units: 25 },
  { id: 9,  device: "Air Conditioner",  date: "22-03-2025", units: 70 },
  { id: 10, device: "Refrigerator",     date: "25-03-2025", units: 40 },
  { id: 11, device: "Water Heater",     date: "28-03-2025", units: 45.5 },
  { id: 12, device: "Television",      date: "30-03-2025", units: 20 }
];

let records = [];          // the one source of truth
let editingId = null;      // null = adding, number = editing that ID
let billLinked = true;     // calculator follows the records total until user types
let charts = {};           // Chart.js instances
let confirmAction = null;  // function run when the confirm dialog is accepted

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toFixed(2);
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// "DD-MM-YYYY" -> number (YYYYMMDD) so dates can be sorted
function dateToNumber(d) {
  return Number(d.slice(6, 10) + d.slice(3, 5) + d.slice(0, 2));
}

let toastTimer;
function showToast(message, isError = false) {
  const t = $("toast");
  t.textContent = message;
  t.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2800);
}

// ---------- Storage ----------
function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    records = saved ? JSON.parse(saved) : SAMPLE_RECORDS.map((r) => ({ ...r }));
  } catch (e) {
    records = SAMPLE_RECORDS.map((r) => ({ ...r }));
  }
}
function saveRecords() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch (e) { /* ignore */ }
}

// ---------- Core logic (ported from the C++ code) ----------

// Same as getNextId(): highest existing ID + 1
function getNextId() {
  return records.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

// Same as isValidDate(): DD-MM-YYYY, day 1-31, month 1-12, year 2000-2100
function isValidDate(d) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(d)) return false;
  const day = Number(d.slice(0, 2)), month = Number(d.slice(3, 5)), year = Number(d.slice(6, 10));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
}

// Slab rates, same as calculateBill(): 100 @ ₹3, next 200 @ ₹5, rest @ ₹8
const SLABS = [
  { name: "First 100 units", size: 100, rate: 3, color: "#22e08a" },
  { name: "Next 200 units",  size: 200, rate: 5, color: "#38bdf8" },
  { name: "Above 300 units", size: Infinity, rate: 8, color: "#f59e0b" }
];

function calculateSlabs(totalUnits) {
  let remaining = totalUnits;
  return SLABS.map((slab) => {
    const units = Math.max(0, Math.min(remaining, slab.size));
    remaining -= units;
    return { ...slab, units, cost: units * slab.rate };
  });
}
function calculateBill(totalUnits) {
  return calculateSlabs(totalUnits).reduce((sum, s) => sum + s.cost, 0);
}

// Same as analyzeData(): returns null when there are no records
function analyzeData() {
  if (records.length === 0) return null;
  let total = 0, high = records[0], low = records[0];
  records.forEach((r) => {
    total += r.units;
    if (r.units > high.units) high = r;
    if (r.units < low.units) low = r;
  });
  return { count: records.length, total, average: total / records.length, high, low, bill: calculateBill(total) };
}

// Add up units per device name (used by charts)
function totalsByDevice() {
  const map = {};
  records.forEach((r) => (map[r.device] = (map[r.device] || 0) + r.units));
  return map;
}

// ---------- Rendering ----------
function renderAll() {
  renderSummary();
  renderRecentTable();
  renderRecordsTable();
  renderCharts();
  renderAnalysis();
  renderBill();
}

function renderSummary() {
  const a = analyzeData();
  $("cTotalRecords").textContent = records.length;
  $("cTotalUnits").textContent = a ? fmt(a.total) : "0.00";
  $("cAverage").textContent = a ? fmt(a.average) : "0.00";
  $("cBill").textContent = a ? inr(a.bill) : "₹0.00";
  $("cHigh").textContent = a ? fmt(a.high.units) + " kWh" : "–";
  $("cHighSub").textContent = a ? `${a.high.device} · ${a.high.date}` : "No data";
  $("cLow").textContent = a ? fmt(a.low.units) + " kWh" : "–";
  $("cLowSub").textContent = a ? `${a.low.device} · ${a.low.date}` : "No data";

  $("insights").innerHTML = a
    ? `<div class="insight"><b>Highest consumption</b><br>${escapeHtml(a.high.device)} on ${a.high.date} — ${fmt(a.high.units)} kWh</div>
       <div class="insight low"><b>Lowest consumption</b><br>${escapeHtml(a.low.device)} on ${a.low.date} — ${fmt(a.low.units)} kWh</div>`
    : `<p class="muted">Add records to see insights.</p>`;
}

function renderRecentTable() {
  const recent = [...records].sort((a, b) => b.id - a.id).slice(0, 5);
  $("recentBody").innerHTML = recent.length
    ? recent.map((r) => `<tr><td>${r.id}</td><td>${escapeHtml(r.device)}</td><td>${r.date}</td><td>${fmt(r.units)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">No records yet.</td></tr>`;
}

// Apply search + sort to the records, return the list to display
function getVisibleRecords() {
  const text = $("searchInput").value.trim();
  const mode = $("searchBy").value;
  let list = records.filter((r) => {
    if (!text) return true;
    if (mode === "id") return String(r.id) === text;           // exact ID
    if (mode === "device") return r.device === text;            // exact name (case-sensitive, like C++)
    if (mode === "date") return r.date === text;                // exact date
    const q = text.toLowerCase();                               // general search
    return [r.id, r.device, r.date, r.units].join(" ").toLowerCase().includes(q);
  });

  const [field, dir] = $("sortBy").value.split("-");
  list.sort((a, b) => {
    let x = a[field], y = b[field];
    if (field === "date") { x = dateToNumber(a.date); y = dateToNumber(b.date); }
    if (field === "device") return dir === "asc" ? x.localeCompare(y) : y.localeCompare(x);
    return dir === "asc" ? x - y : y - x;
  });
  return list;
}

function renderRecordsTable() {
  const list = getVisibleRecords();
  const empty = $("recordsEmpty");
  $("recordsBody").innerHTML = list.map((r) => `
    <tr>
      <td>${r.id}</td><td>${escapeHtml(r.device)}</td><td>${r.date}</td><td>${fmt(r.units)}</td>
      <td class="actions">
        <button class="btn ghost small-btn" data-edit="${r.id}">Edit</button>
        <button class="btn danger small-btn" data-delete="${r.id}">Delete</button>
      </td>
    </tr>`).join("");

  empty.hidden = list.length > 0;
  if (records.length === 0) {
    empty.innerHTML = `<div class="big">🔌</div><p><b>No records yet</b></p><p>Click “Add Record” to log your first energy usage.</p>`;
  } else if (list.length === 0) {
    empty.innerHTML = `<div class="big">🔍</div><p><b>No matching record found.</b></p><p>Try a different search.</p>`;
  }
}

// ---------- Charts ----------
function drawChart(canvasId, config) {
  const wrap = $(canvasId).parentElement;
  if (charts[canvasId]) charts[canvasId].destroy();
  wrap.classList.toggle("is-empty", records.length === 0);
  if (records.length === 0 || typeof Chart === "undefined") return;
  charts[canvasId] = new Chart($(canvasId), config);
}

const PALETTE = ["#22e08a", "#38bdf8", "#a78bfa", "#f59e0b", "#f87171", "#2dd4bf", "#fb7185", "#60a5fa"];

function renderCharts() {
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = "#8a9ab5";
    Chart.defaults.borderColor = "#22304a";
  }
  const byDevice = totalsByDevice();
  const deviceNames = Object.keys(byDevice);
  const baseOptions = { responsive: true, maintainAspectRatio: false };

  // Bar: each record
  drawChart("barChart", {
    type: "bar",
    data: {
      labels: records.map((r) => `#${r.id} ${r.device}`),
      datasets: [{ label: "kWh", data: records.map((r) => r.units), backgroundColor: "#22e08a", borderRadius: 6 }]
    },
    options: { ...baseOptions, plugins: { legend: { display: false } } }
  });

  // Donut: share per device
  drawChart("donutChart", {
    type: "doughnut",
    data: { labels: deviceNames, datasets: [{ data: deviceNames.map((n) => byDevice[n]), backgroundColor: PALETTE, borderColor: "#131c2e" }] },
    options: { ...baseOptions, plugins: { legend: { position: "right" } } }
  });

  // Distribution: how many records fall in each kWh range
  const buckets = [
    { label: "0–25", min: 0, max: 25 }, { label: "25–50", min: 25, max: 50 },
    { label: "50–75", min: 50, max: 75 }, { label: "75–100", min: 75, max: 100 },
    { label: "100+", min: 100, max: Infinity }
  ];
  const counts = buckets.map((b) => records.filter((r) => r.units >= b.min && r.units < b.max).length);
  drawChart("distChart", {
    type: "bar",
    data: { labels: buckets.map((b) => b.label + " kWh"), datasets: [{ label: "Number of records", data: counts, backgroundColor: "#38bdf8", borderRadius: 6 }] },
    options: { ...baseOptions, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
  });

  // Analytics: total per device (horizontal bars)
  drawChart("deviceChart", {
    type: "bar",
    data: { labels: deviceNames, datasets: [{ label: "Total kWh", data: deviceNames.map((n) => byDevice[n]), backgroundColor: PALETTE, borderRadius: 6 }] },
    options: { ...baseOptions, indexAxis: "y", plugins: { legend: { display: false } } }
  });

  // Analytics: consumption over dates (records sorted by date)
  const byDate = [...records].sort((a, b) => dateToNumber(a.date) - dateToNumber(b.date));
  drawChart("timeChart", {
    type: "line",
    data: {
      labels: byDate.map((r) => r.date),
      datasets: [{ label: "kWh", data: byDate.map((r) => r.units), borderColor: "#22e08a", backgroundColor: "rgba(34,224,138,.15)", fill: true, tension: 0.3 }]
    },
    options: { ...baseOptions, plugins: { legend: { display: false } } }
  });
}

// ---------- Analysis section ----------
function renderAnalysis() {
  const a = analyzeData();
  $("analysisList").innerHTML = a
    ? `<li><span>Number of records</span><b>${a.count}</b></li>
       <li><span>Total consumption</span><b>${fmt(a.total)} kWh</b></li>
       <li><span>Average consumption</span><b>${fmt(a.average)} kWh</b></li>
       <li><span>Highest consumption</span><b>${fmt(a.high.units)} kWh<br><small class="muted">${escapeHtml(a.high.device)}, ${a.high.date}</small></b></li>
       <li><span>Lowest consumption</span><b>${fmt(a.low.units)} kWh<br><small class="muted">${escapeHtml(a.low.device)}, ${a.low.date}</small></b></li>
       <li><span>Estimated electricity bill</span><b>${inr(a.bill)}</b></li>`
    : `<li class="muted">No records available for analysis.</li>`;
}

// ---------- Bill calculator ----------
function renderBill() {
  const a = analyzeData();
  if (billLinked) $("billUnits").value = a ? Number(fmt(a.total)) : 0;

  const units = Math.max(0, parseFloat($("billUnits").value) || 0);
  const slabs = calculateSlabs(units);
  $("slabs").innerHTML = slabs.map((s) => {
    const capacity = s.size === Infinity ? Math.max(units, 100) : s.size;
    const pct = capacity ? Math.min(100, (s.units / capacity) * 100) : 0;
    return `<div>
      <div class="slab-head"><span><b>${s.name}</b> · ₹${s.rate}/unit</span>
        <span>${fmt(s.units)} × ₹${s.rate} = <b>${inr(s.cost)}</b></span></div>
      <div class="bar"><div style="width:${pct}%;background:${s.color}"></div></div></div>`;
  }).join("");
  $("billTotal").textContent = inr(calculateBill(units));
}

// ---------- Add / Edit modal ----------
function openRecordDialog(id = null) {
  editingId = id;
  ["eDevice", "eDate", "eUnits"].forEach((e) => ($(e).textContent = ""));
  if (id === null) {
    $("dialogTitle").textContent = "Add Record";
    $("fDevice").value = ""; $("fDate").value = ""; $("fUnits").value = "";
  } else {
    const r = records.find((x) => x.id === id);
    $("dialogTitle").textContent = "Edit Record #" + id;
    $("fDevice").value = r.device; $("fDate").value = r.date; $("fUnits").value = r.units;
  }
  $("recordDialog").showModal();
  $("fDevice").focus();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const device = $("fDevice").value.trim();
  const date = $("fDate").value.trim();
  const unitsText = $("fUnits").value.trim();
  const units = Number(unitsText);
  let ok = true;

  // Same rules as the C++ readText / readDate / readUnits
  $("eDevice").textContent = "";
  $("eDate").textContent = "";
  $("eUnits").textContent = "";
  if (device === "") { $("eDevice").textContent = "Input cannot be empty."; ok = false; }
  else if (device.includes("|")) { $("eDevice").textContent = "The character '|' is not allowed."; ok = false; }
  if (!isValidDate(date)) { $("eDate").textContent = "Invalid date. Use DD-MM-YYYY (year 2000–2100)."; ok = false; }
  if (unitsText === "" || isNaN(units) || units < 0) { $("eUnits").textContent = "Enter a non-negative number."; ok = false; }
  if (!ok) return;

  if (editingId === null) {
    const id = getNextId();
    records.push({ id, device, date, units });
    showToast(`Record added with ID ${id}.`);
  } else {
    const r = records.find((x) => x.id === editingId);
    r.device = device; r.date = date; r.units = units;
    showToast("Record updated.");
  }
  saveRecords();
  $("recordDialog").close();
  renderAll();
}

// ---------- Confirm dialog (delete & reset) ----------
function askConfirm(title, text, action) {
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  confirmAction = action;
  $("confirmDialog").showModal();
}

// ---------- Events ----------
function setupEvents() {
  $("addBtn").addEventListener("click", () => openRecordDialog());
  $("recordForm").addEventListener("submit", handleFormSubmit);
  $("cancelBtn").addEventListener("click", () => $("recordDialog").close());

  // Edit / Delete buttons inside the table (event delegation)
  $("recordsBody").addEventListener("click", (e) => {
    const editId = e.target.dataset.edit, delId = e.target.dataset.delete;
    if (editId) openRecordDialog(Number(editId));
    if (delId) {
      askConfirm("Delete record?", `Record #${delId} will be permanently removed.`, () => {
        records = records.filter((r) => r.id !== Number(delId));
        saveRecords(); renderAll(); showToast("Record deleted.");
      });
    }
  });

  $("confirmYes").addEventListener("click", () => {
    $("confirmDialog").close();
    if (confirmAction) confirmAction();
    confirmAction = null;
  });
  $("confirmNo").addEventListener("click", () => $("confirmDialog").close());

  $("resetBtn").addEventListener("click", () =>
    askConfirm("Reset demo data?", "All your changes will be replaced by the original sample records.", () => {
      records = SAMPLE_RECORDS.map((r) => ({ ...r }));
      billLinked = true;
      saveRecords(); renderAll(); showToast("Demo data reset.");
    }));

  // Live search and sort
  $("searchInput").addEventListener("input", renderRecordsTable);
  $("searchBy").addEventListener("change", renderRecordsTable);
  $("sortBy").addEventListener("change", renderRecordsTable);

  // Bill calculator
  $("billUnits").addEventListener("input", () => { billLinked = false; renderBill(); });
  $("useTotalBtn").addEventListener("click", () => { billLinked = true; renderBill(); });

  // Highlight the sidebar link of the section being viewed
  const links = document.querySelectorAll(".sidebar a");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + entry.target.id));
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll("main section").forEach((s) => observer.observe(s));
}

// ---------- Start ----------
loadRecords();
setupEvents();
renderAll();
