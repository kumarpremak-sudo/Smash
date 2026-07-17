// js/members.js — Members Management & Fee Alerts
import {
  db, currentUser, membersList, tenantSettings, defaultSettings, escapeHTML,
  formatSelectedDate, addOneMonth, showInlineToast, loadMembers,
  setOnAuthReady, initApp, parseDays, checkBookingConflicts,
  collection, doc, getDoc, getDocs, updateDoc, query, where, writeBatch, serverTimestamp,
  populateBookingDropdowns, populateCategoryDropdown, openWhatsApp, isStrictCoach
} from "./shared.js";
import { addDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentFeeFilter = "all";
let currentSearchTerm = "";
let currentPlanFilter = "all";

setOnAuthReady(async (user) => {
  if (isStrictCoach(user)) {
    window.location.href = "coach.html";
    return;
  }
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

  setupTabs();
  setupEnquiries();
  loadEnquiries();
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
    if (m.lastPaidDate === "") { overdueCount++; return; }
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
    tbody.innerHTML = `<tr><td colspan="7"><div class="members-empty-state"><div class="empty-icon">👥</div><p>No members found matching your filters.</p></div></td></tr>`;
    return;
  }

  function getPlanDetails(key) {
    if (!tenantSettings) return { name: key, price: 0 };
    // Exact match against membership programs
    if (tenantSettings.membership_programs) {
      const p = tenantSettings.membership_programs.find(x => x.key === key);
      if (p) return { name: p.type + " - " + p.duration_days + (p.special_notes ? ` (${p.special_notes})` : ""), price: p.fee_per_month };
    }
    // Exact match against fee structure
    if (tenantSettings.fee_structure) {
      for (const prog of tenantSettings.fee_structure) {
        const v = (prog.pricing_variants || []).find(x => x.key === key);
        if (v) return { name: prog.program_name + " - " + v.frequency, price: v.cost };
      }
    }
    // Partial match: key contains program type or category name
    if (key && tenantSettings.membership_programs) {
      const keyLower = key.toLowerCase();
      const p = tenantSettings.membership_programs.find(x => keyLower.includes(x.type.toLowerCase()));
      if (p) return { name: p.type + " - " + p.duration_days, price: p.fee_per_month };
    }
    if (key && tenantSettings.fee_structure) {
      const keyLower = key.toLowerCase();
      for (const prog of tenantSettings.fee_structure) {
        if (keyLower.includes(prog.program_name.toLowerCase().split(" ")[0].toLowerCase())) {
          const price = prog.pricing_variants && prog.pricing_variants.length > 0 ? prog.pricing_variants[0].cost : 0;
          return { name: prog.program_name, price };
        }
      }
    }
    // Fallback: format the raw key into a human-readable name
    const readableName = key ? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Unknown Plan";
    return { name: readableName, price: 0 };
  }

  filtered.forEach(member => {
    const plan = getPlanDetails(member.type);
    plan.color = "var(--accent4)";
    plan.bg = "rgba(77,171,247,0.12)";
    const isPending = member.lastPaidDate === "";
    const lastPaid = isPending ? "Pending" : (member.lastPaidDate || member.joinDate || "—");
    const nextDue = isPending ? "Pending" : ((member.lastPaidDate || member.joinDate) ? addOneMonth(member.lastPaidDate || member.joinDate) : "—");

    let statusClass = "ok", statusText = "✅ Paid";
    if (isPending) {
      statusClass = "pending"; statusText = "⏳ Pending";
    } else if (nextDue !== "—") {
      if (todayStr >= nextDue) { statusClass = "overdue"; statusText = "🔴 Overdue"; }
      else if (nextDue <= soonStr) { statusClass = "due-soon"; statusText = "🟡 Due Soon"; }
    }

    const isGuest = currentUser && currentUser.isAnonymous;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="member-name-cell">${escapeHTML(member.name)}</td>
      <td style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-dim);">${escapeHTML(member.phone || "—")}</td>
      <td><span class="member-plan-badge" style="background:${plan.bg};color:${plan.color};border-color:${plan.color}35">${plan.name}</span></td>
      <td style="font-family:var(--font-mono);font-size:0.82rem;">${escapeHTML(lastPaid)}</td>
      <td style="font-family:var(--font-mono);font-size:0.82rem;">${nextDue}</td>
      <td><span class="member-due-badge ${statusClass}">${statusText}</span></td>
      <td class="member-actions-cell" style="${isGuest ? 'display:none;' : ''}"></td>
    `;

    if (!isGuest) {
      const actionsCell = tr.querySelector(".member-actions-cell");
      
      if (statusClass === "overdue" || statusClass === "due-soon" || statusClass === "pending") {
        const waBtn = document.createElement("button");
        waBtn.className = "btn-icon btn-wa";
        waBtn.title = "Send WhatsApp Reminder";
        waBtn.style.cssText = "background:transparent; border:none; cursor:pointer; font-size:1.1rem; margin-right: 0.5rem;";
        waBtn.innerHTML = "📱";
        waBtn.addEventListener("click", () => {
          const academyName = tenantSettings ? tenantSettings.academy_name : "our academy";
          const priceVal = plan.price > 0 ? `₹${plan.price.toLocaleString()}` : "your fee";
          const msg = `Hi ${member.name},\n\nThis is a gentle reminder from *${academyName}*. Your fee of ${priceVal} for the *${plan.name}* plan is due on *${nextDue}*.\n\nKindly clear the dues at your earliest convenience.\n\nThank you!`;
          openWhatsApp(member.phone, msg);
        });
        actionsCell.appendChild(waBtn);

        const btn = document.createElement("button");
        btn.className = "btn-mark-paid";
        btn.textContent = "💳 Mark Paid";
        btn.style.marginRight = "0.5rem";
        btn.addEventListener("click", () => handleMarkPaid(member, btn));
        actionsCell.appendChild(btn);
      }

      const delBtn = document.createElement("button");
      delBtn.className = "btn-icon btn-del-member";
      delBtn.title = "Delete Member";
      delBtn.style.cssText = "color:var(--danger); background:transparent; border:none; cursor:pointer; font-size:1.1rem;";
      delBtn.innerHTML = "🗑️";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Are you sure you want to delete member "${member.name}" and all their associated reservations? This action cannot be undone.`)) return;
        try {
          if (member.phone) {
            const qBookings = query(
              collection(db, "bookings"), 
              where("customer_phone", "==", member.phone),
              where("academyId", "==", currentUser.academyId)
            );
            const snapBookings = await getDocs(qBookings);
            if (!snapBookings.empty) {
              const batchDel = writeBatch(db);
              snapBookings.forEach(d => {
                batchDel.delete(d.ref);
              });
              await batchDel.commit();
            }
          }

          await deleteDoc(doc(db, "members", member.id));
          showInlineToast(`Member "${member.name}" and reservations deleted successfully`, "success");
          await loadMembers();
          renderMembersTable();
          renderFeeAlerts();
          renderMemberStats();
        } catch (err) {
          console.error("Failed to delete member:", err);
          showInlineToast("Error deleting member", "error");
        }
      });
      actionsCell.appendChild(delBtn);
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
      let rebookMsg = "";
      let newBookingId = null;

      // Auto-rebook logic for Coaching and Members
      if (member.bookingId) {
        const bookingRef = doc(db, "bookings", member.bookingId);
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const tpl = bookingSnap.data();
          if (tpl.booking_type === "Coaching" || tpl.booking_type === "Members") {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);
            
            let descText = tpl.period;
            if (tpl.booking_type === "Members" && tenantSettings.membership_programs) {
              const prog = tenantSettings.membership_programs.find(p => p.duration_days === tpl.period);
              if (prog && prog.days_description) descText += " " + prog.days_description;
            }
            const allowedDays = parseDays(descText);

            const q2 = query(collection(db, "bookings"), where("academyId", "==", currentUser.academyId));
            const snap2 = await getDocs(q2);
            const existing = [];
            snap2.forEach(d => {
              const data = d.data();
              if (data.status === "cancelled") return;
              if (data.court_id == tpl.court_id && data.date >= formatSelectedDate(startDate) && data.date <= formatSelectedDate(endDate)) {
                existing.push(data);
              }
            });

            const batch = writeBatch(db);
            let created = 0;
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              if (!allowedDays.includes(d.getDay())) continue;
              
              const curDateStr = formatSelectedDate(d);
              const dayOverlapping = existing.filter(b => b.date === curDateStr && tpl.start_time < b.end_time && tpl.end_time > b.start_time);
              
              let skipDay = false;
              if (tpl.booking_type === "Members") {
                const memberOverlaps = dayOverlapping.filter(b => b.booking_type === "Members");
                if (memberOverlaps.length >= 6) skipDay = true;
                if (dayOverlapping.some(b => b.booking_type !== "Members")) skipDay = true;
              }

              if (skipDay) continue;

              const newBookingRef = doc(collection(db, "bookings"));
              if (!newBookingId) newBookingId = newBookingRef.id;
              
              batch.set(newBookingRef, {
                booking_type: tpl.booking_type,
                court_id: tpl.court_id,
                customer_name: tpl.customer_name,
                customer_phone: tpl.customer_phone,
                category: tpl.category,
                period: tpl.period,
                gender: tpl.gender || "",
                date: curDateStr,
                start_time: tpl.start_time,
                end_time: tpl.end_time,
                enrollees: tpl.enrollees || "",
                userId: tpl.userId || currentUser.uid,
                academyId: tpl.academyId || currentUser.academyId,
                createdAt: serverTimestamp()
              });
              created++;
            }
            if (created > 0) {
              await batch.commit();
              rebookMsg = ` (+ rebooked ${created} slots)`;
            }
          }
        }
      }

      const updateData = { lastPaidDate: newPaidDate };
      if (newBookingId) {
        updateData.bookingId = newBookingId;
        member.bookingId = newBookingId;
      }
      await updateDoc(doc(db, "members", member.id), updateData);
      
      member.lastPaidDate = newPaidDate;
      showInlineToast(`✅ ${member.name} marked as paid!${rebookMsg}`, "success");
      
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
    if (member.lastPaidDate === "") {
      overdueMembers.push({ ...member, nextDue: "Pending", diffDays: -1 });
      return;
    }
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
    if (member.lastPaidDate === "") {
      daysLabel = `<span class="fee-days-badge fee-days-overdue">Pending</span>`;
    } else if (member.alertKind === "overdue") {
      daysLabel = `<span class="fee-days-badge fee-days-overdue">${member.diffDays < 0 ? Math.abs(member.diffDays) + "d ago" : "Today"}</span>`;
    } else {
      daysLabel = `<span class="fee-days-badge fee-days-upcoming">${member.diffDays}d remaining</span>`;
    }

    const planBadge = `<span style="font-size:0.65rem;background:${plan.bg};color:${plan.color};border:1px solid ${plan.color}35;padding:1px 8px;border-radius:99px;font-weight:600;">${plan.name}</span>`;

    const isGuest = currentUser && currentUser.isAnonymous;
    const row = document.createElement("div");
    row.className = "fee-alert-row" + (member.alertKind === "upcoming" ? " fee-alert-upcoming" : "");
    row.innerHTML = `
      <div class="fee-alert-info">
        <div class="fee-alert-title">${escapeHTML(member.name)} ${member.phone ? `<span style="font-size:0.75rem;color:var(--muted);margin-left:5px;">📞 ${escapeHTML(member.phone)}</span>` : ""} ${daysLabel} ${planBadge}</div>
        <div class="fee-alert-meta">Last paid: <span>${member.lastPaidDate === "" ? "Pending" : escapeHTML(member.lastPaidDate || member.joinDate)}</span> → Next due: <span>${escapeHTML(member.nextDue)}</span></div>
      </div>
      <div class="fee-alert-actions">
        <span class="fee-alert-price-tag">${priceVal}</span>
        ${isGuest ? '' : `<button class="btn-icon btn-wa btn-wa-alert" title="Send WhatsApp Reminder" style="margin-right: 0.5rem; background:transparent; border:none; cursor:pointer; font-size:1.1rem;">📱</button><button class="btn-mark-paid">💳 Mark Paid</button>`}
      </div>
    `;
    if (!isGuest) {
      row.querySelector(".btn-mark-paid").addEventListener("click", (e) => handleMarkPaidAlert(member, e.target, row));
      const waBtn = row.querySelector(".btn-wa-alert");
      if (waBtn) {
        waBtn.addEventListener("click", () => {
          const academyName = tenantSettings ? tenantSettings.academy_name : "our academy";
          const msg = `Hi ${member.name},\n\nThis is a gentle reminder from *${academyName}*. Your fee of ${priceVal} for the *${planDetails.name}* plan is due on *${member.nextDue}*.\n\nKindly clear the dues at your earliest convenience.\n\nThank you!`;
          openWhatsApp(member.phone, msg);
        });
      }
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

// ── Tabs Navigation ───────────────────────────────────────────
function setupTabs() {
  const tabs = document.querySelectorAll('.mem-tab-btn');
  const views = document.querySelectorAll('.mem-view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetView) targetView.classList.add('active');
    });
  });
}

