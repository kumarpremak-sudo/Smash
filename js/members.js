// js/members.js — Members Management & Fee Alerts
import {
  db, currentUser, membersList, tenantSettings, defaultSettings, escapeHTML,
  formatSelectedDate, addOneMonth, showInlineToast, loadMembers,
  setOnAuthReady, initApp, parseDays, checkBookingConflicts,
  populateBookingDropdowns, populateCategoryDropdown, openWhatsApp, isStrictCoach, parseLocalDate,
  courtsList
} from "./shared.js";
import { addDoc, onSnapshot, deleteDoc, collection, doc, getDoc, getDocs, updateDoc, query, where, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
  setupBulkOnboardListeners();
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
      actionsCell.className = "member-actions-cell";
      actionsCell.style.whiteSpace = "nowrap";

      if (statusClass === "overdue" || statusClass === "due-soon" || statusClass === "pending") {
        const waBtn = document.createElement("button");
        waBtn.className = "btn-action-icon";
        waBtn.title = "Send WhatsApp Reminder";
        waBtn.innerHTML = "📱";
        waBtn.addEventListener("click", () => {
          const academyName = tenantSettings ? tenantSettings.academy_name : "our academy";
          const priceVal = plan.price > 0 ? `₹${plan.price.toLocaleString()}` : "your fee";
          const msg = `Hi ${member.name},\n\nThis is a gentle reminder from *${academyName}*. Your fee of ${priceVal} for the *${plan.name}* plan is due on *${nextDue}*.\n\nKindly clear the dues at your earliest convenience.\n\nThank you!`;
          openWhatsApp(member.phone, msg);
        });
        actionsCell.appendChild(waBtn);
      }

      if (member.bookingId) {
        const renewBtn = document.createElement("button");
        renewBtn.className = "btn-action-icon";
        renewBtn.title = "Renew Schedule (30 Days)";
        renewBtn.innerHTML = "📅";
        renewBtn.addEventListener("click", () => openRenewModal(member));
        actionsCell.appendChild(renewBtn);
      }

      const paymentBtn = document.createElement("button");
      paymentBtn.className = "btn-action-icon";
      paymentBtn.title = "Record Payment";
      paymentBtn.innerHTML = "💳";
      paymentBtn.addEventListener("click", () => handleMarkPaid(member, paymentBtn));
      actionsCell.appendChild(paymentBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "btn-action-icon danger";
      delBtn.title = "Delete Member";
      delBtn.innerHTML = "🗑️";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Are you sure you want to delete member "${member.name}" and all their associated reservations? This action cannot be undone.`)) return;
        try {
          const targetPhone = (member.phone || "").trim();
          const targetName = (member.name || "").trim().toLowerCase();

          // 1. Delete all bookings associated with this member (strictly by memberId, or legacy fallback matching both name AND phone)
          const qBookings = query(
            collection(db, "bookings"),
            where("academyId", "==", currentUser.academyId)
          );
          const snapBookings = await getDocs(qBookings);
          if (!snapBookings.empty) {
            const batchDel = writeBatch(db);
            let delCount = 0;
            snapBookings.forEach(d => {
              const bData = d.data();
              const idMatch = bData.memberId && bData.memberId === member.id;
              const legacyMatch = !bData.memberId && targetPhone && targetName &&
                bData.customer_phone && bData.customer_phone.trim() === targetPhone &&
                bData.customer_name && bData.customer_name.trim().toLowerCase() === targetName;
              if (idMatch || legacyMatch) {
                batchDel.delete(d.ref);
                delCount++;
              }
            });
            if (delCount > 0) {
              await batchDel.commit();
            }
          }

          // 2. Delete strictly the targeted member record by unique document ID
          await deleteDoc(doc(db, "members", member.id));

          showInlineToast(`Member "${member.name}" and all associated reservations deleted successfully`, "success");
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
let paymentMemberRef = null;

function handleMarkPaid(member, btnEl) {
  if (!currentUser || currentUser.isAnonymous) {
    showInlineToast("❌ Permission Denied: Guests cannot modify payments.", "error");
    return;
  }
  
  paymentMemberRef = member;
  const modal = document.getElementById("recordPaymentModal");
  const dateInput = document.getElementById("paymentEffectiveDate");
  
  if (modal && dateInput) {
    modal.classList.remove("hidden");
    
    const isPending = member.lastPaidDate === "";
    if (isPending) {
      dateInput.value = formatSelectedDate(new Date());
    } else {
      const nextDue = addOneMonth(member.lastPaidDate || member.joinDate);
      const todayStr = formatSelectedDate(new Date());
      // If overdue/due-soon, default to today. If advance payment, default to nextDue.
      if (todayStr >= nextDue) {
        dateInput.value = todayStr;
      } else {
        dateInput.value = nextDue;
      }
    }
  }
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
    const nextDueDate = parseLocalDate(nextDue); nextDueDate.setHours(0, 0, 0, 0);
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
      <div class="fee-alert-actions" style="display:flex; align-items:center;">
        <span class="fee-alert-price-tag" style="margin-right: 1rem;">${priceVal}</span>
        ${isGuest ? '' : `<button class="btn-action-icon btn-wa-alert" title="Send WhatsApp Reminder" style="margin-right: 0.5rem;">📱</button><button class="btn-action-icon btn-mark-paid" title="Record Payment">💳</button>`}
      </div>
    `;
    if (!isGuest) {
      row.querySelector(".btn-mark-paid").addEventListener("click", (e) => handleMarkPaid(member, e.currentTarget));
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
        const dateA = a.enquiryDate ? parseLocalDate(a.enquiryDate).getTime() : (a.createdAt?.toMillis() || 0);
        const dateB = b.enquiryDate ? parseLocalDate(b.enquiryDate).getTime() : (b.createdAt?.toMillis() || 0);
        return dateB - dateA;
      });

    tbody.innerHTML = "";
    enquiries.forEach(enq => {
      const dateStr = enq.enquiryDate
        ? parseLocalDate(enq.enquiryDate).toLocaleDateString()
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

// ── Renew Schedule ──────────────────────────────────────────────
let renewMemberRef = null;

function openRenewModal(member) {
  renewMemberRef = member;
  document.getElementById("renewScheduleModal").classList.remove("hidden");

  const d = new Date();
  d.setDate(d.getDate() + 1);
  document.getElementById("renewStartDate").value = formatSelectedDate(d);
}

document.getElementById("closeRenewModal")?.addEventListener("click", () => {
  document.getElementById("renewScheduleModal").classList.add("hidden");
});
document.getElementById("btnCancelRenew")?.addEventListener("click", () => {
  document.getElementById("renewScheduleModal").classList.add("hidden");
});

document.getElementById("btnConfirmRenew")?.addEventListener("click", async () => {
  if (!renewMemberRef || !renewMemberRef.bookingId) return;
  const startDateStr = document.getElementById("renewStartDate").value;
  if (!startDateStr) {
    showInlineToast("Please select a start date", "error");
    return;
  }

  const btn = document.getElementById("btnConfirmRenew");
  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    const bookingRef = doc(db, "bookings", renewMemberRef.bookingId);
    const bookingSnap = await getDoc(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Original booking template not found.");

    const tpl = bookingSnap.data();
    const startDate = parseLocalDate(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    let descText = tpl.period;
    if (tpl.booking_type === "Members" && tenantSettings && tenantSettings.membership_programs) {
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
    let newBookingId = null;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (!allowedDays.includes(d.getDay())) continue;

      const curDateStr = formatSelectedDate(d);
      const dayOverlapping = existing.filter(b => b.date === curDateStr && tpl.start_time < b.end_time && tpl.end_time > b.start_time);

      let skipDay = false;

      // Rule 1: Prevent double-renewing the same member
      if (dayOverlapping.some(b => b.memberId === renewMemberRef.id)) skipDay = true;

      if (!skipDay) {
        const type = tpl.booking_type;
        
        if (type === "Coaching") {
          // Coaching allows unlimited students, no conflict (unless exclusive booking holds court)
          const hasExclusive = dayOverlapping.some(b => 
            b.booking_type === "Spot booking" || b.booking_type === "Advance Training" || b.booking_type === "Personal training" || b.booking_type === "Tournament"
          );
          if (hasExclusive) skipDay = true;
        } 
        else if (type === "Spot booking" || type === "Advance Training" || type === "Personal training" || type === "Tournament") {
          // Exclusive types: Cannot overlap with ANY existing booking
          if (dayOverlapping.length > 0) skipDay = true;
        } 
        else {
          // Members, Guest Play, etc.
          // Check if court is already held by an exclusive booking
          const hasExclusive = dayOverlapping.some(b => 
            b.booking_type === "Spot booking" || b.booking_type === "Advance Training" || b.booking_type === "Personal training" || b.booking_type === "Tournament"
          );
          if (hasExclusive) skipDay = true;
          
          if (!skipDay && type === "Members") {
            const memberOverlaps = dayOverlapping.filter(b => b.booking_type === "Members");
            if (memberOverlaps.length >= 6) skipDay = true;
          }
          if (!skipDay && type === "Guest Play") {
            const hasMemberSlot = dayOverlapping.some(b => b.booking_type === "Members");
            if (!hasMemberSlot) skipDay = true;
          }
        }
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
        memberId: renewMemberRef.id,
        createdAt: serverTimestamp()
      });
      created++;
    }

    if (created > 0) {
      await batch.commit();

      if (newBookingId) {
        await updateDoc(doc(db, "members", renewMemberRef.id), { bookingId: newBookingId });
      }

      showInlineToast(`✅ Successfully generated ${created} calendar slots!`, "success");
      document.getElementById("renewScheduleModal").classList.add("hidden");
      await loadMembers();
      renderMembersTable();
    } else {
      showInlineToast("❌ No slots created. Calendar may be fully booked or member is already booked.", "error");
    }
  } catch (error) {
    showInlineToast(`❌ Error: ${error.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Renew Schedule";
  }
});

// ── Record Payment Modal logic ──────────────────────────────────────────────
document.getElementById("closePaymentModal")?.addEventListener("click", () => {
  document.getElementById("recordPaymentModal").classList.add("hidden");
});
document.getElementById("btnCancelPayment")?.addEventListener("click", () => {
  document.getElementById("recordPaymentModal").classList.add("hidden");
});

document.getElementById("btnConfirmPayment")?.addEventListener("click", async () => {
  if (!paymentMemberRef) return;
  const dateStr = document.getElementById("paymentEffectiveDate").value;
  if (!dateStr) {
    showInlineToast("Please select an effective date.", "error");
    return;
  }
  
  const btn = document.getElementById("btnConfirmPayment");
  btn.disabled = true;
  btn.textContent = "Saving...";
  
  try {
    const updateData = { lastPaidDate: dateStr };
    await updateDoc(doc(db, "members", paymentMemberRef.id), updateData);
    
    paymentMemberRef.lastPaidDate = dateStr;
    showInlineToast(`✅ Payment recorded successfully for ${dateStr}`, "success");
    
    document.getElementById("recordPaymentModal").classList.add("hidden");
    await loadMembers();
    renderMembersTable();
    renderFeeAlerts();
    renderMemberStats();
  } catch (error) {
    showInlineToast(`❌ Failed: ${error.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Payment";
  }
});

// ── CSV Bulk Onboarding Module ─────────────────────────────────────────────
let csvParsedRows = [];
let csvValidRows = [];

function setupBulkOnboardListeners() {
  const btnOpen = document.getElementById("btnOpenBulkOnboard");
  const modal = document.getElementById("bulkOnboardModal");
  const btnClose = document.getElementById("closeBulkModal");
  const btnCancel = document.getElementById("btnCancelBulkModal");
  const btnSample = document.getElementById("btnDownloadSampleCsv");
  const fileInput = document.getElementById("csvFileInput");
  const dropzone = document.getElementById("csvDropzone");
  const btnExecute = document.getElementById("btnExecuteBulkImport");
  const btnReset = document.getElementById("btnResetCsv");
  const modeSelect = document.getElementById("csvImportMode");

  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      if (!currentUser || currentUser.isAnonymous) {
        showInlineToast("❌ Permission Denied: Guests cannot access bulk onboarding.", "error");
        return;
      }
      resetBulkOnboardState();
      modal?.classList.remove("hidden");
    });
  }

  const closeModal = () => modal?.classList.add("hidden");
  btnClose?.addEventListener("click", closeModal);
  btnCancel?.addEventListener("click", closeModal);

  btnSample?.addEventListener("click", downloadSampleCSV);

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSelectedCSVFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSelectedCSVFile(e.target.files[0]);
      }
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      if (csvParsedRows.length > 0) {
        validateAndPreviewCSV(csvParsedRows);
      }
    });
  }

  btnReset?.addEventListener("click", resetBulkOnboardState);
  btnExecute?.addEventListener("click", executeBulkImport);
}

