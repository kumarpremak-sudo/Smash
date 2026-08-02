// js/programs.js — Programs & Settings Dashboard
import {
  db, currentUser, tenantSettings, defaultSettings, showMsg,
  setOnAuthReady, initApp, doc, setDoc, escapeHTML, format12Hour, parse12HourTo24Hour,
  isSuperAdmin, isTenantAdmin, isStrictCoach
} from "./shared.js";

// Local state for editing
let localConfig = {
  membership_programs: [],
  hourly_slots: [],
  coaching_schedule: [],
  fee_structure: []
};

function canEditPrograms() {
  return currentUser && (isSuperAdmin(currentUser) || isTenantAdmin(currentUser) || (tenantSettings && tenantSettings.allow_staff_program_edit));
}

setOnAuthReady((user) => {
  if (isStrictCoach(user)) {
    window.location.href = "coach.html";
    return;
  }
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
  
  if (!canEditPrograms()) {
    if (opStart) opStart.disabled = true;
    if (opEnd) opEnd.disabled = true;
  }
  
  function populateTimeSelect(select) {
    if (!select) return;
    select.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, "0");
      const val = `${hh}:00`;
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = format12Hour(val);
      select.appendChild(opt);
    }
  }
  populateTimeSelect(opStart);
  populateTimeSelect(opEnd);

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
  if (btnSave) {
    if (!canEditPrograms()) {
      btnSave.style.display = "none";
      const container = btnSave.parentElement;
      const banner = document.createElement("div");
      banner.style = "background: rgba(255,107,107,0.1); color: var(--accent3); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--accent3); text-align: center; margin-bottom: 1rem; width: 100%;";
      banner.innerHTML = "🔒 <strong>View Only:</strong> Only Tenant Admins can edit programs. Ask your admin to enable staff editing in Settings.";
      container.insertBefore(banner, btnSave);

      ['btnAddMembership', 'btnAddHourly', 'btnAddCoaching', 'btnAddFeePlan'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "none";
      });
    } else {
      btnSave.addEventListener("click", handleSave);
    }
  }
});

