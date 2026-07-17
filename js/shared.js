// js/shared.js — Core shared module for all pages
// Firebase init, auth, theme, toast, utilities, data loaders

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDocs, getDoc, getDocFromServer, setDoc,
  updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp, enableIndexedDbPersistence
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

export function format12Hour(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${String(hour).padStart(2, '0')}:${min} ${ampm}`;
}

export function parse12HourTo24Hour(timeStr) {
  if (!timeStr) return "";
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return timeStr;
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const ampm = (match[3] || "").toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === "string" && dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length >= 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2].substring(0, 2), 10));
    }
  }
  return new Date(dateStr);
}

export function addOneMonth(dateStr) {
  if (!dateStr) return "";
  const d = parseLocalDate(dateStr);
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

export let currentHierarchy = {};

export function getBookingHierarchy() {
  if (!tenantSettings) return {};

  const hierarchy = {};

  const addNode = (type, category, period) => {
    if (!hierarchy[type]) hierarchy[type] = {};
    if (!hierarchy[type][category]) hierarchy[type][category] = [];
    if (period && !hierarchy[type][category].includes(period)) {
      hierarchy[type][category].push(period);
    }
  };

  // 1. Hourly Slots -> Spot booking & Guest Play
  if (tenantSettings.hourly_slots) {
    tenantSettings.hourly_slots.forEach(s => {
      if (!s) return;
      if (s.type && s.type.includes("Hourly Slot")) addNode("Spot booking", "Hourly Slot", "No Need");
      else if (s.type) addNode("Guest Play", s.type, "No Need");
    });
  }

  // 2. Memberships -> Members & Group/Lease
  if (tenantSettings.membership_programs) {
    tenantSettings.membership_programs.forEach(m => {
      if (!m) return;
      const type = (m.type && m.type.toLowerCase() === 'group') ? "Group/Lease" : "Members";
      const cat = (m.type && m.type.toLowerCase() === 'group') ? "Group Members" : "Individual";
      addNode(type, cat, m.duration_days);
    });
  }

  // 3. Coaching Schedules (Fallbacks for batches that have no fee structure yet)
  if (tenantSettings.coaching_schedule) {
    tenantSettings.coaching_schedule.forEach(c => {
      if (!c) return;
      const cat = c.category || "Unknown";
      const type = cat.toLowerCase().includes("advance") ? "Advance Training" : "Coaching";

      // Only add periods from the schedule if this category has NO fee structure defined
      const hasFee = tenantSettings.fee_structure && tenantSettings.fee_structure.some(f => 
        f && (f.program_name || "").toLowerCase().includes(cat.toLowerCase())
      );
      if (!hasFee) {
        addNode(type, cat, c.days || "No Need");
      }
    });
  }

  // 4. Coaching Fee Structure (Handles Kids, Women, Adults, Advance, PT, Tournaments, and any custom programs)
  if (tenantSettings.fee_structure) {
    tenantSettings.fee_structure.forEach(f => {
      if (!f) return;
      const pName = f.program_name || "";
      const pLower = pName.toLowerCase();

      let type, cat;
      if (pLower.includes("personal training")) {
        type = "Personal training";
        cat = pName;
      } else if (pLower.includes("advance")) {
        type = "Advance Training";
        cat = pName;
      } else if (pLower.includes("tournament")) {
        type = "Tournament";
        cat = pName;
      } else {
        type = "Coaching";
        cat = pName;
      }

      if (f.pricing_variants && f.pricing_variants.length > 0) {
        f.pricing_variants.forEach(p => {
          if (p) addNode(type, cat, p.frequency);
        });
      } else {
        addNode(type, cat, "No Need");
      }
    });
  }

  // 5. Fallback for completely empty tenants (if they deleted all default programs)
  if (Object.keys(hierarchy).length === 0) {
    addNode("Court Rental", "Standard Booking", "No Need");
  }

  return hierarchy;
}

export function populateBookingDropdowns(typeSelectId, categorySelectId, allowedTypes = null) {
  try {
    const typeSelect = document.getElementById(typeSelectId);
    if (!typeSelect || !tenantSettings) return;

    currentHierarchy = getBookingHierarchy();

    // Populate Type Dropdown if empty
    if (typeSelect.options.length <= 1) {
      typeSelect.innerHTML = '<option value="" disabled selected>Select Booking Type</option>';
      Object.keys(currentHierarchy).forEach(type => {
        if (allowedTypes && !allowedTypes.includes(type)) return;
        typeSelect.innerHTML += `<option value="${type}">${type}</option>`;
      });
    }
  } catch (error) {
    alert("Error populating dropdowns: " + error.message);
    console.error("Dropdown error:", error);
  }
}

export function resolvePlanKey(type, category, period, gender) {
  if (!tenantSettings) return null;

  if (type === "Members" || type === "Group/Lease") {
    if (tenantSettings.membership_programs) {
      const targetType = (type === "Group/Lease") ? "group" : "individual";
      // Try to find exact match including gender notes
      let match = tenantSettings.membership_programs.find(m =>
        (m.type && m.type.toLowerCase() === targetType) &&
        m.duration_days === period &&
        m.special_notes === gender
      );
      // Fallback to match without gender
      if (!match) {
        match = tenantSettings.membership_programs.find(m =>
          (m.type && m.type.toLowerCase() === targetType) &&
          m.duration_days === period
        );
      }
      // Fallback to any match of same type
      if (!match) {
        match = tenantSettings.membership_programs.find(m =>
          m.type && m.type.toLowerCase() === targetType
        );
      }
      if (match) return match.key;
    }
  }

  if (type === "Coaching" || type === "Advance Training" || type === "Personal training" || type === "Tournament") {
    if (tenantSettings.fee_structure) {
      for (const prog of tenantSettings.fee_structure) {
        // Match program by category name (partial match, case-insensitive)
        const progLower = prog.program_name.toLowerCase();
        const catLower = (category || "").toLowerCase();
        if (progLower.includes(catLower) || catLower.includes(progLower.split(" ")[0])) {
          // Try exact period match first
          let v = (prog.pricing_variants || []).find(x => x.frequency === period);
          // Fallback to first variant if period doesn't match
          if (!v && prog.pricing_variants && prog.pricing_variants.length > 0) {
            v = prog.pricing_variants[0];
          }
          if (v) return v.key;
        }
      }
      // Broader search: try matching category against any program name
      for (const prog of tenantSettings.fee_structure) {
        if (prog.pricing_variants) {
          const v = prog.pricing_variants.find(x => x.frequency === period);
          if (v) return v.key;
        }
      }
    }
  }
  return null;
}

export function populateCategoryDropdown(typeSelectId, categorySelectId) {
  const typeSelect = document.getElementById(typeSelectId);
  const catSelect = document.getElementById(categorySelectId);
  if (!typeSelect || !catSelect) return;

  const currentType = typeSelect.value;
  catSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';

  if (currentType && currentHierarchy[currentType]) {
    Object.keys(currentHierarchy[currentType]).forEach(cat => {
      catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  }
}

export function populatePeriodDropdown(typeSelectId, categorySelectId, periodSelectId) {
  const typeSelect = document.getElementById(typeSelectId);
  const catSelect = document.getElementById(categorySelectId);
  const perSelect = document.getElementById(periodSelectId);
  if (!typeSelect || !catSelect || !perSelect) return;

  const currentType = typeSelect.value;
  const currentCat = catSelect.value;
  perSelect.innerHTML = '<option value="" disabled selected>Select Period</option>';

  if (currentType && currentCat && currentHierarchy[currentType] && currentHierarchy[currentType][currentCat]) {
    const periods = currentHierarchy[currentType][currentCat];
    if (periods.length > 0) {
      periods.forEach(p => {
        perSelect.innerHTML += `<option value="${p}">${p}</option>`;
      });
    } else {
      perSelect.innerHTML += `<option value="No Need">No Need</option>`;
    }
  }
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

      const toArr = (val, def) => {
        if (!val) return def;
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return Object.values(val);
        return def;
      };

      // Inject missing template arrays for backward compatibility and UX, and handle Firebase object-array conversion
      tenantSettings.membership_programs = toArr(tenantSettings.membership_programs, defaultSettings.membership_programs);
      tenantSettings.hourly_slots = toArr(tenantSettings.hourly_slots, defaultSettings.hourly_slots);
      tenantSettings.coaching_schedule = toArr(tenantSettings.coaching_schedule, defaultSettings.coaching_schedule);
      tenantSettings.fee_structure = toArr(tenantSettings.fee_structure, defaultSettings.fee_structure);
      tenantSettings.contact_numbers = toArr(tenantSettings.contact_numbers, []);
      if (!tenantSettings.operating_hours) tenantSettings.operating_hours = defaultSettings.operating_hours;

      // In-memory migration for existing users
      if (tenantSettings.hourly_slots) {
        tenantSettings.hourly_slots.forEach(s => {
          if (s && s.type && (s.type.includes("Guest") || s.type.includes("Spot Booking") || s.type.includes("Hourly Slot Peak"))) {
            if (s.type.includes("Peak")) {
              s.type = s.type.includes("Non") ? "Guest play (Non Peak hours)" : "Guest play (Peak hours)";
            } else if (s.type === "Guest" || s.type === "Spot Booking") {
              s.type = "Hourly Slot";
            }
          }
        });
      }

      // Check for missing mandatory onboarding fields (contact numbers are required)
      if (!tenantSettings.contact_numbers || tenantSettings.contact_numbers.length === 0) {
        if (!window.location.pathname.includes("dashboard")) {
          window.location.href = "/dashboard";
          return;
        }
        document.dispatchEvent(new Event('setup_required'));
      }

    } else {
      // First-time login: missing settings
      tenantSettings = null;
      if (!window.location.pathname.includes("dashboard")) {
        window.location.href = "/dashboard";
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

      // Auto-provision new Google users as TENANT_ADMIN with a generated academyId
      // This allows the onboarding modal to appear on the dashboard
      const generatedAcademyId = "academy_" + userEmail.replace(/[^a-z0-9]/gi, '_') + "_" + Date.now();
      const newUserData = {
        email: userEmail,
        role: "TENANT_ADMIN",
        academyId: generatedAcademyId,
        createdAt: Date.now()
      };
      await setDoc(userDocRef, newUserData);
      user.role = "TENANT_ADMIN";
      user.academyId = generatedAcademyId;
      return true;
    }

    // User found via email document ID
    const userData = userDoc.data();
    
    // Normalize academyRoles
    const academyRoles = userData.academyRoles || {};
    if (userData.academyId && !academyRoles[userData.academyId]) {
      academyRoles[userData.academyId] = userData.role;
    }

    // Auto-populate all academies for SUPER_ADMIN so they can switch context
    window.academyNamesCache = window.academyNamesCache || {};
    if (userData.role === "SUPER_ADMIN") {
      try {
        const acadsSnap = await getDocs(collection(db, "academies"));
        acadsSnap.forEach(d => {
          academyRoles[d.id] = "SUPER_ADMIN";
          if (d.data().name) window.academyNamesCache[d.id] = d.data().name;
        });
      } catch (err) {
        console.error("Failed to load academies for SUPER_ADMIN:", err);
      }
    }

    // Validate that the academy still exists (prevents orphaned users from logging in)
    const hasRole = userData.role === "TENANT_ADMIN" || userData.role === "STAFF" || userData.role === "COACH";
    if (hasRole || Object.keys(academyRoles).length > 0) {
      
      // Determine default academy to load
      let targetAcademyId = userData.academyId || userData.defaultAcademyId;
      if (!targetAcademyId && Object.keys(academyRoles).length > 0) {
         targetAcademyId = Object.keys(academyRoles)[0];
      }

      if (!targetAcademyId) {
        console.warn("User has no assigned academy. Access denied.");
        await deleteDoc(userDocRef);
        return false;
      }
      try {
        const acadDoc = await getDocFromServer(doc(db, "academies", targetAcademyId));
        if (!acadDoc.exists()) {
          if (userData.role === "TENANT_ADMIN") {
            user.role = userData.role;
            user.academyId = targetAcademyId;
            user.academyRoles = academyRoles;
            return true;
          }
          console.warn("Academy has been deleted. Access denied for orphaned user.");
          await deleteDoc(userDocRef);
          return false;
        }
      } catch (err) {
        console.error("Error verifying academy existence:", err);
        return false;
      }
      user.academyId = targetAcademyId;
    } else {
      user.academyId = userData.academyId;
    }

    user.role = userData.role;
    user.academyRoles = academyRoles;
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

export function isCoach(user) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "TENANT_ADMIN") return true; // Inherits coach
  if (user.academyRoles && user.academyId && user.academyRoles[user.academyId] === "COACH") return true;
  return user.role === "COACH";
}

export function isStrictCoach(user) {
  return user && user.role === "COACH";
}

// ── Booking Conflict Check ──────────────────────────────────
// Returns false if no conflict, or an error string if there is a conflict.
// ── Helper to parse days from text ────────────────────────
export function parseDays(text) {
  if (!text) return [0, 1, 2, 3, 4, 5, 6];
  const t = text.toLowerCase();

  if (t.includes("weekend")) return [0, 6];
  if (t.includes("weekday")) return [1, 2, 3, 4, 5];

  const days = [];
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  // Check for ranges like "monday - wednesday" or "mon to wed"
  const rangeMatch = t.match(/(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*(?:-|to)\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/);
  if (rangeMatch) {
    let startIdx = dayNames.findIndex(d => rangeMatch[1].startsWith(d));
    let endIdx = dayNames.findIndex(d => rangeMatch[2].startsWith(d));
    if (startIdx !== -1 && endIdx !== -1) {
      if (endIdx < startIdx) endIdx += 7;
      for (let i = startIdx; i <= endIdx; i++) {
        days.push(i % 7);
      }
    }
  } else {
    // Check for individual days
    dayNames.forEach((d, idx) => {
      if (t.includes(d)) days.push(idx);
    });
  }

  if (days.length > 0) return [...new Set(days)];

  // Fallbacks for common generic period names (when specific days aren't named)
  if (t.includes("7 day") || t.includes("7-day") || t.includes("seven day")) return [0, 1, 2, 3, 4, 5, 6];
  if (t.includes("6 day") || t.includes("6-day") || t.includes("six day")) return [1, 2, 3, 4, 5, 6]; // Mon-Sat
  if (t.includes("5 day") || t.includes("5-day") || t.includes("five day")) return [1, 2, 3, 4, 5]; // Mon-Fri
  if (t.includes("4 day") || t.includes("4-day") || t.includes("four day")) return [1, 2, 3, 4]; // Mon-Thu
  if (t.includes("3 day") || t.includes("3-day") || t.includes("three day")) return [1, 3, 5]; // Mon, Wed, Fri
  if (t.includes("2 day") || t.includes("2-day") || t.includes("two day")) return [1, 2]; // Mon, Tue
  if (t.includes("1 day") || t.includes("1-day") || t.includes("one day")) return [0]; // Sunday default

  return [0, 1, 2, 3, 4, 5, 6];
}

export async function checkBookingConflicts(courtId, dateStr, startTime, endTime, bookingType, category) {
  try {
    // Query by academyId only (auto-indexed), filter date+court client-side
    const q = query(collection(db, "bookings"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);

    const overlapping = [];
    snap.forEach(d => {
      const b = d.data();
      if (b.status === "cancelled") return;
      if (b.date === dateStr && b.court_id == courtId && startTime < b.end_time && endTime > b.start_time) {
        overlapping.push(b);
      }
    });

    // ── Rule: Coaching — Unlimited students, no conflict ──
    if (bookingType === "Coaching") {
      return false;
    }

    // ── Rule: Exclusive types — Spot Booking, Advance Training, Personal Training, Tournament ──
    // No other booking should exist on the same court+slot
    if (bookingType === "Spot booking" || bookingType === "Advance Training" || bookingType === "Personal training" || bookingType === "Tournament") {
      if (overlapping.length > 0) {
        return `Court is unavailable: This time slot is already booked. ${bookingType} requires exclusive court access.`;
      }
      return false;
    }

    // Check if any exclusive booking already holds this slot
    const hasExclusive = overlapping.some(b =>
      b.booking_type === "Spot booking" || b.booking_type === "Advance Training" || b.booking_type === "Personal training"
    );
    if (hasExclusive) {
      return "Court is unavailable: An exclusive booking (Spot/Advance Training/Personal Training) already holds this slot.";
    }

    // ── Rule: Members — Max 6 per court per slot, no other booking types allowed ──
    if (bookingType === "Members") {
      const memberOverlaps = overlapping.filter(b => b.booking_type === "Members");
      if (memberOverlaps.length >= 6) {
        return "Court is unavailable: Maximum capacity of 6 members reached for this slot.";
      }
      return false;
    }

    // ── Rule: Guest Play — Must join an existing Member booking on same court+slot ──
    if (bookingType === "Guest Play") {
      const hasMemberSlot = overlapping.some(b => b.booking_type === "Members");
      if (!hasMemberSlot) {
        return "Guest Play requires an existing Member booking on this court and time slot. The guest must join alongside a member.";
      }
      return false;
    }

    // ── Rule: Group/Lease — No member count restriction ──
    if (bookingType === "Group/Lease") {
      return false;
    }

    // Default: allow
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
    if (isLoginPage) { 
      if (isStrictCoach(user)) {
        window.location.href = "coach.html";
      } else {
        window.location.href = "dashboard.html";
      }
      return; 
    }
    // Update header UI
    const header = document.getElementById("appHeader");
    
    // Multi-Academy Switcher
    const academyRolesKeys = Object.keys(user.academyRoles || {});
    if (academyRolesKeys.length > 1) {
      let switcher = document.getElementById("academySwitcher");
      if (!switcher) {
        switcher = document.createElement("select");
        switcher.id = "academySwitcher";
        switcher.className = "academy-switcher";
        switcher.style.cssText = "margin-right:1rem; padding:4px; border-radius:4px; background:var(--surface2); color:var(--text); border:1px solid var(--border);";
        switcher.addEventListener("change", (e) => switchAcademy(e.target.value));
        const headerRight = document.querySelector(".header-right");
        if (headerRight) headerRight.insertBefore(switcher, headerRight.firstChild);
      }
      switcher.innerHTML = "";
      // Fetch names asynchronously, fallback to ID initially
      window.academyNamesCache = window.academyNamesCache || {};
      const populateNames = async () => {
        for (const acadId of academyRolesKeys) {
          const opt = document.createElement("option");
          opt.value = acadId;
          
          if (window.academyNamesCache[acadId]) {
            opt.textContent = window.academyNamesCache[acadId];
          } else {
            opt.textContent = acadId.replace("academy_", "Academy ");
            try {
              const docSnap = await getDoc(doc(db, "academies", acadId));
              if (docSnap.exists() && docSnap.data().name) {
                window.academyNamesCache[acadId] = docSnap.data().name;
                opt.textContent = docSnap.data().name;
              }
            } catch(e) {
              console.warn("Failed to fetch academy name for", acadId);
            }
          }
          if (acadId === user.academyId) opt.selected = true;
          switcher.appendChild(opt);
        }
      };
      populateNames();
    }

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

    // Show/hide Coach nav based on isCoach or isStaff
    const showCoach = isCoach(user) || isStaff(user);
    const navCoach = document.getElementById("navCoach");
    if (navCoach) navCoach.classList.toggle("hidden", !showCoach);
    const bottomNavCoach = document.getElementById("bottomNavCoach");
    if (bottomNavCoach) bottomNavCoach.classList.toggle("hidden", !showCoach);

    // Hide standard pages for strict coaches
    const strictCoach = isStrictCoach(user);
    ['navDashboard', 'navSchedule', 'navMembers', 'navPrograms',
     'bottomNavDashboard', 'bottomNavSchedule', 'bottomNavMembers', 'bottomNavPrograms'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", strictCoach);
    });

    // Load core data, then call page-specific ready handler
    await loadTenantSettings();
    await loadCourts();

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

export async function switchAcademy(newAcademyId) {
  if (!currentUser || !currentUser.academyRoles || !currentUser.academyRoles[newAcademyId]) return;
  try {
    const userDocRef = doc(db, "users", currentUser.email);
    await updateDoc(userDocRef, { defaultAcademyId: newAcademyId });
    window.location.reload();
  } catch (err) {
    console.error("Failed to switch academy", err);
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
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Multiple tabs open, offline persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence");
    }
  });
  auth = getAuth(app);
  onAuthStateChanged(auth, handleAuthStateChange);
  setupSharedListeners();
}

// ── Bulk Monthly Cancellation Backend Function ─────────────
export async function bulkCancelMonthlyBookings({ memberId, groupId, yearMonth, cancelledBy, reason = "Admin Bulk Cancellation" }) {
  if (!db) throw new Error("Database not initialized.");
  if (!yearMonth || (!memberId && !groupId)) {
    throw new Error("YearMonth and either Member ID or Group ID are required.");
  }

  const startDate = `${yearMonth}-01`;
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

  const bookingsRef = collection(db, "bookings");
  let snapshot;

  try {
    // Query by academyId only (auto-indexed), filter all other fields client-side
    const q = query(bookingsRef, where("academyId", "==", currentUser.academyId));
    const allSnap = await getDocs(q);
    const filteredDocs = [];
    allSnap.forEach(d => {
      const data = d.data();
      const matchDate = data.date >= startDate && data.date <= endDate;
      const matchMember = memberId ? (data.memberId === memberId) : true;
      const matchGroup = groupId ? (data.category === groupId) : true;
      const matchStatus = data.status !== "cancelled";
      if (matchDate && matchMember && matchGroup && matchStatus) {
        filteredDocs.push(d);
      }
    });
    snapshot = { docs: filteredDocs, empty: filteredDocs.length === 0 };
  } catch (err) {
    console.error("Bulk cancel query failed:", err);
    throw new Error("Failed to query bookings for cancellation.");
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

// ── PWA Service Worker Registration ─────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      
      // Check for waiting updates (Stale-While-Revalidate pattern)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available, show prompt
            showUpdatePrompt(newWorker);
          }
        });
      });
    }).catch((err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });

  // Handle reload when new SW activates
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      window.location.reload();
      refreshing = true;
    }
  });
}

function showUpdatePrompt(newWorker) {
  // Create a minimal toast for the update prompt
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'var(--accent, #3b82f6)';
  toast.style.color = '#fff';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
  toast.style.zIndex = '9999';
  toast.style.cursor = 'pointer';
  toast.style.fontFamily = 'var(--font-family, sans-serif)';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = 'bold';
  toast.style.textAlign = 'center';
  toast.innerHTML = `A new version is available!<br><span style="font-size: 12px; font-weight: normal; opacity: 0.8;">Click to refresh and update.</span>`;
  
  toast.addEventListener('click', () => {
    newWorker.postMessage({ type: 'SKIP_WAITING' });
  });

  document.body.appendChild(toast);
}

// ── PWA Explicit Install Button Logic ────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  // We do NOT prevent default, so Chrome can still show the native prompt
  deferredPrompt = e;
  
  // Also reveal our explicit install button if we are on the login screen
  const installBtn = document.getElementById('btnExplicitInstall');
  if (installBtn) {
    installBtn.classList.remove('hidden');
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
        installBtn.classList.add('hidden');
      }
    });
  }
});

// WhatsApp Integration Helper
export function openWhatsApp(phone, message) {
  if (!phone) return;
  // Strip spaces, dashes, etc.
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanPhone) return;
  const encodedMsg = encodeURIComponent(message || '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
}
