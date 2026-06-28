// js/members.js — Members Management & Fee Alerts
import {
  db, currentUser, membersList, tenantSettings, defaultSettings, escapeHTML,
  formatSelectedDate, addOneMonth, showInlineToast, loadMembers,
  setOnAuthReady, initApp,
  collection, doc, getDocs, updateDoc, query, where
} from "./shared.js";

let currentFeeFilter = "all";
let currentSearchTerm = "";
let currentPlanFilter = "all";

setOnAuthReady(async () => {
  await loadMembers();

  // Populate Plan Filter
  const planFilter = document.getElementById("membersPlanFilter");
  if (planFilter && tenantSettings) {
    if (tenantSettings.membership_programs) {
      tenantSettings.membership_programs.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.key;
        opt.textContent = p.type + " - " + p.duration_days;
        planFilter.appendChild(opt);
      });
    }
    if (tenantSettings.fee_structure) {
      tenantSettings.fee_structure.forEach(prog => {
        (prog.pricing_variants || []).forEach(v => {
          const opt = document.createElement("option");
          opt.value = v.key;
          opt.textContent = prog.program_name + " - " + v.frequency;
          planFilter.appendChild(opt);
        });
      });
    }
  }

  renderMembersTable();
  renderFeeAlerts();
  renderMemberStats();
});

function setupMembersListeners() {
  // Search
  const searchInput = document.getElementById("membersSearchInput");
  if (searchInput) searchInput.addEventListener("input", (e) => { currentSearchTerm = e.target.value.toLowerCase(); renderMembersTable(); });

  // Plan filter
  const planFilter = document.getElementById("membersPlanFilter");
  if (planFilter) planFilter.addEventListener("change", (e) => { currentPlanFilter = e.target.value; renderMembersTable(); });

  // Fee filter tabs
  document.querySelectorAll(".fee-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".fee-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFeeFilter = btn.dataset.filter;
      renderFeeAlerts();
    });
  });
}

// ── Member Stats Cards ──────────────────────────────────────
function renderMemberStats() {
  const total = membersList.filter(m => m.status === "active").length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatSelectedDate(today);
  const soonWindow = new Date(today); soonWindow.setDate(soonWindow.getDate() + 7);
  const soonStr = formatSelectedDate(soonWindow);
  let overdueCount = 0, dueSoonCount = 0;
  membersList.forEach(m => {
    if (m.status !== "active") return;
    const lastPaid = m.lastPaidDate || m.joinDate;
    if (!lastPaid) return;
    const nextDue = addOneMonth(lastPaid);
    if (todayStr >= nextDue) overdueCount++;
    else if (nextDue <= soonStr) dueSoonCount++;
  });
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el("statTotalMembers", total);
  el("statOverdueCount", overdueCount);
  el("statDueSoonCount", dueSoonCount);
}

