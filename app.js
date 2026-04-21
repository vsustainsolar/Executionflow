// ============================================================
// VSUSTAIN SOLAR — FIELD APP
// Main application logic
// ============================================================

// ---- State ----
let allProjects = [];
let filteredProjects = [];
let activeProject = null;
let selectedExecutionStage = null;
let selectedOnsiteStage = null;
let userLocation = null;
let activeFilter = "all";
let searchQuery = "";

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  setMonthBadge();
  requestLocation();
  loadProjects();
  bindSearch();
  bindFilters();
});

// ---- Set Month Badge ----
function setMonthBadge() {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();
  document.getElementById("monthBadge").textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ---- Request Location ----
function requestLocation() {
  const pill = document.getElementById("locationText");
  if (!navigator.geolocation) {
    pill.textContent = "Location N/A";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = {
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
        accuracy: Math.round(pos.coords.accuracy),
      };
      pill.textContent = `${userLocation.lat}, ${userLocation.lng}`;
    },
    (err) => {
      pill.textContent = "Location denied";
      userLocation = null;
    },
    { timeout: 8000, enableHighAccuracy: true }
  );
}

// ---- Load Projects from Apps Script ----
async function loadProjects() {
  const loading = document.getElementById("loadingState");
  const errorEl = document.getElementById("errorState");
  const list = document.getElementById("projectList");

  loading.classList.remove("hidden");
  errorEl.classList.add("hidden");

  // Clear existing cards
  list.querySelectorAll(".project-card").forEach(c => c.remove());
  document.querySelector(".empty-state")?.remove();

  try {
    // Apps Script returns JSON. We append ?action=getProjects
    const url = CONFIG.SHEET_API_URL + "?action=getProjects";
    const res = await fetch(url);

    if (!res.ok) throw new Error("HTTP " + res.status);

    const json = await res.json();

    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Unexpected response format");
    }

    // Map rows to project objects
    allProjects = json.data.map(rowToProject).filter(p => p.recordId);

    renderStats();
    applyFilters();

  } catch (err) {
    console.error("Load error:", err);
    errorEl.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
  }
}

// ---- Map Sheet Row → Project Object ----
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
  };
}

// ---- Render Stats ----
function renderStats() {
  document.getElementById("totalProjects").textContent = allProjects.length;
  document.getElementById("activeProjects").textContent =
    allProjects.filter(p => p.status === "In Progress").length;

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("todayUpdates").textContent =
    allProjects.filter(p => p.timestamp && p.timestamp.startsWith(today)).length;
}

// ---- Search Binding ----
function bindSearch() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });
}

// ---- Filter Binding ----
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

