// app.js — Modular Frontend Client Logic for Badminton Booking
// Powered by Firebase Web SDK (v10) & styled with FinResolver aesthetics

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── Application State ───────────────────────────────────────
let db = null;
let auth = null;
let currentUser = null;

let courtsList = [];
let courtsMap = {};
let currentMonthBookings = [];
let dailyBookings = [];

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11
let selectedDate = new Date();
let selectedBooking = null;

const monthNames = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname === "";

// ── Initialization & Config Validation ─────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  
  const isConfigured = window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
  if (!isConfigured) {
    const banner = document.getElementById("setupBanner");
    if (banner) banner.classList.remove("hidden");
    const btnGoogle = document.getElementById("btnGoogleLogin");
    if (btnGoogle) btnGoogle.disabled = true;
    const btnGuest = document.getElementById("btnGuestLogin");
    if (btnGuest) btnGuest.disabled = true;
    console.warn("Firebase config is missing or unconfigured. Populate config.js to begin.");
    return;
  }
  
  // Initialize Firebase
  const app = initializeApp(window.FIREBASE_CONFIG);
  db = getFirestore(app);
  auth = getAuth(app);
  
  // Listen for Authentication changes
  onAuthStateChanged(auth, handleAuthStateChange);
  
  // Setup Event Listeners
  setupEventListeners();
});

// ── Theme Management ───────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark";
  const btn = document.getElementById("themeToggle");
  
  if (savedTheme === "light") {
    document.documentElement.classList.add("light-theme");
    if (btn) btn.textContent = "🌙";
  } else {
    document.documentElement.classList.remove("light-theme");
    if (btn) btn.textContent = "☀️";
  }
  
  if (btn) {
    btn.addEventListener("click", () => {
      if (document.documentElement.classList.contains("light-theme")) {
        document.documentElement.classList.remove("light-theme");
        localStorage.setItem("theme", "dark");
        btn.textContent = "☀️";
      } else {
        document.documentElement.classList.add("light-theme");
        localStorage.setItem("theme", "light");
        btn.textContent = "🌙";
      }
    });
  }
}

// ── Screen Manager ─────────────────────────────────────────
function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  // Show target screen
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
  
  // Highlight active nav link
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  if (screenId === "homeScreen") {
    document.getElementById("navHome").classList.add("active");
  } else if (screenId === "dailyScreen") {
    document.getElementById("navDaily").classList.add("active");
  }
}

// ── Auth Handling ──────────────────────────────────────────
async function handleAuthStateChange(user) {
  if (user) {
    currentUser = user;
    if (isLoginPage) {
      window.location.href = "dashboard.html";
      return;
    }
    
    // Update profile UI
    const header = document.getElementById("appHeader");
    const avatar = document.getElementById("userAvatar");
    const nameEl = document.getElementById("userName");
    const menuEmail = document.getElementById("userMenuEmail");
    
    if (nameEl) nameEl.textContent = user.displayName || (user.isAnonymous ? "Guest Player" : "Member");
    if (menuEmail) menuEmail.textContent = user.email || "Anonymous Guest Account";
    
    if (avatar) {
      if (user.photoURL) {
        avatar.innerHTML = `<img src="${user.photoURL}" alt="avatar">`;
      } else {
        avatar.innerHTML = user.isAnonymous ? "👤" : (user.email ? user.email.charAt(0).toUpperCase() : "?");
      }
    }
    
    // Show Header
    if (header) header.classList.remove("hidden");
    
    // Auto-fill forms with user email & name if available
    const nameInput = document.getElementById("customer_name");
    const emailInput = document.getElementById("customer_email");
    if (!user.isAnonymous) {
      if (nameInput) nameInput.value = user.displayName || "";
      if (emailInput) emailInput.value = user.email || "";
    }
    
    // Load database content
    await loadCourts();
    await loadPricingRates();
    await updateStats();
    
    // Go to default screen
    showScreen("homeScreen");
    initCalendar();
    renderCalendar();
    
  } else {
    currentUser = null;
    if (!isLoginPage) {
      window.location.href = "index.html";
      return;
    }
    const header = document.getElementById("appHeader");
    if (header) header.classList.add("hidden");
    showScreen("loginScreen");
  }
}

