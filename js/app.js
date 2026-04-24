// ============================================================
// VSUSTAIN SOLAR — FIELD APP v3
// Changes:
//   - Logo loaded from CONFIG.LOGO_URL
//   - Location: uses watchPosition + retries for better mobile capture
//   - Filter chips: All / New / Active + 4 lead filters
//   - On-site tab: no green tracker — shows checklist style with timestamp
//   - On-site submit sends POST to n8n with stage + location
//   - Execution stage tracker unchanged (green done logic)
// ============================================================

// ── State ──
let allProjects      = [];
let filteredProjects = [];
let activeProject    = null;
let selectedExecStage    = null;
let selectedOnsiteStage  = null;
let userLocation     = null;
let locationWatcher  = null;
let activeFilter     = "all";
let activeLeadFilter = "all";
let searchQuery      = "";

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  loadLogo();
  setMonthBadge();
  startLocationWatch();
  loadProjects();
  bindSearch();
  buildFilterChips();

  document.getElementById("detailModal").addEventListener("click", e => {
    if (e.target.id === "detailModal") closeModal();
  });
});

// ────────────────────────────────────────────────
// LOGO
// ────────────────────────────────────────────────
function loadLogo() {
  const logoEl = document.getElementById("topbarLogo");
  if (!logoEl) return;
  const img = document.createElement("img");
  img.src   = CONFIG.LOGO_URL;
  img.alt   = "VSustain Solar";
  img.className = "logo-img";
  img.onerror = () => {
    // Fallback to text if image fails
    logoEl.innerHTML = `<div class="logo-mark"></div><span class="logo-text">VSustain</span>`;
  };
  logoEl.innerHTML = "";
  logoEl.appendChild(img);
}

// ────────────────────────────────────────────────
// MONTH BADGE
// ────────────────────────────────────────────────
function setMonthBadge() {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const n = new Date();
  document.getElementById("monthBadge").textContent = `${m[n.getMonth()]} ${n.getFullYear()}`;
}

// ────────────────────────────────────────────────
// LOCATION — watchPosition for continuous updates
// This ensures mobile devices with slow GPS still get a fix
// ────────────────────────────────────────────────
function startLocationWatch() {
  const el = document.getElementById("locationText");
  if (!navigator.geolocation) {
    el.textContent = "GPS N/A";
    return;
  }

  el.textContent = "Locating...";

  // First try: immediate getCurrentPosition for quick result
  navigator.geolocation.getCurrentPosition(
    pos => applyLocation(pos),
    err => { el.textContent = "Allow location"; },
    { timeout: 6000, enableHighAccuracy: false, maximumAge: 30000 }
  );

  // Then watch for more accurate fix
  locationWatcher = navigator.geolocation.watchPosition(
    pos => applyLocation(pos),
    err => { /* silent — first call already set fallback text */ },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );
}

function applyLocation(pos) {
  userLocation = {
    lat:      pos.coords.latitude.toFixed(6),
    lng:      pos.coords.longitude.toFixed(6),
    accuracy: Math.round(pos.coords.accuracy),
  };
  const el = document.getElementById("locationText");
  if (el) el.textContent = `${userLocation.lat}, ${userLocation.lng}`;
}

// ────────────────────────────────────────────────
// LOAD PROJECTS
// ────────────────────────────────────────────────
async function loadProjects() {
  const loadEl  = document.getElementById("loadingState");
  const errorEl = document.getElementById("errorState");
  const list    = document.getElementById("projectList");

  loadEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  list.querySelectorAll(".project-card, .empty-state").forEach(e => e.remove());

  try {
    const res  = await fetch(CONFIG.SHEET_API_URL + "?action=getProjects");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) throw new Error("Bad response format");

    allProjects = json.data.map(rowToProject).filter(p => p.recordId);
    renderStats();
    applyFilters();
  } catch (err) {
    console.error("Load error:", err);
    errorEl.classList.remove("hidden");
  } finally {
    loadEl.classList.add("hidden");
  }
}