let autoSaveTimeout = null;
function triggerAutoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    handleSave();
  }, 1000);
}

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

  // Autosave for Operating Hours
  const opStart = document.getElementById("opStart");
  const opEnd = document.getElementById("opEnd");
  if (opStart) opStart.addEventListener("change", () => { localConfig.operating_hours.start = opStart.value; triggerAutoSave(); });
  if (opEnd) opEnd.addEventListener("change", () => { localConfig.operating_hours.end = opEnd.value; triggerAutoSave(); });
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
      ${canEditPrograms() ? `
      <div style="position:absolute; top:1rem; right:1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline edit-mem" data-idx="${idx}">✏️</button>
        <button class="btn btn-sm btn-outline text-danger del-mem" data-idx="${idx}">🗑️</button>
      </div>` : ''}
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
    triggerAutoSave();
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
  triggerAutoSave();
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
      ${canEditPrograms() ? `
      <div style="position:absolute; top:1rem; right:1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline edit-hr" data-idx="${idx}">✏️</button>
        <button class="btn btn-sm btn-outline text-danger del-hr" data-idx="${idx}">🗑️</button>
      </div>` : ''}
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
    triggerAutoSave();
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
  triggerAutoSave();
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
    let slotsHtml = (c.timing_slots || []).map(t => {
      const parts = t.split(/[-–—]|to/i);
      let displayStr = t;
      if (parts.length === 2) {
        const s24 = parse12HourTo24Hour(parts[0].trim());
        const e24 = parse12HourTo24Hour(parts[1].trim());
        if (s24 && e24) {
          displayStr = `${format12Hour(s24)} - ${format12Hour(e24)}`;
        }
      }
      return `<div style="background:rgba(0,255,170,0.1); color:var(--accent); border:1px solid rgba(0,255,170,0.2); padding:0.3rem 0.6rem; border-radius:4px; font-size:0.8rem; font-family:var(--font-mono); display:inline-block; margin:0.25rem;">${escapeHTML(displayStr)}</div>`;
    }).join('');
    
    card.innerHTML = `
      ${canEditPrograms() ? `
      <div style="position:absolute; top:1rem; right:1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-sm btn-outline edit-coach" data-idx="${idx}">✏️</button>
        <button class="btn btn-sm btn-outline text-danger del-coach" data-idx="${idx}">🗑️</button>
      </div>` : ''}
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
    triggerAutoSave();
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
  let start24 = "06:00";
  let end24 = "07:00";

  if (val) {
    const parts = val.split(/[-–—]|to/i);
    if (parts.length >= 2) {
      start24 = parse12HourTo24Hour(parts[0].trim()) || "06:00";
      end24 = parse12HourTo24Hour(parts[1].trim()) || "07:00";
    }
  }

  const div = document.createElement("div");
  div.className = "timing-slot-row";
  div.style.cssText = "display:flex; gap:0.5rem; align-items:center; margin-bottom:0.5rem;";

  const startSelect = document.createElement("select");
  startSelect.className = "form-control t-slot-start";
  startSelect.style.cssText = "flex:1; height:36px; padding:0 8px;";

  const endSelect = document.createElement("select");
  endSelect.className = "form-control t-slot-end";
  endSelect.style.cssText = "flex:1; height:36px; padding:0 8px;";

  // Generate 30-min time options from 04:00 to 24:00 (12:00 AM Midnight)
  const timesList = [];
  for (let h = 4; h <= 23; h++) {
    timesList.push(`${String(h).padStart(2, "0")}:00`);
    timesList.push(`${String(h).padStart(2, "0")}:30`);
  }
  timesList.push("24:00"); // Represents 12:00 AM Midnight for end times

  timesList.forEach(time24 => {
    if (time24 !== "24:00") {
      const time12 = format12Hour(time24);
      const optS = document.createElement("option");
      optS.value = time24;
      optS.textContent = time12;
      if (time24 === start24) optS.selected = true;
      startSelect.appendChild(optS);
    }

    const displayTimeE = time24 === "24:00" ? "12:00 AM (Midnight)" : format12Hour(time24);
    const optE = document.createElement("option");
    optE.value = time24;
    optE.textContent = displayTimeE;
    if (time24 === end24 || (time24 === "24:00" && (end24 === "00:00" || end24 === "24:00"))) optE.selected = true;
    endSelect.appendChild(optE);
  });

  div.appendChild(startSelect);
  
  const spanTo = document.createElement("span");
  spanTo.style.cssText = "color:var(--muted); font-size:0.85rem; font-weight:600;";
  spanTo.textContent = "to";
  div.appendChild(spanTo);

  div.appendChild(endSelect);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-sm btn-outline text-danger";
  removeBtn.style.cssText = "padding:2px 8px; font-weight:bold;";
  removeBtn.textContent = "✕";
  removeBtn.onclick = () => div.remove();
  div.appendChild(removeBtn);

  document.getElementById("timingSlotsContainer").appendChild(div);
}

function saveCoaching(e) {
  e.preventDefault();
  const idx = document.getElementById("coachIndex").value;
  const rows = document.querySelectorAll("#timingSlotsContainer .timing-slot-row");
  
  const slots = [];
  for (const r of rows) {
    const startSelect = r.querySelector(".t-slot-start");
    const endSelect = r.querySelector(".t-slot-end");
    if (!startSelect || !endSelect) continue;

    const start24 = startSelect.value;
    const end24 = endSelect.value;

    const startMins = parseInt(start24.split(":")[0], 10) * 60 + parseInt(start24.split(":")[1], 10);
    const endMins = end24 === "24:00" ? 24 * 60 : (parseInt(end24.split(":")[0], 10) * 60 + parseInt(end24.split(":")[1], 10));

    if (startMins >= endMins) {
      showMsg("programsSaveMsg", "Start time must be strictly earlier than End time for timing slots.", "error");
      return;
    }

    const endFormatted = end24 === "24:00" ? "12:00 AM" : format12Hour(end24);
    const slotStr = `${format12Hour(start24)} - ${endFormatted}`;
    slots.push(slotStr);
  }

  // Deduplicate slots in same batch
  const uniqueSlots = Array.from(new Set(slots));

  const c = {
    category: document.getElementById("coachCat").value,
    days: document.getElementById("coachDays").value,
    timing_slots: uniqueSlots
  };
  if (idx !== "") localConfig.coaching_schedule[idx] = c;
  else localConfig.coaching_schedule.push(c);
  document.getElementById("coachingModal").classList.add("hidden");
  renderCoaching();
  triggerAutoSave();
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
          ${vidx === 0 && canEditPrograms() ? `<button class="btn btn-sm btn-outline edit-fee" data-idx="${idx}">✏️</button>
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
    triggerAutoSave();
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
  const progNameRaw = document.getElementById("feeProgram").value.trim();
  const cleanProgName = progNameRaw.replace(/[^a-zA-Z0-9_]/g, '');
  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i].value && costs[i].value) {
      const cleanFreq = freqs[i].value.replace(/[^a-zA-Z0-9_]/g, '');
      variants.push({ frequency: freqs[i].value.trim(), cost: parseInt(costs[i].value, 10), key: `${cleanProgName}_${cleanFreq}` });
    }
  }
  
  const f = {
    program_name: progNameRaw,
    pricing_variants: variants
  };
  if (idx !== "") {
    const oldName = localConfig.fee_structure[idx]?.program_name;
    if (oldName && oldName !== progNameRaw) {
      localConfig.coaching_schedule.forEach(cs => {
        if (cs.category === oldName || cs.category.toLowerCase() === oldName.toLowerCase()) {
          cs.category = progNameRaw;
        }
      });
      renderCoaching();
    }
    localConfig.fee_structure[idx] = f;
  } else {
    localConfig.fee_structure.push(f);
  }

  document.getElementById("feeModal").classList.add("hidden");
  renderFees();
  triggerAutoSave();
}