// ── Event Listeners Binding ────────────────────────────────
function setupEventListeners() {
  const addClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };
  const addSubmit = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("submit", fn);
  };

  // Sign In Trigger Buttons
  addClick("btnGoogleLogin", loginWithGoogle);
  addClick("btnGuestLogin", loginAsGuest);
  
  // Sign Out Dropdown Toggles
  addClick("userPill", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("userMenu");
    if (menu) menu.classList.toggle("active");
  });
  
  document.addEventListener("click", () => {
    const menu = document.getElementById("userMenu");
    if (menu) menu.classList.remove("active");
  });
  
  addClick("btnSignOut", () => signOut(auth));
  
  // Navigation
  addClick("logoBtn", () => showScreen("homeScreen"));
  addClick("navHome", (e) => { e.preventDefault(); showScreen("homeScreen"); });
  addClick("navDaily", (e) => { e.preventDefault(); showScreen("dailyScreen"); loadDailyGrid(); });
  
  // Mobile menu hamburger
  addClick("hamburgerBtn", (e) => {
    e.stopPropagation();
    const nav = document.getElementById("desktopNav");
    if (nav) nav.classList.toggle("active");
  });
  
  // Dashboard Calendar Controls
  addClick("prev-month", () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  addClick("next-month", () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
  
  // Open Booking form Modal (Dashboard Button)
  addClick("btnOpenNewBooking", openBookingFormModal);
  addClick("quickDailyGridBtn", () => { showScreen("dailyScreen"); loadDailyGrid(); });
  
  // Modal Close
  addClick("modalClose", closeModal);
  const modal = document.getElementById("bookingModal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  
  // Form submissions
  addSubmit("bookingForm", handleBookingSubmit);
  addSubmit("quickBookingForm", handleQuickBookingSubmit);
  addSubmit("editBookingForm", handleEditBookingSubmit);
  addSubmit("pricingForm", handlePricingSubmit);
  
  // Member/Player Enrollment Submit
  addClick("btnEnrollSubmit", handleEnrollmentSubmit);
  
  // Edit & Delete booking actions
  addClick("btnEditBooking", showEditBookingForm);
  addClick("btnCancelEdit", showBookingDetailsView);
  addClick("btnDeleteBooking", handleBookingDelete);
  
  // Daily Matrix Date Controls
  const dailyDateInput = document.getElementById("daily-date-input");
  if (dailyDateInput) {
    dailyDateInput.value = formatSelectedDate(selectedDate);
    dailyDateInput.addEventListener("change", (e) => {
      selectedDate = new Date(e.target.value);
      loadDailyGrid();
    });
  }
  addClick("prev-day", () => changeDailyDay(-1));
  addClick("next-day", () => changeDailyDay(1));
}

// ── Google & Guest Logins ──────────────────────────────────
async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    document.getElementById("loginError").classList.add("hidden");
    await signInWithPopup(auth, provider);
  } catch (error) {
    showMsg("loginError", "Google authentication failed: " + error.message, "error");
  }
}

async function loginAsGuest() {
  try {
    document.getElementById("loginError").classList.add("hidden");
    await signInAnonymously(auth);
  } catch (error) {
    showMsg("loginError", "Guest Sign-in failed: " + error.message, "error");
  }
}

// ── Database Seeding & Setup ────────────────────────────────
async function seedCourtsIfEmpty() {
  try {
    const snap = await getDocs(collection(db, "courts"));
    if (snap.empty) {
      console.log("Database initialized. Seeding Court 1, Court 2, Court 3...");
      const batch = writeBatch(db);
      
      const c1 = doc(collection(db, "courts"), "court_1");
      const c2 = doc(collection(db, "courts"), "court_2");
      const c3 = doc(collection(db, "courts"), "court_3");
      
      batch.set(c1, { id: 1, name: "Court 1" });
      batch.set(c2, { id: 2, name: "Court 2" });
      batch.set(c3, { id: 3, name: "Court 3" });
      
      await batch.commit();
      console.log("Seeding courts completed.");
    }
  } catch (error) {
    console.error("Court seeding check failed:", error);
  }
}