function resetBulkOnboardState() {
  csvParsedRows = [];
  csvValidRows = [];
  const fileInput = document.getElementById("csvFileInput");
  if (fileInput) fileInput.value = "";
  
  const dropzoneText = document.getElementById("csvDropzoneText");
  if (dropzoneText) dropzoneText.textContent = "Click to browse or drop your CSV file here";

  document.getElementById("csvUploadStep")?.classList.remove("hidden");
  document.getElementById("csvPreviewStep")?.classList.add("hidden");
  document.getElementById("btnResetCsv")?.classList.add("hidden");
  document.getElementById("csvProgressWrap")?.classList.add("hidden");

  const btnExecute = document.getElementById("btnExecuteBulkImport");
  if (btnExecute) {
    btnExecute.disabled = true;
    btnExecute.style.opacity = "0.6";
    btnExecute.style.cursor = "not-allowed";
    btnExecute.textContent = "🚀 Import Valid Records";
  }

  const tbody = document.getElementById("csvPreviewTableBody");
  if (tbody) tbody.innerHTML = "";
}

function downloadSampleCSV() {
  const csvContent = 
`Member Name,Mobile Number,Booking Type,Program / Plan,Court Number,Start Time,End Time,Join Date,Last Paid Date
Rahul Sharma,9876543210,Members,Individual - 5 Days Male,Court 1,09:00 AM,10:00 AM,2026-08-01,2026-08-01
Priya Sharma,9876543211,Coaching,Women Coaching - 5-Day/wk,Court 2,06:00 AM,07:00 AM,2026-08-01,2026-08-01
Aarav Sharma,9876543212,Coaching,Advance Batch - 6-Day/wk,Court 3,07:00 AM,08:00 AM,2026-08-01,
Siddharth V,9123456789,Group/Lease,Group - 5 Days,Court 1,09:00 AM,10:00 AM,2026-08-01,2026-08-01`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "sample_member_onboarding_with_reservations.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleSelectedCSVFile(file) {
  if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
    showInlineToast("Please select a valid .csv file.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    if (!text || !text.trim()) {
      showInlineToast("The selected CSV file is empty.", "error");
      return;
    }
    const rows = parseCSVText(text);
    if (rows.length === 0) {
      showInlineToast("No valid rows found in CSV file.", "error");
      return;
    }
    const dropzoneText = document.getElementById("csvDropzoneText");
    if (dropzoneText) dropzoneText.textContent = `📄 Loaded: ${file.name} (${rows.length} rows)`;

    validateAndPreviewCSV(rows);
  };
  reader.readAsText(file);
}

function normalizeCSVDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return "";
  const clean = dateStr.trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, "0");
    const month = String(dmyMatch[2]).padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(ymdMatch[2]).padStart(2, "0");
    const day = String(ymdMatch[3]).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return clean;
}

function normalizeCSVTime(timeStr) {
  if (!timeStr || !timeStr.trim()) return "";
  let clean = timeStr.trim().toUpperCase();

  // Match 9:00 AM -> 09:00 AM
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    const hh = String(ampmMatch[1]).padStart(2, "0");
    const mm = ampmMatch[2];
    const ampm = ampmMatch[3];
    return `${hh}:${mm} ${ampm}`;
  }

  // Match 24hr format e.g. 18:00 -> 06:00 PM or 09:00 -> 09:00 AM
  const hr24Match = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (hr24Match) {
    let hh = parseInt(hr24Match[1], 10);
    const mm = hr24Match[2];
    const ampm = hh >= 12 ? "PM" : "AM";
    if (hh > 12) hh -= 12;
    if (hh === 0) hh = 12;
    return `${String(hh).padStart(2, "0")}:${mm} ${ampm}`;
  }

  return clean;
}

function parseCSVText(text) {
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 2) return [];

  function tokenizeLine(line) {
    const tokens = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        tokens.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    tokens.push(current.trim().replace(/^"|"$/g, ""));
    return tokens;
  }

  const headers = tokenizeLine(lines[0]).map(h => h.toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = tokenizeLine(line);
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(rowObj);
  }
  return rows;
}