// ── Members Table ───────────────────────────────────────────
function renderMembersTable() {
  const tbody = document.getElementById("membersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const actionsHeader = document.querySelector(".members-table th:nth-child(6)");
  if (actionsHeader) {
    actionsHeader.style.display = (currentUser && currentUser.isAnonymous) ? "none" : "";
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatSelectedDate(today);
  const soonWindow = new Date(today); soonWindow.setDate(soonWindow.getDate() + 7);
  const soonStr = formatSelectedDate(soonWindow);

  let filtered = membersList.filter(m => m.status === "active");
  if (currentSearchTerm) filtered = filtered.filter(m => m.name && m.name.toLowerCase().includes(currentSearchTerm));
  if (currentPlanFilter !== "all") filtered = filtered.filter(m => m.type === currentPlanFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="members-empty-state"><div class="empty-icon">👥</div><p>No members found matching your filters.</p></div></td></tr>`;
    return;
  }

  function getPlanDetails(key) {
    if (!tenantSettings) return { name: key, price: 0 };
    if (tenantSettings.membership_programs) {
      const p = tenantSettings.membership_programs.find(x => x.key === key);
      if (p) return { name: p.type + " - " + p.duration_days, price: p.fee_per_month };
    }
    if (tenantSettings.fee_structure) {
      for (const prog of tenantSettings.fee_structure) {
        const v = (prog.pricing_variants || []).find(x => x.key === key);
        if (v) return { name: prog.program_name + " - " + v.frequency, price: v.cost };
      }
    }
    return { name: key, price: 0 };
  }

  filtered.forEach(member => {
    const plan = getPlanDetails(member.type);
    plan.color = "var(--accent4)";
    plan.bg = "rgba(77,171,247,0.12)";
    const lastPaid = member.lastPaidDate || member.joinDate || "—";
    const nextDue = (member.lastPaidDate || member.joinDate) ? addOneMonth(member.lastPaidDate || member.joinDate) : "—";

    let statusClass = "ok", statusText = "✅ Paid";
    if (nextDue !== "—") {
      if (todayStr >= nextDue) { statusClass = "overdue"; statusText = "🔴 Overdue"; }
      else if (nextDue <= soonStr) { statusClass = "due-soon"; statusText = "🟡 Due Soon"; }
    }

    const isGuest = currentUser && currentUser.isAnonymous;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="member-name-cell">${escapeHTML(member.name)}</td>
      <td><span class="member-plan-badge" style="background:${plan.bg};color:${plan.color};border-color:${plan.color}35">${plan.name}</span></td>
      <td style="font-family:var(--font-mono);font-size:0.82rem;">${escapeHTML(lastPaid)}</td>
      <td style="font-family:var(--font-mono);font-size:0.82rem;">${nextDue}</td>
      <td><span class="member-due-badge ${statusClass}">${statusText}</span></td>
      <td class="member-actions-cell" style="${isGuest ? 'display:none;' : ''}"></td>
    `;

    if (!isGuest && (statusClass === "overdue" || statusClass === "due-soon")) {
      const actionsCell = tr.querySelector(".member-actions-cell");
      const btn = document.createElement("button");
      btn.className = "btn-mark-paid";
      btn.textContent = "💳 Mark Paid";
      btn.addEventListener("click", () => handleMarkPaid(member, btn));
      actionsCell.appendChild(btn);
    }
    tbody.appendChild(tr);
  });
}

// ── Mark Paid ───────────────────────────────────────────────
async function handleMarkPaid(member, btnEl) {
  if (!currentUser || currentUser.isAnonymous) {
    showInlineToast("❌ Permission Denied: Guests cannot modify payments.", "error");
    return;
  }
  // Inline confirmation
  const row = btnEl.closest("td");
  row.innerHTML = `<div class="fee-confirm-wrap"><span class="fee-confirm-text">Confirm payment?</span><div class="fee-confirm-btns"><button class="btn-confirm-yes">✓ Yes</button><button class="btn-confirm-no">✕ No</button></div></div>`;
  row.querySelector(".btn-confirm-no").addEventListener("click", () => {
    row.innerHTML = "";
    const btn = document.createElement("button");
    btn.className = "btn-mark-paid"; btn.textContent = "💳 Mark Paid";
    btn.addEventListener("click", () => handleMarkPaid(member, btn));
    row.appendChild(btn);
  });
  row.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    row.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Saving...</span>';
    try {
      const newPaidDate = formatSelectedDate(new Date());
      await updateDoc(doc(db, "members", member.id), { lastPaidDate: newPaidDate });
      member.lastPaidDate = newPaidDate;
      showInlineToast(`✅ ${member.name} marked as paid!`, "success");
      await loadMembers();
      renderMembersTable();
      renderFeeAlerts();
      renderMemberStats();
    } catch (error) { showInlineToast(`❌ Failed: ${error.message}`, "error"); }
  });
}

