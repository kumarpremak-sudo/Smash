// js/settings.js — Admin Settings: Manage Academies (Super Admin) and Staff (Tenant Admin)
import {
  db, currentUser, authConfig, escapeHTML, showMsg, showInlineToast,
  setOnAuthReady, initApp, isSuperAdmin, isTenantAdmin, isStaff,
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, writeBatch,
  defaultSettings, tenantSettings, isStrictCoach
} from "./shared.js";

setOnAuthReady(async (user) => {
  if (!user || isStaff(user) || isStrictCoach(user) || user.role === "GUEST") {
    // If strict coach somehow navigated here, send them to coach hub.
    // Otherwise send to dashboard.
    window.location.href = isStrictCoach(user) ? "coach.html" : "dashboard.html";
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
  
  if (isTenantAdmin(user)) {
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
  const staffProgramEditToggle = document.getElementById("staffProgramEditToggle");
  
  if (staffProgramEditToggle && tenantSettings) {
    staffProgramEditToggle.checked = tenantSettings.allow_staff_program_edit === true;
    staffProgramEditToggle.addEventListener("change", async (e) => {
      try {
        const newVal = e.target.checked;
        await updateDoc(doc(db, "academies", currentUser.academyId), {
          allow_staff_program_edit: newVal
        });
        tenantSettings.allow_staff_program_edit = newVal;
        showInlineToast(`Staff program editing ${newVal ? 'enabled' : 'disabled'}!`, "success");
      } catch (err) {
        e.target.checked = !e.target.checked; // Revert
        showMsg("settingsMessage", "Failed to update toggle: " + err.message, "error");
      }
    });
  }
  
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

      const acadName = acad.name || acad.academy_name || d.id;
      let dateStr = "Unknown";
      if (acad.createdAt) {
        if (typeof acad.createdAt.toMillis === 'function') dateStr = new Date(acad.createdAt.toMillis()).toLocaleDateString();
        else dateStr = new Date(acad.createdAt).toLocaleDateString();
      }

      const li = document.createElement("li");
      li.className = "whitelist-item";
      li.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <span class="whitelist-item-email" style="font-size:1.05rem;"><strong>${escapeHTML(acadName)}</strong></span>
          <span style="font-size:0.8rem; color:var(--muted); font-family:var(--font-mono);">${escapeHTML(adminEmail)} &nbsp;|&nbsp; Created: ${dateStr}</span>
        </div>
        <div style="display:flex; gap:0.5rem; margin-left:auto; align-items:center;">
          <button class="btn btn-sm btn-outline btn-purge-academy" title="Purge Tenant Data" style="color:var(--accent2); border-color:var(--accent2); padding:2px 8px; font-size:0.75rem;">🧹 Purge Data</button>
          <button class="btn-remove-whitelist" title="Delete Academy">&times;</button>
        </div>
      `;
      li.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteAcademy(d.id, acadName, li));
      li.querySelector(".btn-purge-academy").addEventListener("click", () => handlePurgeAcademy(d.id, acadName, li));
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
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!academyName) {
    showMsg("settingsMessage", "Please enter an academy name.", "error");
    return;
  }
  if (!emailRegex.test(adminEmail)) {
    showMsg("settingsMessage", "Please enter a valid admin email address.", "error");
    return;
  }

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
    liEl.querySelector(".btn-purge-academy").addEventListener("click", () => handlePurgeAcademy(academyId, academyName, liEl));
  });
  liEl.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    liEl.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Deleting...</span>';
    try {
      // 1. Process all users belonging to this academy
      const q = query(collection(db, "users"), where("academyId", "==", academyId));
      const usersSnap = await getDocs(q);
      const batch = writeBatch(db);
      usersSnap.forEach(uDoc => {
        const uData = uDoc.data();
        const roles = uData.academyRoles || {};
        delete roles[academyId];
        
        if (Object.keys(roles).length === 0) {
          batch.delete(doc(db, "users", uDoc.id));
        } else {
          // If they have other academies, preserve the user account
          const nextAcademyId = Object.keys(roles)[0];
          batch.update(doc(db, "users", uDoc.id), { academyRoles: roles, academyId: nextAcademyId });
        }
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

async function handlePurgeAcademy(academyId, academyName, liEl) {
  if (!isSuperAdmin(currentUser)) return;
  
  const originalHtml = liEl.innerHTML;
  liEl.innerHTML = `
    <div class="fee-confirm-wrap" style="width: 100%; display: flex; flex-direction: column; gap: 0.5rem;">
      <span class="fee-confirm-text" style="font-size: 0.8rem; font-weight: 600; color: var(--accent2);">⚠️ PURGE all operational data (bookings, members, etc.) for ${escapeHTML(academyName)}? This cannot be undone.</span>
      <div class="fee-confirm-btns" style="display: flex; gap: 0.4rem; justify-content: flex-end;">
        <button class="btn-confirm-yes" style="padding: 2px 8px; font-size: 0.75rem; background: var(--accent2); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">✓ Yes, Purge</button>
        <button class="btn-confirm-no" style="padding: 2px 8px; font-size: 0.75rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">✕ Cancel</button>
      </div>
    </div>
  `;
  liEl.querySelector(".btn-confirm-no").addEventListener("click", () => {
    liEl.innerHTML = originalHtml;
    liEl.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteAcademy(academyId, academyName, liEl));
    liEl.querySelector(".btn-purge-academy").addEventListener("click", () => handlePurgeAcademy(academyId, academyName, liEl));
  });
  liEl.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    liEl.innerHTML = '<span style="color:var(--accent2);font-size:0.8rem;">Purging data, please wait...</span>';
    try {
      const collectionsToPurge = ["bookings", "members", "enquiries", "courts", "programs", "coaching", "attendance", "hourly_slots"];
      const batch = writeBatch(db);
      let deleteCount = 0;
      
      for (const colName of collectionsToPurge) {
        const q = query(collection(db, colName), where("academyId", "==", academyId));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
          batch.delete(doc(db, colName, docSnap.id));
          deleteCount++;
        });
      }
      
      const acadRef = doc(db, "academies", academyId);
      batch.update(acadRef, {
        membership_programs: defaultSettings.membership_programs,
        hourly_slots: defaultSettings.hourly_slots,
        coaching_schedule: defaultSettings.coaching_schedule,
        fee_structure: defaultSettings.fee_structure
      });
      
      await batch.commit();
      
      showInlineToast(`Purged ${deleteCount} records for ${academyName} and reset programs.`, "success");
      await loadAcademies();
    } catch (error) {
      showInlineToast(`Failed to purge data: ${error.message}`, "error");
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
  list.innerHTML = '<div class="empty-list-msg">Loading staff & coaches...</div>';
  try {
    const q = query(collection(db, "users"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    list.innerHTML = "";
    // Filter for STAFF or COACH role client-side based on academyRoles or legacy role
    const staffDocs = [];
    snap.forEach(d => { 
      const u = d.data();
      const roles = u.academyRoles || {};
      if (u.role === "STAFF" || u.role === "COACH" || roles[currentUser.academyId] === "STAFF" || roles[currentUser.academyId] === "COACH") {
        staffDocs.push(d); 
      }
    });
    if (staffDocs.length === 0) {
      list.innerHTML = '<div class="empty-list-msg">No staff or coaches configured yet.</div>';
      return;
    }
    staffDocs.forEach(d => {
      const staff = d.data();
      const roles = staff.academyRoles || {};
      const displayRole = roles[currentUser.academyId] || staff.role;
      const li = document.createElement("li");
      li.className = "whitelist-item";
      li.innerHTML = `
        <div style="display:flex; flex-direction:column;">
          <span class="whitelist-item-email">${escapeHTML(staff.email)}</span>
          <span style="font-size:0.75rem; color:var(--accent); font-weight:600;">${escapeHTML(displayRole)}</span>
        </div>
        <div class="whitelist-actions" style="display:flex; gap:0.5rem; margin-left:auto;">
          <button class="btn-remove-whitelist" title="Revoke Access">&times;</button>
        </div>
      `;
      li.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteStaff(staff.email, li));
      list.appendChild(li);
    });
  } catch (error) {
    console.error("Failed to load staff:", error);
    list.innerHTML = `<div class="empty-list-msg" style="color:var(--accent2)">Error loading staff/coaches.</div>`;
  }
}

async function handleDeleteStaff(staffEmail, liEl) {
  if (!isTenantAdmin(currentUser)) return;
  
  const originalHtml = liEl.innerHTML;
  liEl.innerHTML = `
    <div class="fee-confirm-wrap" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
      <span class="fee-confirm-text" style="font-size: 0.8rem; font-weight: 600; color: var(--accent2);">Delete ${escapeHTML(staffEmail)}?</span>
      <div class="fee-confirm-btns" style="display: flex; gap: 0.4rem;">
        <button class="btn-confirm-yes" style="padding: 2px 8px; font-size: 0.75rem; background: var(--accent2); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">✓ Yes</button>
        <button class="btn-confirm-no" style="padding: 2px 8px; font-size: 0.75rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">✕ No</button>
      </div>
    </div>
  `;
  liEl.querySelector(".btn-confirm-no").addEventListener("click", () => {
    liEl.innerHTML = originalHtml;
    liEl.querySelector(".btn-edit-staff").addEventListener("click", () => handleEditStaff(staffEmail, liEl));
    liEl.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteStaff(staffEmail, liEl));
  });
  liEl.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    liEl.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Revoking access...</span>';
    try {
      const userDocRef = doc(db, "users", staffEmail);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const roles = uData.academyRoles || {};
        delete roles[currentUser.academyId];
        
        // If no roles left, delete the user entirely
        if (Object.keys(roles).length === 0) {
          await deleteDoc(userDocRef);
        } else {
          await updateDoc(userDocRef, { academyRoles: roles });
        }
      }
      showInlineToast(`Revoked access for ${staffEmail}.`, "success");
      await loadStaff();
    } catch (error) {
      showInlineToast(`Failed to revoke access: ${error.message}`, "error");
      await loadStaff();
    }
  });
}

async function handleEditStaff(oldEmail, liEl) {
  if (!isTenantAdmin(currentUser)) return;
  
  const originalHtml = liEl.innerHTML;
  liEl.innerHTML = `
    <div style="display:flex; gap:0.5rem; width:100%; align-items:center;">
      <input type="email" class="edit-staff-input" value="${escapeHTML(oldEmail)}" style="flex:1; padding:0.25rem 0.5rem; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface2); color:var(--text);" />
      <button class="btn-save-edit" style="padding: 2px 8px; font-size: 0.75rem; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">Save</button>
      <button class="btn-cancel-edit" style="padding: 2px 8px; font-size: 0.75rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">Cancel</button>
    </div>
  `;
  
  const inputEl = liEl.querySelector(".edit-staff-input");
  inputEl.focus();
  
  liEl.querySelector(".btn-cancel-edit").addEventListener("click", () => {
    liEl.innerHTML = originalHtml;
    liEl.querySelector(".btn-edit-staff").addEventListener("click", () => handleEditStaff(oldEmail, liEl));
    liEl.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteStaff(oldEmail, liEl));
  });
  
  liEl.querySelector(".btn-save-edit").addEventListener("click", async () => {
    const newEmail = inputEl.value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showInlineToast("Please enter a valid email address.", "error");
      return;
    }
    if (newEmail === oldEmail) {
      liEl.innerHTML = originalHtml;
      liEl.querySelector(".btn-edit-staff").addEventListener("click", () => handleEditStaff(oldEmail, liEl));
      liEl.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleDeleteStaff(oldEmail, liEl));
      return;
    }
    
    liEl.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Saving...</span>';
    try {
      // 1. Get old staff doc
      const oldDocRef = doc(db, "users", oldEmail);
      const oldDocSnap = await getDoc(oldDocRef);
      if (!oldDocSnap.exists()) throw new Error("Staff user not found.");
      
      const staffData = oldDocSnap.data();
      staffData.email = newEmail;
      
      const batch = writeBatch(db);
      // 2. Create new doc
      batch.set(doc(db, "users", newEmail), staffData);
      // 3. Delete old doc
      batch.delete(oldDocRef);
      
      await batch.commit();
      
      showInlineToast(`Updated staff email.`, "success");
      await loadStaff();
    } catch (error) {
      showInlineToast(`Failed to update: ${error.message}`, "error");
      await loadStaff();
    }
  });
}


async function handleAddStaff(e) {
  e.preventDefault();
  if (!isTenantAdmin(currentUser)) return;
  
  const emailInput = document.getElementById("newStaffEmail");
  const staffEmail = emailInput.value.trim().toLowerCase();
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(staffEmail)) {
    showMsg("settingsMessage", "Please enter a valid staff email address.", "error");
    return;
  }

  const roleSelect = document.getElementById("newStaffRole");
  const selectedRole = roleSelect ? roleSelect.value : "STAFF";
  
  try {
    const userDocRef = doc(db, "users", staffEmail);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      // User exists, update academyRoles
      const data = userSnap.data();
      const academyRoles = data.academyRoles || {};
      academyRoles[currentUser.academyId] = selectedRole;
      await updateDoc(userDocRef, { academyRoles });
    } else {
      // New user
      await setDoc(userDocRef, {
        email: staffEmail,
        role: selectedRole,
        academyId: currentUser.academyId,
        academyRoles: { [currentUser.academyId]: selectedRole },
        createdAt: Date.now()
      });
    }
    
    emailInput.value = "";
    showInlineToast(`Added ${selectedRole} successfully!`, "success");
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

  const btnMigrate = document.getElementById("btnRunMigration");
  if (btnMigrate) {
    btnMigrate.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to run the data migration? This will link old bookings to member IDs.")) return;
      
      btnMigrate.disabled = true;
      btnMigrate.textContent = "Running Migration...";
      const statusText = document.getElementById("migrationStatusText");
      
      try {
        const membersSnap = await getDocs(collection(db, "members"));
        let count = 0;
        
        for (const memberDoc of membersSnap.docs) {
          const member = memberDoc.data();
          if (!member.phone || !member.name) continue;
          
          const q = query(
            collection(db, "bookings"), 
            where("customer_phone", "==", member.phone),
            where("customer_name", "==", member.name)
          );
          const bookingSnap = await getDocs(q);
          
          for (const bDoc of bookingSnap.docs) {
            if (!bDoc.data().memberId) {
              await updateDoc(doc(db, "bookings", bDoc.id), { memberId: memberDoc.id });
              count++;
            }
          }
        }
        
        showInlineToast(`Migration complete! Linked ${count} old bookings.`, "success");
        if (statusText) statusText.textContent = `Success: Linked ${count} old bookings to members.`;
      } catch (err) {
        showMsg("settingsMessage", "Migration failed: " + err.message, "error");
        if (statusText) statusText.textContent = "Migration failed.";
      } finally {
        btnMigrate.disabled = false;
        btnMigrate.textContent = "Run Migration";
      }
    });
  }
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
