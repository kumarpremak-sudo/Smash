// js/dashboard.js — Home Screen: Stats, Calendar, Bookings, Revenue
import {
  db, currentUser, courtsList, courtsMap, membersList, tenantSettings, defaultSettings,
  monthNames, escapeHTML, formatSelectedDate, showMsg, showInlineToast,
  loadMembers, setOnAuthReady, initApp, populateBookingDropdowns, populateCategoryDropdown, populatePeriodDropdown, resolvePlanKey,
  collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, writeBatch, serverTimestamp, checkBookingConflicts, maskEmail, maskPhone,
  signOut
} from "./shared.js";

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = new Date();
let currentMonthBookings = [];
let selectedBooking = null;

// ── First Time Setup ────────────────────────────────────────
document.addEventListener('setup_required', () => {
  const modal = document.getElementById("firstTimeSetupModal");
  if (modal) modal.classList.remove("hidden");
});

// ── Auth Ready Handler ──────────────────────────────────────
setOnAuthReady(async (user) => {
  // Fill court selector
  const select = document.getElementById("court_id");
  if (select) {
    select.innerHTML = '<option value="" disabled selected>Select Court</option>';
    courtsList.forEach(court => {
      const opt = document.createElement("option");
      opt.value = court.id;
      opt.textContent = court.name;
      select.appendChild(opt);
    });
  }

  // Fill booking category dynamically
  populateBookingDropdowns("booking_type", "booking_category");

  // Fill enrollee plan dynamically
  const enrolleeSelect = document.getElementById("newEnrolleeType");
  if (enrolleeSelect && tenantSettings) {
    if (tenantSettings.membership_programs) {
      tenantSettings.membership_programs.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.key;
        opt.textContent = p.type + " - " + p.duration_days + (p.special_notes ? " (" + p.special_notes + ")" : "");
        enrolleeSelect.appendChild(opt);
      });
    }
    if (tenantSettings.fee_structure) {
      tenantSettings.fee_structure.forEach(prog => {
        (prog.pricing_variants || []).forEach(v => {
          const opt = document.createElement("option");
          opt.value = v.key;
          opt.textContent = prog.program_name + " - " + v.frequency;
          enrolleeSelect.appendChild(opt);
        });
      });
    }
  }

  // Prefill user info
  if (user && !user.isAnonymous) {
    const nameInput = document.getElementById("customer_name");
    const phoneInput = document.getElementById("customer_phone");
    if (nameInput) nameInput.value = user.displayName || "";
    if (phoneInput && !phoneInput.value.trim()) phoneInput.value = "+91 ";
  }
  const nameEl = document.getElementById("homeWelcomeName");
  if (nameEl) nameEl.textContent = user.displayName || (user.isAnonymous ? "Guest" : "Admin");
  await renderCalendar();
});

// ── Setup Page Listeners ────────────────────────────────────
function setupDashboardListeners() {
  const addClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
  const addSubmit = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("submit", fn); };

  // Calendar
  addClick("prev-month", () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar(); });
  addClick("next-month", () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); });

  // Booking form
  addClick("btnOpenNewBooking", openBookingFormModal);
  addSubmit("bookingForm", handleBookingSubmit);
  addSubmit("editBookingForm", handleEditBookingSubmit);

  // Modal
  addClick("modalClose", closeModal);
  const modal = document.getElementById("bookingModal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Booking detail actions
  addClick("btnEditBooking", showEditBookingForm);
  addClick("btnCancelEdit", () => { if (selectedBooking) openBookingDetailsModal(selectedBooking); });
  addClick("btnDeleteBooking", handleBookingDelete);

  // Enrollment
  addClick("btnEnrollSubmit", handleEnrollmentSubmit);

  const catSelect = document.getElementById("booking_category");
  const typeSelect = document.getElementById("booking_type");
  const periodSelect = document.getElementById("booking_period");

  if (typeSelect) typeSelect.addEventListener("change", () => {
    populateCategoryDropdown("booking_type", "booking_category");
    catSelect.value = "";
    populatePeriodDropdown("booking_type", "booking_category", "booking_period");
    periodSelect.value = "";
    populateTimeDropdowns("");
  });

  if (catSelect) catSelect.addEventListener("change", () => {
    populatePeriodDropdown("booking_type", "booking_category", "booking_period");
    periodSelect.value = "";
    populateTimeDropdowns(catSelect.value);
  });

  // Setup
  addSubmit("setupForm", handleSetupSubmit);

  // Quick links
  addClick("quickDailyGridBtn", () => { window.location.href = "schedule.html"; });
}