async function loadCourts() {
  await seedCourtsIfEmpty();
  const snap = await getDocs(collection(db, "courts"));
  courtsList = [];
  courtsMap = {};
  snap.forEach(d => {
    const court = d.data();
    courtsList.push(court);
    courtsMap[court.id] = court.name;
  });
  
  // Sort courts by ID numerically
  courtsList.sort((a, b) => a.id - b.id);
  
  // Fill booking court selector
  const select = document.getElementById("court_id");
  select.innerHTML = '<option value="" disabled selected>Select Court</option>';
  courtsList.forEach(court => {
    const opt = document.createElement("option");
    opt.value = court.id;
    opt.textContent = court.name;
    select.appendChild(opt);
  });
  
  // Daily matrix skeleton build
  buildMatrixHeaders();
}

// ── Dashboard Statistics ───────────────────────────────────
async function updateStats() {
  try {
    const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
    
    const q = query(
      collection(db, "bookings"),
      where("date", ">=", startStr),
      where("date", "<=", endStr)
    );
    const snap = await getDocs(q);
    document.getElementById("statBookingsCount").textContent = snap.size;
    document.getElementById("statCourtsCount").textContent = courtsList.length;
  } catch (e) {
    console.error("Stats fetch failed:", e);
  }
}

// ── Interactive Calendar Renderer ──────────────────────────
async function renderCalendar() {
  document.getElementById("month-year").textContent = `${monthNames[currentMonth]} ${currentYear}`;
  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";
  
  // Fetch bookings for the month
  const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
  const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
  
  try {
    const q = query(
      collection(db, "bookings"),
      where("date", ">=", startStr),
      where("date", "<=", endStr)
    );
    const snap = await getDocs(q);
    currentMonthBookings = [];
    snap.forEach(docSnap => {
      currentMonthBookings.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (e) {
    currentMonthBookings = [];
    console.error("Month bookings fetch failed:", e);
  }
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Inject empty squares for start offsets
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    grid.appendChild(empty);
  }
  
  // Inject calendar day nodes
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day";
    dayDiv.textContent = dayNum;
    
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    dayDiv.dataset.date = dateStr;
    
    // Check if bookings exist on date
    const hasBookings = currentMonthBookings.some(b => b.date === dateStr);
    if (hasBookings) {
      const dot = document.createElement("span");
      dot.className = "calendar-day-dot";
      dayDiv.appendChild(dot);
    }
    
    if (dateStr === formatSelectedDate(selectedDate)) {
      dayDiv.classList.add("selected");
    }
    
    dayDiv.addEventListener("click", () => {
      selectedDate = new Date(currentYear, currentMonth, dayNum);
      document.querySelectorAll(".calendar-day").forEach(d => d.classList.remove("selected"));
      dayDiv.classList.add("selected");
      
      // Update selected date outputs
      document.getElementById("selected-date-display").textContent = formatSelectedDate(selectedDate);
      document.getElementById("daily-date-input").value = formatSelectedDate(selectedDate);
      
      updateSelectedDayBookingsView();
    });
    
    grid.appendChild(dayDiv);
  }
  
  // Refresh stats & bookings list view
  document.getElementById("selected-date-display").textContent = formatSelectedDate(selectedDate);
  updateSelectedDayBookingsView();
  updateStats();
  calculateMonthlyRevenue();
}

function formatSelectedDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  
  // Sort bookings by start time
  dayBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));
  
  dayBookings.forEach(booking => {
    const card = document.createElement("div");
    card.className = "booking-card";
    
    const start = booking.start_time.substring(0, 5);
    const end = booking.end_time.substring(0, 5);
    const courtName = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
    
    let enrolleesCount = 0;
    if (booking.enrollees) {
      enrolleesCount = booking.enrollees.split(",").filter(n => n.trim()).length;
    }
    const badgeHtml = enrolleesCount > 0 
      ? `<span class="booking-badge-count">${enrolleesCount} Enrolled</span>` 
      : "";
      
    card.innerHTML = `
      <div class="booking-card-left">
        <div class="booking-time">${start} - ${end}</div>
        <div class="booking-court">${courtName}</div>
      </div>
      <div class="booking-card-right">
        <div class="booking-user">${booking.customer_name}</div>
        ${badgeHtml}
      </div>
    `;
    
    card.addEventListener("click", () => openBookingDetailsModal(booking));
    container.appendChild(card);
  });
}

