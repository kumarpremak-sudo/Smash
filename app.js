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
let authConfig = { allowedEmails: [], allowGuestLogin: true };
let membersList = [];

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11
let selectedDate = new Date();
let selectedBooking = null;

const monthNames = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname === "";

const iraguRates = {
  Individual_5d_Male: 1400,
  Individual_5d_Female: 1200,
  Individual_7d: 1800,
  Individual_weekend: 1050,
  Group_5d: 8500,
  Group_7d: 10000,
  Group_weekend: 5000,
  Kids_3d: 2000,
  Kids_5d: 2500,
  Kids_weekend: 1500,
  Women_5d: 2500,
  Women_3d: 2000,
  Adults_5d_weekend: 3000,
  Adults_3d: 2500,
  Advance_6d: 12000,
  PT_session: 700,
  Guest_non_peak: 150,
  Guest_peak: 200,
  Guest_hourly_slot: 300
};

const planLabels = {
  Individual_5d_Male: { name: "Indiv. 5-Day Male", color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" },
  Individual_5d_Female: { name: "Indiv. 5-Day Female", color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" },
  Individual_7d: { name: "Indiv. 7-Day", color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" },
  Individual_weekend: { name: "Indiv. Weekend", color: "var(--accent3)", bg: "rgba(255, 209, 102, 0.12)" },
  Group_5d: { name: "Group 5-Day", color: "var(--accent)", bg: "rgba(0, 229, 160, 0.12)" },
  Group_7d: { name: "Group 7-Day", color: "var(--accent)", bg: "rgba(0, 229, 160, 0.12)" },
  Group_weekend: { name: "Group Weekend", color: "var(--accent3)", bg: "rgba(255, 209, 102, 0.12)" },
  Kids_3d: { name: "Kids 3-Day/wk", color: "var(--purple)", bg: "rgba(167, 139, 250, 0.12)" },
  Kids_5d: { name: "Kids 5-Day/wk", color: "var(--purple)", bg: "rgba(167, 139, 250, 0.12)" },
  Kids_weekend: { name: "Kids Weekend", color: "var(--purple)", bg: "rgba(167, 139, 250, 0.12)" },
  Women_5d: { name: "Women 5-Day/wk", color: "var(--accent2)", bg: "rgba(255, 107, 107, 0.12)" },
  Women_3d: { name: "Women 3-Day/wk", color: "var(--accent2)", bg: "rgba(255, 107, 107, 0.12)" },
  Adults_5d_weekend: { name: "Adults 5-Day/Wknd", color: "var(--text)", bg: "rgba(255, 255, 255, 0.08)" },
  Adults_3d: { name: "Adults 3-Day/wk", color: "var(--text)", bg: "rgba(255, 255, 255, 0.08)" },
  Advance_6d: { name: "Advance 6-Day/wk", color: "var(--accent2)", bg: "rgba(255, 107, 107, 0.12)" },
  PT_session: { name: "PT Session", color: "var(--accent3)", bg: "rgba(255, 209, 102, 0.12)" }
};

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
  } else if (screenId === "programsScreen") {
    const navProg = document.getElementById("navPrograms");
    if (navProg) navProg.classList.add("active");
  } else if (screenId === "settingsScreen") {
    if (!currentUser || currentUser.isAnonymous) {
      showScreen("homeScreen");
      return;
    }
    const navSet = document.getElementById("navSettings");
    if (navSet) navSet.classList.add("active");
    renderSettingsView();
  }
  
  // Auto-close mobile hamburger menu
  const nav = document.getElementById("desktopNav");
  if (nav) nav.classList.remove("active");
}

// ── Auth Checking & Whitelisting ───────────────────────────
async function checkUserAccess(user) {
  if (!db) return false;
  try {
    let allowedEmails = [];
    let allowGuestLogin = true;
    
    const configSnap = await getDocs(collection(db, "configs"));
    let authDocFound = false;
    
    configSnap.forEach(d => {
      if (d.id === "auth") {
        authDocFound = true;
        const data = d.data();
        allowedEmails = data.allowedEmails || [];
        allowGuestLogin = data.allowGuestLogin !== undefined ? data.allowGuestLogin : true;
      }
    });
    
    authConfig.allowedEmails = allowedEmails;
    authConfig.allowGuestLogin = allowGuestLogin;
    
    // Auto-seed: if allowedEmails is empty, whitelist the first Google user who logs in
    if (allowedEmails.length === 0 && !user.isAnonymous && user.email) {
      allowedEmails.push(user.email.toLowerCase().trim());
      await setDoc(doc(db, "configs", "auth"), {
        allowedEmails: allowedEmails,
        allowGuestLogin: allowGuestLogin
      });
      authConfig.allowedEmails = allowedEmails;
      console.log("Auto-seeded whitelist with first Google user:", user.email);
      return true;
    }
    
    if (user.isAnonymous) {
      return allowGuestLogin;
    } else {
      const userEmail = (user.email || "").toLowerCase().trim();
      return allowedEmails.map(e => e.toLowerCase().trim()).includes(userEmail);
    }
  } catch (error) {
    console.error("Access verification error:", error);
    return false;
  }
}

// ── Auth Handling ──────────────────────────────────────────
async function handleAuthStateChange(user) {
  if (user) {
    // Check whitelist authorization
    const hasAccess = await checkUserAccess(user);
    if (!hasAccess) {
      let errMsg = "Access Denied: Your email is not whitelisted to access this application.";
      if (user.isAnonymous) {
        errMsg = "Access Denied: Guest Administrator login is currently disabled by the owner.";
      }
      await signOut(auth);
      
      const errEl = document.getElementById("loginError");
      if (errEl) {
        errEl.textContent = errMsg;
        errEl.classList.remove("hidden");
      }
      return;
    }
    
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
    
    // Hide Admin Settings link in nav bar if Guest
    const navSettings = document.getElementById("navSettings");
    if (navSettings) {
      if (user.isAnonymous) {
        navSettings.classList.add("hidden");
      } else {
        navSettings.classList.remove("hidden");
      }
    }
    
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
  addClick("navPrograms", (e) => { e.preventDefault(); showScreen("programsScreen"); initProgramsScreen(); });
  addClick("navSettings", (e) => { e.preventDefault(); showScreen("settingsScreen"); });
  
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
  
  // Advanced Pricing Board
  addClick("btnOpenPricingBoard", openPricingBoardModal);
  addClick("pricingBoardModalClose", closePricingBoardModal);
  const pbModal = document.getElementById("pricingBoardModal");
  if (pbModal) pbModal.addEventListener("click", (e) => { if (e.target === pbModal) closePricingBoardModal(); });
  addSubmit("pricingBoardForm", handlePricingBoardSubmit);
  
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
  
  // Whitelist Form & Guest toggle listeners
  addSubmit("addWhitelistForm", handleAddWhitelistSubmit);
  const guestToggle = document.getElementById("toggleGuestLogin");
  if (guestToggle) {
    guestToggle.addEventListener("change", handleToggleGuestLogin);
  }
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
async function loadMembers() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "members"));
    membersList = [];
    snap.forEach(d => {
      membersList.push({ id: d.id, ...d.data() });
    });
  } catch (error) {
    console.error("Failed to load members:", error);
  }
}

function addOneMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function checkFeeAlerts() {
  const alertsListEl = document.getElementById("feeAlertsList");
  const alertsCountEl = document.getElementById("feeAlertsCount");
  if (!alertsListEl || !alertsCountEl) return;
  
  if (!db) return;
  try {
    const todayStr = formatSelectedDate(new Date());
    const overdueMembers = [];
    
    membersList.forEach(member => {
      if (member.status !== "active") return;
      
      const lastPaid = member.lastPaidDate || member.joinDate;
      const nextDue = addOneMonth(lastPaid);
      
      if (todayStr >= nextDue) {
        overdueMembers.push({
          ...member,
          nextDue: nextDue
        });
      }
    });
    
    alertsCountEl.textContent = `${overdueMembers.length} Pending Alert${overdueMembers.length !== 1 ? 's' : ''}`;
    
    if (overdueMembers.length === 0) {
      alertsListEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.8rem; color: var(--accent); background: rgba(0, 230, 118, 0.05); border: 1px dashed rgba(0, 230, 118, 0.3); padding: 1rem; border-radius: var(--radius-md);">
          <span style="font-size: 1.5rem;">🎉</span>
          <span style="font-size: 0.9rem; font-weight: 600;">All member, trainee, coaching, and personal training fees are fully up to date!</span>
        </div>
      `;
      return;
    }
    
    alertsListEl.innerHTML = "";
    overdueMembers.forEach(member => {
      const plan = planLabels[member.type] || { name: member.type, color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" };
      
      let priceVal = "₹0";
      if (member.type === "PT_session") {
        priceVal = `₹${(iraguRates.PT_session || 700)}/hr`;
      } else if (iraguRates[member.type] !== undefined) {
        priceVal = `₹${iraguRates[member.type].toLocaleString()}`;
      }
      
      const row = document.createElement("div");
      row.className = "fee-alert-row";
      
      row.innerHTML = `
        <div class="fee-alert-info">
          <div class="fee-alert-title">👤 ${member.name} <span style="font-size:0.7rem; background:${plan.bg}; color:${plan.color}; border:1px solid ${plan.color}35; padding:1px 8px; border-radius:99px; font-weight:600; margin-left:0.5rem;">${plan.name}</span></div>
          <div class="fee-alert-meta">Joined: <span>${member.joinDate}</span> | Last Paid: <span>${member.lastPaidDate}</span> | Due Since: <span style="color:var(--accent2); font-weight:bold;">${member.nextDue}</span></div>
        </div>
        <div class="fee-alert-actions">
          <div class="fee-alert-price-tag">${priceVal}</div>
          <button class="btn-mark-paid" style="margin-top:0;">Mark Paid</button>
        </div>
      `;
      
      const markBtn = row.querySelector(".btn-mark-paid");
      markBtn.addEventListener("click", () => markMemberAsPaid(member.id, member.name));
      
      alertsListEl.appendChild(row);
    });
  } catch (error) {
    console.error("Failed to check fee alerts:", error);
    alertsListEl.innerHTML = `<div style="color: var(--accent2); font-size:0.85rem;">Error computing fee alerts: ${error.message}</div>`;
  }
}

async function markMemberAsPaid(memberId, memberName) {
  const confirmPaid = confirm(`Confirm fee collection for ${memberName}? This will advance their billing cycle by 1 month.`);
  if (!confirmPaid) return;
  
  try {
    const todayStr = formatSelectedDate(new Date());
    const docRef = doc(db, "members", memberId);
    await updateDoc(docRef, {
      lastPaidDate: todayStr
    });
    
    await loadMembers();
    await checkFeeAlerts();
    await updateStats();
  } catch (error) {
    alert("Failed to mark as paid: " + error.message);
  }
}

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
    
    // Core loads
    await loadMembers();
    calculateMonthlyRevenue();
    await checkFeeAlerts();
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
      
    const catLabels = {
      court_rental: "Rental",
      coaching: "Coaching",
      personal_training: "PT Session",
      advance_batch: "Advance Batch"
    };
    const catColors = {
      court_rental: "var(--accent)",
      coaching: "var(--accent4)",
      personal_training: "var(--accent3)",
      advance_batch: "var(--accent2)"
    };
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
          <div class="booking-user">${booking.customer_name}</div>
          <div style="display:flex; gap:0.4rem; align-items:center;">
            ${categoryBadgeHtml}
            ${badgeHtml}
          </div>
        </div>
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
      const categoryClass = booking.category || "court_rental";
      cell.className = "matrix-cell booked " + categoryClass;
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
async function openBookingDetailsModal(booking) {
  selectedBooking = booking;
  openModal("Booking Details");
  
  document.getElementById("modalDetailsView").classList.remove("hidden");
  
  document.getElementById("detCourt").textContent = courtsMap[booking.court_id] || `Court ${booking.court_id}`;
  document.getElementById("detTime").textContent = `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)} on ${booking.date}`;
  document.getElementById("detName").textContent = booking.customer_name;
  
  // Set default join date input in modal to today
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  if (joinDateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    joinDateInput.value = `${yyyy}-${mm}-${dd}`;
  }
  
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
  
  await renderModalEnrolleesList(booking.id);
}

async function renderModalEnrolleesList(bookingId) {
  const ul = document.getElementById("enrollees-list");
  if (!ul) return;
  ul.innerHTML = '<li class="text-muted" style="list-style:none;">Loading members...</li>';
  
  if (!db) return;
  try {
    const q = query(collection(db, "members"), where("bookingId", "==", bookingId), where("status", "==", "active"));
    const snap = await getDocs(q);
    
    ul.innerHTML = "";
    
    if (!snap.empty) {
      snap.forEach(d => {
        const member = { id: d.id, ...d.data() };
        const li = document.createElement("li");
        li.className = "enrollee-list-item";
        li.style.marginBottom = "0.5rem";
        
        const plan = planLabels[member.type] || { name: member.type, color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" };
        const badgeHtml = `<span style="font-size:0.65rem; background:${plan.bg}; color:${plan.color}; border:1px solid ${plan.color}35; padding:1px 8px; border-radius:99px; font-weight:600;">${plan.name}</span>`;
        
        const infoDiv = document.createElement("div");
        infoDiv.className = "enrollee-list-item-info";
        infoDiv.innerHTML = `
          <span style="font-weight:600;">👤 ${member.name}</span>
          <span class="enrollee-list-item-meta">Joined: <span>${member.joinDate}</span> | Paid: <span>${member.lastPaidDate}</span></span>
        `;
        
        const rightDiv = document.createElement("div");
        rightDiv.style.display = "flex";
        rightDiv.style.alignItems = "center";
        rightDiv.style.gap = "0.8rem";
        rightDiv.innerHTML = badgeHtml;
        
        // Remove button
        const removeBtn = document.createElement("button");
        removeBtn.className = "btn-remove-enrollee";
        removeBtn.innerHTML = "&times;";
        removeBtn.title = `Remove ${member.name}`;
        removeBtn.addEventListener("click", () => handleRemoveEnrollee(member.id, member.name, bookingId));
        
        rightDiv.appendChild(removeBtn);
        
        li.appendChild(infoDiv);
        li.appendChild(rightDiv);
        ul.appendChild(li);
      });
    } else {
      ul.innerHTML = '<li class="text-muted" style="list-style:none;">No enrollees yet</li>';
    }
  } catch (error) {
    ul.innerHTML = `<li style="color: var(--accent2); list-style:none;">Failed to load members: ${error.message}</li>`;
  }
}

async function handleRemoveEnrollee(memberId, memberName, bookingId) {
  const confirmRemove = confirm(`Are you sure you want to remove ${memberName}?`);
  if (!confirmRemove) return;
  
  try {
    const docRef = doc(db, "members", memberId);
    await deleteDoc(docRef);
    
    showMsg("modalMessage", `Removed ${memberName} successfully!`, "success");
    await renderModalEnrolleesList(bookingId);
    await updateStats();
    await checkFeeAlerts();
  } catch (error) {
    showMsg("modalMessage", "Failed to remove member: " + error.message, "error");
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
  const category = document.getElementById("booking_category").value;
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
        category: category,
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
          category: category,
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
  const category = document.getElementById("quickBookingCategory").value;
  
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
      category: category,
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
  const joinDateInput = document.getElementById("newEnrolleeJoinDate");
  
  const newName = input.value.trim();
  if (!newName) return;
  
  const submitBtn = document.getElementById("btnEnrollSubmit");
  submitBtn.disabled = true;
  
  const type = typeSelect.value;
  // Fallback to selectedDate formatted if input is empty
  const joinDate = joinDateInput.value || formatSelectedDate(selectedDate);
  
  try {
    // Add member doc to members collection
    await addDoc(collection(db, "members"), {
      name: newName,
      type: type,
      joinDate: joinDate,
      lastPaidDate: joinDate, // initially equals join date
      bookingId: selectedBooking.id,
      status: "active",
      createdTime: Date.now()
    });
    
    input.value = "";
    showMsg("modalMessage", "Trainee enrolled successfully!", "success");
    
    await renderModalEnrolleesList(selectedBooking.id);
    await updateStats();
    await checkFeeAlerts();
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

// ── Admin Settings Systems ─────────────────────────────────
async function renderSettingsView() {
  if (!db) return;
  const listEl = document.getElementById("whitelist-list");
  if (!listEl) return;
  
  listEl.innerHTML = "";
  
  // Populate guest toggle state
  const guestToggle = document.getElementById("toggleGuestLogin");
  if (guestToggle) {
    guestToggle.checked = authConfig.allowGuestLogin;
  }
  
  if (authConfig.allowedEmails.length === 0) {
    listEl.innerHTML = `<li class="empty-list-msg" style="color: var(--muted); font-size: 0.85rem; font-style: italic; padding: 0.5rem; background: rgba(0,0,0,0.1); border-radius: var(--radius-sm); border: 1px dashed var(--border);">No authorized emails configured.</li>`;
    return;
  }
  
  authConfig.allowedEmails.forEach(email => {
    const li = document.createElement("li");
    li.className = "whitelist-item";
    
    const emailSpan = document.createElement("span");
    emailSpan.className = "whitelist-item-email";
    emailSpan.textContent = email;
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove-whitelist";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = `Remove ${email} from whitelist`;
    removeBtn.addEventListener("click", () => handleRemoveWhitelistEmail(email));
    
    li.appendChild(emailSpan);
    
    // Don't allow a user to remove themselves from the whitelist to avoid getting locked out
    if (currentUser && currentUser.email && email.toLowerCase() === currentUser.email.toLowerCase()) {
      const lockSpan = document.createElement("span");
      lockSpan.style.color = "var(--muted)";
      lockSpan.style.fontSize = "0.75rem";
      lockSpan.textContent = " (You)";
      li.appendChild(lockSpan);
    } else {
      li.appendChild(removeBtn);
    }
    
    listEl.appendChild(li);
  });
}

async function handleAddWhitelistSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("newWhitelistEmail");
  if (!input) return;
  
  const email = input.value.trim().toLowerCase();
  if (!email) return;
  
  if (authConfig.allowedEmails.includes(email)) {
    showMsg("whitelistMsg", "Email is already whitelisted.", "error");
    return;
  }
  
  const updatedEmails = [...authConfig.allowedEmails, email];
  try {
    const docRef = doc(db, "configs", "auth");
    await setDoc(docRef, {
      allowedEmails: updatedEmails,
      allowGuestLogin: authConfig.allowGuestLogin
    });
    
    authConfig.allowedEmails = updatedEmails;
    input.value = "";
    showMsg("whitelistMsg", `Successfully whitelisted: ${email}`, "success");
    renderSettingsView();
  } catch (error) {
    showMsg("whitelistMsg", "Failed to update whitelist: " + error.message, "error");
  }
}

async function handleRemoveWhitelistEmail(email) {
  const confirmRemove = confirm(`Are you sure you want to remove ${email} from the whitelist?`);
  if (!confirmRemove) return;
  
  const updatedEmails = authConfig.allowedEmails.filter(e => e.toLowerCase() !== email.toLowerCase());
  try {
    const docRef = doc(db, "configs", "auth");
    await setDoc(docRef, {
      allowedEmails: updatedEmails,
      allowGuestLogin: authConfig.allowGuestLogin
    });
    
    authConfig.allowedEmails = updatedEmails;
    renderSettingsView();
  } catch (error) {
    alert("Failed to remove email: " + error.message);
  }
}

async function handleToggleGuestLogin(e) {
  const checkbox = e.target;
  if (!checkbox) return;
  
  const allowGuest = checkbox.checked;
  try {
    const docRef = doc(db, "configs", "auth");
    await setDoc(docRef, {
      allowedEmails: authConfig.allowedEmails,
      allowGuestLogin: allowGuest
    });
    
    authConfig.allowGuestLogin = allowGuest;
    showMsg("settingsSaveMsg", `Guest access is now ${allowGuest ? "enabled" : "disabled"}.`, "success");
  } catch (error) {
    checkbox.checked = !allowGuest; // revert on failure
    showMsg("settingsSaveMsg", "Failed to save settings: " + error.message, "error");
  }
}

// ── Financial Revenue & Pricing Systems ─────────────────────
function updateDynamicPricesUI() {
  document.querySelectorAll(".dyn-price").forEach(el => {
    const key = el.dataset.rateKey;
    if (key && iraguRates[key] !== undefined) {
      const value = iraguRates[key];
      el.textContent = `₹${value.toLocaleString()}`;
    }
  });
}

function openPricingBoardModal() {
  document.getElementById("p_indiv_5d_male").value = iraguRates.Individual_5d_Male || 0;
  document.getElementById("p_indiv_5d_female").value = iraguRates.Individual_5d_Female || 0;
  document.getElementById("p_indiv_7d").value = iraguRates.Individual_7d || 0;
  document.getElementById("p_indiv_weekend").value = iraguRates.Individual_weekend || 0;
  
  document.getElementById("p_group_5d").value = iraguRates.Group_5d || 0;
  document.getElementById("p_group_7d").value = iraguRates.Group_7d || 0;
  document.getElementById("p_group_weekend").value = iraguRates.Group_weekend || 0;
  
  document.getElementById("p_kids_3d").value = iraguRates.Kids_3d || 0;
  document.getElementById("p_kids_5d").value = iraguRates.Kids_5d || 0;
  document.getElementById("p_kids_weekend").value = iraguRates.Kids_weekend || 0;
  
  document.getElementById("p_women_5d").value = iraguRates.Women_5d || 0;
  document.getElementById("p_women_3d").value = iraguRates.Women_3d || 0;
  
  document.getElementById("p_adults_5d").value = iraguRates.Adults_5d_weekend || 0;
  document.getElementById("p_adults_3d").value = iraguRates.Adults_3d || 0;
  
  document.getElementById("p_advance_6d").value = iraguRates.Advance_6d || 0;
  document.getElementById("p_pt_session").value = iraguRates.PT_session || 0;
  
  document.getElementById("p_guest_nonpeak").value = iraguRates.Guest_non_peak || 0;
  document.getElementById("p_guest_peak").value = iraguRates.Guest_peak || 0;
  document.getElementById("p_guest_hourly").value = iraguRates.Guest_hourly_slot || 0;
  
  document.getElementById("pricingBoardModal").classList.remove("hidden");
}

function closePricingBoardModal() {
  document.getElementById("pricingBoardModal").classList.add("hidden");
}

async function handlePricingBoardSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("btnSavePricingBoard");
  btn.disabled = true;
  btn.textContent = "Saving...";
  
  iraguRates.Individual_5d_Male = parseInt(document.getElementById("p_indiv_5d_male").value) || 0;
  iraguRates.Individual_5d_Female = parseInt(document.getElementById("p_indiv_5d_female").value) || 0;
  iraguRates.Individual_7d = parseInt(document.getElementById("p_indiv_7d").value) || 0;
  iraguRates.Individual_weekend = parseInt(document.getElementById("p_indiv_weekend").value) || 0;
  
  iraguRates.Group_5d = parseInt(document.getElementById("p_group_5d").value) || 0;
  iraguRates.Group_7d = parseInt(document.getElementById("p_group_7d").value) || 0;
  iraguRates.Group_weekend = parseInt(document.getElementById("p_group_weekend").value) || 0;
  
  iraguRates.Kids_3d = parseInt(document.getElementById("p_kids_3d").value) || 0;
  iraguRates.Kids_5d = parseInt(document.getElementById("p_kids_5d").value) || 0;
  iraguRates.Kids_weekend = parseInt(document.getElementById("p_kids_weekend").value) || 0;
  
  iraguRates.Women_5d = parseInt(document.getElementById("p_women_5d").value) || 0;
  iraguRates.Women_3d = parseInt(document.getElementById("p_women_3d").value) || 0;
  
  iraguRates.Adults_5d_weekend = parseInt(document.getElementById("p_adults_5d").value) || 0;
  iraguRates.Adults_3d = parseInt(document.getElementById("p_adults_3d").value) || 0;
  
  iraguRates.Advance_6d = parseInt(document.getElementById("p_advance_6d").value) || 0;
  iraguRates.PT_session = parseInt(document.getElementById("p_pt_session").value) || 0;
  
  iraguRates.Guest_non_peak = parseInt(document.getElementById("p_guest_nonpeak").value) || 0;
  iraguRates.Guest_peak = parseInt(document.getElementById("p_guest_peak").value) || 0;
  iraguRates.Guest_hourly_slot = parseInt(document.getElementById("p_guest_hourly").value) || 0;
  
  // Sync to standard inputs
  document.getElementById("rate_single").value = iraguRates.Guest_hourly_slot;
  document.getElementById("rate_member").value = iraguRates.PT_session;
  document.getElementById("rate_kid").value = iraguRates.Advance_6d;
  
  try {
    if (!db) throw new Error("Database connection not active.");
    
    const docRef = doc(db, "configs", "pricing");
    await setDoc(docRef, {
      rateSingle: iraguRates.Guest_hourly_slot,
      rateMember: iraguRates.PT_session,
      rateKid: iraguRates.Advance_6d,
      rates: iraguRates,
      updatedAt: serverTimestamp()
    });
    
    updateDynamicPricesUI();
    showMsg("pricingBoardMessage", "Advanced pricing board saved successfully!", "success");
    calculateMonthlyRevenue();
    
    setTimeout(() => {
      closePricingBoardModal();
    }, 1200);
  } catch (error) {
    showMsg("pricingBoardMessage", "Failed to update rates: " + error.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Advanced Rates";
  }
}

async function loadPricingRates() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "configs"));
    snap.forEach(d => {
      if (d.id === "pricing") {
        const data = d.data();
        document.getElementById("rate_single").value = data.rateSingle !== undefined ? data.rateSingle : 300;
        document.getElementById("rate_member").value = data.rateMember !== undefined ? data.rateMember : 700;
        document.getElementById("rate_kid").value = data.rateKid !== undefined ? data.rateKid : 12000;
        
        if (data.rates) {
          Object.assign(iraguRates, data.rates);
        }
        
        // Ensure standard rates are synchronized into iraguRates in case they were updated externally
        iraguRates.Guest_hourly_slot = data.rateSingle !== undefined ? data.rateSingle : iraguRates.Guest_hourly_slot;
        iraguRates.PT_session = data.rateMember !== undefined ? data.rateMember : iraguRates.PT_session;
        iraguRates.Advance_6d = data.rateKid !== undefined ? data.rateKid : iraguRates.Advance_6d;
      }
    });
    
    updateDynamicPricesUI();
  } catch (error) {
    console.error("Failed to load pricing configurations:", error);
  }
}

async function handlePricingSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("btnSavePricing");
  btn.disabled = true;
  btn.textContent = "Saving Rates...";
  
  const rateSingle = parseInt(document.getElementById("rate_single").value) || 300;
  const rateMember = parseInt(document.getElementById("rate_member").value) || 700;
  const rateKid = parseInt(document.getElementById("rate_kid").value) || 12000;
  
  // Sync to iraguRates
  iraguRates.Guest_hourly_slot = rateSingle;
  iraguRates.PT_session = rateMember;
  iraguRates.Advance_6d = rateKid;
  
  try {
    if (!db) throw new Error("Database connection not active.");
    
    const docRef = doc(db, "configs", "pricing");
    await setDoc(docRef, {
      rateSingle: rateSingle,
      rateMember: rateMember,
      rateKid: rateKid,
      rates: iraguRates,
      updatedAt: serverTimestamp()
    });
    
    updateDynamicPricesUI();
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
  const hourlySlotRate = iraguRates.Guest_hourly_slot || 300;

  let totalMembersRevenue = 0;
  let totalCoachingRevenue = 0;
  let totalPTRevenue = 0;
  let totalGuestRevenue = 0;

  let membersCount = 0;
  let coachingCount = 0;
  let ptHours = 0;
  let guestHours = 0;

  // 1. Calculate Academy & Membership Revenue directly from structured membersList
  membersList.forEach(member => {
    if (member.status !== "active") return;
    
    const planKey = member.type;
    if (planKey && iraguRates[planKey] !== undefined) {
      const rate = iraguRates[planKey];
      
      if (planKey.startsWith("Individual_") || planKey.startsWith("Group_")) {
        totalMembersRevenue += rate;
        membersCount++;
      } else if (planKey.startsWith("Kids_") || planKey.startsWith("Women_") || planKey.startsWith("Adults_") || planKey === "Advance_6d") {
        totalCoachingRevenue += rate;
        coachingCount++;
      } else if (planKey === "PT_session") {
        totalPTRevenue += rate;
        ptHours++;
      }
    }
  });

  // 2. Calculate Guest Play / Hourly Court Rental from bookings
  currentMonthBookings.forEach(booking => {
    const category = booking.category || "court_rental";
    
    // Calculate booking duration in hours
    const startStr = booking.start_time.substring(0, 5);
    const endStr = booking.end_time.substring(0, 5);
    const startHour = parseInt(startStr.split(":")[0]);
    const endHour = parseInt(endStr.split(":")[0]);
    const hours = endHour - startHour;

    if (hours <= 0) return;

    if (category === "court_rental") {
      guestHours += hours;
      // Get registered enrollees count for this guest booking slot
      const bookingMembers = membersList.filter(m => m.bookingId === booking.id && m.status === "active");
      const playerCount = bookingMembers.length;
      
      if (playerCount === 0) {
        // Flat court slot rental
        totalGuestRevenue += hours * hourlySlotRate;
      } else {
        // Guest play (check peak vs non-peak)
        const startHourInt = parseInt(startStr.split(":")[0]);
        const isPeak = (startHourInt >= 5 && startHourInt < 9) || (startHourInt >= 16 && startHourInt < 21);
        
        if (isPeak) {
          totalGuestRevenue += hours * playerCount * (iraguRates.Guest_peak || 200);
        } else {
          totalGuestRevenue += hours * (iraguRates.Guest_non_peak || 150);
        }
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

// ── Iragu Calculator Implementations ────────────────────────
function updateCalculatorFields() {
  const category = document.getElementById("calcCategory").value;
  
  // Hide all option blocks
  document.getElementById("calcBlockIndividual").classList.add("hidden");
  document.getElementById("calcBlockGroup").classList.add("hidden");
  document.getElementById("calcBlockCoaching").classList.add("hidden");
  document.getElementById("calcBlockPT").classList.add("hidden");
  document.getElementById("calcBlockGuest").classList.add("hidden");
  
  if (category === "individual") {
    document.getElementById("calcBlockIndividual").classList.remove("hidden");
  } else if (category === "group") {
    document.getElementById("calcBlockGroup").classList.remove("hidden");
  } else if (category === "coaching") {
    document.getElementById("calcBlockCoaching").classList.remove("hidden");
    updateCoachingFrequencies();
  } else if (category === "pt") {
    document.getElementById("calcBlockPT").classList.remove("hidden");
  } else if (category === "guest") {
    document.getElementById("calcBlockGuest").classList.remove("hidden");
    updateGuestPlayFields();
  }
  
  runCalculator();
}

function updateCoachingFrequencies() {
  const program = document.getElementById("calcCoachProgram").value;
  const freqSelect = document.getElementById("calcCoachFreq");
  freqSelect.innerHTML = "";
  
  if (program === "kids") {
    freqSelect.innerHTML = `
      <option value="Kids_3d">3 Days/Week (Mon/Wed/Fri or Tue/Thu/Fri) - ₹2000/mo</option>
      <option value="Kids_5d">5 Days/Week (Mon-Fri) - ₹2500/mo</option>
      <option value="Kids_weekend">Weekend Batch (Sat-Sun) - ₹1500/mo</option>
    `;
  } else if (program === "women") {
    freqSelect.innerHTML = `
      <option value="Women_3d">3 Days/Week (Mon-Fri blocks) - ₹2000/mo</option>
      <option value="Women_5d">5 Days/Week (Mon-Fri blocks) - ₹2500/mo</option>
    `;
  } else if (program === "adults") {
    freqSelect.innerHTML = `
      <option value="Adults_3d">3 Days/Week (Morning or Evening) - ₹2500/mo</option>
      <option value="Adults_5d_weekend">5 Days / Weekend Batch - ₹3000/mo</option>
    `;
  } else if (program === "advance") {
    freqSelect.innerHTML = `
      <option value="Advance_6d">6 Days/Week (Morning + Ground Fitness + Evening) - ₹12000/mo</option>
    `;
  }
  
  runCalculator();
}

function updateGuestPlayFields() {
  const mode = document.getElementById("calcGuestMode").value;
  const personsGroup = document.getElementById("calcGuestPersonsGroup");
  
  if (mode === "peak") {
    personsGroup.classList.remove("hidden");
  } else {
    personsGroup.classList.add("hidden");
  }
  
  runCalculator();
}

function runCalculator() {
  const category = document.getElementById("calcCategory").value;
  let price = 0;
  let planName = "—";
  let schedule = "—";
  let billingFreq = "Monthly Billing";
  
  if (category === "individual") {
    const type = document.getElementById("calcIndivType").value;
    if (type === "5d_male") {
      price = iraguRates.Individual_5d_Male || 1400;
      planName = "Individual Membership (5 Days - Male)";
      schedule = "Monday - Friday Court Access";
    } else if (type === "5d_female") {
      price = iraguRates.Individual_5d_Female || 1200;
      planName = "Individual Membership (5 Days - Female)";
      schedule = "Monday - Friday Court Access (Women Discount)";
    } else if (type === "7d") {
      price = iraguRates.Individual_7d || 1800;
      planName = "Individual Membership (7 Days)";
      schedule = "Monday - Sunday Court Access";
    } else if (type === "weekend") {
      price = iraguRates.Individual_weekend || 1050;
      planName = "Individual Membership (Weekend)";
      schedule = "Saturday - Sunday Court Access";
    }
  } else if (category === "group") {
    const type = document.getElementById("calcGroupType").value;
    if (type === "5d") {
      price = iraguRates.Group_5d || 8500;
      planName = "Group Membership (5 Days)";
      schedule = "Monday - Friday Corporate Access";
    } else if (type === "7d") {
      price = iraguRates.Group_7d || 10000;
      planName = "Group Membership (7 Days)";
      schedule = "Monday - Sunday Unlimited Access";
    } else if (type === "weekend") {
      price = iraguRates.Group_weekend || 5000;
      planName = "Group Membership (Weekend)";
      schedule = "Saturday - Sunday Weekend Access";
    }
  } else if (category === "coaching") {
    const planKey = document.getElementById("calcCoachFreq").value;
    const program = document.getElementById("calcCoachProgram").value;
    
    if (planKey && iraguRates[planKey] !== undefined) {
      price = iraguRates[planKey];
      
      if (program === "kids") {
        planName = "Kids Academy Coaching";
        if (planKey === "Kids_3d") {
          schedule = "Batch 1: Mon/Wed/Fri (06-07 AM or Evening) or Batch 2: Tue/Thu/Fri";
        } else if (planKey === "Kids_5d") {
          schedule = "Monday - Friday (Morning 06:00-07:00 AM or Evening Beginner batches)";
        } else if (planKey === "Kids_weekend") {
          schedule = "Saturday & Sunday (Morning 06:00-09:00 AM or Evening)";
        }
      } else if (program === "women") {
        planName = "Women Academy Coaching";
        if (planKey === "Women_5d") {
          schedule = "Monday - Friday Morning (09:00 AM - 10:00 AM)";
        } else {
          schedule = "3 Selected Days / Week Morning (09:00 AM - 10:00 AM)";
        }
      } else if (program === "adults") {
        planName = "Adults Academy Coaching";
        if (planKey === "Adults_5d_weekend") {
          schedule = "Morning (05:30-06:30 AM) or Weekend Batch";
        } else {
          schedule = "3 Selected Days / Week (Morning 05:30-06:30 AM)";
        }
      } else if (program === "advance") {
        planName = "Advance Coaching (National Track)";
        schedule = "6 Days/Week (Ground Fitness 5-6 AM, Morning 8-10 AM, Evening 6-9 PM)";
      }
    }
  } else if (category === "pt") {
    const hours = parseInt(document.getElementById("calcPTHours").value) || 1;
    price = hours * (iraguRates.PT_session || 700);
    planName = `Personal Training (PT) sessions`;
    schedule = `${hours} custom hour coaching sessions mapped with personal trainer`;
    billingFreq = "Per Session / Booking Billing";
  } else if (category === "guest") {
    const mode = document.getElementById("calcGuestMode").value;
    const hours = parseInt(document.getElementById("calcGuestHours").value) || 1;
    billingFreq = "Hourly Pay-and-Play";
    
    if (mode === "non_peak") {
      price = hours * (iraguRates.Guest_non_peak || 150);
      planName = "Guest Play (Non-Peak Hours)";
      schedule = "Available during mid-day blocks (9 AM to 4 PM)";
    } else if (mode === "peak") {
      const persons = parseInt(document.getElementById("calcGuestPersons").value) || 1;
      price = hours * persons * (iraguRates.Guest_peak || 200);
      planName = `Guest Play (Peak Hours - ${persons} players)`;
      schedule = "Available during morning/evening peak blocks (₹200 per person per hour)";
    } else if (mode === "hourly_slot") {
      price = hours * (iraguRates.Guest_hourly_slot || 300);
      planName = "Hourly Court Rental Slot";
      schedule = "Flat rate for 1 Court booking (up to 4 players)";
    }
  }
  
  document.getElementById("calcResultPlanName").textContent = planName;
  document.getElementById("calcResultSchedule").textContent = schedule;
  document.getElementById("calcResultFreq").textContent = billingFreq;
  document.getElementById("calcResultPrice").textContent = `₹${price.toLocaleString()}`;
}

function initProgramsScreen() {
  // Tab switching
  const tabs = ["Memberships", "Coaching", "Calculator"];
  tabs.forEach(tab => {
    const btn = document.getElementById(`btnProg${tab}`);
    if (btn) {
      btn.addEventListener("click", () => {
        // Deactivate all
        tabs.forEach(t => {
          document.getElementById(`btnProg${t}`).classList.remove("active");
          document.getElementById(`prog${t}View`).classList.remove("active");
        });
        // Activate clicked
        btn.classList.add("active");
        document.getElementById(`prog${tab}View`).classList.add("active");
      });
    }
  });

  // Calculator Setup
  const categorySelect = document.getElementById("calcCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", updateCalculatorFields);
    document.getElementById("calcIndivType").addEventListener("change", runCalculator);
    document.getElementById("calcGroupType").addEventListener("change", runCalculator);
    document.getElementById("calcCoachProgram").addEventListener("change", updateCoachingFrequencies);
    document.getElementById("calcCoachFreq").addEventListener("change", runCalculator);
    document.getElementById("calcPTHours").addEventListener("input", runCalculator);
    document.getElementById("calcGuestMode").addEventListener("change", updateGuestPlayFields);
    document.getElementById("calcGuestHours").addEventListener("input", runCalculator);
    document.getElementById("calcGuestPersons").addEventListener("input", runCalculator);

    // Trigger initial load
    updateCalculatorFields();
  }
}

// Global exposure for event handlers
window.initProgramsScreen = initProgramsScreen;
