import { db, doc, collection, query, where, getDocs, getDoc, setDoc, updateDoc, addDoc, setOnAuthReady, initApp, currentUser, formatSelectedDate, escapeHTML, tenantSettings, isSuperAdmin, isTenantAdmin, isStaff, isCoach } from "./shared.js";

let studentsList = [];
let attendanceRecord = {}; // date -> { studentId: true/false }
let currentAttendanceDate = formatSelectedDate(new Date());
let attendanceSearchTerm = "";
let profileSearchTerm = "";
let currentEditingStudent = null;

// DOM Elements
const tabAttendance = document.getElementById("tabAttendance");
const tabProfiles = document.getElementById("tabProfiles");
const tabReports = document.getElementById("tabReports");
const viewAttendance = document.getElementById("viewAttendance");
const viewProfiles = document.getElementById("viewProfiles");
const viewReports = document.getElementById("viewReports");

const attendanceGrid = document.getElementById("attendanceGrid");
const profilesGrid = document.getElementById("profilesGrid");
const attendanceDatePicker = document.getElementById("attendanceDatePicker");
const attendanceSearch = document.getElementById("attendanceSearch");
const attendanceDateDisplay = document.getElementById("attendanceDateDisplay");
const profileSearch = document.getElementById("profileSearch");

// Reports Elements
const reportMonthPicker = document.getElementById("reportMonthPicker");
const btnGenerateReport = document.getElementById("btnGenerateReport");
const btnShareReport = document.getElementById("btnShareReport");
const btnDownloadReport = document.getElementById("btnDownloadReport");
const reportContainer = document.getElementById("reportContainer");
let generatedPdfBlob = null;
let currentReportMonth = "";

// Modal Elements
const profileModal = document.getElementById("profileModal");
const closeProfileModalBtn = document.getElementById("closeProfileModal");
const btnSaveProfile = document.getElementById("btnSaveProfile");
const profileModalTitle = document.getElementById("profileModalTitle");

const profSkillLevel = document.getElementById("profSkillLevel");
const profHand = document.getElementById("profHand");
const profStyle = document.getElementById("profStyle");
const profAgility = document.getElementById("profAgility");
const profFocus = document.getElementById("profFocus");
const tsPlayed = document.getElementById("tsPlayed");
const tsWon = document.getElementById("tsWon");
const tsLost = document.getElementById("tsLost");
const tsTitles = document.getElementById("tsTitles");
const profNewLog = document.getElementById("profNewLog");
const profLogHistory = document.getElementById("profLogHistory");

function setupListeners() {
  tabAttendance.addEventListener("click", () => switchTab("attendance"));
  tabProfiles.addEventListener("click", () => switchTab("profiles"));
  if (tabReports) tabReports.addEventListener("click", () => switchTab("reports"));
  
  attendanceDatePicker.value = currentAttendanceDate;
  attendanceDatePicker.addEventListener("change", (e) => {
    currentAttendanceDate = e.target.value;
    updateDateDisplay();
    loadAttendanceForDate();
  });

  if (attendanceSearch) {
    attendanceSearch.addEventListener("input", (e) => {
      attendanceSearchTerm = e.target.value.toLowerCase();
      renderAttendanceGrid();
    });
  }

  profileSearch.addEventListener("input", (e) => {
    profileSearchTerm = e.target.value.toLowerCase();
    renderProfilesGrid();
  });

  if (btnGenerateReport) {
    btnGenerateReport.addEventListener("click", generateMonthlyReport);
  }
  if (btnShareReport) {
    btnShareReport.addEventListener("click", sharePDF);
  }
  if (btnDownloadReport) {
    btnDownloadReport.addEventListener("click", downloadPDF);
  }

  closeProfileModalBtn.addEventListener("click", () => {
    profileModal.classList.add("hidden");
    currentEditingStudent = null;
  });

  btnSaveProfile.addEventListener("click", saveStudentProfile);
}