// ── Daily Grid Matrix Timeline ──────────────────────────────
function changeDailyDay(delta) {
  selectedDate.setDate(selectedDate.getDate() + delta);
  document.getElementById("daily-date-input").value = formatSelectedDate(selectedDate);
  loadDailyGrid();
}

function buildMatrixHeaders() {
  const row = document.getElementById("matrix-header-row");
  // Clean other columns except time
  row.innerHTML = "<th>Time</th>";
  courtsList.forEach(court => {
    const th = document.createElement("th");
    th.textContent = court.name;
    row.appendChild(th);
  });
}

async function loadDailyGrid() {
  const dateStr = formatSelectedDate(selectedDate);
  
  // Clear cell contents and classes
  document.querySelectorAll(".matrix-cell").forEach(cell => {
    cell.className = "matrix-cell";
    cell.innerHTML = '<span class="matrix-cell-empty-text">Click to Book</span>';
    delete cell.dataset.bookingId;
  });
  
  try {
    const q = query(collection(db, "bookings"), where("date", "==", dateStr));
    const snap = await getDocs(q);
    dailyBookings = [];
    snap.forEach(d => {
      dailyBookings.push({ id: d.id, ...d.data() });
    });
  } catch (error) {
    dailyBookings = [];
    console.error("Failed daily bookings load:", error);
  }
  
  // Re-build timeline matrix rows if first load
  const tbody = document.getElementById("matrix-body");
  if (tbody.children.length === 0) {
    // Hours 06:00 to 22:00
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
  
  // Fill bookings into matrix cells
  dailyBookings.forEach(booking => {
    const start = booking.start_time.substring(0, 5);
    const cell = document.querySelector(
      `.matrix-cell[data-court-id="${booking.court_id}"][data-start="${start}"]`
    );
    if (cell) {
      cell.classList.add("booked");
      cell.dataset.bookingId = booking.id;
      
      let enrolleesCount = 0;
      if (booking.enrollees) {
        enrolleesCount = booking.enrollees.split(",").filter(n => n.trim()).length;
      }
      
      const enrolleesBadge = enrolleesCount > 0 
        ? `<div class="matrix-cell-enrollees">${enrolleesCount} Enrolled</div>` 
        : "";
        
      cell.innerHTML = `
        <span class="matrix-cell-booked-by">${booking.customer_name}</span>
        ${enrolleesBadge}
      `;
    }
  });
}

function handleMatrixCellClick(courtId, start, end) {
  const cell = document.querySelector(
    `.matrix-cell[data-court-id="${courtId}"][data-start="${start}"]`
  );
  if (cell && cell.classList.contains("booked")) {
    const bId = cell.dataset.bookingId;
    const booking = dailyBookings.find(b => b.id === bId);
    if (booking) openBookingDetailsModal(booking);
  } else {
    openQuickBookingModal(courtId, start, end);
  }
}

// ── Unified Modal Controllers ────────────────────────────────
function openModal(title) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("bookingModal").classList.remove("hidden");
  document.getElementById("modalMessage").classList.add("hidden");
  
  // Hide all sections initially
  document.getElementById("modalDetailsView").classList.add("hidden");
  document.getElementById("modalEditFormView").classList.add("hidden");
  document.getElementById("modalBookingFormView").classList.add("hidden");
  document.getElementById("modalQuickFormView").classList.add("hidden");
}

function closeModal() {
  document.getElementById("bookingModal").classList.add("hidden");
  selectedBooking = null;
}

function maskEmail(email) {
  if (!email) return "N/A";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return `${name.charAt(0)}*@${domain}`;
  return `${name.substring(0, 2)}***@${domain}`;
}

// Modal View 1: Show Booking details and player join enrollment lists
function openBookingDetailsModal(booking) {
  selectedBooking = booking;
  openModal("Booking Details");
  
  document.getElementById("modalDetailsView").classList.remove("hidden");
  
  document.getElementById("detCourt").textContent = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
  document.getElementById("detTime").textContent = `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} on ${booking.date}`;
  document.getElementById("detName").textContent = booking.customer_name;
  
  // Enforce Permissions (Owner can edit/delete)
  const ownerActions = document.getElementById("ownerActions");
  const isOwner = currentUser && booking.userId === currentUser.uid;
  
  if (isOwner) {
    document.getElementById("detEmail").textContent = booking.customer_email;
    ownerActions.classList.remove("hidden");
  } else {
    document.getElementById("detEmail").textContent = maskEmail(booking.customer_email);
    ownerActions.classList.add("hidden");
  }
  
  renderModalEnrolleesList(booking.enrollees);
}

