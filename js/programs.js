// js/programs.js — Programs & Settings Dashboard
import {
  db, currentUser, tenantSettings, defaultSettings, showMsg,
  setOnAuthReady, initApp, doc, setDoc, escapeHTML
} from "./shared.js";

// Local state for editing
let localConfig = {
  membership_programs: [],
  hourly_slots: [],
  coaching_schedule: [],
  fee_structure: []
};

setOnAuthReady(() => {
  if (!tenantSettings) {
    document.getElementById("tab-memberships").innerHTML = `<div class="members-empty-state"><div class="empty-icon">⚠️</div><p>No settings found. Please complete first-time setup on the dashboard.</p></div>`;
    return;
  }
  
  // Initialize local config
  localConfig.membership_programs = JSON.parse(JSON.stringify(tenantSettings.membership_programs || []));
  localConfig.hourly_slots = JSON.parse(JSON.stringify(tenantSettings.hourly_slots || []));
  localConfig.coaching_schedule = JSON.parse(JSON.stringify(tenantSettings.coaching_schedule || []));
  localConfig.fee_structure = JSON.parse(JSON.stringify(tenantSettings.fee_structure || []));
  localConfig.operating_hours = JSON.parse(JSON.stringify(tenantSettings.operating_hours || { start: "05:00", end: "23:00" }));

  const opStart = document.getElementById("opStart");
  const opEnd = document.getElementById("opEnd");
  if (opStart) opStart.value = localConfig.operating_hours.start;
  if (opEnd) opEnd.value = localConfig.operating_hours.end;

  const courtBadge = document.getElementById("courtCountValue");
  if (courtBadge && tenantSettings && tenantSettings.court_count) {
    courtBadge.textContent = tenantSettings.court_count;
  }

  setupTabs();
  setupModals();
  renderAll();

  const btnSave = document.getElementById("btnSavePrograms");
  if (btnSave) btnSave.addEventListener("click", handleSave);
});

// ── Tabs ──────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".prog-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".prog-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".prog-view").forEach(v => v.classList.remove("active"));
      btn.classList.add("active");
      const tabId = "tab-" + btn.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });
}

// ── Modals Setup ──────────────────────────────────────────
function setupModals() {
  const closeBtn = (id) => { const e = document.getElementById(id); if(e) e.addEventListener("click", (ev) => ev.target.closest('.modal-overlay').classList.add('hidden')); };
  closeBtn("closeMembershipModal");
  closeBtn("closeHourlyModal");
  closeBtn("closeCoachingModal");
  closeBtn("closeFeeModal");

  document.getElementById("btnAddMembership").addEventListener("click", () => openMembershipModal());
  document.getElementById("btnAddHourly").addEventListener("click", () => openHourlyModal());
  document.getElementById("btnAddCoaching").addEventListener("click", () => openCoachingModal());
  document.getElementById("btnAddFeePlan").addEventListener("click", () => openFeeModal());

  document.getElementById("membershipForm").addEventListener("submit", saveMembership);
  document.getElementById("hourlyForm").addEventListener("submit", saveHourly);
  document.getElementById("coachingForm").addEventListener("submit", saveCoaching);
  document.getElementById("feeForm").addEventListener("submit", saveFeePlan);

  document.getElementById("btnAddTimingSlot").addEventListener("click", () => addTimingSlotInput());
  document.getElementById("btnAddPricingVariant").addEventListener("click", () => addPricingVariantInput());
}

function renderAll() {
  renderMemberships();
  renderHourly();
  renderCoaching();
  renderFees();
}