// ── Enquiries Logic ───────────────────────────────────────────
let enquiriesUnsubscribe = null;

function setupEnquiries() {
  const btnAdd = document.getElementById('btnAddEnquiry');
  const modal = document.getElementById('enquiryModal');
  const btnClose = document.getElementById('closeEnquiryModal');
  const btnCancel = document.getElementById('btnCancelEnquiry');
  const form = document.getElementById('enquiryForm');
  const typeSelect = document.getElementById('enqBookingType');

  if (btnAdd) btnAdd.addEventListener('click', () => {
    populateBookingDropdowns("enqBookingType", "enqBookingCategory");
    const dateInput = document.getElementById('enqDate');
    if (dateInput) dateInput.value = formatSelectedDate(new Date());
    modal.classList.remove('hidden');
  });

  const closeModal = () => {
    modal.classList.add('hidden');
    form.reset();
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      populateCategoryDropdown("enqBookingType", "enqBookingCategory");
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSave = document.getElementById('btnSaveEnquiry');
      btnSave.disabled = true;
      btnSave.textContent = "Saving...";

      try {
        const enqData = {
          academyId: currentUser.academyId,
          name: document.getElementById('enqName').value.trim(),
          phone: document.getElementById('enqPhone').value.trim(),
          booking_type: document.getElementById('enqBookingType').value,
          booking_category: document.getElementById('enqBookingCategory').value,
          enquiryDate: document.getElementById('enqDate') ? document.getElementById('enqDate').value : formatSelectedDate(new Date()),
          notes: document.getElementById('enqNotes').value.trim(),
          status: 'New',
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "enquiries"), enqData);
        showInlineToast("Enquiry added successfully", "success");
        closeModal();
      } catch (err) {
        console.error("Error adding enquiry:", err);
        showInlineToast("Failed to add enquiry", "error");
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = "Save Enquiry";
      }
    });
  }
}