// ---- Apply Search + Filter ----
function applyFilters() {
  filteredProjects = allProjects.filter(p => {
    const matchesFilter = activeFilter === "all" || p.status === activeFilter;
    const matchesSearch = !searchQuery ||
      p.projectName.toLowerCase().includes(searchQuery) ||
      p.customerName.toLowerCase().includes(searchQuery) ||
      p.phone.includes(searchQuery) ||
      p.addressCity.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  renderProjects();
}

// ---- Render Project Cards ----
function renderProjects() {
  const list = document.getElementById("projectList");

  // Remove existing cards and empty state
  list.querySelectorAll(".project-card, .empty-state").forEach(el => el.remove());

  if (filteredProjects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = searchQuery
      ? `<p>No projects match "${searchQuery}"</p>`
      : "<p>No projects found for this filter.</p>";
    list.appendChild(empty);
    return;
  }

  filteredProjects.forEach((project, idx) => {
    const card = buildCard(project, idx);
    list.appendChild(card);
  });
}

// ---- Build Card Element ----
function buildCard(project, idx) {
  const div = document.createElement("div");
  div.className = "project-card";
  div.style.animationDelay = `${idx * 40}ms`;

  const statusClass = {
    "New": "badge-new",
    "In Progress": "badge-active",
    "Complete": "badge-complete",
  }[project.status] || "badge-new";

  const address = [project.addressCity, project.addressState]
    .filter(Boolean).join(", ");

  div.innerHTML = `
    <div class="card-top">
      <div class="card-name">${esc(project.projectName)}</div>
      <span class="card-badge ${statusClass}">${esc(project.status)}</span>
    </div>
    <div class="card-customer">
      <span>👤</span> ${esc(project.customerName)}
    </div>
    <div class="card-meta">
      ${project.phone ? `<span class="card-meta-item">📞 ${esc(project.phone)}</span>` : ""}
      ${address ? `<span class="card-meta-item">📍 ${esc(address)}</span>` : ""}
      ${project.projectType ? `<span class="card-meta-item">⚡ ${esc(project.projectType)}</span>` : ""}
    </div>
    <div class="card-stage">
      <span class="stage-label">Stage</span>
      <span class="stage-value">${esc(project.executionStage || "—")}</span>
      <span class="card-arrow">›</span>
    </div>
  `;

  div.addEventListener("click", () => openModal(project));
  return div;
}

// ---- Open Detail Modal ----
function openModal(project) {
  activeProject = project;
  selectedExecutionStage = null;
  selectedOnsiteStage = null;

  // Populate header
  document.getElementById("modalProjectName").textContent = project.projectName;
  document.getElementById("modalCustomer").textContent = project.customerName || "—";
  document.getElementById("modalPhone").textContent = project.phone || "—";
  document.getElementById("modalType").textContent = project.projectType || "—";
  document.getElementById("modalCurrentStage").textContent = project.executionStage || "Not set";

  // Full address
  const parts = [
    project.addressStreet,
    project.addressCity,
    project.addressState,
    project.addressZip,
    project.addressCountry
  ].filter(Boolean);
  document.getElementById("modalAddress").textContent = parts.join(", ") || "—";

  // Render stage options
  renderStageOptions("execution");
  renderStageOptions("onsite");

  // Reset to execution panel
  showStagePanel("execution");

  // Reset buttons
  document.getElementById("btnSubmitExecution").disabled = true;
  document.getElementById("btnOpenForm").disabled = true;

  // Clear feedback
  const fb = document.getElementById("execFeedback");
  fb.classList.add("hidden");
  fb.classList.remove("error");
  fb.textContent = "";

  // Show modal
  const modal = document.getElementById("detailModal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

// ---- Close Modal ----
function closeModal() {
  document.getElementById("detailModal").classList.add("hidden");
  document.body.style.overflow = "";
  activeProject = null;
  selectedExecutionStage = null;
  selectedOnsiteStage = null;
}

// Close on overlay click
document.getElementById("detailModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ---- Render Stage Options ----
function renderStageOptions(type) {
  const stages = type === "execution"
    ? CONFIG.EXECUTION_STAGES
    : CONFIG.ONSITE_STAGES;
  const containerId = type === "execution" ? "executionStageList" : "onsiteStageList";
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  stages.forEach(stage => {
    const div = document.createElement("div");
    div.className = "stage-option";
    div.dataset.stage = stage;
    div.dataset.type = type;

    div.innerHTML = `
      <div class="stage-radio"></div>
      <span class="stage-text">${esc(stage)}</span>
    `;

    div.addEventListener("click", () => selectStage(type, stage, div));
    container.appendChild(div);
  });
}

// ---- Select Stage ----
function selectStage(type, stage, clickedEl) {
  const containerId = type === "execution" ? "executionStageList" : "onsiteStageList";
  document.querySelectorAll(`#${containerId} .stage-option`).forEach(el => {
    el.classList.remove("selected");
  });
  clickedEl.classList.add("selected");

  if (type === "execution") {
    selectedExecutionStage = stage;
    document.getElementById("btnSubmitExecution").disabled = false;
  } else {
    selectedOnsiteStage = stage;
    document.getElementById("btnOpenForm").disabled = false;
  }
}

// ---- Show Stage Panel ----
function showStagePanel(type) {
  document.getElementById("panelExecution").classList.toggle("hidden", type !== "execution");
  document.getElementById("panelOnsite").classList.toggle("hidden", type !== "onsite");
  document.getElementById("btnExecution").classList.toggle("active", type === "execution");
  document.getElementById("btnOnsite").classList.toggle("active", type === "onsite");
}

// ---- Submit Execution Stage → n8n ----
async function submitExecutionStage() {
  if (!activeProject || !selectedExecutionStage) return;

  const btn = document.getElementById("btnSubmitExecution");
  const feedback = document.getElementById("execFeedback");
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = "Sending...";
  feedback.classList.add("hidden");

  const payload = {
    type: "execution_stage_update",
    recordId: activeProject.recordId,
    projectId: activeProject.projectId,
    projectName: activeProject.projectName,
    customerName: activeProject.customerName,
    phone: activeProject.phone,
    stage: selectedExecutionStage,
    updatedAt: new Date().toISOString(),
    location: userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng, accuracy: userLocation.accuracy }
      : null,
  };

  try {
    const res = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Server returned " + res.status);

    // Success
    feedback.textContent = `Stage updated to "${selectedExecutionStage}" successfully.`;
    feedback.classList.remove("hidden", "error");

    // Update the local project object so card refreshes
    activeProject.executionStage = selectedExecutionStage;

    // Optionally close after delay
    setTimeout(() => {
      closeModal();
      // Re-render the project list so the updated stage shows
      renderProjects();
    }, 1800);

  } catch (err) {
    console.error("Submit error:", err);
    feedback.textContent = "Failed to send update. Please check your connection and try again.";
    feedback.classList.remove("hidden");
    feedback.classList.add("error");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ---- Open Google Form (On-Site Stage) ----
function openGoogleForm() {
  if (!activeProject || !selectedOnsiteStage) return;

  const params = new URLSearchParams({
    "usp": "pp_url",
    [CONFIG.FORM_ENTRY_NAME]:  activeProject.customerName || "",
    [CONFIG.FORM_ENTRY_ID]:    activeProject.recordId     || "",
    [CONFIG.FORM_ENTRY_PHONE]: activeProject.phone        || "",
  });

  const formUrl = `${CONFIG.GOOGLE_FORM_BASE}?${params.toString()}`;

  // Open in new tab (mobile browsers will navigate)
  window.open(formUrl, "_blank");
}

// ---- Escape HTML ----
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