function renderModalEnrolleesList(enrolleesStr) {
  const ul = document.getElementById("enrollees-list");
  ul.innerHTML = "";
  if (enrolleesStr) {
    enrolleesStr.split(",").forEach(name => {
      const trimmed = name.trim();
      if (trimmed) {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.marginBottom = "0.2rem";
        
        let displayName = trimmed;
        let badgeHtml = `<span style="font-size:0.65rem; background:rgba(41, 182, 246, 0.12); color:var(--accent4); border:1px solid rgba(41, 182, 246, 0.2); padding:1px 6px; border-radius:99px; font-weight:600;">Member</span>`;
        
        if (trimmed.endsWith("(Kid)")) {
          displayName = trimmed.replace(" (Kid)", "");
          badgeHtml = `<span style="font-size:0.65rem; background:rgba(179, 157, 219, 0.12); color:var(--purple); border:1px solid rgba(179, 157, 219, 0.2); padding:1px 6px; border-radius:99px; font-weight:600;">Kid Training</span>`;
        } else if (trimmed.endsWith("(Member)")) {
          displayName = trimmed.replace(" (Member)", "");
        }
        
        li.innerHTML = `
          <span>👤 ${displayName}</span>
          ${badgeHtml}
        `;
        ul.appendChild(li);
      }
    });
  } else {
    ul.innerHTML = '<li class="text-muted" style="list-style:none;">No enrollees yet</li>';
  }
}

// Modal View 2: Edit Form
function showEditBookingForm() {
  if (!selectedBooking) return;
  document.getElementById("modalTitle").textContent = "Edit Reservation";
  
  document.getElementById("modalDetailsView").classList.add("hidden");
  document.getElementById("modalEditFormView").classList.remove("hidden");
  
  document.getElementById("editCustomerName").value = selectedBooking.customer_name;
  document.getElementById("editCustomerEmail").value = selectedBooking.customer_email;
}

function showBookingDetailsView() {
  if (!selectedBooking) return;
  openBookingDetailsModal(selectedBooking);
}

// Modal View 3: Full booking reservation form
function openBookingFormModal() {
  openModal("Reserve Court");
  document.getElementById("modalBookingFormView").classList.remove("hidden");
  
  // Reset form
  document.getElementById("bookingForm").reset();
  
  // Set default start/end times empty
  document.getElementById("start_time").value = "";
  document.getElementById("end_time").value = "";
  
  // Prefill organizer if logged in as non-guest
  if (currentUser && !currentUser.isAnonymous) {
    document.getElementById("customer_name").value = currentUser.displayName || "";
    document.getElementById("customer_email").value = currentUser.email || "";
  }
}

// Modal View 4: Quick book slot from matrix
function openQuickBookingModal(courtId, start, end) {
  openModal("Quick Reservation");
  document.getElementById("modalQuickFormView").classList.remove("hidden");
  
  document.getElementById("quickCourtId").value = courtId;
  document.getElementById("quickStartTime").value = start;
  document.getElementById("quickEndTime").value = end;
  
  const dateStr = formatSelectedDate(selectedDate);
  document.getElementById("quickSlotDesc").textContent = `${courtsMap[courtId] || `Court ${courtId}`} on ${dateStr} (${start} - ${end})`;
  
  // Reset form
  document.getElementById("quickBookingForm").reset();
  
  // Prefill organizer
  if (currentUser && !currentUser.isAnonymous) {
    document.getElementById("quickCustomerName").value = currentUser.displayName || "";
    document.getElementById("quickCustomerEmail").value = currentUser.email || "";
  }
}

// ── Overlap Conflicts Calculation ──────────────────────────
async function checkBookingConflicts(courtId, dateStr, startTime, endTime, skipBookingId = null) {
  try {
    const q = query(
      collection(db, "bookings"),
      where("court_id", "==", courtId),
      where("date", "==", dateStr)
    );
    const snap = await getDocs(q);
    let conflict = false;
    snap.forEach(d => {
      if (skipBookingId && d.id === skipBookingId) return;
      const b = d.data();
      // overlap checks: start1 < end2 && end1 > start2
      if (startTime < b.end_time && endTime > b.start_time) {
        conflict = true;
      }
    });
    return conflict;
  } catch (err) {
    console.error("Conflict checking query error:", err);
    return true; // fail-safe: blocks booking on firestore failure
  }
}

