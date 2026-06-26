// js/settings.js — Admin Settings: Whitelist, Guest Toggle
import {
  db, currentUser, authConfig, escapeHTML, showMsg, showInlineToast,
  setOnAuthReady, initApp, isSuperAdmin,
  collection, doc, getDocs, setDoc
} from "./shared.js";

setOnAuthReady(async (user) => {
  if (!user || !isSuperAdmin(user)) {
    window.location.href = "dashboard.html";
    return;
  }
  await loadSettingsData();
});

async function loadSettingsData() {
  if (!db) return;
  try {
    const configSnap = await getDocs(collection(db, "configs"));
    configSnap.forEach(d => {
      if (d.id === "auth") {
        const data = d.data();
        authConfig.allowedEmails = data.allowedEmails || [];
        authConfig.allowGuestLogin = data.allowGuestLogin !== undefined ? data.allowGuestLogin : true;
      }
    });
    renderWhitelistEmails();
    const guestToggle = document.getElementById("guestLoginToggle");
    if (guestToggle) guestToggle.checked = authConfig.allowGuestLogin;
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

function renderWhitelistEmails() {
  const list = document.getElementById("whitelistEmailsList");
  if (!list) return;
  list.innerHTML = "";
  if (authConfig.allowedEmails.length === 0) {
    list.innerHTML = '<div class="empty-list-msg">No whitelisted emails configured yet.</div>';
    return;
  }
  authConfig.allowedEmails.forEach(email => {
    const li = document.createElement("li");
    li.className = "whitelist-item";
    li.innerHTML = `
      <span class="whitelist-item-email">${escapeHTML(email)}</span>
      <button class="btn-remove-whitelist" title="Remove ${escapeHTML(email)}">&times;</button>
    `;
    li.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleRemoveWhitelistEmail(email, li));
    list.appendChild(li);
  });
}

async function handleRemoveWhitelistEmail(email, liEl) {
  if (!currentUser || !isSuperAdmin(currentUser)) {
    showInlineToast("Permission Denied: Only the super administrator can remove whitelisted admins.", "error");
    return;
  }
  const originalHtml = liEl.innerHTML;
  liEl.innerHTML = `
    <div class="fee-confirm-wrap" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
      <span class="fee-confirm-text" style="font-size: 0.8rem; font-weight: 600; color: var(--accent2);">Remove email?</span>
      <div class="fee-confirm-btns" style="display: flex; gap: 0.4rem;">
        <button class="btn-confirm-yes" style="padding: 2px 8px; font-size: 0.75rem; background: var(--accent2); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">✓ Yes</button>
        <button class="btn-confirm-no" style="padding: 2px 8px; font-size: 0.75rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;">✕ No</button>
      </div>
    </div>
  `;
  liEl.querySelector(".btn-confirm-no").addEventListener("click", () => {
    liEl.innerHTML = originalHtml;
    liEl.querySelector(".btn-remove-whitelist").addEventListener("click", () => handleRemoveWhitelistEmail(email, liEl));
  });
  liEl.querySelector(".btn-confirm-yes").addEventListener("click", async () => {
    liEl.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Removing...</span>';
    try {
      authConfig.allowedEmails = authConfig.allowedEmails.filter(e => e.toLowerCase().trim() !== email.toLowerCase().trim());
      await setDoc(doc(db, "configs", "auth"), {
        allowedEmails: authConfig.allowedEmails,
        allowGuestLogin: authConfig.allowGuestLogin
      });
      renderWhitelistEmails();
      showInlineToast(`Removed ${email} from whitelist`, "success");
    } catch (error) {
      showInlineToast(`Failed to remove: ${error.message}`, "error");
      renderWhitelistEmails();
    }
  });
}

async function handleAddWhitelistEmail(event) {
  event.preventDefault();
  if (!currentUser || !isSuperAdmin(currentUser)) {
    showMsg("settingsMessage", "Permission Denied: Only the super administrator can add whitelisted admins.", "error");
    return;
  }
  const input = document.getElementById("newWhitelistEmail");
  const email = input.value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showMsg("settingsMessage", "Please enter a valid email address.", "error");
    return;
  }
  if (email.length > 80) {
    showMsg("settingsMessage", "Email cannot exceed 80 characters.", "error");
    return;
  }
  if (authConfig.allowedEmails.map(e => e.toLowerCase()).includes(email)) {
    showMsg("settingsMessage", "This email is already whitelisted.", "error");
    return;
  }
  try {
    authConfig.allowedEmails.push(email);
    await setDoc(doc(db, "configs", "auth"), {
      allowedEmails: authConfig.allowedEmails,
      allowGuestLogin: authConfig.allowGuestLogin
    });
    input.value = "";
    renderWhitelistEmails();
    showInlineToast(`Added ${email} to whitelist`, "success");
  } catch (error) {
    showMsg("settingsMessage", "Failed to add: " + error.message, "error");
  }
}

async function handleGuestToggle() {
  if (!currentUser || !isSuperAdmin(currentUser)) {
    showInlineToast("Permission Denied: Only the super administrator can modify guest settings.", "error");
    return;
  }
  const toggle = document.getElementById("guestLoginToggle");
  authConfig.allowGuestLogin = toggle.checked;
  try {
    await setDoc(doc(db, "configs", "auth"), {
      allowedEmails: authConfig.allowedEmails,
      allowGuestLogin: authConfig.allowGuestLogin
    });
    showInlineToast(`Guest login ${authConfig.allowGuestLogin ? "enabled" : "disabled"}`, "success");
  } catch (error) {
    showInlineToast(`Failed: ${error.message}`, "error");
    toggle.checked = !toggle.checked;
  }
}

function setupSettingsListeners() {
  const addSubmit = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("submit", fn); };
  addSubmit("whitelistForm", handleAddWhitelistEmail);
  const guestToggle = document.getElementById("guestLoginToggle");
  if (guestToggle) guestToggle.addEventListener("change", handleGuestToggle);
}

document.addEventListener("DOMContentLoaded", () => {
  setupSettingsListeners();
  initApp();
});