// ── Fee Alerts ──────────────────────────────────────────────
function renderFeeAlerts() {
  const alertsListEl = document.getElementById("feeAlertsList");
  const overdueNumEl = document.getElementById("feeOverdueNum");
  const upcomingNumEl = document.getElementById("feeUpcomingNum");
  if (!alertsListEl) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatSelectedDate(today);
  const soonWindow = new Date(today); soonWindow.setDate(soonWindow.getDate() + 7);
  const soonStr = formatSelectedDate(soonWindow);

  const overdueMembers = [], upcomingMembers = [];
  membersList.forEach(member => {
    if (member.status !== "active") return;
    const lastPaid = member.lastPaidDate || member.joinDate;
    if (!lastPaid) return;
    const nextDue = addOneMonth(lastPaid);
    const nextDueDate = new Date(nextDue); nextDueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((nextDueDate - today) / (1000 * 60 * 60 * 24));
    if (todayStr >= nextDue) overdueMembers.push({ ...member, nextDue, diffDays });
    else if (nextDue <= soonStr) upcomingMembers.push({ ...member, nextDue, diffDays });
  });

  if (overdueNumEl) overdueNumEl.textContent = overdueMembers.length;
  if (upcomingNumEl) upcomingNumEl.textContent = upcomingMembers.length;

  const overdueBadgeEl = document.getElementById("feeOverdueCount");
  if (overdueBadgeEl) overdueBadgeEl.classList.toggle("has-alerts", overdueMembers.length > 0);
  const upcomingBadgeEl = document.getElementById("feeUpcomingCount");
  if (upcomingBadgeEl) upcomingBadgeEl.classList.toggle("has-alerts", upcomingMembers.length > 0);

  if (overdueMembers.length + upcomingMembers.length === 0) {
    alertsListEl.innerHTML = `<div class="fee-alerts-empty">🎉 All member fees are fully up to date!</div>`;
    return;
  }

  let toRender = [];
  if (currentFeeFilter === "overdue") toRender = overdueMembers.map(m => ({ ...m, alertKind: "overdue" }));
  else if (currentFeeFilter === "upcoming") toRender = upcomingMembers.map(m => ({ ...m, alertKind: "upcoming" }));
  else toRender = [...overdueMembers.map(m => ({ ...m, alertKind: "overdue" })), ...upcomingMembers.map(m => ({ ...m, alertKind: "upcoming" }))];

  alertsListEl.innerHTML = "";
  if (toRender.length === 0) {
    alertsListEl.innerHTML = `<div class="fee-alert-empty-filter">No ${currentFeeFilter === "overdue" ? "overdue" : "upcoming"} alerts right now.</div>`;
    return;
  }

  function getPlanDetails(key) {
    if (!tenantSettings) return { name: key, price: 0 };
    if (tenantSettings.membership_programs) {
      const p = tenantSettings.membership_programs.find(x => x.key === key);
      if (p) return { name: p.type + " - " + p.duration_days, price: p.fee_per_month };
    }
    if (tenantSettings.fee_structure) {
      for (const prog of tenantSettings.fee_structure) {
        const v = (prog.pricing_variants || []).find(x => x.key === key);
        if (v) return { name: prog.program_name + " - " + v.frequency, price: v.cost };
      }
    }
    return { name: key, price: 0 };
  }

  let lastKind = null;
  toRender.forEach(member => {
    if (currentFeeFilter === "all" && member.alertKind !== lastKind) {
      const hdr = document.createElement("div");
      hdr.className = "fee-section-header";
      hdr.innerHTML = member.alertKind === "overdue" ? '<span class="fee-section-label overdue">🔴 Overdue Payments</span>' : '<span class="fee-section-label upcoming">🟡 Due Within 7 Days</span>';
      alertsListEl.appendChild(hdr);
      lastKind = member.alertKind;
    }
    const planDetails = getPlanDetails(member.type);
    const plan = { name: planDetails.name, color: "var(--accent4)", bg: "rgba(77,171,247,0.12)" };
    let priceVal = `₹${planDetails.price.toLocaleString()}`;

    let daysLabel = "";
    if (member.alertKind === "overdue") {
      const daysOver = Math.abs(member.diffDays);
      daysLabel = `<span class="fee-days-badge fee-days-overdue">${daysOver === 0 ? "Due today" : `${daysOver}d overdue`}</span>`;
    } else {
      daysLabel = `<span class="fee-days-badge fee-days-upcoming">${member.diffDays}d remaining</span>`;
    }

    const planBadge = `<span style="font-size:0.65rem;background:${plan.bg};color:${plan.color};border:1px solid ${plan.color}35;padding:1px 8px;border-radius:99px;font-weight:600;">${plan.name}</span>`;

    const isGuest = currentUser && currentUser.isAnonymous;
    const row = document.createElement("div");
    row.className = "fee-alert-row" + (member.alertKind === "upcoming" ? " fee-alert-upcoming" : "");
    row.innerHTML = `
      <div class="fee-alert-info">
        <div class="fee-alert-title">${escapeHTML(member.name)} ${daysLabel} ${planBadge}</div>
        <div class="fee-alert-meta">Last paid: <span>${escapeHTML(member.lastPaidDate || member.joinDate)}</span> → Next due: <span>${escapeHTML(member.nextDue)}</span></div>
      </div>
      <div class="fee-alert-actions">
        <span class="fee-alert-price-tag">${priceVal}</span>
        ${isGuest ? '' : '<button class="btn-mark-paid">💳 Mark Paid</button>'}
      </div>
    `;
    if (!isGuest) {
      row.querySelector(".btn-mark-paid").addEventListener("click", (e) => handleMarkPaidAlert(member, e.target, row));
    }
    alertsListEl.appendChild(row);
  });
}

async function handleMarkPaidAlert(member, btnEl, rowEl) {
  if (!currentUser || currentUser.isAnonymous) {
    showInlineToast("❌ Permission Denied: Guests cannot modify payments.", "error");
    return;
  }
  const actionsDiv = rowEl.querySelector(".fee-alert-actions");
  actionsDiv.innerHTML = `<div class="fee-confirm-wrap"><span class="fee-confirm-text">Confirm payment?</span><div class="fee-confirm-btns"><button class="btn-confirm-yes">✓ Yes</button><button class="btn-confirm-no">✕ No</button></div></div>`;
  actionsDiv.querySelector(".btn-confirm-no").addEventListener("click", () => renderFeeAlerts());
  actionsDiv.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    actionsDiv.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Saving...</span>';
    try {
      const newPaidDate = formatSelectedDate(new Date());
      await updateDoc(doc(db, "members", member.id), { lastPaidDate: newPaidDate });
      member.lastPaidDate = newPaidDate;
      showInlineToast(`✅ ${member.name} marked as paid!`, "success");
      await loadMembers();
      renderMembersTable();
      renderFeeAlerts();
      renderMemberStats();
    } catch (error) { showInlineToast(`❌ Failed: ${error.message}`, "error"); }
  });
}

function bootstrap() {
  setupMembersListeners();
  initApp();
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