function populateTimeDropdowns(category) {
  const startSel = document.getElementById("start_time");
  const endSel = document.getElementById("end_time");
  if (!startSel || !endSel) return;
  startSel.innerHTML = '<option value="" disabled selected>Select Start Time</option>';
  endSel.innerHTML = '<option value="" disabled selected>Select End Time</option>';

  if (!category || !tenantSettings) return;
  const catLower = category.toLowerCase();
  const isCoaching = catLower.includes("coaching") || catLower.includes("training") || catLower.includes("advance") || catLower.includes("batch");

  let times = [];
  if (isCoaching && tenantSettings.coaching_schedule) {
    const schedule = tenantSettings.coaching_schedule.find(c => c.category.toLowerCase().replace(/\s+/g, '_') === catLower);
    if (schedule && schedule.timing_slots) {
      schedule.timing_slots.forEach(t => {
        const parts = t.split("-");
        if (parts.length === 2) {
          const st = parts[0].trim();
          const en = parts[1].trim();
          if (!times.includes(st)) times.push(st);
          if (!times.includes(en)) times.push(en);
        }
      });
    }
  } else {
    const op = tenantSettings.operating_hours || { start: "05:00", end: "23:00" };
    const parseTime = (t) => { const p = t.split(":"); return parseInt(p[0]) * 60 + parseInt(p[1]); };
    const startMins = parseTime(op.start);
    const endMins = parseTime(op.end);
    for (let m = startMins; m <= endMins; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      times.push(`${hh}:${mm}`);
    }
  }

  if (times.length === 0) {
    for (let h = 5; h <= 23; h++) {
      times.push(`${String(h).padStart(2, '0')}:00`);
      times.push(`${String(h).padStart(2, '0')}:30`);
    }
  }

  times.sort();
  times.forEach(t => {
    startSel.innerHTML += `<option value="${t}">${t}</option>`;
    endSel.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

// ── Calendar ────────────────────────────────────────────────
async function renderCalendar() {
  document.getElementById("month-year").textContent = `${monthNames[currentMonth]} ${currentYear}`;
  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
  try {
    const q = query(collection(db, "bookings"), where("date", ">=", startStr), where("date", "<=", endStr), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    currentMonthBookings = [];
    snap.forEach(docSnap => { currentMonthBookings.push({ id: docSnap.id, ...docSnap.data() }); });
  } catch (e) { currentMonthBookings = []; }

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    grid.appendChild(empty);
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day";
    dayDiv.textContent = dayNum;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    dayDiv.dataset.date = dateStr;
    if (currentMonthBookings.some(b => b.date === dateStr)) {
      const dot = document.createElement("span");
      dot.className = "calendar-day-dot";
      dayDiv.appendChild(dot);
    }
    if (dateStr === formatSelectedDate(selectedDate)) dayDiv.classList.add("selected");
    dayDiv.addEventListener("click", () => {
      selectedDate = new Date(currentYear, currentMonth, dayNum);
      document.querySelectorAll(".calendar-day").forEach(d => d.classList.remove("selected"));
      dayDiv.classList.add("selected");
      document.getElementById("selected-date-display").textContent = formatSelectedDate(selectedDate);
      updateSelectedDayBookingsView();
    });
    grid.appendChild(dayDiv);
  }

  document.getElementById("selected-date-display").textContent = formatSelectedDate(selectedDate);
  updateSelectedDayBookingsView();
  await updateStats();
}

function updateSelectedDayBookingsView() {
  const dateStr = formatSelectedDate(selectedDate);
  const dayBookings = currentMonthBookings.filter(b => b.date === dateStr);
  const container = document.getElementById("availability-grid");
  container.innerHTML = "";
  if (dayBookings.length === 0) {
    container.innerHTML = '<p class="no-bookings-text">No bookings for this date.</p>';
    return;
  }
  dayBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));
  dayBookings.forEach(booking => {
    const card = document.createElement("div");
    card.className = "booking-card";
    const start = booking.start_time.substring(0, 5);
    const end = booking.end_time.substring(0, 5);
    const courtName = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
    let enrolleesCount = booking.enrollees ? booking.enrollees.split(",").filter(n => n.trim()).length : 0;
    const badgeHtml = enrolleesCount > 0 ? `<span class="booking-badge-count">${enrolleesCount} Enrolled</span>` : "";
    const catLabels = { court_rental: "Rental", coaching: "Coaching", personal_training: "PT Session", advance_batch: "Advance Batch" };
    const catColors = { court_rental: "var(--accent)", coaching: "var(--accent4)", personal_training: "var(--accent3)", advance_batch: "var(--accent2)" };
    const catName = catLabels[booking.category || "court_rental"];
    const catColor = catColors[booking.category || "court_rental"];
    const categoryBadgeHtml = `<span style="font-size:0.65rem; background:rgba(255,255,255,0.05); color:${catColor}; border:1px solid ${catColor}40; padding:1px 6px; border-radius:4px; font-weight:600; text-transform:uppercase;">${catName}</span>`;
    card.innerHTML = `
      <div class="booking-card-left">
        <div class="booking-time">${start} - ${end}</div>
        <div class="booking-court">${courtName}</div>
      </div>
      <div class="booking-card-right">
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.3rem;">
          <div class="booking-user">${escapeHTML(booking.customer_name)}</div>
          <div style="display:flex; gap:0.4rem; align-items:center;">${categoryBadgeHtml}${badgeHtml}</div>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openBookingDetailsModal(booking));
    container.appendChild(card);
  });
}

// ── Stats ───────────────────────────────────────────────────
async function updateStats() {
  try {
    document.getElementById("statBookingsCount").textContent = currentMonthBookings.length;
    document.getElementById("statCourtsCount").textContent = courtsList.length;
    await loadMembers();
    calculateMonthlyRevenue();
  } catch (e) { console.error("Stats fetch failed:", e); }
}

// ── Revenue ─────────────────────────────────────────────────
function calculateMonthlyRevenue() {
  let hourlySlotRate = 300, peakRate = 200, nonPeakRate = 150;
  if (tenantSettings && tenantSettings.hourly_slots) {
    const defaultHourly = tenantSettings.hourly_slots.find(s => s.type === "Guest")?.rate;
    if (defaultHourly) hourlySlotRate = defaultHourly;
    const peak = tenantSettings.hourly_slots.find(s => s.type === "Guest Peak")?.rate;
    if (peak) peakRate = peak;
    const nonPeak = tenantSettings.hourly_slots.find(s => s.type === "Guest Non-Peak")?.rate;
    if (nonPeak) nonPeakRate = nonPeak;
  }

  let totalMembersRevenue = 0, totalCoachingRevenue = 0, totalPTRevenue = 0, totalGuestRevenue = 0;
  let membersCount = 0, coachingCount = 0, ptHours = 0, guestHours = 0;

  // Build a lookup map of all keys -> cost
  const rateMap = {};
  if (tenantSettings) {
    (tenantSettings.membership_programs || []).forEach(p => rateMap[p.key] = p.fee_per_month);
    (tenantSettings.fee_structure || []).forEach(prog => {
      (prog.pricing_variants || []).forEach(v => rateMap[v.key] = v.cost);
    });
  }

  membersList.forEach(member => {
    if (member.status !== "active") return;
    const planKey = member.type;
    if (planKey && rateMap[planKey] !== undefined) {
      const rate = rateMap[planKey];
      if (planKey.startsWith("Individual_") || planKey.startsWith("Group_")) { totalMembersRevenue += rate; membersCount++; }
      else if (planKey === "PT_session") { totalPTRevenue += rate; ptHours++; }
      else { totalCoachingRevenue += rate; coachingCount++; }
    }
  });

  currentMonthBookings.forEach(booking => {
    const category = booking.category || "Court Rental";
    const startHour = parseInt(booking.start_time.substring(0, 2));
    const endHour = parseInt(booking.end_time.substring(0, 2));
    const hours = endHour - startHour;
    if (hours <= 0) return;
    if (category.toLowerCase().includes("rental") || category === "court_rental") {
      guestHours += hours;
      const bookingMembers = membersList.filter(m => m.bookingId === booking.id && m.status === "active");
      if (bookingMembers.length === 0) { totalGuestRevenue += hours * hourlySlotRate; }
      else {
        const isPeak = (startHour >= 5 && startHour < 9) || (startHour >= 16 && startHour < 21);
        totalGuestRevenue += isPeak ? hours * bookingMembers.length * peakRate : hours * bookingMembers.length * nonPeakRate;
      }
    }
  });

  const totalRevenue = totalMembersRevenue + totalCoachingRevenue + totalPTRevenue + totalGuestRevenue;
  document.getElementById("revenueMonthName").textContent = `${monthNames[currentMonth]} ${currentYear}`;
  document.getElementById("revMembersVal").textContent = `₹${totalMembersRevenue.toLocaleString()}`;
  document.getElementById("revMembersCount").textContent = `${membersCount} active memberships`;
  document.getElementById("revCoachingVal").textContent = `₹${totalCoachingRevenue.toLocaleString()}`;
  document.getElementById("revCoachingCount").textContent = `${coachingCount} unique trainees`;
  document.getElementById("revPTVal").textContent = `₹${totalPTRevenue.toLocaleString()}`;
  document.getElementById("revPTHrs").textContent = `${ptHours} hours scheduled`;
  document.getElementById("revGuestVal").textContent = `₹${totalGuestRevenue.toLocaleString()}`;
  document.getElementById("revGuestHrs").textContent = `${guestHours} hours booked`;
  document.getElementById("revTotalVal").textContent = `₹${totalRevenue.toLocaleString()}`;
}

// ── Modal Controllers ───────────────────────────────────────
function openModal(title) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("bookingModal").classList.remove("hidden");
  document.getElementById("modalMessage").classList.add("hidden");
  document.getElementById("modalDetailsView").classList.add("hidden");
  document.getElementById("modalEditFormView").classList.add("hidden");
  document.getElementById("modalBookingFormView").classList.add("hidden");
}

function closeModal() {
  document.getElementById("bookingModal").classList.add("hidden");
  selectedBooking = null;
}

async function openBookingDetailsModal(booking) {
  selectedBooking = booking;
  openModal("Booking Details");
  document.getElementById("modalDetailsView").classList.remove("hidden");
  document.getElementById("detCourt").textContent = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
  document.getElementById("detTime").textContent = `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} on ${booking.date}`;
  document.getElementById("detName").textContent = booking.customer_name;
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  if (joinDateInput) { const today = new Date(); joinDateInput.value = formatSelectedDate(today); }

  // Hide enrollment controls for guests
  const enrollBlock = document.querySelector(".enroll-block");
  if (enrollBlock) {
    enrollBlock.classList.toggle("hidden", currentUser && currentUser.isAnonymous);
  }

  const ownerActions = document.getElementById("ownerActions");
  const isOwner = currentUser && booking.userId === currentUser.uid;
  const contactInfo = booking.customer_phone || booking.customer_email || "N/A";
  if (isOwner) { document.getElementById("detPhone").textContent = contactInfo; ownerActions.classList.remove("hidden"); }
  else { document.getElementById("detPhone").textContent = maskPhone(contactInfo); ownerActions.classList.add("hidden"); }
  await renderModalEnrolleesList(booking.id);
}

async function renderModalEnrolleesList(bookingId) {
  const ul = document.getElementById("enrollees-list");
  if (!ul) return;
  ul.innerHTML = '<li class="text-muted" style="list-style:none;">Loading members...</li>';
  if (!db) return;
  try {
    const q = query(collection(db, "members"), where("bookingId", "==", bookingId), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    ul.innerHTML = "";
    let activeCount = 0;
    if (!snap.empty) {
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== "active") return;
        activeCount++;
        const member = { id: d.id, ...data };
        const li = document.createElement("li");
        li.className = "enrollee-list-item";
        li.style.marginBottom = "0.5rem";
        const plan = planLabels[member.type] || { name: member.type, color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" };
        const badgeHtml = `<span style="font-size:0.65rem; background:${plan.bg}; color:${plan.color}; border:1px solid ${plan.color}35; padding:1px 8px; border-radius:99px; font-weight:600;">${plan.name}</span>`;
        const infoDiv = document.createElement("div");
        infoDiv.className = "enrollee-list-item-info";
        infoDiv.innerHTML = `<span style="font-weight:600;">👤 ${escapeHTML(member.name)}</span><span class="enrollee-list-item-meta">Joined: <span>${escapeHTML(member.joinDate)}</span> | Paid: <span>${escapeHTML(member.lastPaidDate)}</span></span>`;
        const rightDiv = document.createElement("div");
        rightDiv.style.display = "flex"; rightDiv.style.alignItems = "center"; rightDiv.style.gap = "0.8rem";
        rightDiv.innerHTML = badgeHtml;
        const isGuest = currentUser && currentUser.isAnonymous;
        const removeBtn = document.createElement("button");
        removeBtn.className = "btn-remove-enrollee"; removeBtn.innerHTML = "&times;"; removeBtn.title = `Remove ${member.name}`;
        removeBtn.addEventListener("click", () => handleRemoveEnrollee(member.id, member.name, bookingId));
        if (isGuest) {
          removeBtn.style.display = "none";
        }
        rightDiv.appendChild(removeBtn);
        li.appendChild(infoDiv); li.appendChild(rightDiv);
        ul.appendChild(li);
      });
    }
    if (activeCount === 0) ul.innerHTML = '<li class="text-muted" style="list-style:none;">No enrollees yet</li>';
  } catch (error) {
    ul.innerHTML = `<li style="color: var(--accent2); list-style:none;">Failed to load members: ${error.message}</li>`;
  }
}

async function handleRemoveEnrollee(memberId, memberName, bookingId) {
  if (!currentUser || currentUser.isAnonymous) {
    showMsg("modalMessage", "Permission Denied: Guests cannot remove enrollees.", "error");
    return;
  }
  if (!confirm(`Are you sure you want to remove ${memberName}?`)) return;
  try {
    await deleteDoc(doc(db, "members", memberId));
    showMsg("modalMessage", `Removed ${memberName} successfully!`, "success");
    await renderModalEnrolleesList(bookingId);
    await updateStats();
  } catch (error) { showMsg("modalMessage", "Failed to remove member: " + error.message, "error"); }
}

function openBookingFormModal() {
  openModal("Reserve Court");
  document.getElementById("modalBookingFormView").classList.remove("hidden");
  document.getElementById("bookingForm").reset();

  // Initialize dropdowns based on hierarchy
  populateBookingDropdowns("booking_type", "booking_category");
  document.getElementById("booking_category").innerHTML = '<option value="" disabled selected>Select Category</option>';
  document.getElementById("booking_period").innerHTML = '<option value="" disabled selected>Select Period</option>';

  document.getElementById("start_time").value = "";
  document.getElementById("end_time").value = "";
  if (currentUser && !currentUser.isAnonymous) {
    document.getElementById("customer_name").value = currentUser.displayName || "";
  }
  document.getElementById("customer_phone").value = "+91 ";
}

function showEditBookingForm() {
  if (!selectedBooking) return;
  document.getElementById("modalTitle").textContent = "Edit Reservation";
  document.getElementById("modalDetailsView").classList.add("hidden");
  document.getElementById("modalEditFormView").classList.remove("hidden");
  document.getElementById("editCustomerName").value = selectedBooking.customer_name;
  document.getElementById("editCustomerPhone").value = selectedBooking.customer_phone || selectedBooking.customer_email || "+91 ";
}

// ── Form Submissions ────────────────────────────────────────
async function handleBookingSubmit(event) {
  event.preventDefault();
  const btn = event.target.querySelector("button[type='submit']");
  const type = document.getElementById("booking_type").value;
  const courtId = parseInt(document.getElementById("court_id").value);
  const category = document.getElementById("booking_category").value;
  const period = document.getElementById("booking_period").value;
  const gender = document.getElementById("booking_gender").value;
  const startTime = document.getElementById("start_time").value + ":00";
  const endTime = document.getElementById("end_time").value + ":00";
  const name = document.getElementById("customer_name").value.trim();
  const phone = document.getElementById("customer_phone").value.trim();
  if (name.length > 40) { showMsg("modalMessage", "Name cannot exceed 40 characters.", "error"); return; }
  if (phone.length > 20) { showMsg("modalMessage", "Phone cannot exceed 20 characters.", "error"); return; }
  if (startTime >= endTime) { showMsg("modalMessage", "End time must occur after start time.", "error"); return; }
  btn.disabled = true; btn.textContent = "Processing Reservation...";
  try {
    if (!currentUser) throw new Error("You must be signed in to reserve a court.");

    const isSingleDay = ["Spot booking", "Guest Play", "Personal training"].includes(type);

    if (isSingleDay) {
      const dateStr = formatSelectedDate(selectedDate);
      const conflictError = await checkBookingConflicts(courtId, dateStr, startTime, endTime, category);
      if (conflictError) throw new Error(conflictError);
      const newBookingRef = await addDoc(collection(db, "bookings"), { booking_type: type, court_id: courtId, customer_name: name, customer_phone: phone, category, period, gender, date: dateStr, start_time: startTime, end_time: endTime, enrollees: "", userId: currentUser.uid, academyId: currentUser.academyId, createdAt: serverTimestamp() });

      // Auto-enroll member for Personal Training (which is a single day booking but still a program)
      if (type === "Personal training") {
        const planKey = resolvePlanKey(type, category, period, gender) || (category + " - " + period);
        const todayStr = formatSelectedDate(new Date());
        await addDoc(collection(db, "members"), {
          name: name,
          type: planKey,
          joinDate: todayStr,
          lastPaidDate: todayStr,
          bookingId: newBookingRef.id,
          status: "active",
          createdTime: Date.now(),
          academyId: currentUser.academyId
        });
      }

      showMsg("modalMessage", "Reservation confirmed successfully!", "success");
      setTimeout(() => { closeModal(); renderCalendar(); }, 1200);
    } else {
      const daysMode = (period === "5 Days" || period === "3 Days") ? "weekdays" : (period === "Weekend" ? "weekend" : "all");
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
      const endStr2 = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
      const q2 = query(collection(db, "bookings"), where("date", ">=", startStr), where("date", "<=", endStr2), where("academyId", "==", currentUser.academyId));
      const snap2 = await getDocs(q2);
      const existing = []; snap2.forEach(d => { if (d.data().court_id == courtId) existing.push(d.data()); });
      const batch = writeBatch(db);
      let created = 0, skipped = 0;
      let firstBookingId = null;
      for (let day = 1; day <= lastDay; day++) {
        const curDate = new Date(currentYear, currentMonth, day);
        const dayOfWeek = curDate.getDay();

        if (daysMode === "weekdays" && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
        if (daysMode === "weekend" && (dayOfWeek !== 0 && dayOfWeek !== 6)) continue;

        const curDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let overlaps = 0;
        const catLower = (category || "").toLowerCase();
        const isCoaching = catLower.includes("coaching") || catLower.includes("training") || catLower.includes("advance") || catLower.includes("batch");
        if (!isCoaching) {
          existing.forEach(b => {
            if (curDateStr === b.date && startTime < b.end_time && endTime > b.start_time) overlaps++;
          });
        }
        if (overlaps >= 2) { skipped++; continue; }
        const newBookingRef = doc(collection(db, "bookings"));
        if (!firstBookingId) firstBookingId = newBookingRef.id;

        batch.set(newBookingRef, { booking_type: type, court_id: courtId, customer_name: name, customer_phone: phone, category, period, gender, date: curDateStr, start_time: startTime, end_time: endTime, enrollees: "", userId: currentUser.uid, academyId: currentUser.academyId, createdAt: serverTimestamp() });
        created++;
      }
      if (created > 0) {
        await batch.commit();

        // Auto-enroll member for recurring plans
        if (type !== "Spot booking" && type !== "Guest Play") {
          const planKey = resolvePlanKey(type, category, period, gender) || (category + " - " + period);
          const todayStr = formatSelectedDate(new Date());
          await addDoc(collection(db, "members"), {
            name: name,
            type: planKey,
            joinDate: todayStr,
            lastPaidDate: todayStr,
            bookingId: firstBookingId,
            status: "active",
            createdTime: Date.now(),
            academyId: currentUser.academyId
          });
        }

        showMsg("modalMessage", `Bulk complete. Processed ${created} slots, skipped ${skipped} conflicts.`, "success");
      }
      else showMsg("modalMessage", "All dates conflicted or filtered out.", "error");
      setTimeout(() => { closeModal(); renderCalendar(); }, 2000);
    }
  } catch (error) { showMsg("modalMessage", error.message, "error"); }
  finally { btn.disabled = false; btn.textContent = "Confirm Reservation"; }
}

async function handleEditBookingSubmit(event) {
  event.preventDefault();
  if (!selectedBooking) return;
  const btn = event.target.querySelector("button[type='submit']");
  btn.disabled = true;
  const name = document.getElementById("editCustomerName").value.trim();
  const phone = document.getElementById("editCustomerPhone").value.trim();
  if (name.length > 40) { showMsg("modalMessage", "Name cannot exceed 40 characters.", "error"); return; }
  if (phone.length > 20) { showMsg("modalMessage", "Phone cannot exceed 20 characters.", "error"); return; }
  try {
    if (!(currentUser && selectedBooking.userId === currentUser.uid)) throw new Error("Permission Denied.");
    await updateDoc(doc(db, "bookings", selectedBooking.id), { customer_name: name, customer_phone: phone });
    selectedBooking.customer_name = name; selectedBooking.customer_phone = phone;
    showMsg("modalMessage", "Reservation details saved.", "success");
    setTimeout(() => { openBookingDetailsModal(selectedBooking); renderCalendar(); }, 1200);
  } catch (error) { showMsg("modalMessage", "Failed to update: " + error.message, "error"); }
  finally { btn.disabled = false; }
}

async function handleBookingDelete() {
  if (!selectedBooking) return;
  if (!confirm("Are you sure you want to permanently cancel this court reservation?")) return;
  const btn = document.getElementById("btnDeleteBooking");
  btn.disabled = true; btn.textContent = "Cancelling...";
  try {
    if (!(currentUser && selectedBooking.userId === currentUser.uid)) throw new Error("Permission Denied.");
    await deleteDoc(doc(db, "bookings", selectedBooking.id));
    showMsg("modalMessage", "Reservation cancelled successfully.", "success");
    setTimeout(() => { closeModal(); renderCalendar(); }, 1200);
  } catch (error) { showMsg("modalMessage", "Cancellation failed: " + error.message, "error"); btn.disabled = false; btn.textContent = "Cancel Booking"; }
}

async function handleEnrollmentSubmit() {
  if (!selectedBooking) return;
  if (!currentUser || currentUser.isAnonymous) {
    showMsg("modalMessage", "Permission Denied: Guests cannot enroll trainees.", "error");
    return;
  }
  const ul = document.getElementById("enrollees-list");
  if (ul && ul.querySelectorAll("li.enrollee-list-item").length >= 30) { showMsg("modalMessage", "Maximum limit of 30 trainees reached.", "error"); return; }
  const input = document.getElementById("newEnrolleeInput");
  const typeSelect = document.getElementById("newEnrolleeType");
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  const newName = input.value.trim();
  if (!newName) return;
  if (newName.length > 40) { showMsg("modalMessage", "Trainee name cannot exceed 40 characters.", "error"); return; }
  const submitBtn = document.getElementById("btnEnrollSubmit");
  submitBtn.disabled = true;
  const type = typeSelect.value;
  const joinDate = joinDateInput.value || formatSelectedDate(selectedDate);
  try {
    await addDoc(collection(db, "members"), { name: newName, type, joinDate, lastPaidDate: joinDate, bookingId: selectedBooking.id, status: "active", createdTime: Date.now(), academyId: currentUser.academyId });
    input.value = "";
    showMsg("modalMessage", "Trainee enrolled successfully!", "success");
    await renderModalEnrolleesList(selectedBooking.id);
    await updateStats();
  } catch (error) { showMsg("modalMessage", "Enrollment failed: " + error.message, "error"); }
  finally { submitBtn.disabled = false; }
}

// ── Pricing ─────────────────────────────────────────────────
async function handleSetupSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("btnCompleteSetup");
  btn.disabled = true; btn.textContent = "Setting up Academy...";

  const name = document.getElementById("setupAcademyName").value.trim();
  const contact = document.getElementById("setupContact").value.trim();
  const courtsStr = document.getElementById("setupCourts").value.trim();
  const courts = parseInt(courtsStr, 10);

  if (!name || !contact || !courtsStr || isNaN(courts) || courts <= 0) {
    showMsg("setupMessage", "All fields are mandatory. Please provide a valid Academy Name, Contact Number, and Court Count.", "error");
    btn.disabled = false; btn.textContent = "Complete Setup & Launch Dashboard";
    return;
  }

  const settingsPayload = {
    ...defaultSettings,
    academy_name: name,
    contact_numbers: [contact],
    court_count: courts
  };

  try {
    if (!db || !currentUser?.academyId) throw new Error("Database connection not active or missing academy ID.");

    // Save Academy Settings
    await setDoc(doc(db, "academies", currentUser.academyId), settingsPayload);

    // Seed Courts dynamically
    const batch = writeBatch(db);
    for (let i = 1; i <= courts; i++) {
      batch.set(doc(collection(db, "courts")), { id: i, name: `Court ${i}`, academyId: currentUser.academyId });
    }
    await batch.commit();

    document.getElementById("firstTimeSetupModal").classList.add("hidden");
    window.location.reload();
  } catch (error) {
    showMsg("setupMessage", "Failed to setup academy: " + error.message, "error");
    btn.disabled = false; btn.textContent = "Complete Setup & Launch Dashboard";
  }
}

// ── Init ────────────────────────────────────────────────────
function bootstrap() {
  setupDashboardListeners();
  initApp();
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