function resolvePlanKey(programStr, bookingTypeStr) {
  const modeSelect = document.getElementById("csvImportMode");
  const forcedMode = modeSelect ? modeSelect.value : "auto";
  
  let targetType = forcedMode !== "auto" ? forcedMode : (bookingTypeStr || "Members");
  const progLower = (programStr || "").toLowerCase();

  // Match against fee_structure (Coaching, Advance Batch, Women, Kids)
  if (tenantSettings && tenantSettings.fee_structure) {
    for (const prog of tenantSettings.fee_structure) {
      const progNameLower = prog.program_name.toLowerCase();
      if (progLower.includes(progNameLower) || progNameLower.includes(progLower.split(" ")[0])) {
        const variant = (prog.pricing_variants || []).find(v => 
          progLower.includes((v.frequency || "").toLowerCase()) || progLower.includes((v.key || "").toLowerCase())
        ) || (prog.pricing_variants || [])[0];
        
        return {
          bookingType: forcedMode !== "auto" ? forcedMode : "Coaching",
          category: prog.program_name,
          typeKey: variant ? variant.key : prog.program_name,
          period: variant ? variant.frequency : "5 Days",
          daysDescription: variant ? variant.frequency : "5 Days"
        };
      }
    }
  }

  // Match against membership_programs
  if (tenantSettings && tenantSettings.membership_programs) {
    const p = tenantSettings.membership_programs.find(x => 
      x.key.toLowerCase() === progLower ||
      progLower.includes(x.type.toLowerCase()) ||
      x.duration_days.toLowerCase().includes(progLower)
    );
    if (p) {
      return {
        bookingType: forcedMode !== "auto" ? forcedMode : (p.type === "Group" ? "Group/Lease" : "Members"),
        category: p.type === "Group" ? "Group" : "Individual",
        typeKey: p.key,
        period: p.duration_days,
        daysDescription: p.days_description || p.duration_days
      };
    }
  }

  // Fallback
  return {
    bookingType: targetType,
    category: targetType === "Coaching" ? "Kids Coaching" : "Individual",
    typeKey: programStr ? programStr.replace(/\s+/g, "_") : "Individual_7d",
    period: "5 Days",
    daysDescription: "5 Days"
  };
}