function switchTab(tab) {
  [tabAttendance, tabProfiles, tabReports].forEach(t => {
    if (t) {
      t.classList.remove("active");
      t.style.color = "var(--muted)";
      t.style.borderBottom = "none";
    }
  });
  
  [viewAttendance, viewProfiles, viewReports].forEach(v => {
    if (v) v.classList.add("hidden");
  });

  if (tab === "attendance") {
    tabAttendance.classList.add("active");
    tabAttendance.style.color = "var(--accent)";
    tabAttendance.style.borderBottom = "2px solid var(--accent)";
    viewAttendance.classList.remove("hidden");
    loadAttendanceForDate();
  } else if (tab === "profiles") {
    tabProfiles.classList.add("active");
    tabProfiles.style.color = "var(--accent)";
    tabProfiles.style.borderBottom = "2px solid var(--accent)";
    viewProfiles.classList.remove("hidden");
    renderProfilesGrid();
  } else if (tab === "reports") {
    if (tabReports) {
      tabReports.classList.add("active");
      tabReports.style.color = "var(--accent)";
      tabReports.style.borderBottom = "2px solid var(--accent)";
    }
    if (viewReports) viewReports.classList.remove("hidden");
    
    if (!reportMonthPicker.value) {
      const today = new Date();
      reportMonthPicker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
  }
}

function updateDateDisplay() {
  const today = formatSelectedDate(new Date());
  if (currentAttendanceDate === today) {
    attendanceDateDisplay.textContent = "Today";
  } else {
    const d = new Date(currentAttendanceDate);
    attendanceDateDisplay.textContent = isNaN(d) ? currentAttendanceDate : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

async function loadCoachingStudents() {
  if (!db || !currentUser || !currentUser.academyId) return;
  try {
    const q = query(collection(db, "members"), where("academyId", "==", currentUser.academyId));
    const snap = await getDocs(q);
    studentsList = [];
    snap.forEach(d => {
      const data = d.data();
      data.id = d.id;
      // Only show coaching-related members in the Coaching Hub
      if (data.status === "active" && data.type) {
        let isCoaching = false;
        
        // 1. Check if the plan key belongs to the coaching fee_structure
        if (tenantSettings && tenantSettings.fee_structure) {
          for (const prog of tenantSettings.fee_structure) {
            // Exact key match
            if (prog.pricing_variants && prog.pricing_variants.some(v => v.key === data.type)) {
              isCoaching = true;
              break;
            }
            // Partial string match against program name
            if (prog.program_name && data.type.toLowerCase().includes(prog.program_name.toLowerCase())) {
              isCoaching = true;
              break;
            }
          }
        }
        
        // 2. Fallback for older data or custom manually-typed string plans
        if (!isCoaching) {
          const t = data.type.toLowerCase();
          if (t.includes("coaching") || t.includes("advance") || t.includes("personal") || t.includes("tournament")) {
            isCoaching = true;
          }
        }

        if (isCoaching) {
          studentsList.push(data);
        }
      }
    });
    
    // Sort alphabetically
    studentsList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    
    // Initialize profile metadata if missing
    studentsList.forEach(s => {
      if (!s.profile) {
        s.profile = {
          skillLevel: "Beginner",
          dominantHand: "Right",
          playingStyle: "All-Rounder",
          agilityFitness: 3,
          focusAreas: "",
          tournamentStats: { played: 0, won: 0, lost: 0, titles: 0 },
          logs: []
        };
      } else {
        if (!s.profile.tournamentStats) s.profile.tournamentStats = { played: 0, won: 0, lost: 0, titles: 0 };
        if (!s.profile.logs) s.profile.logs = [];
      }
    });

    await loadAttendanceForDate();
    renderProfilesGrid();
  } catch (err) {
    console.error("Failed to load coaching students", err);
  }
}

async function loadAttendanceForDate() {
  if (!db || !currentUser || !currentUser.academyId) return;
  const docId = `att_${currentUser.academyId}_${currentAttendanceDate}`;
  try {
    const attRef = doc(db, "attendance", docId);
    const snap = await getDoc(attRef);
    if (snap.exists()) {
      attendanceRecord = snap.data().records || {};
    } else {
      attendanceRecord = {};
    }
    renderAttendanceGrid();
  } catch (err) {
    console.warn("Attendance record not found or permission denied, assuming empty.", err);
    attendanceRecord = {};
    renderAttendanceGrid();
  }
}

async function toggleAttendance(studentId, isPresent) {
  if (currentUser && currentUser.isAnonymous) {
    alert("Guest users cannot modify attendance.");
    return;
  }
  attendanceRecord[studentId] = isPresent;
  // Optimistic update
  renderAttendanceGrid();

  const docId = `att_${currentUser.academyId}_${currentAttendanceDate}`;
  const attRef = doc(db, "attendance", docId);
  try {
    await setDoc(attRef, {
      academyId: currentUser.academyId,
      date: currentAttendanceDate,
      records: attendanceRecord,
      updatedAt: Date.now(),
      updatedBy: currentUser.email
    }, { merge: true });
  } catch (err) {
    console.error("Failed to update attendance", err);
    alert("Failed to save attendance.");
  }
}

function renderAttendanceGrid() {
  attendanceGrid.innerHTML = "";
  
  let filtered = studentsList;
  if (attendanceSearchTerm) {
    filtered = filtered.filter(s => {
      const nameMatch = s.name && s.name.toLowerCase().includes(attendanceSearchTerm);
      const planName = s.type ? s.type.replace(/_/g, " ").toLowerCase() : "";
      const planMatch = planName.includes(attendanceSearchTerm);
      return nameMatch || planMatch;
    });
  }
  
  if (filtered.length === 0) {
    attendanceGrid.innerHTML = '<div class="empty-list-msg">No students found.</div>';
    return;
  }

  filtered.forEach(student => {
    const card = document.createElement("div");
    card.className = "coach-card";
    
    const status = attendanceRecord[student.id]; // true, false, or undefined
    const planName = student.type ? student.type.replace(/_/g, " ") : "Unknown Plan";

    card.innerHTML = `
      <div class="coach-card-header">
        <div>
          <div class="coach-card-title">${escapeHTML(student.name)}</div>
          <div class="coach-card-subtitle">${escapeHTML(planName)} ${student.phone ? ' • ' + escapeHTML(student.phone) : ''}</div>
        </div>
      </div>
      <div class="attendance-actions">
        <button class="btn-attend present ${status === true ? 'active' : ''}" data-id="${student.id}" data-val="true" title="Present">✓</button>
        <button class="btn-attend absent ${status === false ? 'active' : ''}" data-id="${student.id}" data-val="false" title="Absent">✕</button>
      </div>
    `;

    card.querySelector(".present").addEventListener("click", () => toggleAttendance(student.id, true));
    card.querySelector(".absent").addEventListener("click", () => toggleAttendance(student.id, false));

    attendanceGrid.appendChild(card);
  });
}

function renderProfilesGrid() {
  profilesGrid.innerHTML = "";
  
  let filtered = studentsList;
  if (profileSearchTerm) {
    filtered = filtered.filter(s => s.name && s.name.toLowerCase().includes(profileSearchTerm));
  }

  if (filtered.length === 0) {
    profilesGrid.innerHTML = '<div class="empty-list-msg">No profiles found.</div>';
    return;
  }

  filtered.forEach(student => {
    const card = document.createElement("div");
    card.className = "coach-card";
    
    const prof = student.profile;
    const focusArr = prof.focusAreas ? prof.focusAreas.split(",").map(s => s.trim()).filter(Boolean) : [];
    const focusHtml = focusArr.length > 0 
      ? focusArr.map(f => `<span class="focus-tag">${escapeHTML(f)}</span>`).join("")
      : '<span style="color:var(--muted); font-size:0.75rem;">None</span>';

    card.innerHTML = `
      <div class="coach-card-header">
        <div>
          <div class="coach-card-title">${escapeHTML(student.name)}</div>
          <div class="coach-card-subtitle">${escapeHTML(prof.skillLevel)} • ${escapeHTML(prof.dominantHand)} Handed</div>
        </div>
        <button class="btn-icon btn-edit-profile" title="Edit Profile" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--accent);">✎</button>
      </div>
      <div class="profile-metrics">
        <div class="metric-item">
          <span class="metric-label">Style</span>
          <span class="metric-value">${escapeHTML(prof.playingStyle)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Agility/Fit</span>
          <span class="metric-value">${prof.agilityFitness} / 5</span>
        </div>
      </div>
      <div style="font-size:0.75rem; color:var(--muted); margin-top:0.5rem; text-transform:uppercase; letter-spacing:0.5px;">Focus Areas</div>
      <div class="focus-tags">${focusHtml}</div>
    `;

    card.querySelector(".btn-edit-profile").addEventListener("click", () => openProfileModal(student));
    profilesGrid.appendChild(card);
  });
}

function openProfileModal(student) {
  currentEditingStudent = student;
  profileModalTitle.textContent = `Edit Profile: ${student.name}`;
  
  const p = student.profile;
  profSkillLevel.value = p.skillLevel;
  profHand.value = p.dominantHand;
  profStyle.value = p.playingStyle;
  profAgility.value = p.agilityFitness;
  profFocus.value = p.focusAreas;

  const t = p.tournamentStats;
  tsPlayed.value = t.played;
  tsWon.value = t.won;
  tsLost.value = t.lost;
  tsTitles.value = t.titles;

  profNewLog.value = "";
  renderLogs(p.logs);

  profileModal.classList.remove("hidden");
}

function renderLogs(logs) {
  profLogHistory.innerHTML = "";
  if (!logs || logs.length === 0) {
    profLogHistory.innerHTML = '<div style="color:var(--muted); padding:1rem 0;">No improvement logs yet.</div>';
    return;
  }
  // Show newest first
  const sorted = [...logs].reverse();
  sorted.forEach(log => {
    const d = new Date(log.timestamp);
    const dateStr = d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    profLogHistory.innerHTML += `
      <div class="log-item">
        <div class="log-header">
          <span>${escapeHTML(log.author)}</span>
          <span>${dateStr}</span>
        </div>
        <div class="log-note">${escapeHTML(log.note)}</div>
      </div>
    `;
  });
}

async function saveStudentProfile() {
  if (!currentEditingStudent || currentUser.isAnonymous) {
    if(currentUser.isAnonymous) alert("Guest users cannot edit profiles.");
    return;
  }
  
  btnSaveProfile.textContent = "Saving...";
  btnSaveProfile.disabled = true;

  const p = currentEditingStudent.profile;
  p.skillLevel = profSkillLevel.value;
  p.dominantHand = profHand.value;
  p.playingStyle = profStyle.value;
  p.agilityFitness = parseInt(profAgility.value, 10) || 3;
  p.focusAreas = profFocus.value;
  
  p.tournamentStats = {
    played: parseInt(tsPlayed.value, 10) || 0,
    won: parseInt(tsWon.value, 10) || 0,
    lost: parseInt(tsLost.value, 10) || 0,
    titles: parseInt(tsTitles.value, 10) || 0
  };

  const newLogText = profNewLog.value.trim();
  if (newLogText) {
    p.logs.push({
      note: newLogText,
      author: currentUser.displayName || currentUser.email,
      timestamp: Date.now()
    });
  }

  try {
    const memberRef = doc(db, "members", currentEditingStudent.id);
    await updateDoc(memberRef, { profile: p });
    
    // Refresh UI
    renderProfilesGrid();
    renderLogs(p.logs);
    profNewLog.value = "";
    
    // Provide a small UI feedback
    const oldText = btnSaveProfile.textContent;
    btnSaveProfile.textContent = "Saved!";
    setTimeout(() => {
      btnSaveProfile.textContent = "💾 Save Profile";
      btnSaveProfile.disabled = false;
    }, 1500);

  } catch (err) {
    console.error("Failed to save profile", err);
    alert("Failed to save profile.");
    btnSaveProfile.textContent = "💾 Save Profile";
    btnSaveProfile.disabled = false;
  }
}

async function generateMonthlyReport() {
  if (!db || !currentUser || !currentUser.academyId) return;
  const monthVal = reportMonthPicker.value;
  if (!monthVal) {
    alert("Please select a month.");
    return;
  }

  currentReportMonth = monthVal;
  const startDate = `${monthVal}-01`;
  
  // Get last day of month
  const [year, month] = monthVal.split("-");
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${monthVal}-${lastDay}`;

  reportContainer.innerHTML = '<div class="empty-list-msg">Fetching attendance records...</div>';
  if (btnShareReport) btnShareReport.classList.add("hidden");
  if (btnDownloadReport) btnDownloadReport.classList.add("hidden");

  try {
    // Process records by fetching each day's doc directly to avoid composite index requirements
    const attendanceByStudent = {}; // studentId -> { present: 0, absent: 0 }
    let totalClassesRecorded = 0;
    const fetchPromises = [];

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${monthVal}-${String(day).padStart(2, '0')}`;
      const docId = `att_${currentUser.academyId}_${dateStr}`;
      fetchPromises.push(getDoc(doc(db, "attendance", docId)));
    }

    const snaps = await Promise.all(fetchPromises);

    snaps.forEach(snap => {
      if (snap.exists()) {
        totalClassesRecorded++;
        const records = snap.data().records || {};
        for (const [studentId, isPresent] of Object.entries(records)) {
          if (!attendanceByStudent[studentId]) {
            attendanceByStudent[studentId] = { present: 0, absent: 0 };
          }
          if (isPresent) attendanceByStudent[studentId].present++;
          else attendanceByStudent[studentId].absent++;
        }
      }
    });

    if (totalClassesRecorded === 0) {
      reportContainer.innerHTML = '<div class="empty-list-msg">No attendance records found for this month.</div>';
      return;
    }

    // Prepare table data
    const tableData = [];
    studentsList.forEach(student => {
      const stats = attendanceByStudent[student.id] || { present: 0, absent: 0 };
      const total = stats.present + stats.absent;
      const percentage = total > 0 ? Math.round((stats.present / total) * 100) + '%' : 'N/A';
      
      tableData.push([
        student.name || "Unknown",
        student.phone || "N/A",
        stats.present,
        stats.absent,
        total,
        percentage
      ]);
    });
    
    // Sort by name
    tableData.sort((a, b) => a[0].localeCompare(b[0]));

    // Render HTML Table
    let html = `<table class="styled-table" style="width:100%; border-collapse:collapse; min-width:600px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border); text-align:left;">
          <th style="padding:0.8rem;">Student Name</th>
          <th style="padding:0.8rem;">Phone</th>
          <th style="padding:0.8rem;">Present</th>
          <th style="padding:0.8rem;">Absent</th>
          <th style="padding:0.8rem;">Total</th>
          <th style="padding:0.8rem;">Att %</th>
        </tr>
      </thead>
      <tbody>`;
    
    tableData.forEach(row => {
      html += `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.8rem;">${escapeHTML(row[0])}</td>
        <td style="padding:0.8rem; color:var(--muted);">${escapeHTML(row[1])}</td>
        <td style="padding:0.8rem; color:var(--accent3); font-weight:bold;">${row[2]}</td>
        <td style="padding:0.8rem; color:var(--accent2); font-weight:bold;">${row[3]}</td>
        <td style="padding:0.8rem;">${row[4]}</td>
        <td style="padding:0.8rem; font-weight:600;">${row[5]}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    reportContainer.innerHTML = html;
    
    // Generate PDF Blob
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    
    docPdf.setFontSize(18);
    docPdf.text("Monthly Attendance Report", 14, 22);
    
    docPdf.setFontSize(11);
    docPdf.setTextColor(100);
    docPdf.text(`Month: ${monthVal}`, 14, 30);
    docPdf.text(`Total Recorded Class Days: ${totalClassesRecorded}`, 14, 36);
    
    docPdf.autoTable({
      startY: 45,
      head: [['Student Name', 'Phone', 'Present', 'Absent', 'Total', 'Att %']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    
    generatedPdfBlob = docPdf.output('blob');
    if (btnShareReport) btnShareReport.classList.remove("hidden");
    if (btnDownloadReport) btnDownloadReport.classList.remove("hidden");

  } catch (err) {
    console.error("Failed to generate report", err);
    reportContainer.innerHTML = '<div class="empty-list-msg" style="color:var(--accent2);">Failed to fetch data. Check console.</div>';
  }
}

async function sharePDF() {
  if (!generatedPdfBlob) return;
  
  const fileName = `Attendance_Report_${currentReportMonth}.pdf`;
  const file = new File([generatedPdfBlob], fileName, { type: 'application/pdf' });
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Attendance Report - ${currentReportMonth}`,
        text: `Here is the student attendance report for ${currentReportMonth}.`,
        files: [file]
      });
    } catch (err) {
      console.warn("Share failed or cancelled", err);
    }
  } else {
    alert("Sharing is not supported on this device/browser. Please use the Download button instead.");
  }
}

function downloadPDF() {
  if (!generatedPdfBlob) return;
  const fileName = `Attendance_Report_${currentReportMonth}.pdf`;
  const url = URL.createObjectURL(generatedPdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

setOnAuthReady(async (user) => {
  if (!user) return;
  // Must be COACH, STAFF, TENANT_ADMIN, or SUPER_ADMIN
  if (!isCoach(user) && !isStaff(user) && !isTenantAdmin(user) && !isSuperAdmin(user)) {
    alert("You do not have permission to view this page.");
    window.location.href = "dashboard.html";
    return;
  }
  
  setupListeners();
  updateDateDisplay();
  await loadCoachingStudents();
});

function bootstrap() {
  initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
