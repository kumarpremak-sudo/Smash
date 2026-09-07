// js/schedule.js — Daily Matrix Timeline
import {
  db, currentUser, courtsList, courtsMap, escapeHTML, formatSelectedDate,
  showMsg, setOnAuthReady, initApp, checkBookingConflicts, maskEmail,
  bulkCancelMonthlyBookings, tenantSettings, populateBookingDropdowns, populateCategoryDropdown, openWhatsApp,
  collection, doc, getDocs, addDoc, deleteDoc, updateDoc,
  query, where, serverTimestamp, format12Hour, isStrictCoach, parseLocalDate, getPlanDetails
} from "./shared.js?v=3";

let selectedDate = new Date();
let dailyBookings = [];
let selectedBooking = null;

setOnAuthReady(async (user) => {
  if (isStrictCoach(user)) {
    window.location.href = "coach.html";
    return;
  }
  buildMatrixHeaders();
  const dateInput = document.getElementById("daily-date-input");
  if (dateInput) dateInput.value = formatSelectedDate(selectedDate);
  await loadDailyGrid();
  setupScheduleListeners();
});

let listenersAttached = false;
function setupScheduleListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const addClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
  const addSubmit = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("submit", fn); };

  addClick("prev-day", () => changeDailyDay(-1));
  addClick("next-day", () => changeDailyDay(1));
  const dateInput = document.getElementById("daily-date-input");
  if (dateInput) dateInput.addEventListener("change", (e) => { selectedDate = parseLocalDate(e.target.value); loadDailyGrid(); });

  // Quick booking modal
  addClick("modalClose", closeModal);
  const modal = document.getElementById("bookingModal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  addSubmit("quickBookingForm", handleQuickBookingSubmit);

  // Booking detail modal actions
  addClick("btnRemindBooking", handleRemindBooking);
  addClick("btnEditBooking", showEditBookingForm);
  addClick("btnCancelEdit", () => { if (selectedBooking) openBookingDetailsModal(selectedBooking); });
  addClick("btnDeleteBooking", handleBookingDelete);
  addSubmit("editBookingForm", handleEditBookingSubmit);
  addClick("btnEnrollSubmit", handleEnrollmentSubmit);

  // Bulk Cancel Modal listeners
  addClick("btnOpenBulkCancel", openBulkCancelModal);
  addClick("bulkCancelClose", closeBulkCancelModal);
  const bulkModal = document.getElementById("bulkCancelModal");
  if (bulkModal) bulkModal.addEventListener("click", (e) => { if (e.target === bulkModal) closeBulkCancelModal(); });
  
  const targetTypeSelect = document.getElementById("bulkTargetType");
  if (targetTypeSelect) {
    targetTypeSelect.addEventListener("change", (e) => {
      const isMember = e.target.value === "member";
      document.getElementById("bulkMemberGroup").classList.toggle("hidden", !isMember);
      document.getElementById("bulkCategoryGroup").classList.toggle("hidden", isMember);
    });
  }
  addSubmit("bulkCancelForm", handleBulkCancelSubmit);

  populateBookingDropdowns("booking_type", "booking_category", ["Spot booking", "Guest Play", "Court Rental"]);
  const typeSelect = document.getElementById("booking_type");
  const catSelect = document.getElementById("booking_category");
  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      populateCategoryDropdown("booking_type", "booking_category");
      if (catSelect) catSelect.value = "";
    });
  }
}