async function syncUpcomingCoachingBookings(coachingSchedule) {
  if (!db || !currentUser?.academyId || !coachingSchedule) return;
  try {
    const todayStr = formatSelectedDate(new Date());
    const q = query(
      collection(db, "bookings"),
      where("academyId", "==", currentUser.academyId),
      where("booking_type", "==", "Coaching")
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    let count = 0;

    snap.forEach(d => {
      const bData = d.data();
      if (bData.date < todayStr || bData.status === "cancelled") return;

      // Find matching coaching schedule by category (with fuzzy matching for variations like Kids vs Kids Coaching)
      const match = coachingSchedule.find(cs => 
        cs.category && bData.category && (
          cs.category.toLowerCase() === bData.category.toLowerCase() ||
          cs.category.toLowerCase().includes(bData.category.toLowerCase()) ||
          bData.category.toLowerCase().includes(cs.category.toLowerCase())
        )
      );

      if (match && match.timing_slots && match.timing_slots.length > 0) {
        // Multi-slot aware: match student's current slot or default to primary slot
        let targetSlot = match.timing_slots[0];
        if (match.timing_slots.length > 1 && bData.start_time) {
          const foundSlot = match.timing_slots.find(t => {
            const parts = t.split(/[-–—]|to/i);
            if (parts.length === 2) {
              const st = format12Hour(parse12HourTo24Hour(parts[0].trim()));
              return st === bData.start_time;
            }
            return false;
          });
          if (foundSlot) targetSlot = foundSlot;
        }

        const parts = targetSlot.split(/[-–—]|to/i);
        if (parts.length === 2) {
          const newStart = format12Hour(parse12HourTo24Hour(parts[0].trim()));
          const newEnd = format12Hour(parse12HourTo24Hour(parts[1].trim()));
          if (newStart && newEnd && (bData.start_time !== newStart || bData.end_time !== newEnd)) {
            batch.update(doc(db, "bookings", d.id), {
              start_time: newStart,
              end_time: newEnd
            });
            count++;
          }
        }
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Updated ${count} upcoming coaching reservation slots to match new program timing.`);
    }
  } catch (err) {
    console.error("Error syncing coaching bookings:", err);
  }
}

// ── Global Save ───────────────────────────────────────────
async function handleSave() {
  if (!canEditPrograms()) {
    showMsg("programsSaveMsg", "Permission Denied: You do not have permission to modify configurations.", "error");
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

    // Sync upcoming coaching reservations with new time slots
    await syncUpcomingCoachingBookings(localConfig.coaching_schedule);
    
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