function validateAndPreviewCSV(rows) {
  csvParsedRows = rows;
  csvValidRows = [];
  let validCount = 0, invalidCount = 0;
  const tbody = document.getElementById("csvPreviewTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const seenInCSV = new Set();

  rows.forEach((row, idx) => {
    const name = row["member name"] || row["name"] || row["student name"] || "";
    let phone = row["mobile number"] || row["phone"] || row["mobile"] || "";
    const bTypeRaw = row["booking type"] || row["type"] || "";
    const programRaw = row["program / plan"] || row["plan"] || row["program"] || "";
    const courtRaw = row["court number"] || row["court"] || row["court_id"] || "";
    const startTimeRaw = normalizeCSVTime(row["start time"] || row["start_time"] || row["time"] || "");
    const endTimeRaw = normalizeCSVTime(row["end time"] || row["end_time"] || "");

    const rawJoin = row["join date"] || row["joindate"] || "";
    const rawPaid = row["last paid date"] || row["lastpaiddate"] || "";
    const joinDate = normalizeCSVDate(rawJoin) || formatSelectedDate(new Date());
    const lastPaidDate = normalizeCSVDate(rawPaid);

    phone = phone.replace(/[^\d+]/g, "");
    if (!phone.startsWith("+91") && phone.length === 10) phone = "+91 " + phone;

    const errors = [];
    const warnings = [];

    if (!name) errors.push("Missing Name");
    if (!phone || phone.length < 10) errors.push("Invalid Phone");

    const resolved = resolvePlanKey(programRaw, bTypeRaw);

    let finalStart = startTimeRaw;
    let finalEnd = endTimeRaw;

    if ((!finalStart || !finalEnd) && tenantSettings && tenantSettings.coaching_schedule) {
      const matchCs = tenantSettings.coaching_schedule.find(cs => 
        cs.category && resolved.category && cs.category.toLowerCase() === resolved.category.toLowerCase()
      );
      if (matchCs && matchCs.timing_slots && matchCs.timing_slots.length > 0) {
        const parts = matchCs.timing_slots[0].split(/[-–—]|to/i);
        if (parts.length === 2) {
          if (!finalStart) finalStart = format12Hour(parse12HourTo24Hour(parts[0].trim()));
          if (!finalEnd) finalEnd = format12Hour(parse12HourTo24Hour(parts[1].trim()));
        }
      }
    }

    let courtId = null;
    const safeCourts = Array.isArray(courtsList) ? courtsList : [];
    if (courtRaw) {
      const matchCourt = safeCourts.find(c => String(c.id) === courtRaw || String(c.name).toLowerCase() === courtRaw.toLowerCase() || String(c.name).toLowerCase().includes(courtRaw.toLowerCase()));
      if (matchCourt) {
        courtId = matchCourt.id;
      } else {
        const parsedId = parseInt(courtRaw.replace(/[^\d]/g, ""), 10);
        courtId = isNaN(parsedId) || parsedId <= 0 ? 1 : parsedId;
      }
    } else if (finalStart && finalEnd) {
      courtId = 1; // Default to Court 1 if time slot is set
    }

    const timeSlotDisplay = (finalStart && finalEnd) ? `${finalStart} - ${finalEnd}` : "None";

    const comboKey = `${name.toLowerCase()}_${phone}`;
    if (seenInCSV.has(comboKey)) {
      warnings.push("Duplicate in CSV");
    } else {
      seenInCSV.add(comboKey);
    }

    const existingMember = membersList.find(m => m.status === "active" && m.name.toLowerCase() === name.toLowerCase() && m.phone.trim() === phone.trim());
    if (existingMember) warnings.push("Existing Active Member");

    const isValid = errors.length === 0;
    if (isValid) {
      validCount++;
      csvValidRows.push({
        name, phone, bookingType: resolved.bookingType, typeKey: resolved.typeKey,
        category: resolved.category, period: resolved.period, daysDescription: resolved.daysDescription,
        courtId, startTime: finalStart, endTime: finalEnd,
        joinDate, lastPaidDate, rowNum: idx + 1
      });
    } else {
      invalidCount++;
    }

    const tr = document.createElement("tr");
    tr.className = isValid ? "preview-row-valid" : "preview-row-invalid";

    let statusHtml = "";
    if (errors.length > 0) {
      statusHtml = `<span style="color:#dc3545;font-weight:600;">❌ ${escapeHTML(errors.join(", "))}</span>`;
    } else if (warnings.length > 0) {
      statusHtml = `<span style="color:#ffc107;font-weight:600;">⚠️ ${escapeHTML(warnings.join(", "))}</span>`;
    } else {
      statusHtml = `<span style="color:#28a745;font-weight:600;">✅ Ready</span>`;
    }

    tr.innerHTML = `
      <td style="padding:6px 10px;font-family:var(--font-mono);">${idx + 1}</td>
      <td style="padding:6px 10px;font-weight:600;">${escapeHTML(name || "—")}</td>
      <td style="padding:6px 10px;font-family:var(--font-mono);">${escapeHTML(phone || "—")}</td>
      <td style="padding:6px 10px;">${escapeHTML(resolved.bookingType)}</td>
      <td style="padding:6px 10px;"><span class="member-plan-badge">${escapeHTML(resolved.typeKey)}</span></td>
      <td style="padding:6px 10px;">${escapeHTML(courtId ? `Court ${courtId}` : "Auto")}</td>
      <td style="padding:6px 10px;font-family:var(--font-mono);">${escapeHTML(timeSlotDisplay)}</td>
      <td style="padding:6px 10px;">${statusHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  const bValid = document.getElementById("badgeValidCount");
  const bInvalid = document.getElementById("badgeInvalidCount");
  if (bValid) bValid.textContent = `${validCount} Valid`;
  if (bInvalid) bInvalid.textContent = `${invalidCount} Errors`;

  document.getElementById("csvUploadStep")?.classList.add("hidden");
  document.getElementById("csvPreviewStep")?.classList.remove("hidden");
  document.getElementById("btnResetCsv")?.classList.remove("hidden");

  const btnExecute = document.getElementById("btnExecuteBulkImport");
  if (btnExecute) {
    if (validCount > 0) {
      btnExecute.disabled = false;
      btnExecute.style.opacity = "1";
      btnExecute.style.cursor = "pointer";
      btnExecute.textContent = `🚀 Import ${validCount} Valid Record(s)`;
    } else {
      btnExecute.disabled = true;
      btnExecute.style.opacity = "0.6";
      btnExecute.style.cursor = "not-allowed";
      btnExecute.textContent = "❌ No Valid Records to Import";
    }
  }
}

async function executeBulkImport() {
  if (!currentUser || currentUser.isAnonymous) {
    showInlineToast("Permission Denied: Guest accounts cannot perform bulk imports.", "error");
    return;
  }
  if (csvValidRows.length === 0) return;

  const btnExecute = document.getElementById("btnExecuteBulkImport");
  const progressWrap = document.getElementById("csvProgressWrap");
  const progressBar = document.getElementById("csvProgressBar");
  const progressPercent = document.getElementById("csvProgressPercent");

  if (btnExecute) {
    btnExecute.disabled = true;
    btnExecute.textContent = "Processing Import...";
  }
  if (progressWrap) progressWrap.classList.remove("hidden");

  const total = csvValidRows.length;
  let processed = 0;
  const BATCH_SIZE = 400;

  const chunks = [];
  for (let i = 0; i < csvValidRows.length; i += BATCH_SIZE) {
    chunks.push(csvValidRows.slice(i, i + BATCH_SIZE));
  }

  try {
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const data of chunk) {
        const newMemberRef = doc(collection(db, "members"));
        let firstBookingId = null;

        // Auto-generate 30-day recurring court reservations if court & time parameters provided
        if (data.courtId && data.startTime && data.endTime) {
          const startDate = parseLocalDate(data.joinDate || formatSelectedDate(new Date()));
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 30);

          const allowedDays = parseDays(data.daysDescription || data.period || "5 Days");

          for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            if (!allowedDays.includes(d.getDay())) continue;

            const curDateStr = formatSelectedDate(d);
            const newBookingRef = doc(collection(db, "bookings"));
            if (!firstBookingId) firstBookingId = newBookingRef.id;

            batch.set(newBookingRef, {
              booking_type: data.bookingType,
              court_id: data.courtId,
              customer_name: data.name,
              customer_phone: data.phone,
              category: data.category,
              period: data.period,
              gender: "",
              date: curDateStr,
              start_time: data.startTime,
              end_time: data.endTime,
              enrollees: "",
              userId: currentUser.uid,
              academyId: currentUser.academyId,
              memberId: newMemberRef.id,
              createdAt: serverTimestamp()
            });
          }
        }

        // Save Member document in members collection
        batch.set(newMemberRef, {
          name: data.name,
          phone: data.phone,
          type: data.typeKey,
          bookingType: data.bookingType || "Coaching",
          category: data.category || "",
          joinDate: data.joinDate || formatSelectedDate(new Date()),
          lastPaidDate: data.lastPaidDate || "",
          bookingId: firstBookingId || null,
          status: "active",
          createdTime: Date.now(),
          academyId: currentUser.academyId,
          onboardedVia: "bulk_csv"
        });

        processed++;
      }

      await batch.commit();

      const pct = Math.round((processed / total) * 100);
      if (progressBar) progressBar.style.width = pct + "%";
      if (progressPercent) progressPercent.textContent = pct + "%";
    }

    showInlineToast(`🎉 Successfully onboarded ${processed} member(s) and generated schedule reservations!`, "success");
    document.getElementById("bulkOnboardModal")?.classList.add("hidden");
    resetBulkOnboardState();

    await loadMembers();
    renderMembersTable();
    renderFeeAlerts();
    renderMemberStats();
  } catch (err) {
    console.error("Bulk onboarding error:", err);
    showInlineToast(`❌ Import Failed: ${err.message}`, "error");
  } finally {
    if (btnExecute) {
      btnExecute.disabled = false;
      btnExecute.textContent = "🚀 Import Valid Records";
    }
  }
}