// ── Form Submissions ───────────────────────────────────────

// 1. Full Booking Submit (Handles Single Booking & Bulk Month Booking)
async function handleBookingSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector("button[type='submit']");
  
  const type = document.getElementById("booking_type").value;
  const courtId = parseInt(document.getElementById("court_id").value);
  const startTime = document.getElementById("start_time").value + ":00";
  const endTime = document.getElementById("end_time").value + ":00";
  const name = document.getElementById("customer_name").value.trim();
  const email = document.getElementById("customer_email").value.trim();
  
  if (startTime >= endTime) {
    showMsg("modalMessage", "End time must occur after start time.", "error");
    return;
  }
  
  btn.disabled = true;
  btn.textContent = "Processing Reservation...";
  
  try {
    if (!currentUser) {
      throw new Error("You must be signed in to reserve a court.");
    }
    
    if (type === "single") {
      const dateStr = formatSelectedDate(selectedDate);
      const conflict = await checkBookingConflicts(courtId, dateStr, startTime, endTime);
      if (conflict) {
        throw new Error("This court is already reserved for the selected time range.");
      }
      
      const payload = {
        court_id: courtId,
        customer_name: name,
        customer_email: email,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        enrollees: "",
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "bookings"), payload);
      showMsg("modalMessage", "Reservation confirmed successfully!", "success");
      
      setTimeout(() => {
        closeModal();
        renderCalendar();
        loadDailyGrid();
      }, 1200);
      
    } else {
      // Bulk Month Booking (Current calendar month)
      const daysMode = type === "month_weekdays" ? "weekdays" : "all";
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      // Query month bookings for this court
      const startStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
      const endStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31`;
      const q = query(
        collection(db, "bookings"),
        where("court_id", "==", courtId),
        where("date", ">=", startStr),
        where("date", "<=", endStr)
      );
      
      const snap = await getDocs(q);
      const existing = [];
      snap.forEach(d => existing.push(d.data()));
      
      const batch = writeBatch(db);
      let created = 0;
      let skipped = 0;
      
      for (let day = 1; day <= lastDay; day++) {
        const curDate = new Date(currentYear, currentMonth, day);
        const dayOfWeek = curDate.getDay(); // 0: Sun, 6: Sat
        
        if (daysMode === "weekdays" && (dayOfWeek === 0 || dayOfWeek === 6)) {
          continue; // Skip weekends
        }
        
        const curDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        
        // In-memory conflict check
        const conflict = existing.some(b => {
          return curDateStr === b.date && startTime < b.end_time && endTime > b.start_time;
        });
        
        if (conflict) {
          skipped++;
          continue;
        }
        
        const newRef = doc(collection(db, "bookings"));
        batch.set(newRef, {
          court_id: courtId,
          customer_name: name,
          customer_email: email,
          date: curDateStr,
          start_time: startTime,
          end_time: endTime,
          enrollees: "",
          userId: currentUser.uid,
          createdAt: serverTimestamp()
        });
        created++;
      }
      
      if (created > 0) {
        await batch.commit();
        showMsg("modalMessage", `Bulk complete. Processed ${created} slots, skipped ${skipped} conflicts.`, "success");
      } else {
        showMsg("modalMessage", `All dates conflicted or filtered out. No bookings created.`, "error");
      }
      
      setTimeout(() => {
        closeModal();
        renderCalendar();
        loadDailyGrid();
      }, 2000);
    }
  } catch (error) {
    showMsg("modalMessage", error.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Reservation";
  }
}

// 2. Quick Book Timeline Matrix Submit
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
  
  try {
    if (!currentUser) {
      throw new Error("You must be signed in to reserve a court.");
    }
    
    const conflict = await checkBookingConflicts(courtId, dateStr, startTime, endTime);
    if (conflict) {
      throw new Error("This court slot is already booked.");
    }
    
    const payload = {
      court_id: courtId,
      customer_name: name,
      customer_email: email,
      date: dateStr,
      start_time: startTime,
      end_time: endTime,
      enrollees: "",
      userId: currentUser.uid,
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, "bookings"), payload);
    showMsg("modalMessage", "Quick reservation confirmed!", "success");
    
    setTimeout(() => {
      closeModal();
      renderCalendar();
      loadDailyGrid();
    }, 1200);
    
  } catch (error) {
    showMsg("modalMessage", error.message, "error");
  } finally {
    btn.disabled = false;
  }
}

// 3. Edit Booking Submit (Organizer Details change)
async function handleEditBookingSubmit(event) {
  event.preventDefault();
  if (!selectedBooking) return;
  const btn = event.target.querySelector("button[type='submit']");
  btn.disabled = true;
  
  const name = document.getElementById("editCustomerName").value.trim();
  const email = document.getElementById("editCustomerEmail").value.trim();
  
  try {
    const isOwner = currentUser && selectedBooking.userId === currentUser.uid;
    if (!isOwner) {
      throw new Error("Permission Denied: You cannot modify another player's booking.");
    }
    
    const docRef = doc(db, "bookings", selectedBooking.id);
    await updateDoc(docRef, {
      customer_name: name,
      customer_email: email
    });
    
    // Update local cache object
    selectedBooking.customer_name = name;
    selectedBooking.customer_email = email;
    
    showMsg("modalMessage", "Reservation details saved.", "success");
    
    setTimeout(() => {
      openBookingDetailsModal(selectedBooking);
      renderCalendar();
      loadDailyGrid();
    }, 1200);
    
  } catch (error) {
    showMsg("modalMessage", "Failed to update: " + error.message, "error");
  } finally {
    btn.disabled = false;
  }
}

// ── Enrollment / Joining sessions ──────────────────────────
async function handleEnrollmentSubmit() {
  if (!selectedBooking) return;
  const input = document.getElementById("newEnrolleeInput");
  const typeSelect = document.getElementById("newEnrolleeType");
  const newName = input.value.trim();
  if (!newName) return;
  
  const submitBtn = document.getElementById("btnEnrollSubmit");
  submitBtn.disabled = true;
  
  const type = typeSelect.value; // "Member" or "Kid"
  const formattedName = `${newName} (${type})`;
  
  const currentEnrollees = selectedBooking.enrollees || "";
  let updated = "";
  if (currentEnrollees.trim() === "") {
    updated = formattedName;
  } else {
    updated = currentEnrollees + ", " + formattedName;
  }
  
  try {
    const docRef = doc(db, "bookings", selectedBooking.id);
    await updateDoc(docRef, {
      enrollees: updated
    });
    
    // Update cached object
    selectedBooking.enrollees = updated;
    
    input.value = "";
    renderModalEnrolleesList(updated);
    showMsg("modalMessage", "You have enrolled successfully!", "success");
    
    // Refresh background screens
    renderCalendar();
    loadDailyGrid();
  } catch (error) {
    showMsg("modalMessage", "Enrollment failed: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// ── Deleting / Cancelling bookings ─────────────────────────
async function handleBookingDelete() {
  if (!selectedBooking) return;
  if (!confirm("Are you sure you want to permanently cancel this court reservation?")) return;
  
  const btn = document.getElementById("btnDeleteBooking");
  btn.disabled = true;
  btn.textContent = "Cancelling...";
  
  try {
    const isOwner = currentUser && selectedBooking.userId === currentUser.uid;
    if (!isOwner) {
      throw new Error("Permission Denied: You cannot cancel another player's booking.");
    }
    
    const docRef = doc(db, "bookings", selectedBooking.id);
    await deleteDoc(docRef);
    
    showMsg("modalMessage", "Reservation cancelled successfully.", "success");
    
    setTimeout(() => {
      closeModal();
      renderCalendar();
      loadDailyGrid();
    }, 1200);
  } catch (error) {
    showMsg("modalMessage", "Cancellation failed: " + error.message, "error");
    btn.disabled = false;
    btn.textContent = "Cancel Booking";
  }
}

// ── Helper: Output modal messaging banners ─────────────────
function showMsg(containerId, text, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  
  el.textContent = text;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    el.classList.add("hidden");
  }, 4000);
}

// ── Financial Revenue & Pricing Systems ─────────────────────
async function loadPricingRates() {
  if (!db) return;
  try {
    const docRef = doc(db, "configs", "pricing");
    const docSnap = await getDocs(query(collection(db, "configs"))); // Get config details
    
    // In Firestore web SDK, simple query for single doc
    const snap = await getDocs(query(collection(db, "configs")));
    snap.forEach(d => {
      if (d.id === "pricing") {
        const data = d.data();
        document.getElementById("rate_single").value = data.rateSingle || 500;
        document.getElementById("rate_member").value = data.rateMember || 1000;
        document.getElementById("rate_kid").value = data.rateKid || 1500;
      }
    });
  } catch (error) {
    console.error("Failed to load pricing configurations:", error);
  }
}

async function handlePricingSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("btnSavePricing");
  btn.disabled = true;
  btn.textContent = "Saving Rates...";
  
  const rateSingle = parseInt(document.getElementById("rate_single").value) || 500;
  const rateMember = parseInt(document.getElementById("rate_member").value) || 1000;
  const rateKid = parseInt(document.getElementById("rate_kid").value) || 1500;
  
  try {
    if (!db) throw new Error("Database connection not active.");
    
    const docRef = doc(db, "configs", "pricing");
    await setDoc(docRef, {
      rateSingle: rateSingle,
      rateMember: rateMember,
      rateKid: rateKid,
      updatedAt: serverTimestamp()
    });
    
    showMsg("pricingMessage", "Pricing rates updated successfully!", "success");
    calculateMonthlyRevenue();
  } catch (error) {
    showMsg("pricingMessage", "Failed to update rates: " + error.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Update Pricing Rates";
  }
}

function calculateMonthlyRevenue() {
  const rateSingle = parseFloat(document.getElementById("rate_single").value) || 500;
  const rateMember = parseFloat(document.getElementById("rate_member").value) || 1000;
  const rateKid = parseFloat(document.getElementById("rate_kid").value) || 1500;
  
  let totalSingleHours = 0;
  const uniqueMembers = new Set();
  const uniqueKids = new Set();
  
  currentMonthBookings.forEach(booking => {
    const enrolleesStr = booking.enrollees || "";
    const hasEnrollees = enrolleesStr.trim().length > 0;
    
    if (!hasEnrollees) {
      // Calculate single booking slot hours
      const startStr = booking.start_time.substring(0, 5);
      const endStr = booking.end_time.substring(0, 5);
      
      const startHour = parseInt(startStr.split(":")[0]);
      const endHour = parseInt(endStr.split(":")[0]);
      const hours = endHour - startHour;
      if (hours > 0) {
        totalSingleHours += hours;
      }
    } else {
      // Parse members and kids enrollees
      enrolleesStr.split(",").forEach(name => {
        const trimmed = name.trim();
        if (trimmed) {
          if (trimmed.endsWith("(Kid)")) {
            uniqueKids.add(trimmed);
          } else if (trimmed.endsWith("(Member)")) {
            uniqueMembers.add(trimmed);
          } else {
            // Default suffix-less legacy to Member
            uniqueMembers.add(trimmed);
          }
        }
      });
    }
  });
  
  const singleRevenue = totalSingleHours * rateSingle;
  const memberRevenue = uniqueMembers.size * rateMember;
  const kidRevenue = uniqueKids.size * rateKid;
  const totalRevenue = singleRevenue + memberRevenue + kidRevenue;
  
  document.getElementById("revenueMonthName").textContent = `${monthNames[currentMonth]} ${currentYear}`;
  
  document.getElementById("revSingleVal").textContent = `₹${singleRevenue.toLocaleString()}`;
  document.getElementById("revSingleHrs").textContent = `${totalSingleHours} hours allocated`;
  
  document.getElementById("revMembersVal").textContent = `₹${memberRevenue.toLocaleString()}`;
  document.getElementById("revMembersCount").textContent = `${uniqueMembers.size} unique members`;
  
  document.getElementById("revKidsVal").textContent = `₹${kidRevenue.toLocaleString()}`;
  document.getElementById("revKidsCount").textContent = `${uniqueKids.size} unique kids`;
  
  document.getElementById("revTotalVal").textContent = `₹${totalRevenue.toLocaleString()}`;
}
