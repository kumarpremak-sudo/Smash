// js/shared.js — Core shared module for all pages
// Firebase init, auth, theme, toast, utilities, data loaders

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDocs, getDoc, getDocFromServer, setDoc,
  updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signInAnonymously, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ── Exported State ──────────────────────────────────────────
export let db = null;
export let auth = null;
export let currentUser = null;
export let courtsList = [];
export let courtsMap = {};
export let membersList = [];
export let authConfig = { allowedEmails: [], allowGuestLogin: true };

export const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export let tenantSettings = null;

export const defaultSettings = {
  "academy_name": "",
  "contact_numbers": [],
  "court_count": 3,
  "membership_programs": [
    { "type": "Individual", "duration_days": "5 Days", "days_description": "Monday - Friday", "fee_per_month": 1400, "special_notes": "Male", "key": "Individual_5d_Male" },
    { "type": "Individual", "duration_days": "5 Days", "days_description": "Monday - Friday", "fee_per_month": 1200, "special_notes": "Female", "key": "Individual_5d_Female" },
    { "type": "Individual", "duration_days": "7 Days", "days_description": "Monday - Sunday", "fee_per_month": 1800, "special_notes": "", "key": "Individual_7d" },
    { "type": "Individual", "duration_days": "Weekend", "days_description": "Saturday & Sunday", "fee_per_month": 1050, "special_notes": "", "key": "Individual_weekend" },
    { "type": "Group", "duration_days": "5 Days", "days_description": "Monday - Friday", "fee_per_month": 8500, "special_notes": "", "key": "Group_5d" }
  ],
  "hourly_slots": [
    { "type": "Hourly Slot", "rate": 300, "unit": "per hour" },
    { "type": "Guest play (Peak hours)", "rate": 200, "unit": "per hour per person" },
    { "type": "Guest play (Non Peak hours)", "rate": 150, "unit": "per hour per person" }
  ],
  "coaching_schedule": [
    { "category": "Kids", "timing_slots": [], "days": "5 Days/wk" },
    { "category": "Women", "timing_slots": [], "days": "5 Days/wk" },
    { "category": "Adults", "timing_slots": [], "days": "5-Day/Wknd" },
    { "category": "Advance Batch", "timing_slots": [], "days": "6-Day/wk" }
  ],
  "fee_structure": [
    { "program_name": "Kids Coaching", "pricing_variants": [{ "frequency": "5 Days/Week", "cost": 2500, "key": "Kids_5d" }, { "frequency": "3 Days/Week", "cost": 2000, "key": "Kids_3d" }, { "frequency": "Weekend", "cost": 1500, "key": "Kids_weekend" }] },
    { "program_name": "Women Coaching", "pricing_variants": [{ "frequency": "5-Day/wk", "cost": 2500, "key": "Women_5d" }, { "frequency": "3-Day/wk", "cost": 2000, "key": "Women_3d" }] },
    { "program_name": "Adults Coaching", "pricing_variants": [{ "frequency": "5-Day/Wknd", "cost": 3000, "key": "Adults_5d_weekend" }, { "frequency": "3-Day/wk", "cost": 2500, "key": "Adults_3d" }] },
    { "program_name": "Advance Batch", "pricing_variants": [{ "frequency": "6-Day/wk", "cost": 12000, "key": "Advance_6d" }] },
    { "program_name": "Personal Training", "pricing_variants": [{ "frequency": "1 Session", "cost": 700, "key": "PT_session" }] }
  ],
  "operating_hours": {
    "start": "05:00",
    "end": "23:00"
  }
};

// Re-export Firebase utilities for page modules
export {
  getFirestore, collection, doc, addDoc, getDocs, getDoc, setDoc,
  updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp,
  signOut
};

// ── Utilities ───────────────────────────────────────────────
export function escapeHTML(str) {
  if (!str) return "";
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
}