function rowToProject(row) {
  const C = CONFIG.COLUMNS;
  return {
    timestamp:      row[C.TIMESTAMP]       || "",
    recordId:       row[C.RECORD_ID]       || "",
    projectName:    row[C.PROJECT_NAME]    || "Unnamed Project",
    projectId:      row[C.PROJECT_ID]      || "",
    customerName:   row[C.CUSTOMER_NAME]   || "",
    phone:          row[C.PHONE]           || "",
    email:          row[C.EMAIL]           || "",
    addressStreet:  row[C.ADDRESS_STREET]  || "",
    addressCity:    row[C.ADDRESS_CITY]    || "",
    addressState:   row[C.ADDRESS_STATE]   || "",
    addressZip:     row[C.ADDRESS_ZIP]     || "",
    addressCountry: row[C.ADDRESS_COUNTRY] || "",
    projectType:    row[C.PROJECT_TYPE]    || "",
    sanctionedLoad: row[C.SANCTIONED_LOAD] || "",
    totalAmount:    row[C.TOTAL_AMOUNT]    || "",
    advanceAmount:  row[C.ADVANCE_AMOUNT]  || "",
    executionStage: row[C.EXECUTION_STAGE] || "",
    projectLead:    row[C.PROJECT_LEAD]    || "",
    status:         row[C.STATUS]          || "New",
    onsiteStage:    row[C.ONSITE_STAGE]    || "",
  };
}

// ────────────────────────────────────────────────
// STATS
// ────────────────────────────────────────────────
function renderStats() {
  document.getElementById("totalProjects").textContent  = allProjects.length;
  document.getElementById("activeProjects").textContent = allProjects.filter(p => p.status === "In Progress").length;
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("todayUpdates").textContent   = allProjects.filter(p => p.timestamp && p.timestamp.startsWith(today)).length;
}

// ────────────────────────────────────────────────
// FILTER CHIPS — built from config
// ────────────────────────────────────────────────
function buildFilterChips() {
  const bar = document.getElementById("filterBar");
  if (!bar) return;
  bar.innerHTML = "";

  // Status filters
  const statusFilters = [
    { label: "All",    value: "all",         type: "status" },
    { label: "New",    value: "New",          type: "status" },
    { label: "Active", value: "In Progress",  type: "status" },
  ];

  // Lead filters
  const leadFilters = CONFIG.PROJECT_LEADS.map(lead => ({ label: lead, value: lead, type: "lead" }));

  [...statusFilters, ...leadFilters].forEach(f => {
    const btn = document.createElement("button");
    btn.className = "chip" + (f.value === "all" && f.type === "status" ? " active" : "");
    btn.textContent = f.label;
    btn.dataset.value = f.value;
    btn.dataset.type  = f.type;
    btn.addEventListener("click", () => onChipClick(btn, f));
    bar.appendChild(btn);
  });
}

function onChipClick(btn, filter) {
  if (filter.type === "status") {
    // Deactivate all status chips
    document.querySelectorAll("#filterBar .chip[data-type='status']").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = filter.value;
  } else {
    // Toggle lead filter
    const wasActive = btn.classList.contains("active");
    document.querySelectorAll("#filterBar .chip[data-type='lead']").forEach(c => c.classList.remove("active"));
    if (!wasActive) {
      btn.classList.add("active");
      activeLeadFilter = filter.value;
    } else {
      activeLeadFilter = "all"; // deselect
    }
  }
  applyFilters();
}

// ────────────────────────────────────────────────
// SEARCH
// ────────────────────────────────────────────────
function bindSearch() {
  document.getElementById("searchInput").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });
}

// ────────────────────────────────────────────────
// APPLY ALL FILTERS
// ────────────────────────────────────────────────
function applyFilters() {
  filteredProjects = allProjects.filter(p => {
    const matchStatus = activeFilter === "all" || p.status === activeFilter;
    const matchLead   = activeLeadFilter === "all" || p.projectLead === activeLeadFilter;
    const matchSearch = !searchQuery ||
      p.projectName.toLowerCase().includes(searchQuery) ||
      p.customerName.toLowerCase().includes(searchQuery) ||
      p.phone.includes(searchQuery) ||
      p.addressCity.toLowerCase().includes(searchQuery);
    return matchStatus && matchLead && matchSearch;
  });
  renderProjects();
}

// ────────────────────────────────────────────────
// RENDER PROJECT CARDS
// ────────────────────────────────────────────────
function renderProjects() {
  const list = document.getElementById("projectList");
  list.querySelectorAll(".project-card, .empty-state").forEach(e => e.remove());

  if (!filteredProjects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = searchQuery
      ? `<p>No matches for "${esc(searchQuery)}"</p>`
      : "<p>No projects found for this filter.</p>";
    list.appendChild(empty);
    return;
  }

  filteredProjects.forEach((p, i) => list.appendChild(buildCard(p, i)));
}