// ── Memberships ───────────────────────────────────────────
function renderMemberships() {
  const grid = document.getElementById("membershipsGrid");
  grid.innerHTML = "";
  if (localConfig.membership_programs.length === 0) {
    grid.innerHTML = `<p class="text-muted">No membership programs configured.</p>`;
    return;
  }
  localConfig.membership_programs.forEach((m, idx) => {
    const card = document.createElement("div");
    card.className = "plan-card";
    card.style.background = "var(--surface2)";
    card.style.padding = "1.5rem";
    card.style.borderRadius = "var(--radius-md)";
    card.style.position = "relative";
    card.innerHTML = `
      <div style="position:absolute; top:1rem; right:1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline edit-mem" data-idx="${idx}">✏️</button>
        <button class="btn btn-sm btn-outline text-danger del-mem" data-idx="${idx}">🗑️</button>
      </div>
      <div style="font-size:0.75rem; color:var(--accent); font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">${escapeHTML(m.type)}</div>
      <h4 style="margin-bottom:0.25rem; font-size:1.1rem;">${escapeHTML(m.duration_days)}</h4>
      <p style="color:var(--muted); font-size:0.85rem; margin-bottom:1rem;">${escapeHTML(m.days_description)}</p>
      <div style="font-size:1.5rem; font-weight:700;">₹${escapeHTML(String(m.fee_per_month))} <span style="font-size:0.85rem; color:var(--muted); font-weight:normal;">/ month</span></div>
      ${m.special_notes ? `<div style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-muted); background:var(--bg); padding:0.4rem; border-radius:4px;">${escapeHTML(m.special_notes)}</div>` : ''}
    `;
    grid.appendChild(card);
  });
  document.querySelectorAll(".edit-mem").forEach(b => b.addEventListener("click", (e) => openMembershipModal(e.currentTarget.dataset.idx)));
  document.querySelectorAll(".del-mem").forEach(b => b.addEventListener("click", (e) => {
    localConfig.membership_programs.splice(e.currentTarget.dataset.idx, 1);
    renderMemberships();
  }));
}

function openMembershipModal(idx = null) {
  const form = document.getElementById("membershipForm");
  form.reset();
  document.getElementById("memKey").value = idx !== null ? idx : "";
  document.getElementById("membershipModalTitle").textContent = idx !== null ? "Edit" : "Add";
  
  if (idx !== null) {
    const m = localConfig.membership_programs[idx];
    document.getElementById("memType").value = m.type;
    document.getElementById("memDuration").value = m.duration_days;
    document.getElementById("memDays").value = m.days_description;
    document.getElementById("memFee").value = m.fee_per_month;
    document.getElementById("memNotes").value = m.special_notes || "";
  }
  document.getElementById("membershipModal").classList.remove("hidden");
}

function saveMembership(e) {
  e.preventDefault();
  const idx = document.getElementById("memKey").value;
  const m = {
    type: document.getElementById("memType").value,
    duration_days: document.getElementById("memDuration").value,
    days_description: document.getElementById("memDays").value,
    fee_per_month: parseInt(document.getElementById("memFee").value, 10),
    special_notes: document.getElementById("memNotes").value,
    key: document.getElementById("memType").value + "_" + document.getElementById("memDuration").value.replace(/\s+/g, '')
  };
  if (idx !== "") localConfig.membership_programs[idx] = m;
  else localConfig.membership_programs.push(m);
  document.getElementById("membershipModal").classList.add("hidden");
  renderMemberships();
}

// ── Hourly Slots ──────────────────────────────────────────
function renderHourly() {
  const grid = document.getElementById("hourlyGrid");
  grid.innerHTML = "";
  if (localConfig.hourly_slots.length === 0) {
    grid.innerHTML = `<p class="text-muted">No hourly slots configured.</p>`;
    return;
  }
  localConfig.hourly_slots.forEach((h, idx) => {
    const card = document.createElement("div");
    card.style.background = "var(--surface2)";
    card.style.padding = "1.5rem";
    card.style.borderRadius = "var(--radius-md)";
    card.style.position = "relative";
    card.innerHTML = `
      <div style="position:absolute; top:1rem; right:1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline edit-hr" data-idx="${idx}">✏️</button>
        <button class="btn btn-sm btn-outline text-danger del-hr" data-idx="${idx}">🗑️</button>
      </div>
      <div style="font-size:0.75rem; color:var(--accent); font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">HOURLY SLOT</div>
      <h4 style="margin-bottom:0.25rem; font-size:1.1rem;">${escapeHTML(h.type)}</h4>
      <div style="margin-top:1rem; font-size:1.5rem; font-weight:700;">₹${escapeHTML(String(h.rate))} <span style="font-size:0.85rem; color:var(--muted); font-weight:normal;">${escapeHTML(h.unit)}</span></div>
    `;
    grid.appendChild(card);
  });
  document.querySelectorAll(".edit-hr").forEach(b => b.addEventListener("click", (e) => openHourlyModal(e.currentTarget.dataset.idx)));
  document.querySelectorAll(".del-hr").forEach(b => b.addEventListener("click", (e) => {
    localConfig.hourly_slots.splice(e.currentTarget.dataset.idx, 1);
    renderHourly();
  }));
}

function openHourlyModal(idx = null) {
  const form = document.getElementById("hourlyForm");
  form.reset();
  document.getElementById("hourIndex").value = idx !== null ? idx : "";
  document.getElementById("hourlyModalTitle").textContent = idx !== null ? "Edit" : "Add";
  
  if (idx !== null) {
    const h = localConfig.hourly_slots[idx];
    document.getElementById("hourType").value = h.type;
    document.getElementById("hourRate").value = h.rate;
    document.getElementById("hourUnit").value = h.unit;
  }
  document.getElementById("hourlyModal").classList.remove("hidden");
}

function saveHourly(e) {
  e.preventDefault();
  const idx = document.getElementById("hourIndex").value;
  const h = {
    type: document.getElementById("hourType").value,
    rate: parseInt(document.getElementById("hourRate").value, 10),
    unit: document.getElementById("hourUnit").value
  };
  if (idx !== "") localConfig.hourly_slots[idx] = h;
  else localConfig.hourly_slots.push(h);
  document.getElementById("hourlyModal").classList.add("hidden");
  renderHourly();
}

// ── Coaching Schedule ─────────────────────────────────────
function renderCoaching() {
  const grid = document.getElementById("coachingGrid");
  grid.innerHTML = "";
  if (localConfig.coaching_schedule.length === 0) {
    grid.innerHTML = `<p class="text-muted">No coaching schedules configured.</p>`;
    return;
  }
  localConfig.coaching_schedule.forEach((c, idx) => {
    const card = document.createElement("div");
    card.style.background = "var(--surface2)";
    card.style.padding = "1.5rem";
    card.style.borderRadius = "var(--radius-md)";
    card.style.position = "relative";
    let slotsHtml = (c.timing_slots || []).map(t => `<div style="background:rgba(0,255,170,0.1); color:var(--accent); border:1px solid rgba(0,255,170,0.2); padding:0.3rem 0.6rem; border-radius:4px; font-size:0.8rem; font-family:var(--font-mono); display:inline-block; margin:0.25rem;">${escapeHTML(t)}</div>`).join('');
    
    card.innerHTML = `
      <div style="position:absolute; top:1rem; right:1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline edit-coach" data-idx="${idx}">✏️</button>
        <button class="btn btn-sm btn-outline text-danger del-coach" data-idx="${idx}">🗑️</button>
      </div>
      <h4 style="margin-bottom:0.25rem; font-size:1.1rem;">${escapeHTML(c.category)}</h4>
      <p style="color:var(--muted); font-size:0.85rem; margin-bottom:1rem;">${escapeHTML(c.days)}</p>
      <div>${slotsHtml || '<span class="text-muted">No timing slots defined.</span>'}</div>
    `;
    grid.appendChild(card);
  });
  document.querySelectorAll(".edit-coach").forEach(b => b.addEventListener("click", (e) => openCoachingModal(e.currentTarget.dataset.idx)));
  document.querySelectorAll(".del-coach").forEach(b => b.addEventListener("click", (e) => {
    localConfig.coaching_schedule.splice(e.currentTarget.dataset.idx, 1);
    renderCoaching();
  }));
}

function openCoachingModal(idx = null) {
  const form = document.getElementById("coachingForm");
  form.reset();
  document.getElementById("coachIndex").value = idx !== null ? idx : "";
  document.getElementById("coachingModalTitle").textContent = idx !== null ? "Edit" : "Add";
  document.getElementById("timingSlotsContainer").innerHTML = "";
  
  if (idx !== null) {
    const c = localConfig.coaching_schedule[idx];
    document.getElementById("coachCat").value = c.category;
    document.getElementById("coachDays").value = c.days;
    if (c.timing_slots) {
      c.timing_slots.forEach(t => addTimingSlotInput(t));
    }
  } else {
    addTimingSlotInput();
  }
  document.getElementById("coachingModal").classList.remove("hidden");
}

function addTimingSlotInput(val = "") {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.gap = "0.5rem";
  div.innerHTML = `
    <input type="text" class="t-slot-input" placeholder="e.g. 05:30 AM - 06:30 AM" value="${escapeHTML(val)}" style="flex:1" required />
    <button type="button" class="btn btn-sm btn-outline text-danger" onclick="this.parentElement.remove()">X</button>
  `;
  document.getElementById("timingSlotsContainer").appendChild(div);
}

function saveCoaching(e) {
  e.preventDefault();
  const idx = document.getElementById("coachIndex").value;
  const slots = Array.from(document.querySelectorAll(".t-slot-input")).map(i => i.value.trim()).filter(v => v);
  const c = {
    category: document.getElementById("coachCat").value,
    days: document.getElementById("coachDays").value,
    timing_slots: slots
  };
  if (idx !== "") localConfig.coaching_schedule[idx] = c;
  else localConfig.coaching_schedule.push(c);
  document.getElementById("coachingModal").classList.add("hidden");
  renderCoaching();
}

// ── Fee Structure ─────────────────────────────────────────
function renderFees() {
  const tbody = document.getElementById("feeTableBody");
  tbody.innerHTML = "";
  if (localConfig.fee_structure.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No fee plans configured.</td></tr>`;
    return;
  }
  localConfig.fee_structure.forEach((f, idx) => {
    f.pricing_variants.forEach((v, vidx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:600;">${vidx === 0 ? escapeHTML(f.program_name) : ''}</td>
        <td>${escapeHTML(v.frequency)}</td>
        <td style="font-family:var(--font-mono); font-weight:700;">₹${escapeHTML(String(v.cost))}</td>
        <td>
          ${vidx === 0 ? `<button class="btn btn-sm btn-outline edit-fee" data-idx="${idx}">✏️</button>
          <button class="btn btn-sm btn-outline text-danger del-fee" data-idx="${idx}">🗑️</button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
  document.querySelectorAll(".edit-fee").forEach(b => b.addEventListener("click", (e) => openFeeModal(e.currentTarget.dataset.idx)));
  document.querySelectorAll(".del-fee").forEach(b => b.addEventListener("click", (e) => {
    localConfig.fee_structure.splice(e.currentTarget.dataset.idx, 1);
    renderFees();
  }));
}

function openFeeModal(idx = null) {
  const form = document.getElementById("feeForm");
  form.reset();
  document.getElementById("feeIndex").value = idx !== null ? idx : "";
  document.getElementById("feeModalTitle").textContent = idx !== null ? "Edit" : "Add";
  document.getElementById("pricingVariantsContainer").innerHTML = "";
  
  if (idx !== null) {
    const f = localConfig.fee_structure[idx];
    document.getElementById("feeProgram").value = f.program_name;
    if (f.pricing_variants) {
      f.pricing_variants.forEach(v => addPricingVariantInput(v.frequency, v.cost));
    }
  } else {
    addPricingVariantInput();
  }
  document.getElementById("feeModal").classList.remove("hidden");
}

function addPricingVariantInput(freq = "", cost = "") {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.gap = "0.5rem";
  div.innerHTML = `
    <input type="text" class="v-freq-input" placeholder="Frequency (e.g. 5 Days)" value="${escapeHTML(freq)}" style="flex:2" required />
    <input type="number" class="v-cost-input" placeholder="Cost (₹)" value="${escapeHTML(String(cost))}" style="flex:1" min="0" required />
    <button type="button" class="btn btn-sm btn-outline text-danger" onclick="this.parentElement.remove()">X</button>
  `;
  document.getElementById("pricingVariantsContainer").appendChild(div);
}

function saveFeePlan(e) {
  e.preventDefault();
  const idx = document.getElementById("feeIndex").value;
  const variants = [];
  const freqs = document.querySelectorAll(".v-freq-input");
  const costs = document.querySelectorAll(".v-cost-input");
  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i].value && costs[i].value) {
      variants.push({ frequency: freqs[i].value, cost: parseInt(costs[i].value, 10), key: document.getElementById("feeProgram").value.replace(/\s+/g, '') + "_" + freqs[i].value.replace(/\s+/g, '') });
    }
  }
  
  const f = {
    program_name: document.getElementById("feeProgram").value,
    pricing_variants: variants
  };
  if (idx !== "") localConfig.fee_structure[idx] = f;
  else localConfig.fee_structure.push(f);
  document.getElementById("feeModal").classList.add("hidden");
  renderFees();
}

// ── Global Save ───────────────────────────────────────────
async function handleSave() {
  if (!currentUser || currentUser.isAnonymous) {
    showMsg("programsSaveMsg", "Permission Denied: Guests cannot modify academy configurations.", "error");
    return;
  }

  const btn = document.getElementById("btnSavePrograms");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const updatedSettings = {
      ...tenantSettings,
      membership_programs: localConfig.membership_programs,
      fee_structure: localConfig.fee_structure,
      coaching_schedule: localConfig.coaching_schedule,
      hourly_slots: localConfig.hourly_slots,
      operating_hours: {
        start: document.getElementById("opStart")?.value || "05:00",
        end: document.getElementById("opEnd")?.value || "23:00"
      }
    };

    if (!db) throw new Error("Database connection not active.");
    await setDoc(doc(db, "academies", currentUser.academyId), updatedSettings);
    
    // Update local global state
    Object.assign(tenantSettings, updatedSettings);
    
    showMsg("programsSaveMsg", "Academy programs and fees updated successfully!", "success");
  } catch (err) {
    showMsg("programsSaveMsg", "Failed to save: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save All Changes";
  }
}

function bootstrap() {
  initApp();
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
