// ============================================================
// VSUSTAIN SOLAR — FIELD APP v2
// ============================================================

// ── State ──
let allProjects     = [];
let filteredProjects = [];
let activeProject   = null;
let selectedExecStage   = null;
let selectedOnsiteStage = null;
let userLocation    = null;
let activeFilter    = "all";
let searchQuery     = "";

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  setMonthBadge();
  requestLocation();
  loadProjects();
  bindSearch();
  bindFilters();

  // Close modal on overlay click
  document.getElementById("detailModal").addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeModal();
  });
});

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

function setMonthBadge() {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const n = new Date();
  document.getElementById("monthBadge").textContent = `${m[n.getMonth()]} ${n.getFullYear()}`;
}

// ────────────────────────────────────────────────
// LOCATION
// ────────────────────────────────────────────────

function requestLocation() {
  const el = document.getElementById("locationText");
  if (!navigator.geolocation) { el.textContent = "Location N/A"; return; }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      userLocation = { lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) };
      el.textContent = `${userLocation.lat}, ${userLocation.lng}`;
    },
    () => { el.textContent = "Location denied"; userLocation = null; },
    { timeout: 8000, enableHighAccuracy: true }
  );
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
    if (!json.data || !Array.isArray(json.data)) throw new Error("Bad format");

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

// ── Map sheet row array → project object ──
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
    executionStage: row[C.EXECUTION_STAGE] || "",   // last project execution stage
    projectLead:    row[C.PROJECT_LEAD]    || "",
    status:         row[C.STATUS]          || "New",
    onsiteStage:    row[C.ONSITE_STAGE]    || "",   // last on-site execution stage
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
// SEARCH + FILTER
// ────────────────────────────────────────────────

function bindSearch() {
  document.getElementById("searchInput").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });
}

function bindFilters() {
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });
}