function openBulkCancelModal() {
  const modal = document.getElementById("bulkCancelModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  const now = new Date();
  const yearMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ymInput = document.getElementById("bulkYearMonth");
  if (ymInput && !ymInput.value) ymInput.value = yearMonthStr;

  const catSelect = document.getElementById("bulkCategory");
  if (catSelect && tenantSettings && tenantSettings.fee_structure) {
    catSelect.innerHTML = '<option value="" disabled selected>Select Coaching Program</option>';
    tenantSettings.fee_structure.forEach(prog => {
      let pName = prog.program_name || "";
      let pLower = pName.toLowerCase();
      let cat = pName;
      if (pLower.includes("personal training")) {
        cat = "Private Coaching";
      } else if (pLower.includes("advance")) {
        cat = "3 Session";
      } else if (!pLower.includes("tournament")) {
        cat = pName.replace(/coaching/i, "").trim() || pName;
      }
      catSelect.innerHTML += `<option value="${cat}">${pName}</option>`;
    });
  }

  // Populate member dropdown with active, deduplicated members
  const memberSelect = document.getElementById("bulkMemberId");
  if (memberSelect) {
    memberSelect.innerHTML = '<option value="" disabled selected>Loading members...</option>';
    if (currentUser && currentUser.academyId) {
      Promise.all([
        getDocs(query(collection(db, "members"), where("academyId", "==", currentUser.academyId))),
        getDocs(query(collection(db, "bookings"), where("academyId", "==", currentUser.academyId)))
      ]).then(([membersSnap, bookingsSnap]) => {
        memberSelect.innerHTML = '<option value="" disabled selected>Select a Member</option>';
        
        const activePhones = new Set();
        const activeNames = new Set();
        const activeMemberIds = new Set();
        bookingsSnap.forEach(d => {
          const b = d.data();
          if (b.status !== "cancelled") {
            if (b.memberId) activeMemberIds.add(b.memberId);
            if (b.customer_phone) activePhones.add(b.customer_phone.trim());
            if (b.customer_name) activeNames.add(b.customer_name.trim().toLowerCase());
          }
        });

        const uniqueMembersMap = new Map();
        membersSnap.forEach(docSnap => {
          const m = { id: docSnap.id, ...docSnap.data() };
          if (m.status === "cancelled" || m.status === "inactive") return;
          
          const phoneKey = (m.phone || "").trim();
          const nameKey = (m.name || "").trim().toLowerCase();
          
          const hasActiveBooking = (phoneKey && activePhones.has(phoneKey)) ||
                                   (nameKey && activeNames.has(nameKey)) ||
                                   activeMemberIds.has(m.id);
          if (!hasActiveBooking) return;

          const dupKey = phoneKey || nameKey || m.id;
          if (!uniqueMembersMap.has(dupKey)) {
            uniqueMembersMap.set(dupKey, m);
          }
        });

        const membersList = Array.from(uniqueMembersMap.values());
        membersList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        if (membersList.length === 0) {
          memberSelect.innerHTML = '<option value="" disabled selected>No active members with bookings found</option>';
        } else {
          membersList.forEach(m => {
            const phoneStr = m.phone ? ` (${m.phone})` : '';
            memberSelect.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}${escapeHTML(phoneStr)}</option>`;
          });
        }
      }).catch(err => {
        console.error("Failed to load members:", err);
        memberSelect.innerHTML = '<option value="" disabled selected>Failed to load members</option>';
      });
    }
  }
}

function closeBulkCancelModal() {
  const modal = document.getElementById("bulkCancelModal");
  if (modal) modal.classList.add("hidden");
}

async function handleBulkCancelSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSubmitBulkCancel");
  const targetType = document.getElementById("bulkTargetType").value;
  const memberId = document.getElementById("bulkMemberId") ? document.getElementById("bulkMemberId").value : "";
  const groupId = document.getElementById("bulkCategory").value;
  const yearMonth = document.getElementById("bulkYearMonth").value;
  const reason = document.getElementById("bulkReason").value.trim();

  if (targetType === "member" && !memberId) {
    showMsg("bulkCancelMsg", "Please select a member.", "error");
    return;
  }
  
  if (targetType === "group" && !groupId) {
    showMsg("bulkCancelMsg", "Please select a Coaching Group/Program.", "error");
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = "Processing Bulk Cancellation..."; }
    const res = await bulkCancelMonthlyBookings({
      memberId: targetType === "member" ? memberId : null,
      groupId: targetType === "group" ? groupId : null,
      yearMonth,
      cancelledBy: currentUser ? currentUser.email : "Admin",
      reason
    });

    if (res.processedCount === 0) {
      showMsg("bulkCancelMsg", "No active reservations found matching criteria.", "error");
    } else {
      showMsg("bulkCancelMsg", `Successfully cancelled ${res.processedCount} slot(s) for ${yearMonth}!`, "success");
      setTimeout(() => {
        closeBulkCancelModal();
        loadDailyGrid();
      }, 1500);
    }
  } catch (err) {
    showMsg("bulkCancelMsg", "Bulk Cancellation failed: " + err.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🗑️ Execute Bulk Cancellation"; }
  }
}


function changeDailyDay(delta) {
  selectedDate.setDate(selectedDate.getDate() + delta);
  document.getElementById("daily-date-input").value = formatSelectedDate(selectedDate);
  loadDailyGrid();
}

function buildMatrixHeaders() {
  const row = document.getElementById("matrix-header-row");
  row.innerHTML = "<th>Time</th>";
  courtsList.forEach(court => {
    const th = document.createElement("th");
    th.textContent = court.name;
    row.appendChild(th);
  });
}

async function loadDailyGrid() {
  const dateStr = formatSelectedDate(selectedDate);
  document.querySelectorAll(".matrix-cell").forEach(cell => {
    cell.className = "matrix-cell";
    cell.innerHTML = '<span class="matrix-cell-empty-text">Click to Book</span>';
    delete cell.dataset.bookingId;
  });
  try {
    // Query by academyId only (auto-indexed), filter date client-side
    const q = query(collection(db, "bookings"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    dailyBookings = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.status === "cancelled") return;
      if (data.date === dateStr) {
        dailyBookings.push({ id: d.id, ...data });
      }
    });
  } catch (error) { console.error("Schedule query failed:", error); dailyBookings = []; }

  const tbody = document.getElementById("matrix-body");
  if (tbody.children.length === 0) {
    const op = (tenantSettings && tenantSettings.operating_hours) ? tenantSettings.operating_hours : { start: "05:00", end: "23:00" };
    const startHour = parseInt(op.start.split(":")[0], 10);
    const endHour = parseInt(op.end.split(":")[0], 10);

    for (let hour = startHour; hour < endHour; hour++) {
      const tr = document.createElement("tr");
      const startStr = `${String(hour).padStart(2, "0")}:00`;
      const endStr = `${String(hour + 1).padStart(2, "0")}:00`;
      const tdTime = document.createElement("td");
      tdTime.className = "matrix-time-col";
      tdTime.textContent = `${format12Hour(startStr)} - ${format12Hour(endStr)}`;
      tr.appendChild(tdTime);
      courtsList.forEach(court => {
        const td = document.createElement("td");
        td.className = "matrix-cell";
        td.dataset.courtId = court.id;
        td.dataset.start = startStr;
        td.dataset.end = endStr;
        td.innerHTML = '<span class="matrix-cell-empty-text">Click to Book</span>';
        td.addEventListener("click", () => handleMatrixCellClick(court.id, startStr, endStr));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  }

  dailyBookings.forEach(booking => {
    if (!booking.start_time || !booking.end_time) return; // Prevent substring crash
    const startHour = parseInt(booking.start_time.substring(0, 2), 10);
    const endHour = parseInt(booking.end_time.substring(0, 2), 10);
    
    // Loop through every hour the booking spans
    for (let h = startHour; h < endHour; h++) {
      const slotStart = `${String(h).padStart(2, "0")}:00`;
      const cell = document.querySelector(`.matrix-cell[data-court-id="${booking.court_id}"][data-start="${slotStart}"]`);
      if (cell) {
        cell.className = "matrix-cell booked " + (booking.category || "court_rental");
        cell.dataset.bookingId = booking.id;
        
        // Only show the label on the very first cell of the block for cleaner UI
        if (h === startHour) {
          let enrolleesCount = booking.enrollees ? booking.enrollees.split(",").filter(n => n.trim()).length : 0;
          const enrolleesBadge = enrolleesCount > 0 ? `<div class="matrix-cell-enrollees">${enrolleesCount} Enrolled</div>` : "";
          cell.innerHTML = `<span class="matrix-cell-booked-by">${escapeHTML(booking.customer_name)}</span>${enrolleesBadge}`;
        } else {
          cell.innerHTML = `<span class="matrix-cell-booked-by" style="opacity:0.5; font-size:0.75rem;">(Continued)</span>`;
        }
      }
    }
  });
}

function handleMatrixCellClick(courtId, start, end) {
  const cell = document.querySelector(`.matrix-cell[data-court-id="${courtId}"][data-start="${start}"]`);
  if (cell && cell.classList.contains("booked")) {
    const booking = dailyBookings.find(b => b.id === cell.dataset.bookingId);
    if (booking) openBookingDetailsModal(booking);
  } else {
    openQuickBookingModal(courtId, start, end);
  }
}

// ── Modal Controllers ───────────────────────────────────────
function openModal(title) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("bookingModal").classList.remove("hidden");
  document.getElementById("modalMessage").classList.add("hidden");
  ["modalDetailsView", "modalEditFormView", "modalQuickFormView"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

function closeModal() { document.getElementById("bookingModal").classList.add("hidden"); selectedBooking = null; }

function openQuickBookingModal(courtId, start, end) {
  openModal("Quick Reservation");
  document.getElementById("modalQuickFormView").classList.remove("hidden");
  document.getElementById("quickCourtId").value = courtId;
  document.getElementById("quickStartTime").value = start;
  document.getElementById("quickEndTime").value = end;
  const dateStr = formatSelectedDate(selectedDate);
  document.getElementById("quickSlotDesc").textContent = `${courtsMap[courtId] || `Court ${courtId}`} on ${dateStr} (${format12Hour(start)} - ${format12Hour(end)})`;
  
  // Force dropdown population just in case the initial load failed or was skipped
  populateBookingDropdowns("booking_type", "booking_category", ["Spot booking", "Guest Play", "Court Rental"]);
  
  document.getElementById("quickBookingForm").reset();
  if (currentUser && !currentUser.isAnonymous) {
    document.getElementById("quickCustomerName").value = currentUser.displayName || "";
    document.getElementById("quickCustomerEmail").value = currentUser.email || "";
    document.getElementById("quickCustomerPhone").value = currentUser.phoneNumber || "";
  }
}

async function openBookingDetailsModal(booking) {
  selectedBooking = booking;
  openModal("Booking Details");
  document.getElementById("modalDetailsView").classList.remove("hidden");
  document.getElementById("detCourt").textContent = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
  document.getElementById("detTime").textContent = `${format12Hour(booking.start_time)} - ${format12Hour(booking.end_time)} on ${booking.date}`;
  document.getElementById("detName").textContent = booking.customer_name;
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  if (joinDateInput) joinDateInput.value = formatSelectedDate(new Date());

  // Hide enrollment controls for guests
  const enrollBlock = document.querySelector(".enroll-block");
  if (enrollBlock) {
    enrollBlock.classList.toggle("hidden", currentUser && currentUser.isAnonymous);
  }

  const ownerActions = document.getElementById("ownerActions");
  const isAuthorized = currentUser && (!currentUser.isAnonymous || booking.userId === currentUser.uid);
  if (isAuthorized) { document.getElementById("detEmail").textContent = booking.customer_email; ownerActions.classList.remove("hidden"); }
  else { document.getElementById("detEmail").textContent = maskEmail(booking.customer_email); ownerActions.classList.add("hidden"); }
  await renderModalEnrolleesList(booking.id);
}

async function renderModalEnrolleesList(bookingId) {
  const ul = document.getElementById("enrollees-list");
  if (!ul || !db) return;
  ul.innerHTML = '<li class="text-muted" style="list-style:none;">Loading...</li>';
  try {
    // Query by academyId only (auto-indexed), filter bookingId client-side
    const q = query(collection(db, "members"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    ul.innerHTML = "";
    let activeCount = 0;
    const isGuest = currentUser && currentUser.isAnonymous;
    snap.forEach(d => {
      const data = d.data();
      if (data.bookingId !== bookingId) return; // Client-side filter
      if (data.status !== "active") return;
      activeCount++;
      const member = { id: d.id, ...data };
      const planDetails = getPlanDetails(member.type);
      const planName = planDetails.name;
      let planColor = "var(--accent4)";
      let planBg = "rgba(77,171,247,0.12)";
      if (planDetails.category === "membership") {
        planColor = "var(--accent)"; planBg = "rgba(0,212,169,0.12)";
      } else if (planDetails.category === "pt") {
        planColor = "var(--accent3)"; planBg = "rgba(255,107,107,0.12)";
      }
      const li = document.createElement("li");
      li.className = "enrollee-list-item"; li.style.marginBottom = "0.5rem";
      
      const removeBtnHtml = isGuest ? '' : `<button class="btn-remove-enrollee" title="Remove ${escapeHTML(member.name)}">&times;</button>`;
      
      li.innerHTML = `<div class="enrollee-list-item-info"><span style="font-weight:600;">👤 ${escapeHTML(member.name)}</span><span class="enrollee-list-item-meta">Joined: <span>${escapeHTML(member.joinDate)}</span> | Paid: <span>${member.lastPaidDate === "" ? "Pending" : escapeHTML(member.lastPaidDate)}</span></span></div><div style="display:flex;align-items:center;gap:0.8rem;"><span style="font-size:0.65rem;background:${planBg};color:${planColor};border:1px solid ${planColor}35;padding:1px 8px;border-radius:99px;font-weight:600;">${planName}</span>${removeBtnHtml}</div>`;
      
      if (!isGuest) {
        li.querySelector(".btn-remove-enrollee").addEventListener("click", async () => {
          if (!currentUser || currentUser.isAnonymous) {
            showMsg("modalMessage", "Permission Denied: Guests cannot remove enrollees.", "error");
            return;
          }
          if (!confirm(`Remove ${member.name}?`)) return;
          await deleteDoc(doc(db, "members", member.id));
          await renderModalEnrolleesList(bookingId);
        });
      }
      ul.appendChild(li);
    });
    if (activeCount === 0) ul.innerHTML = '<li class="text-muted" style="list-style:none;">No enrollees yet</li>';
  } catch (error) { ul.innerHTML = `<li style="color:var(--accent2);list-style:none;">Error: ${error.message}</li>`; }
}

function handleRemindBooking() {
  if (!selectedBooking) return;
  const academyName = tenantSettings ? tenantSettings.academy_name : "our academy";
  const msg = `Hi ${selectedBooking.customer_name},\n\nThis is a reminder from *${academyName}* for your upcoming session.\n\n*Details:*\nDate: ${selectedBooking.date}\nTime: ${format12Hour(selectedBooking.start_time)} - ${format12Hour(selectedBooking.end_time)}\nCategory: ${selectedBooking.booking_type} - ${selectedBooking.category}\n\nSee you on the court!`;
  // if they only entered email, this might be empty, openWhatsApp handles empty gracefully
  const phone = selectedBooking.customer_phone || selectedBooking.customer_email || "";
  openWhatsApp(phone, msg);
}

function showEditBookingForm() {
  if (!selectedBooking) return;
  document.getElementById("modalTitle").textContent = "Edit Reservation";
  document.getElementById("modalDetailsView").classList.add("hidden");
  document.getElementById("modalEditFormView").classList.remove("hidden");
  document.getElementById("editCustomerName").value = selectedBooking.customer_name;
  document.getElementById("editCustomerEmail").value = selectedBooking.customer_email;
}

async function handleEditBookingSubmit(event) {
  event.preventDefault();
  if (!selectedBooking) return;
  const btn = event.target.querySelector("button[type='submit']");
  btn.disabled = true;
  const name = document.getElementById("editCustomerName").value.trim();
  const email = document.getElementById("editCustomerEmail").value.trim();
  if (name.length > 40) { showMsg("modalMessage", "Name cannot exceed 40 characters.", "error"); btn.disabled = false; return; }
  if (email.length > 80) { showMsg("modalMessage", "Email cannot exceed 80 characters.", "error"); btn.disabled = false; return; }
  try {
    if (!currentUser) throw new Error("Permission Denied: You must be signed in.");
    if (currentUser.isAnonymous && selectedBooking.userId !== currentUser.uid) {
      throw new Error("Permission Denied: Guests can only edit their own reservations.");
    }
    if (currentUser.academyId && selectedBooking.academyId && currentUser.academyId !== selectedBooking.academyId) {
      throw new Error("Permission Denied: Cross-tenant access is not allowed.");
    }
    await updateDoc(doc(db, "bookings", selectedBooking.id), { customer_name: name, customer_email: email });
    selectedBooking.customer_name = name; selectedBooking.customer_email = email;
    showMsg("modalMessage", "Saved.", "success");
    setTimeout(() => { openBookingDetailsModal(selectedBooking); loadDailyGrid(); }, 1200);
  } catch (error) { showMsg("modalMessage", error.message, "error"); }
  finally { btn.disabled = false; }
}

async function handleBookingDelete() {
  if (!selectedBooking || !confirm("Cancel this reservation?")) return;
  try {
    if (!currentUser) throw new Error("Permission Denied: You must be signed in.");
    if (currentUser.isAnonymous && selectedBooking.userId !== currentUser.uid) {
      throw new Error("Permission Denied: Guests can only cancel their own reservations.");
    }
    if (currentUser.academyId && selectedBooking.academyId && currentUser.academyId !== selectedBooking.academyId) {
      throw new Error("Permission Denied: Cross-tenant access is not allowed.");
    }
    await deleteDoc(doc(db, "bookings", selectedBooking.id));

    if (selectedBooking.memberId) {
      try {
        const qOther = query(collection(db, "bookings"), where("academyId", "==", currentUser.academyId));
        const otherSnap = await getDocs(qOther);
        let hasOtherBookings = false;
        otherSnap.forEach(d => {
          if (d.id !== selectedBooking.id) {
            const bData = d.data();
            if (bData.status !== "cancelled" && bData.memberId === selectedBooking.memberId) {
              hasOtherBookings = true;
            }
          }
        });
        if (!hasOtherBookings) {
          await deleteDoc(doc(db, "members", selectedBooking.memberId));
        }
      } catch (mErr) { console.warn("Linked member deletion check:", mErr); }
    }

    showMsg("modalMessage", "Cancelled.", "success");
    setTimeout(() => { closeModal(); loadDailyGrid(); }, 1200);
  } catch (error) { showMsg("modalMessage", error.message, "error"); }
}

async function handleEnrollmentSubmit() {
  if (!selectedBooking) return;
  if (!currentUser || currentUser.isAnonymous) {
    showMsg("modalMessage", "Permission Denied: Guests cannot enroll trainees.", "error");
    return;
  }
  const ul = document.getElementById("enrollees-list");
  if (ul && ul.querySelectorAll("li.enrollee-list-item").length >= 30) {
    showMsg("modalMessage", "Maximum limit of 30 trainees reached.", "error");
    return;
  }
  const input = document.getElementById("newEnrolleeInput");
  const typeSelect = document.getElementById("newEnrolleeType");
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  const newName = input.value.trim();
  if (!newName) return;
  if (newName.length > 40) {
    showMsg("modalMessage", "Trainee name cannot exceed 40 characters.", "error");
    return;
  }
  const submitBtn = document.getElementById("btnEnrollSubmit");
  submitBtn.disabled = true;
  try {
    const newMemberRef = doc(collection(db, "members"));
    await setDoc(newMemberRef, { name: newName, type: typeSelect.value, joinDate: joinDateInput.value || formatSelectedDate(selectedDate), lastPaidDate: "", bookingId: selectedBooking.id, status: "active", createdTime: Date.now(), academyId: currentUser.academyId });
    input.value = "";
    showMsg("modalMessage", "Enrolled!", "success");
    await renderModalEnrolleesList(selectedBooking.id);
  } catch (error) { showMsg("modalMessage", error.message, "error"); }
  finally { submitBtn.disabled = false; }
}

async function handleQuickBookingSubmit(event) {
  event.preventDefault();
  const btn = event.target.querySelector("button[type='submit']");
  btn.disabled = true;
  const courtId = parseInt(document.getElementById("quickCourtId").value);
  const startTime = document.getElementById("quickStartTime").value + ":00";
  const endTime = document.getElementById("quickEndTime").value + ":00";
  const dateStr = formatSelectedDate(selectedDate);
  const name = document.getElementById("quickCustomerName").value.trim();
  const email = document.getElementById("quickCustomerEmail").value.trim();
  const phone = document.getElementById("quickCustomerPhone").value.trim();
  const category = document.getElementById("booking_category").value;
  const bookingType = document.getElementById("booking_type").value;
  if (name.length > 40) { showMsg("modalMessage", "Name cannot exceed 40 characters.", "error"); btn.disabled = false; return; }
  if (email.length > 80) { showMsg("modalMessage", "Email cannot exceed 80 characters.", "error"); btn.disabled = false; return; }
  if (phone.length > 20) { showMsg("modalMessage", "Phone cannot exceed 20 characters.", "error"); btn.disabled = false; return; }
  if (startTime >= endTime) { showMsg("modalMessage", "End time must be after start time.", "error"); btn.disabled = false; return; }
  try {
    if (!currentUser) throw new Error("You must be signed in.");
    const conflictError = await checkBookingConflicts(courtId, dateStr, startTime, endTime, bookingType, category);
    if (conflictError) throw new Error(conflictError);
    await addDoc(collection(db, "bookings"), { court_id: courtId, customer_name: name, customer_email: email, customer_phone: phone, category, booking_type: bookingType, date: dateStr, start_time: startTime, end_time: endTime, enrollees: "", userId: currentUser.uid, academyId: currentUser.academyId, createdAt: serverTimestamp() });
    showMsg("modalMessage", "Quick reservation confirmed!", "success");
    setTimeout(() => { closeModal(); loadDailyGrid(); }, 1200);
  } catch (error) { showMsg("modalMessage", error.message, "error"); }
  finally { btn.disabled = false; }
}

function bootstrap() {
  setupScheduleListeners();
  initApp();
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