function loadEnquiries() {
  if (!currentUser || !currentUser.academyId) return;

  const q = query(collection(db, "enquiries"), where("academyId", "==", currentUser.academyId));
  enquiriesUnsubscribe = onSnapshot(q, (snapshot) => {
    const tbody = document.getElementById('enquiriesTableBody');
    if (!tbody) return;
    
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="members-empty-state"><p>No active enquiries found.</p></div></td></tr>`;
      return;
    }

    const enquiries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                                   .sort((a, b) => {
                                      const dateA = a.enquiryDate ? new Date(a.enquiryDate).getTime() : (a.createdAt?.toMillis() || 0);
                                      const dateB = b.enquiryDate ? new Date(b.enquiryDate).getTime() : (b.createdAt?.toMillis() || 0);
                                      return dateB - dateA;
                                   });

    tbody.innerHTML = "";
    enquiries.forEach(enq => {
      const dateStr = enq.enquiryDate 
          ? new Date(enq.enquiryDate).toLocaleDateString() 
          : (enq.createdAt ? new Date(enq.createdAt.toMillis()).toLocaleDateString() : "Just now");
      
      let statusColor = "var(--muted)";
      if (enq.status === "New") statusColor = "var(--accent)";
      else if (enq.status === "Converted") statusColor = "var(--success)";
      else if (enq.status === "Lost") statusColor = "var(--danger)";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHTML(enq.name)}</strong></td>
        <td>${escapeHTML(enq.phone)}</td>
        <td>${escapeHTML(enq.booking_type)} - ${escapeHTML(enq.booking_category)}</td>
        <td>${dateStr}</td>
        <td><span class="status-badge" style="background:${statusColor}; color:#fff; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">${enq.status}</span></td>
        <td class="actions-cell">
          <select class="form-control status-select" style="padding:0.2rem; font-size:0.8rem; width:110px;" data-id="${enq.id}">
            <option value="New" ${enq.status === 'New' ? 'selected' : ''}>New</option>
            <option value="In Progress" ${enq.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Converted" ${enq.status === 'Converted' ? 'selected' : ''}>Converted</option>
            <option value="Lost" ${enq.status === 'Lost' ? 'selected' : ''}>Lost</option>
          </select>
          <button class="btn-icon btn-wa-enq" data-id="${enq.id}" title="Send WhatsApp Message" style="margin-left:0.5rem; background:transparent; border:none; cursor:pointer; font-size:1.1rem;">📱</button>
          <button class="btn-icon btn-del-enq" data-id="${enq.id}" title="Delete" style="margin-left:0.5rem; color:var(--danger); background:transparent; border:none; cursor:pointer;">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
      
      const waBtn = tr.querySelector(".btn-wa-enq");
      if (waBtn) {
        waBtn.addEventListener("click", () => {
          const academyName = tenantSettings ? tenantSettings.academy_name : "our academy";
          const msg = `Hi ${enq.name},\n\nThank you for enquiring at *${academyName}*! You recently asked about *${enq.booking_type} - ${enq.booking_category}*.\n\nPlease let us know if you'd like to reserve a slot or if you have any questions. We're happy to help!`;
          openWhatsApp(enq.phone, msg);
        });
      }
    });

    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        try {
          await updateDoc(doc(db, "enquiries", id), { status: newStatus });
          showInlineToast("Status updated", "success");
        } catch (err) {
          console.error("Failed to update status", err);
          showInlineToast("Error updating status", "error");
        }
      });
    });

    document.querySelectorAll('.btn-del-enq').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm("Are you sure you want to delete this enquiry?")) return;
        const id = e.currentTarget.dataset.id;
        try {
          await deleteDoc(doc(db, "enquiries", id));
          showInlineToast("Enquiry deleted", "success");
        } catch (err) {
          console.error("Failed to delete", err);
          showInlineToast("Error deleting enquiry", "error");
        }
      });
    });
  }, (err) => {
    console.error("Listen error:", err);
  });
}
