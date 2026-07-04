// js/settings.js — Admin Settings: Manage Academies (Super Admin) and Staff (Tenant Admin)
import {
  db, currentUser, authConfig, escapeHTML, showMsg, showInlineToast,
  setOnAuthReady, initApp, isSuperAdmin, isTenantAdmin, isStaff,
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, writeBatch,
  defaultSettings, tenantSettings
} from "./shared.js";

setOnAuthReady(async (user) => {
  if (!user || isStaff(user) || user.role === "GUEST") {
    window.location.href = "dashboard.html";
    return;
  }
  
  if (isSuperAdmin(user)) {
    document.getElementById("superAdminPanel").classList.remove("hidden");
    const guestTogglePanel = document.getElementById("guestTogglePanel");
    if (guestTogglePanel) guestTogglePanel.classList.remove("hidden");
    await loadAcademies();
    await loadSettingsData();
  } else if (isTenantAdmin(user)) {
    document.getElementById("tenantAdminPanel").classList.remove("hidden");
    await loadStaff();
  }
  
  if (isSuperAdmin(user) || isTenantAdmin(user)) {
    document.getElementById("tenantSettingsPanel").classList.remove("hidden");
    initAcademyProfile();
  }
});

// --- Academy Profile ---
function initAcademyProfile() {
  const pName = document.getElementById("progAcademyName");
  const pContact = document.getElementById("progContactNumber");
  const btnEdit = document.getElementById("btnEditProfile");
  const btnSave = document.getElementById("btnSaveProfile");
  
  if (pName && tenantSettings) {
    pName.value = tenantSettings.academy_name || tenantSettings.name || "";
  }
  if (pContact && tenantSettings && tenantSettings.contact_numbers && tenantSettings.contact_numbers.length > 0) {
    pContact.value = tenantSettings.contact_numbers[0];
  }
  
  if (btnEdit) {
    btnEdit.addEventListener("click", () => {
      if (pName.hasAttribute("readonly")) {
        pName.removeAttribute("readonly");
        pContact.removeAttribute("readonly");
        pName.focus();
        btnEdit.innerHTML = "✕ Cancel";
        btnSave.disabled = false;
      } else {
        pName.setAttribute("readonly", true);
        pContact.setAttribute("readonly", true);
        btnEdit.innerHTML = "✎ Edit";
        btnSave.disabled = true;
        // reset to original
        pName.value = tenantSettings.academy_name || tenantSettings.name || "";
        pContact.value = (tenantSettings.contact_numbers && tenantSettings.contact_numbers.length > 0) ? tenantSettings.contact_numbers[0] : "";
      }
    });
  }
  
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      btnSave.disabled = true;
      btnSave.textContent = "Saving...";
      try {
        const newName = pName.value.trim();
        const newContact = pContact.value.trim();
        await updateDoc(doc(db, "academies", currentUser.academyId), {
          academy_name: newName,
          name: newName,
          contact_numbers: newContact ? [newContact] : []
        });
        
        // Update local object
        tenantSettings.academy_name = newName;
        tenantSettings.name = newName;
        tenantSettings.contact_numbers = newContact ? [newContact] : [];
        
        pName.setAttribute("readonly", true);
        pContact.setAttribute("readonly", true);
        btnEdit.innerHTML = "✎ Edit";
        btnSave.textContent = "💾 Save Profile";
        showInlineToast("Academy profile updated successfully!", "success");
      } catch (err) {
        btnSave.textContent = "💾 Save Profile";
        btnSave.disabled = false;
        showMsg("settingsMessage", "Failed to update academy profile: " + err.message, "error");
      }
    });
  }
}