export function formatSelectedDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addOneMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function showMsg(containerId, text, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

export function maskEmail(email) {
  if (!email || typeof email !== "string") return "N/A";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local}***@${domain}`;
  return `${local.substring(0, 2)}***@${domain}`;
}

export function populateBookingDropdowns(typeSelectId, categorySelectId) {
  const typeSelect = document.getElementById(typeSelectId);
  const catSelect = document.getElementById(categorySelectId);
  if (!typeSelect || !catSelect || !tenantSettings) return;

  // Ensure we don't duplicate options if called multiple times
  if (typeSelect.options.length <= 1) {
    typeSelect.innerHTML = '<option value="" disabled selected>Select Booking Type</option>';
    typeSelect.innerHTML += '<option value="single">Spot Booking</option>';
    typeSelect.innerHTML += '<option value="month_weekdays">Entire Month (Weekdays)</option>';
    typeSelect.innerHTML += '<option value="month_all">Entire Month (All Days)</option>';
  }

  const currentType = typeSelect.value;
  catSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';

  const categories = new Set();

  if (currentType === "single") {
    // Only show hourly/spot slots
    if (tenantSettings.hourly_slots) {
      tenantSettings.hourly_slots.forEach(s => categories.add(s.type));
    }
  } else if (currentType && currentType.startsWith("month")) {
    // Only show Memberships and Coaching
    if (tenantSettings.coaching_schedule) {
      tenantSettings.coaching_schedule.forEach(c => categories.add(c.category));
    }
    if (tenantSettings.fee_structure && tenantSettings.fee_structure.some(f => f.program_name.toLowerCase().includes("personal training"))) {
      categories.add("Personal Training");
    }
    if (tenantSettings.membership_programs) {
      tenantSettings.membership_programs.forEach(m => categories.add(m.type + " Membership"));
    }
  } else {
    // Show all if nothing selected yet
    if (tenantSettings.hourly_slots) tenantSettings.hourly_slots.forEach(s => categories.add(s.type));
    if (tenantSettings.coaching_schedule) tenantSettings.coaching_schedule.forEach(c => categories.add(c.category));
    if (tenantSettings.fee_structure && tenantSettings.fee_structure.some(f => f.program_name.toLowerCase().includes("personal training"))) {
      categories.add("Personal Training");
    }
    if (tenantSettings.membership_programs) tenantSettings.membership_programs.forEach(m => categories.add(m.type + " Membership"));
  }

  if (categories.size === 0) {
    categories.add("Court Rental");
    categories.add("Coaching");
  }

  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.toLowerCase().replace(/\s+/g, '_');
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });
}

export function maskPhone(phone) {
  if (!phone) return "N/A";
  const p = phone.trim();
  if (p.length <= 4) return p;
  return "XXXX" + p.slice(-4);
}

// ── Toast Notification System ───────────────────────────────
export function showInlineToast(message, type = "success") {
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement("div");
  toast.className = `app-toast app-toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Theme Management ────────────────────────────────────────
export function initTheme() {
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

// ── Data Loaders ────────────────────────────────────────────
export async function loadCourts() {
  let snap;
  if (currentUser?.academyId) {
    const q = query(collection(db, "courts"), where("academyId", "==", currentUser.academyId));
    snap = await getDocs(q);
  } else {
    snap = { forEach: () => { } };
  }
  courtsList = [];
  courtsMap = {};
  snap.forEach(d => {
    const court = d.data();
    courtsList.push(court);
    courtsMap[court.id] = court.name;
  });
  
  if (courtsList.length === 0 && tenantSettings && tenantSettings.court_count) {
    for (let i = 1; i <= tenantSettings.court_count; i++) {
      courtsList.push({ id: i, name: `Court ${i}` });
      courtsMap[i] = `Court ${i}`;
    }
  }
  
  courtsList.sort((a, b) => a.id - b.id);
}

export async function loadMembers() {
  if (!db) return;
  try {
    let snap = { forEach: () => { } };
    if (currentUser?.academyId) {
      const q = query(collection(db, "members"), where("academyId", "==", currentUser.academyId));
      snap = await getDocs(q);
    }
    membersList = [];
    snap.forEach(d => {
      membersList.push({ id: d.id, ...d.data() });
    });
  } catch (error) {
    console.error("Failed to load members:", error);
  }
}

export async function loadTenantSettings() {
  if (!db || !currentUser?.academyId) return;
  try {
    const docRef = doc(db, "academies", currentUser.academyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      tenantSettings = snap.data();
      
      // Inject missing template arrays for backward compatibility and UX
      if (!tenantSettings.membership_programs) tenantSettings.membership_programs = defaultSettings.membership_programs;
      if (!tenantSettings.hourly_slots) tenantSettings.hourly_slots = defaultSettings.hourly_slots;
      if (!tenantSettings.coaching_schedule) tenantSettings.coaching_schedule = defaultSettings.coaching_schedule;
      if (!tenantSettings.fee_structure) tenantSettings.fee_structure = defaultSettings.fee_structure;
      if (!tenantSettings.operating_hours) tenantSettings.operating_hours = defaultSettings.operating_hours;
      
      // In-memory migration for existing users
      if (tenantSettings.hourly_slots) {
        tenantSettings.hourly_slots.forEach(s => {
          if (s.type.includes("Guest") || s.type.includes("Spot Booking") || s.type.includes("Hourly Slot Peak")) {
            if (s.type.includes("Peak")) {
              s.type = s.type.includes("Non") ? "Guest play (Non Peak hours)" : "Guest play (Peak hours)";
            } else if (s.type === "Guest" || s.type === "Spot Booking") {
              s.type = "Hourly Slot";
            }
          }
        });
      }
      
      // Check for missing mandatory onboarding fields
      if (!tenantSettings.court_count) {
        if (!window.location.pathname.endsWith("dashboard.html")) {
          window.location.href = "dashboard.html";
          return;
        }
        document.dispatchEvent(new Event('setup_required'));
      }
      
    } else {
      // First-time login: missing settings
      tenantSettings = null;
      if (!window.location.pathname.endsWith("dashboard.html")) {
        window.location.href = "dashboard.html";
        return;
      }
      document.dispatchEvent(new Event('setup_required'));
    }
  } catch (error) {
    console.error("Failed to load tenant settings:", error);
  }
}

// ── Auth Checking ───────────────────────────────────────────
async function checkUserAccess(user) {
  if (!db) return false;
  try {
    // 1. Check Global Guest Setting
    const configDoc = await getDoc(doc(db, "configs", "auth"));
    if (configDoc.exists()) {
      const data = configDoc.data();
      authConfig.allowGuestLogin = data.allowGuestLogin !== undefined ? data.allowGuestLogin : true;
    }

    // 2. Handle Anonymous Users
    if (user.isAnonymous) {
      if (authConfig.allowGuestLogin) {
        // Enforce 24-hour expiration
        const creationTime = new Date(user.metadata.creationTime).getTime();
        const now = Date.now();
        if (now - creationTime > 24 * 60 * 60 * 1000) {
          await signOut(auth);
          return false;
        }

        user.role = "GUEST";
        user.academyId = "demo_" + user.uid; // Isolate each guest to their own private demo tenant
        return true;
      }
      return false;
    }

    const userEmail = (user.email || "").toLowerCase().trim();
    const userDocRef = doc(db, "users", userEmail);
    const userDoc = await getDocFromServer(userDocRef);

    if (!userDoc.exists()) {
      // Auto-seed super admin if they match the admin email
      if (userEmail === "kumarprem.ak@gmail.com") {
        const adminData = {
          email: userEmail,
          role: "SUPER_ADMIN",
          academyId: null,
          createdAt: Date.now()
        };
        // Save using their email as the document ID
        await setDoc(userDocRef, adminData);
        user.role = "SUPER_ADMIN";
        user.academyId = null;
        return true;
      }
      return false;
    }

    // User found via email document ID
    const userData = userDoc.data();

    // Validate that the academy still exists (prevents orphaned users from logging in)
    if (userData.role === "TENANT_ADMIN" || userData.role === "STAFF") {
      if (!userData.academyId) {
        console.warn("User has no assigned academy. Access denied.");
        // Auto-cleanup invalid user
        await deleteDoc(userDocRef);
        return false;
      }
      try {
        const acadDoc = await getDocFromServer(doc(db, "academies", userData.academyId));
        if (!acadDoc.exists()) {
          console.warn("Academy has been deleted. Access denied for orphaned user.");

          // Auto-cleanup the orphaned user
          await deleteDoc(userDocRef);

          return false;
        }
      } catch (err) {
        console.error("Error verifying academy existence:", err);
        return false;
      }
    }

    user.role = userData.role;
    user.academyId = userData.academyId;
    return true;
  } catch (error) {
    console.error("Access verification error:", error);
    return false;
  }
}

export function isSuperAdmin(user) {
  return user && user.role === "SUPER_ADMIN";
}

export function isTenantAdmin(user) {
  return user && user.role === "TENANT_ADMIN";
}

export function isStaff(user) {
  return user && user.role === "STAFF";
}

// ── Booking Conflict Check ──────────────────────────────────
// Returns false if no conflict, or an error string if there is a conflict.
export async function checkBookingConflicts(courtId, dateStr, startTime, endTime, category) {
  try {
    const q = query(collection(db, "bookings"), where("court_id", "==", courtId), where("date", "==", dateStr), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    
    // Rule 1: Coaching Sessions (No Limit)
    const catLower = (category || "").toLowerCase();
    const isCoaching = catLower.includes("coaching") || catLower.includes("training") || catLower.includes("advance") || catLower.includes("batch");
    if (isCoaching) {
      return false; 
    }

    // Rule 2: Individual / Guest Bookings (Max 2 Per Court)
    let overlapCount = 0;
    snap.forEach(d => {
      const b = d.data();
      if (startTime < b.end_time && endTime > b.start_time) {
        overlapCount++;
      }
    });

    if (overlapCount >= 2) {
      return "Court is unavailable: Maximum capacity of 2 players reached for this slot.";
    }

    return false;
  } catch (err) {
    console.error("Conflict checking query error:", err);
    return "Error validating court availability.";
  }
}

// ── Auth Handling ───────────────────────────────────────────
// Each page provides its own onReady callback for post-auth actions
let _onAuthReady = null;
export function setOnAuthReady(fn) { _onAuthReady = fn; }

const pageFile = window.location.pathname.split("/").pop() || "index.html";
const isLoginPage = pageFile === "index.html" || pageFile === "" || window.location.pathname === "/";

async function handleAuthStateChange(user) {
  if (user) {
    const hasAccess = await checkUserAccess(user);
    if (!hasAccess) {
      let errMsg = user.isAnonymous
        ? "Access Denied: Guest Administrator login is currently disabled by the owner."
        : "Access Denied: Your email is not whitelisted to access this application.";
      await signOut(auth);
      const errEl = document.getElementById("loginError");
      if (errEl) { errEl.textContent = errMsg; errEl.classList.remove("hidden"); }
      return;
    }
    currentUser = user;
    if (isLoginPage) { window.location.href = "dashboard.html"; return; }
    // Update header UI
    const header = document.getElementById("appHeader");
    const avatar = document.getElementById("userAvatar");
    const nameEl = document.getElementById("userName");
    const menuEmail = document.getElementById("userMenuEmail");
    if (nameEl) nameEl.textContent = user.displayName || (user.isAnonymous ? "Guest Player" : "Member");
    if (menuEmail) menuEmail.textContent = user.email || "Anonymous Guest Account";
    if (avatar) {
      avatar.innerHTML = user.photoURL
        ? `<img src="${user.photoURL}" alt="avatar">`
        : (user.isAnonymous ? "👤" : (user.email ? user.email.charAt(0).toUpperCase() : "?"));
    }
    if (header) header.classList.remove("hidden");

    // Hide settings nav for non-admin roles
    const showSettings = isSuperAdmin(user) || isTenantAdmin(user);
    const navSettings = document.getElementById("navSettings");
    if (navSettings) {
      navSettings.classList.toggle("hidden", !showSettings);
    }
    const bottomNavSettings = document.getElementById("bottomNavSettings");
    if (bottomNavSettings) {
      bottomNavSettings.classList.toggle("hidden", !showSettings);
    }
    // Load core data, then call page-specific ready handler
    await loadCourts();
    await loadTenantSettings();

    // Reveal page content after data is loaded
    const pageContent = document.querySelector(".page-content");
    if (pageContent) pageContent.classList.remove("hidden");

    if (_onAuthReady) _onAuthReady(user);
  } else {
    currentUser = null;
    if (!isLoginPage) { window.location.href = "index.html"; return; }
    const header = document.getElementById("appHeader");
    if (header) header.classList.add("hidden");
  }
}

// ── Shared Event Listeners ──────────────────────────────────
function setupSharedListeners() {
  const addClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };
  // Sign out
  addClick("btnSignOut", () => signOut(auth));
  // User pill dropdown
  addClick("userPill", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("userMenu");
    if (menu) menu.classList.toggle("active");
  });
  document.addEventListener("click", () => {
    const menu = document.getElementById("userMenu");
    if (menu) menu.classList.remove("active");
  });
  // Logo
  addClick("logoBtn", () => { window.location.href = "dashboard.html"; });
  // Mobile hamburger
  addClick("hamburgerBtn", (e) => {
    e.stopPropagation();
    const nav = document.getElementById("desktopNav");
    if (nav) nav.classList.toggle("active");
  });
  // Login buttons (only on login page)
  addClick("btnGoogleLogin", async () => {
    try {
      document.getElementById("loginError").classList.add("hidden");
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      showMsg("loginError", "Google authentication failed: " + error.message, "error");
    }
  });
  addClick("btnGuestLogin", async () => {
    try {
      document.getElementById("loginError").classList.add("hidden");
      await signInAnonymously(auth);
    } catch (error) {
      showMsg("loginError", "Guest Sign-in failed: " + error.message, "error");
    }
  });
}

// ── Initialization ──────────────────────────────────────────
export function initApp() {
  initTheme();
  const isConfigured = window.FIREBASE_CONFIG &&
    window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY" &&
    window.FIREBASE_CONFIG.apiKey !== "__FIREBASE_API_KEY__";
  if (!isConfigured) {
    const banner = document.getElementById("setupBanner");
    if (banner) banner.classList.remove("hidden");
    const btnGoogle = document.getElementById("btnGoogleLogin");
    if (btnGoogle) btnGoogle.disabled = true;
    const btnGuest = document.getElementById("btnGuestLogin");
    if (btnGuest) btnGuest.disabled = true;
    console.warn("Firebase config is missing or unconfigured.");
    return;
  }
  const app = initializeApp(window.FIREBASE_CONFIG);
  db = getFirestore(app);
  auth = getAuth(app);
  onAuthStateChanged(auth, handleAuthStateChange);
  setupSharedListeners();
}

// ── Bulk Monthly Cancellation Backend Function ─────────────
export async function bulkCancelMonthlyBookings({ memberPhone, groupId, yearMonth, cancelledBy, reason = "Admin Bulk Cancellation" }) {
  if (!db) throw new Error("Database not initialized.");
  if (!yearMonth || (!memberPhone && !groupId)) {
    throw new Error("YearMonth and either Member Phone or Group ID are required.");
  }

  const startDate = `${yearMonth}-01`;
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

  const bookingsRef = collection(db, "bookings");
  let snapshot;

  try {
    let constraints = [
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    ];
    if (memberPhone) {
      constraints.push(where("customer_phone", "==", memberPhone));
    } else if (groupId) {
      constraints.push(where("category", "==", groupId));
    }

    const q = query(bookingsRef, ...constraints);
    snapshot = await getDocs(q);
  } catch (err) {
    // Fallback in-memory scan if composite index or custom queries hit constraints locally
    const allSnap = await getDocs(bookingsRef);
    const filteredDocs = [];
    allSnap.forEach(d => {
      const data = d.data();
      const matchDate = data.date >= startDate && data.date <= endDate;
      const matchMember = memberPhone ? (data.customer_phone === memberPhone) : true;
      const matchGroup = groupId ? (data.category === groupId) : true;
      const matchStatus = data.status !== "cancelled";
      if (matchDate && matchMember && matchGroup && matchStatus) {
        filteredDocs.push(d);
      }
    });
    snapshot = { docs: filteredDocs, empty: filteredDocs.length === 0 };
  }

  if (snapshot.empty) {
    return { success: true, processedCount: 0, failedCount: 0, cancelledIds: [], failures: [] };
  }

  const BATCH_SIZE = 450;
  const docs = snapshot.docs;
  const chunks = [];
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    chunks.push(docs.slice(i, i + BATCH_SIZE));
  }

  const cancelledIds = [];
  const failures = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = writeBatch(db);
    const chunkIds = [];

    chunk.forEach((docSnap) => {
      const ref = doc(db, "bookings", docSnap.id);
      batch.update(ref, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: cancelledBy || "Admin",
        cancellationReason: reason
      });
      chunkIds.push(docSnap.id);
    });

    try {
      await batch.commit();
      cancelledIds.push(...chunkIds);
    } catch (error) {
      chunkIds.forEach(id => failures.push({ id, error: error.message }));
    }
  }

  return {
    success: failures.length === 0,
    processedCount: cancelledIds.length,
    failedCount: failures.length,
    cancelledIds,
    failures
  };
}

