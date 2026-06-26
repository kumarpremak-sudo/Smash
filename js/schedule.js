// js/schedule.js — Daily Matrix Timeline
import {
  db, currentUser, courtsList, courtsMap, escapeHTML, formatSelectedDate,
  showMsg, setOnAuthReady, initApp, checkBookingConflicts, maskEmail, planLabels,
  collection, doc, getDocs, addDoc, deleteDoc, updateDoc,
  query, where, serverTimestamp
} from "./shared.js";

let selectedDate = new Date();
let dailyBookings = [];
let selectedBooking = null;

setOnAuthReady(async () => {
  buildMatrixHeaders();
  const dateInput = document.getElementById("daily-date-input");
  if (dateInput) dateInput.value = formatSelectedDate(selectedDate);
  await loadDailyGrid();
});

function setupScheduleListeners() {
  const addClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
  const addSubmit = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("submit", fn); };

  addClick("prev-day", () => changeDailyDay(-1));
  addClick("next-day", () => changeDailyDay(1));
  const dateInput = document.getElementById("daily-date-input");
  if (dateInput) dateInput.addEventListener("change", (e) => { selectedDate = new Date(e.target.value); loadDailyGrid(); });

  // Quick booking modal
  addClick("modalClose", closeModal);
  const modal = document.getElementById("bookingModal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  addSubmit("quickBookingForm", handleQuickBookingSubmit);

  // Booking detail modal actions
  addClick("btnEditBooking", showEditBookingForm);
  addClick("btnCancelEdit", () => { if (selectedBooking) openBookingDetailsModal(selectedBooking); });
  addClick("btnDeleteBooking", handleBookingDelete);
  addSubmit("editBookingForm", handleEditBookingSubmit);
  addClick("btnEnrollSubmit", handleEnrollmentSubmit);
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
    const q = query(collection(db, "bookings"), where("date", "==", dateStr));
    const snap = await getDocs(q);
    dailyBookings = [];
    snap.forEach(d => dailyBookings.push({ id: d.id, ...d.data() }));
  } catch (error) { dailyBookings = []; }

  const tbody = document.getElementById("matrix-body");
  if (tbody.children.length === 0) {
    for (let hour = 6; hour <= 22; hour++) {
      const tr = document.createElement("tr");
      const startStr = `${String(hour).padStart(2, "0")}:00`;
      const endStr = `${String(hour + 1).padStart(2, "0")}:00`;
      const tdTime = document.createElement("td");
      tdTime.className = "matrix-time-col";
      tdTime.textContent = `${startStr} - ${endStr}`;
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
    const start = booking.start_time.substring(0, 5);
    const cell = document.querySelector(`.matrix-cell[data-court-id="${booking.court_id}"][data-start="${start}"]`);
    if (cell) {
      cell.className = "matrix-cell booked " + (booking.category || "court_rental");
      cell.dataset.bookingId = booking.id;
      let enrolleesCount = booking.enrollees ? booking.enrollees.split(",").filter(n => n.trim()).length : 0;
      const enrolleesBadge = enrolleesCount > 0 ? `<div class="matrix-cell-enrollees">${enrolleesCount} Enrolled</div>` : "";
      cell.innerHTML = `<span class="matrix-cell-booked-by">${escapeHTML(booking.customer_name)}</span>${enrolleesBadge}`;
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
  document.getElementById("quickSlotDesc").textContent = `${courtsMap[courtId] || `Court ${courtId}`} on ${dateStr} (${start} - ${end})`;
  document.getElementById("quickBookingForm").reset();
  if (currentUser && !currentUser.isAnonymous) {
    document.getElementById("quickCustomerName").value = currentUser.displayName || "";
    document.getElementById("quickCustomerEmail").value = currentUser.email || "";
  }
}

async function openBookingDetailsModal(booking) {
  selectedBooking = booking;
  openModal("Booking Details");
  document.getElementById("modalDetailsView").classList.remove("hidden");
  document.getElementById("detCourt").textContent = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
  document.getElementById("detTime").textContent = `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} on ${booking.date}`;
  document.getElementById("detName").textContent = booking.customer_name;
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  if (joinDateInput) joinDateInput.value = formatSelectedDate(new Date());

  // Hide enrollment controls for guests
  const enrollBlock = document.querySelector(".enroll-block");
  if (enrollBlock) {
    enrollBlock.classList.toggle("hidden", currentUser && currentUser.isAnonymous);
  }

  const ownerActions = document.getElementById("ownerActions");
  const isOwner = currentUser && booking.userId === currentUser.uid;
  if (isOwner) { document.getElementById("detEmail").textContent = booking.customer_email; ownerActions.classList.remove("hidden"); }
  else { document.getElementById("detEmail").textContent = maskEmail(booking.customer_email); ownerActions.classList.add("hidden"); }
  await renderModalEnrolleesList(booking.id);
}

async function renderModalEnrolleesList(bookingId) {
  const ul = document.getElementById("enrollees-list");
  if (!ul || !db) return;
  ul.innerHTML = '<li class="text-muted" style="list-style:none;">Loading...</li>';
  try {
    const q = query(collection(db, "members"), where("bookingId", "==", bookingId));
    const snap = await getDocs(q);
    ul.innerHTML = "";
    let activeCount = 0;
    const isGuest = currentUser && currentUser.isAnonymous;
    snap.forEach(d => {
      const data = d.data();
      if (data.status !== "active") return;
      activeCount++;
      const member = { id: d.id, ...data };
      const plan = planLabels[member.type] || { name: member.type, color: "var(--accent4)", bg: "rgba(77,171,247,0.12)" };
      const li = document.createElement("li");
      li.className = "enrollee-list-item"; li.style.marginBottom = "0.5rem";
      
      const removeBtnHtml = isGuest ? '' : `<button class="btn-remove-enrollee" title="Remove ${escapeHTML(member.name)}">&times;</button>`;
      
      li.innerHTML = `<div class="enrollee-list-item-info"><span style="font-weight:600;">👤 ${escapeHTML(member.name)}</span><span class="enrollee-list-item-meta">Joined: <span>${escapeHTML(member.joinDate)}</span> | Paid: <span>${escapeHTML(member.lastPaidDate)}</span></span></div><div style="display:flex;align-items:center;gap:0.8rem;"><span style="font-size:0.65rem;background:${plan.bg};color:${plan.color};border:1px solid ${plan.color}35;padding:1px 8px;border-radius:99px;font-weight:600;">${plan.name}</span>${removeBtnHtml}</div>`;
      
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
    if (!(currentUser && selectedBooking.userId === currentUser.uid)) throw new Error("Permission Denied.");
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
    if (!(currentUser && selectedBooking.userId === currentUser.uid)) throw new Error("Permission Denied.");
    await deleteDoc(doc(db, "bookings", selectedBooking.id));
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
    await addDoc(collection(db, "members"), { name: newName, type: typeSelect.value, joinDate: joinDateInput.value || formatSelectedDate(selectedDate), lastPaidDate: joinDateInput.value || formatSelectedDate(selectedDate), bookingId: selectedBooking.id, status: "active", createdTime: Date.now() });
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
  const category = document.getElementById("quickBookingCategory").value;
  if (name.length > 40) { showMsg("modalMessage", "Name cannot exceed 40 characters.", "error"); btn.disabled = false; return; }
  if (email.length > 80) { showMsg("modalMessage", "Email cannot exceed 80 characters.", "error"); btn.disabled = false; return; }
  if (startTime >= endTime) { showMsg("modalMessage", "End time must be after start time.", "error"); btn.disabled = false; return; }
  try {
    if (!currentUser) throw new Error("You must be signed in.");
    if (await checkBookingConflicts(courtId, dateStr, startTime, endTime)) throw new Error("Slot already booked.");
    await addDoc(collection(db, "bookings"), { court_id: courtId, customer_name: name, customer_email: email, category, date: dateStr, start_time: startTime, end_time: endTime, enrollees: "", userId: currentUser.uid, createdAt: serverTimestamp() });
    showMsg("modalMessage", "Quick reservation confirmed!", "success");
    setTimeout(() => { closeModal(); loadDailyGrid(); }, 1200);
  } catch (error) { showMsg("modalMessage", error.message, "error"); }
  finally { btn.disabled = false; }
}

document.addEventListener("DOMContentLoaded", () => {
  setupScheduleListeners();
  initApp();
});