function buildCard(p, idx) {
  const div = document.createElement("div");
  div.className = "project-card";
  div.style.animationDelay = `${idx * 35}ms`;

  const badgeClass = { "New": "badge-new", "In Progress": "badge-active", "Complete": "badge-complete" }[p.status] || "badge-new";
  const address    = [p.addressCity, p.addressState].filter(Boolean).join(", ");

  div.innerHTML = `
    <div class="card-top">
      <div class="card-name">${esc(p.projectName)}</div>
      <span class="card-badge ${badgeClass}">${esc(p.status)}</span>
    </div>
    <div class="card-customer">👤 ${esc(p.customerName)}</div>
    <div class="card-meta">
      ${p.phone       ? `<span class="card-meta-item">📞 ${esc(p.phone)}</span>` : ""}
      ${address       ? `<span class="card-meta-item">📍 ${esc(address)}</span>` : ""}
      ${p.projectLead ? `<span class="card-meta-item">👷 ${esc(p.projectLead)}</span>` : ""}
    </div>
    <div class="card-stage">
      <span class="stage-label">Exec Stage</span>
      <span class="stage-value">${esc(p.executionStage || "—")}</span>
      <span class="card-arrow">›</span>
    </div>
  `;

  div.addEventListener("click", () => openModal(p));
  return div;
}

// ────────────────────────────────────────────────
// MODAL
// ────────────────────────────────────────────────
function openModal(p) {
  activeProject       = p;
  selectedExecStage   = null;
  selectedOnsiteStage = null;

  document.getElementById("modalProjectName").textContent = p.projectName;
  document.getElementById("modalCustomer").textContent    = p.customerName || "—";
  document.getElementById("modalPhone").textContent       = p.phone        || "—";
  document.getElementById("modalType").textContent        = p.projectType  || "—";
  document.getElementById("modalLead").textContent        = p.projectLead  || "—";

  const addrParts = [p.addressStreet, p.addressCity, p.addressState, p.addressZip, p.addressCountry].filter(Boolean);
  document.getElementById("modalAddress").textContent = addrParts.join(", ") || "—";

  buildExecTracker(p.executionStage);
  buildExecSelector();
  buildOnsiteChecklist(p.onsiteStage);
  buildOnsiteSelector();

  document.getElementById("btnSubmitExecution").disabled = true;
  document.getElementById("btnOpenForm").disabled        = true;

  const fb = document.getElementById("execFeedback");
  fb.classList.add("hidden");
  fb.classList.remove("error");
  fb.textContent = "";

  switchTab("execution");
  document.getElementById("detailModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.body.style.overflow = "";
  activeProject = selectedExecStage = selectedOnsiteStage = null;
}

function switchTab(type) {
  document.getElementById("tabPanelExecution").classList.toggle("hidden", type !== "execution");
  document.getElementById("tabPanelOnsite").classList.toggle("hidden",    type !== "onsite");
  document.getElementById("tabExec").classList.toggle("active",   type === "execution");
  document.getElementById("tabOnsite").classList.toggle("active", type === "onsite");
}

// ────────────────────────────────────────────────
// EXECUTION STAGE TRACKER — green done logic
// ────────────────────────────────────────────────
function buildExecTracker(currentStage) {
  const container = document.getElementById("executionTracker");
  container.innerHTML = "";
  const stages     = CONFIG.EXECUTION_STAGES;
  const currentIdx = stages.findIndex(s => s.trim().toLowerCase() === (currentStage || "").trim().toLowerCase());

  stages.forEach((stage, idx) => {
    const item = document.createElement("div");
    item.className = "tracker-item";
    let badge = "";
    if (currentIdx >= 0) {
      if (idx < currentIdx)      { item.classList.add("done");    badge = `<span class="done-badge">Done</span>`; }
      else if (idx === currentIdx){ item.classList.add("current"); badge = `<span class="current-badge">Current</span>`; }
    }
    item.innerHTML = `<div class="tracker-item-left"><div class="tracker-dot"></div><span class="tracker-name">${esc(stage)}</span></div>${badge}`;
    container.appendChild(item);
  });
}

function buildExecSelector() {
  const container = document.getElementById("executionStageList");
  container.innerHTML = "";
  CONFIG.EXECUTION_STAGES.forEach(stage => {
    const div = document.createElement("div");
    div.className = "stage-option";
    div.innerHTML = `<div class="stage-radio"></div><span class="stage-text">${esc(stage)}</span>`;
    div.addEventListener("click", () => {
      container.querySelectorAll(".stage-option").forEach(o => o.classList.remove("selected"));
      div.classList.add("selected");
      selectedExecStage = stage;
      document.getElementById("btnSubmitExecution").disabled = false;
    });
    container.appendChild(div);
  });
}

// ────────────────────────────────────────────────
// ON-SITE CHECKLIST — simple list, no green tracker
// Shows last completed stage from sheet as info only
// ────────────────────────────────────────────────
function buildOnsiteChecklist(lastStage) {
  const container = document.getElementById("onsiteLastStage");
  if (!container) return;
  container.textContent = lastStage ? `Last updated: ${lastStage}` : "No on-site stages recorded yet";
}

function buildOnsiteSelector() {
  const container = document.getElementById("onsiteStageList");
  container.innerHTML = "";
  CONFIG.ONSITE_STAGES.forEach(stage => {
    const div = document.createElement("div");
    div.className = "stage-option";
    div.innerHTML = `<div class="stage-radio"></div><span class="stage-text">${esc(stage)}</span>`;
    div.addEventListener("click", () => {
      container.querySelectorAll(".stage-option").forEach(o => o.classList.remove("selected"));
      div.classList.add("selected");
      selectedOnsiteStage = stage;
      document.getElementById("btnOpenForm").disabled = false;
    });
    container.appendChild(div);
  });
}

// ────────────────────────────────────────────────
// SUBMIT EXECUTION STAGE → n8n
// ────────────────────────────────────────────────
async function submitExecutionStage() {
  if (!activeProject || !selectedExecStage) return;

  const btn      = document.getElementById("btnSubmitExecution");
  const feedback = document.getElementById("execFeedback");
  const orig     = btn.textContent;

  btn.disabled    = true;
  btn.textContent = "Sending...";
  feedback.classList.add("hidden");

  const payload = {
    type:         "execution_stage_update",
    recordId:     activeProject.recordId,
    projectId:    activeProject.projectId,
    projectName:  activeProject.projectName,
    customerName: activeProject.customerName,
    phone:        activeProject.phone,
    projectLead:  activeProject.projectLead,
    stage:        selectedExecStage,
    updatedAt:    new Date().toISOString(),
    location:     userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng, accuracy: userLocation.accuracy }
      : null,
  };

  try {
    const res = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Server returned " + res.status);

    activeProject.executionStage = selectedExecStage;
    buildExecTracker(selectedExecStage);

    feedback.textContent = `✓ Stage updated to "${selectedExecStage}"`;
    feedback.classList.remove("hidden", "error");

    setTimeout(() => { closeModal(); renderProjects(); }, 1800);

  } catch (err) {
    console.error(err);
    feedback.textContent = "Failed to send. Check connection and retry.";
    feedback.classList.remove("hidden");
    feedback.classList.add("error");
    btn.disabled    = false;
    btn.textContent = orig;
  }
}