// --- Super Admin: Academies ---
async function loadAcademies() {
  if (!db) return;
  const list = document.getElementById("academiesList");
  list.innerHTML = '<div class="empty-list-msg">Loading academies...</div>';
  try {
    const snap = await getDocs(collection(db, "academies"));
    list.innerHTML = "";
    if (snap.empty) {
      list.innerHTML = '<div class="empty-list-msg">No academies configured yet.</div>';
      return;
    }
    for (const d of snap.docs) {
      const acad = d.data();
      
      let adminEmail = "No Admin Associated";
      try {
        const uq = query(collection(db, "users"), where("academyId", "==", d.id));
        const usnap = await getDocs(uq);
        if (!usnap.empty) {
          const adminDoc = usnap.docs.find(ud => ud.data().role === "TENANT_ADMIN");
          if (adminDoc) adminEmail = adminDoc.data().email;
        }
      } catch (e) {
        console.warn("Could not fetch admin email for", d.id);
      }

      const li = document.createElement("li");
      li.className = "whitelist-item";
      li.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <span class="whitelist-item-email" style="font-size:1.05rem;"><strong>${escapeHTML(acad.name)}</strong></span>
          <span style="font-size:0.8rem; color:var(--muted); font-family:var(--font-mono);">${escapeHTML(adminEmail)} &nbsp;|&nbsp; Created: ${new Date(acad.createdAt).toLocaleDateString()}</span>
        </div>
        <button class="btn-remove-whitelist" style="margin-left:auto;" title="Delete Academy">&times;</button>
      `;
      li.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteAcademy(d.id, acad.name, li));
      list.appendChild(li);
    }
  } catch (error) {
    console.error("Failed to load academies:", error);
    list.innerHTML = `<div class="empty-list-msg" style="color:var(--accent2)">Error loading academies.</div>`;
  }
}

async function handleCreateAcademy(e) {
  e.preventDefault();
  if (!isSuperAdmin(currentUser)) return;
  
  const nameInput = document.getElementById("newAcademyName");
  const emailInput = document.getElementById("newTenantAdminEmail");
  const academyName = nameInput.value.trim();
  const adminEmail = emailInput.value.trim().toLowerCase();
  
  if (!academyName || !adminEmail.includes("@")) return;

  try {
    // 1. Create Academy
    const acadRef = await addDoc(collection(db, "academies"), {
      ...defaultSettings,
      name: academyName,
      createdAt: Date.now()
    });
    
    // 2. Create Tenant Admin user using email as the document ID
    await setDoc(doc(db, "users", adminEmail), {
      email: adminEmail,
      role: "TENANT_ADMIN",
      academyId: acadRef.id,
      createdAt: Date.now()
    });
    
    nameInput.value = "";
    emailInput.value = "";
    showInlineToast(`Academy created successfully!`, "success");
    await loadAcademies();
  } catch (error) {
    showMsg("settingsMessage", "Failed to create academy: " + error.message, "error");
  }
}

async function handleDeleteAcademy(academyId, academyName, liEl) {
  if (!isSuperAdmin(currentUser)) return;
  
  const originalHtml = liEl.innerHTML;
  liEl.innerHTML = `
    <div class="fee-confirm-wrap" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
      <span class="fee-confirm-text" style="font-size: 0.8rem; font-weight: 600; color: var(--accent2);">Delete ${escapeHTML(academyName)}?</span>
      <div class="fee-confirm-btns" style="display: flex; gap: 0.4rem;">
        <button class="btn-confirm-yes" style="padding: 2px 8px; font-size: 0.75rem; background: var(--accent2); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">✓ Yes</button>
        <button class="btn-confirm-no" style="padding: 2px 8px; font-size: 0.75rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">✕ No</button>
      </div>
    </div>
  `;
  liEl.querySelector(".btn-confirm-no").addEventListener("click", () => {
    liEl.innerHTML = originalHtml;
    liEl.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteAcademy(academyId, academyName, liEl));
  });
  liEl.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    liEl.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Deleting...</span>';
    try {
      // 1. Delete all users belonging to this academy
      const q = query(collection(db, "users"), where("academyId", "==", academyId));
      const usersSnap = await getDocs(q);
      const batch = writeBatch(db);
      usersSnap.forEach(uDoc => {
        batch.delete(doc(db, "users", uDoc.id));
      });
      await batch.commit();

      // 2. Delete the academy itself
      await deleteDoc(doc(db, "academies", academyId));
      showInlineToast(`Deleted academy ${academyName} and associated users.`, "success");
      await loadAcademies();
    } catch (error) {
      showInlineToast(`Failed to delete: ${error.message}`, "error");
      await loadAcademies();
    }
  });
}

// --- Global Settings (Guest Login) ---
async function loadSettingsData() {
  if (!db) return;
  try {
    const configDoc = await getDoc(doc(db, "configs", "auth"));
    if (configDoc.exists()) {
      const data = configDoc.data();
      authConfig.allowGuestLogin = data.allowGuestLogin !== undefined ? data.allowGuestLogin : true;
    }
    const guestToggle = document.getElementById("guestLoginToggle");
    if (guestToggle) guestToggle.checked = authConfig.allowGuestLogin;
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

async function handleGuestToggle() {
  if (!currentUser || !isSuperAdmin(currentUser)) return;
  const toggle = document.getElementById("guestLoginToggle");
  authConfig.allowGuestLogin = toggle.checked;
  try {
    await setDoc(doc(db, "configs", "auth"), {
      allowGuestLogin: authConfig.allowGuestLogin
    }, { merge: true });
    showInlineToast(`Guest login ${authConfig.allowGuestLogin ? "enabled" : "disabled"}`, "success");
  } catch (error) {
    showInlineToast(`Failed: ${error.message}`, "error");
    toggle.checked = !toggle.checked;
  }
}

// --- Tenant Admin: Staff ---
async function loadStaff() {
  if (!db || !currentUser.academyId) return;
  const list = document.getElementById("staffList");
  list.innerHTML = '<div class="empty-list-msg">Loading staff...</div>';
  try {
    const q = query(collection(db, "users"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    list.innerHTML = "";
    // Filter for STAFF role client-side
    const staffDocs = [];
    snap.forEach(d => { if (d.data().role === "STAFF") staffDocs.push(d); });
    if (staffDocs.length === 0) {
      list.innerHTML = '<div class="empty-list-msg">No staff users configured yet.</div>';
      return;
    }
    staffDocs.forEach(d => {
      const staff = d.data();
      const li = document.createElement("li");
      li.className = "whitelist-item";
      li.innerHTML = `<span class="whitelist-item-email">${escapeHTML(staff.email)}</span>`;
      list.appendChild(li);
    });
  } catch (error) {
    console.error("Failed to load staff:", error);
    list.innerHTML = `<div class="empty-list-msg" style="color:var(--accent2)">Error loading staff.</div>`;
  }
}

async function handleAddStaff(e) {
  e.preventDefault();
  if (!isTenantAdmin(currentUser)) return;
  
  const emailInput = document.getElementById("newStaffEmail");
  const staffEmail = emailInput.value.trim().toLowerCase();
  
  if (!staffEmail || !staffEmail.includes("@")) return;

  try {
    await setDoc(doc(db, "users", staffEmail), {
      email: staffEmail,
      role: "STAFF",
      academyId: currentUser.academyId,
      createdAt: Date.now()
    });
    
    emailInput.value = "";
    showInlineToast(`Staff user added!`, "success");
    await loadStaff();
  } catch (error) {
    showMsg("settingsMessage", "Failed to add staff: " + error.message, "error");
  }
}

function setupSettingsListeners() {
  const addSubmit = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("submit", fn); };
  addSubmit("createAcademyForm", handleCreateAcademy);
  addSubmit("staffForm", handleAddStaff);
  
  const guestToggle = document.getElementById("guestLoginToggle");
  if (guestToggle) guestToggle.addEventListener("change", handleGuestToggle);
}

function bootstrap() {
  setupSettingsListeners();
  initApp();
}
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