function applyFilters() {
  filteredProjects = allProjects.filter(p => {
    const matchFilter = activeFilter === "all" || p.status === activeFilter;
    const matchSearch = !searchQuery ||
      p.projectName.toLowerCase().includes(searchQuery) ||
      p.customerName.toLowerCase().includes(searchQuery) ||
      p.phone.includes(searchQuery) ||
      p.addressCity.toLowerCase().includes(searchQuery);
    return matchFilter && matchSearch;
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
    empty.innerHTML = searchQuery ? `<p>No projects match "${esc(searchQuery)}"</p>` : "<p>No projects found.</p>";
    list.appendChild(empty);
    return;
  }

  filteredProjects.forEach((project, idx) => {
    const card = buildCard(project, idx);
    list.appendChild(card);
  });
}

function buildCard(project, idx) {
  const div = document.createElement("div");
  div.className = "project-card";
  div.style.animationDelay = `${idx * 40}ms`;

  const badgeClass = { "New": "badge-new", "In Progress": "badge-active", "Complete": "badge-complete" }[project.status] || "badge-new";
  const address = [project.addressCity, project.addressState].filter(Boolean).join(", ");

  div.innerHTML = `
    <div class="card-top">
      <div class="card-name">${esc(project.projectName)}</div>
      <span class="card-badge ${badgeClass}">${esc(project.status)}</span>
    </div>
    <div class="card-customer"><span>👤</span> ${esc(project.customerName)}</div>
    <div class="card-meta">
      ${project.phone   ? `<span class="card-meta-item">📞 ${esc(project.phone)}</span>` : ""}
      ${address         ? `<span class="card-meta-item">📍 ${esc(address)}</span>` : ""}
      ${project.projectType ? `<span class="card-meta-item">⚡ ${esc(project.projectType)}</span>` : ""}
    </div>
    <div class="card-stage">
      <span class="stage-label">Exec stage</span>
      <span class="stage-value">${esc(project.executionStage || "—")}</span>
      <span class="card-arrow">›</span>
    </div>
  `;

  div.addEventListener("click", () => openModal(project));
  return div;
}

// ────────────────────────────────────────────────
// MODAL — OPEN / CLOSE / TAB
// ────────────────────────────────────────────────

function openModal(project) {
  activeProject       = project;
  selectedExecStage   = null;
  selectedOnsiteStage = null;

  // Populate info grid
  document.getElementById("modalProjectName").textContent = project.projectName;
  document.getElementById("modalCustomer").textContent    = project.customerName || "—";
  document.getElementById("modalPhone").textContent       = project.phone        || "—";
  document.getElementById("modalType").textContent        = project.projectType  || "—";
  document.getElementById("modalLead").textContent        = project.projectLead  || "—";

  const addressParts = [project.addressStreet, project.addressCity, project.addressState, project.addressZip, project.addressCountry].filter(Boolean);
  document.getElementById("modalAddress").textContent = addressParts.join(", ") || "—";

  // Build both trackers and selectors
  buildTracker("execution", project.executionStage);
  buildTracker("onsite",    project.onsiteStage);
  buildStageSelector("execution");
  buildStageSelector("onsite");

  // Reset submit buttons
  document.getElementById("btnSubmitExecution").disabled = true;
  document.getElementById("btnOpenForm").disabled        = true;

  // Reset feedback
  const fb = document.getElementById("execFeedback");
  fb.classList.add("hidden");
  fb.classList.remove("error");
  fb.textContent = "";

  // Default to execution tab
  switchTab("execution");

  document.getElementById("detailModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.body.style.overflow = "";
  activeProject       = null;
  selectedExecStage   = null;
  selectedOnsiteStage = null;
}

function switchTab(type) {
  document.getElementById("tabPanelExecution").classList.toggle("hidden", type !== "execution");
  document.getElementById("tabPanelOnsite").classList.toggle("hidden",    type !== "onsite");
  document.getElementById("tabExec").classList.toggle("active",   type === "execution");
  document.getElementById("tabOnsite").classList.toggle("active", type === "onsite");
}

// ────────────────────────────────────────────────
// TRACKER — shows done (green) vs remaining (grey)
// ────────────────────────────────────────────────

function buildTracker(type, currentStage) {
  const stages     = type === "execution" ? CONFIG.EXECUTION_STAGES : CONFIG.ONSITE_STAGES;
  const containerId = type === "execution" ? "executionTracker" : "onsiteTracker";
  const container  = document.getElementById(containerId);
  container.innerHTML = "";

  // Find index of current stage in the ordered list (case-insensitive trim)
  const currentIdx = stages.findIndex(s => s.trim().toLowerCase() === (currentStage || "").trim().toLowerCase());

  if (currentIdx === -1 && currentStage) {
    // Stage value in sheet doesn't match known stages — show raw value
    const note = document.createElement("p");
    note.style.cssText = "font-size:12px;color:var(--text-secondary);padding:4px 0";
    note.textContent = `Current: ${currentStage}`;
    container.appendChild(note);
  }

  stages.forEach((stage, idx) => {
    const item = document.createElement("div");
    item.className = "tracker-item";

    let badge = "";
    if (currentIdx === -1) {
      // No stage set yet — all grey
    } else if (idx < currentIdx) {
      // Before current — DONE
      item.classList.add("done");
      badge = `<span class="done-badge">Done</span>`;
    } else if (idx === currentIdx) {
      // Current stage — highlighted amber
      item.classList.add("current");
      badge = `<span class="current-badge">Current</span>`;
    }
    // idx > currentIdx → remaining, no class

    item.innerHTML = `
      <div class="tracker-item-left">
        <div class="tracker-dot"></div>
        <span class="tracker-name">${esc(stage)}</span>
      </div>
      ${badge}
    `;

    container.appendChild(item);
  });
}

// ────────────────────────────────────────────────
// STAGE SELECTOR (radio list for updating)
// ────────────────────────────────────────────────

function buildStageSelector(type) {
  const stages      = type === "execution" ? CONFIG.EXECUTION_STAGES : CONFIG.ONSITE_STAGES;
  const containerId = type === "execution" ? "executionStageList"    : "onsiteStageList";
  const container   = document.getElementById(containerId);
  container.innerHTML = "";

  stages.forEach(stage => {
    const div = document.createElement("div");
    div.className = "stage-option";

    div.innerHTML = `
      <div class="stage-radio"></div>
      <span class="stage-text">${esc(stage)}</span>
    `;

    div.addEventListener("click", () => selectStage(type, stage, div));
    container.appendChild(div);
  });
}

function selectStage(type, stage, el) {
  const containerId = type === "execution" ? "executionStageList" : "onsiteStageList";
  document.querySelectorAll(`#${containerId} .stage-option`).forEach(o => o.classList.remove("selected"));
  el.classList.add("selected");

  if (type === "execution") {
    selectedExecStage = stage;
    document.getElementById("btnSubmitExecution").disabled = false;
  } else {
    selectedOnsiteStage = stage;
    document.getElementById("btnOpenForm").disabled = false;
  }
}

// ────────────────────────────────────────────────
// SUBMIT EXECUTION STAGE → n8n
// n8n will update Zoho CRM AND call back Apps Script to update the sheet
// ────────────────────────────────────────────────

async function submitExecutionStage() {
  if (!activeProject || !selectedExecStage) return;

  const btn         = document.getElementById("btnSubmitExecution");
  const feedback    = document.getElementById("execFeedback");
  const originalTxt = btn.textContent;

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

    // Optimistically update local data
    activeProject.executionStage = selectedExecStage;

    // Refresh tracker UI immediately
    buildTracker("execution", selectedExecStage);

    feedback.textContent = `Stage updated to "${selectedExecStage}"`;
    feedback.classList.remove("hidden", "error");

    // Close modal and re-render cards after short delay
    setTimeout(() => { closeModal(); renderProjects(); }, 1800);

  } catch (err) {
    console.error(err);
    feedback.textContent = "Failed to send. Check connection and try again.";
    feedback.classList.remove("hidden");
    feedback.classList.add("error");
    btn.disabled    = false;
    btn.textContent = originalTxt;
  }
}

// ────────────────────────────────────────────────
// OPEN GOOGLE FORM — On-Site Stage
// Pre-fills: name, record ID, phone + selected onsite stage
// ────────────────────────────────────────────────

function openGoogleForm() {
  if (!activeProject || !selectedOnsiteStage) return;

  const params = new URLSearchParams({
    usp: "pp_url",
    [CONFIG.FORM_ENTRY_NAME]:         activeProject.customerName  || "",
    [CONFIG.FORM_ENTRY_ID]:           activeProject.recordId      || "",
    [CONFIG.FORM_ENTRY_PHONE]:        activeProject.phone         || "",
    [CONFIG.FORM_ENTRY_ONSITE_STAGE]: selectedOnsiteStage         || "",
  });

  window.open(`${CONFIG.GOOGLE_FORM_BASE}?${params.toString()}`, "_blank");
}