// ────────────────────────────────────────────────
// OPEN GOOGLE FORM — On-Site Stage (pre-filled)
// Also sends location to n8n before opening form
// ────────────────────────────────────────────────
async function openGoogleForm() {
  if (!activeProject || !selectedOnsiteStage) return;

  const btn  = document.getElementById("btnOpenForm");
  const orig = btn.textContent;
  btn.disabled    = true;
  btn.textContent = "Opening...";

  // Send the onsite stage + location to n8n
  const payload = {
    type:           "onsite_stage_update",
    recordId:       activeProject.recordId,
    projectId:      activeProject.projectId,
    projectName:    activeProject.projectName,
    customerName:   activeProject.customerName,
    phone:          activeProject.phone,
    projectLead:    activeProject.projectLead,
    onsiteStage:    selectedOnsiteStage,
    updatedAt:      new Date().toISOString(),
    location:       userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng, accuracy: userLocation.accuracy }
      : null,
  };

  try {
    await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    // Don't block form opening if n8n call fails
    console.warn("n8n call failed, continuing to form:", e);
  }

  // Build pre-filled form URL
  const params = new URLSearchParams({
    usp: "pp_url",
    [CONFIG.FORM_ENTRY_NAME]:         activeProject.customerName || "",
    [CONFIG.FORM_ENTRY_ID]:           activeProject.recordId    || "",
    [CONFIG.FORM_ENTRY_PHONE]:        activeProject.phone       || "",
    [CONFIG.FORM_ENTRY_ONSITE_STAGE]: selectedOnsiteStage       || "",
  });

  window.open(`${CONFIG.GOOGLE_FORM_BASE}?${params.toString()}`, "_blank");

  btn.disabled    = false;
  btn.textContent = orig;
}

// ────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────
function esc(str) {
  return String(str || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
