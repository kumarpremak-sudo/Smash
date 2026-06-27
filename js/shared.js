// js/shared.js — Core shared module for all pages
// Firebase init, auth, theme, toast, utilities, data loaders

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDocs, getDoc, setDoc,
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
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export const iraguRates = {
  Individual_5d_Male: 1400, Individual_5d_Female: 1200,
  Individual_7d: 1800, Individual_weekend: 1050,
  Group_5d: 8500, Group_7d: 10000, Group_weekend: 5000,
  Kids_3d: 2000, Kids_5d: 2500, Kids_weekend: 1500,
  Women_5d: 2500, Women_3d: 2000,
  Adults_5d_weekend: 3000, Adults_3d: 2500,
  Advance_6d: 12000, PT_session: 700,
  Guest_non_peak: 150, Guest_peak: 200, Guest_hourly_slot: 300
};

export const planLabels = {
  Individual_5d_Male:   { name: "Indiv. 5-Day Male",  color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" },
  Individual_5d_Female: { name: "Indiv. 5-Day Female",color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" },
  Individual_7d:        { name: "Indiv. 7-Day",       color: "var(--accent4)", bg: "rgba(77, 171, 247, 0.12)" },
  Individual_weekend:   { name: "Indiv. Weekend",     color: "var(--accent3)", bg: "rgba(255, 209, 102, 0.12)" },
  Group_5d:             { name: "Group 5-Day",        color: "var(--accent)",  bg: "rgba(0, 229, 160, 0.12)" },
  Group_7d:             { name: "Group 7-Day",        color: "var(--accent)",  bg: "rgba(0, 229, 160, 0.12)" },
  Group_weekend:        { name: "Group Weekend",      color: "var(--accent3)", bg: "rgba(255, 209, 102, 0.12)" },
  Kids_3d:              { name: "Kids 3-Day/wk",      color: "var(--purple)",  bg: "rgba(167, 139, 250, 0.12)" },
  Kids_5d:              { name: "Kids 5-Day/wk",      color: "var(--purple)",  bg: "rgba(167, 139, 250, 0.12)" },
  Kids_weekend:         { name: "Kids Weekend",       color: "var(--purple)",  bg: "rgba(167, 139, 250, 0.12)" },
  Women_5d:             { name: "Women 5-Day/wk",     color: "var(--accent2)", bg: "rgba(255, 107, 107, 0.12)" },
  Women_3d:             { name: "Women 3-Day/wk",     color: "var(--accent2)", bg: "rgba(255, 107, 107, 0.12)" },
  Adults_5d_weekend:    { name: "Adults 5-Day/Wknd",  color: "var(--text)",    bg: "rgba(255, 255, 255, 0.08)" },
  Adults_3d:            { name: "Adults 3-Day/wk",    color: "var(--text)",    bg: "rgba(255, 255, 255, 0.08)" },
  Advance_6d:           { name: "Advance 6-Day/wk",   color: "var(--accent2)", bg: "rgba(255, 107, 107, 0.12)" },
  PT_session:           { name: "PT Session",         color: "var(--accent3)", bg: "rgba(255, 209, 102, 0.12)" }
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
async function seedCourtsIfEmpty() {
  if (!currentUser?.academyId) return;
  try {
    const q = query(collection(db, "courts"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    if (snap.empty) {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, "courts")), { id: 1, name: "Court 1", academyId: currentUser.academyId });
      batch.set(doc(collection(db, "courts")), { id: 2, name: "Court 2", academyId: currentUser.academyId });
      batch.set(doc(collection(db, "courts")), { id: 3, name: "Court 3", academyId: currentUser.academyId });
      await batch.commit();
    }
  } catch (error) {
    console.error("Court seeding check failed:", error);
  }
}

export async function loadCourts() {
  await seedCourtsIfEmpty();
  let snap;
  if (currentUser?.academyId) {
    const q = query(collection(db, "courts"), where("academyId", "==", currentUser.academyId));
    snap = await getDocs(q);
  } else {
    snap = { forEach: () => {} }; 
  }
  courtsList = [];
  courtsMap = {};
  snap.forEach(d => {
    const court = d.data();
    courtsList.push(court);
    courtsMap[court.id] = court.name;
  });
  courtsList.sort((a, b) => a.id - b.id);
}

export async function loadMembers() {
  if (!db) return;
  try {
    let snap = { forEach: () => {} };
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

export async function loadPricingRates() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, "configs"));
    snap.forEach(d => {
      if (d.id === "pricing") {
        const data = d.data();
        if (data.rates) Object.assign(iraguRates, data.rates);
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

export function updateDynamicPricesUI() {
  document.querySelectorAll(".dyn-price").forEach(el => {
    const key = el.dataset.rateKey;
    if (key && iraguRates[key] !== undefined) {
      el.textContent = `₹${iraguRates[key].toLocaleString()}`;
    }
  });
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
    const userDoc = await getDoc(userDocRef);
    
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
export async function checkBookingConflicts(courtId, dateStr, startTime, endTime, skipBookingId = null) {
  try {
    if (!currentUser?.academyId) return true;
    const q = query(collection(db, "bookings"), where("date", "==", dateStr), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    let conflict = false;
    snap.forEach(d => {
      if (skipBookingId && d.id === skipBookingId) return;
      const b = d.data();
      if (b.court_id == courtId) {
        if (startTime < b.end_time && endTime > b.start_time) conflict = true;
      }
    });
    return conflict;
  } catch (err) {
    console.error("Conflict checking query error:", err);
    return true;
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
    
    // Hide settings nav for non-super-admins
    const showSettings = isSuperAdmin(user);
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
    await loadPricingRates();
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

