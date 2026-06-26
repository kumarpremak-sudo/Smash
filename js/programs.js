// js/programs.js — Programs, Coaching Schedule, Fee Calculator
import {
  iraguRates, setOnAuthReady, initApp, updateDynamicPricesUI
} from "./shared.js";

setOnAuthReady(() => {
  updateDynamicPricesUI();
  setupCalculator();
});

function setupProgramsListeners() {
  // Tab switching
  document.querySelectorAll(".prog-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".prog-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".prog-view").forEach(v => v.classList.remove("active"));
      btn.classList.add("active");
      const targetView = document.getElementById(btn.dataset.view);
      if (targetView) targetView.classList.add("active");
    });
  });
}

function setupCalculator() {
  const calcType = document.getElementById("calcType");
  const calcPlan = document.getElementById("calcPlan");
  const calcDays = document.getElementById("calcDays");
  const calcHours = document.getElementById("calcHours");
  if (!calcType) return;

  const calcCoachingBlock = document.getElementById("calcCoachingBlock");
  const calcGuestBlock = document.getElementById("calcGuestBlock");

  function updateCalcOptions() {
    const type = calcType.value;
    if (calcCoachingBlock) calcCoachingBlock.classList.toggle("hidden", type === "guest");
    if (calcGuestBlock) calcGuestBlock.classList.toggle("hidden", type !== "guest");
    calculateFee();
  }

  function calculateFee() {
    const type = calcType.value;
    let total = 0, breakdownHtml = "";
    if (type === "guest") {
      const hours = parseInt(calcHours.value) || 1;
      const peak = document.getElementById("calcPeakToggle");
      const isPeak = peak && peak.checked;
      const rate = isPeak ? (iraguRates.Guest_peak || 200) : (iraguRates.Guest_non_peak || 150);
      total = rate * hours;
      breakdownHtml = `
        <div class="calc-res-item"><span class="calc-res-lbl">Rate Type</span><span class="calc-res-val">${isPeak ? "Peak Hours" : "Non-Peak Hours"}</span></div>
        <div class="calc-res-item"><span class="calc-res-lbl">Rate per Hour</span><span class="calc-res-val">₹${rate.toLocaleString()}</span></div>
        <div class="calc-res-item"><span class="calc-res-lbl">Hours</span><span class="calc-res-val">${hours}</span></div>
      `;
    } else {
      const plan = calcPlan.value;
      const planKey = plan;
      const rate = iraguRates[planKey] || 0;
      const months = parseInt(calcDays.value) || 1;
      total = rate * months;
      const planLabel = (window._planLabels && window._planLabels[planKey]) ? window._planLabels[planKey].name : planKey;
      breakdownHtml = `
        <div class="calc-res-item"><span class="calc-res-lbl">Plan</span><span class="calc-res-val">${planLabel}</span></div>
        <div class="calc-res-item"><span class="calc-res-lbl">Monthly Rate</span><span class="calc-res-val">₹${rate.toLocaleString()}</span></div>
        <div class="calc-res-item"><span class="calc-res-lbl">Duration</span><span class="calc-res-val">${months} month${months > 1 ? "s" : ""}</span></div>
      `;
    }
    const detailsEl = document.getElementById("calcResultDetails");
    if (detailsEl) detailsEl.innerHTML = breakdownHtml;
    const totalEl = document.getElementById("calcTotalVal");
    if (totalEl) totalEl.textContent = `₹${total.toLocaleString()}`;
  }

  calcType.addEventListener("change", updateCalcOptions);
  if (calcPlan) calcPlan.addEventListener("change", calculateFee);
  if (calcDays) calcDays.addEventListener("input", calculateFee);
  if (calcHours) calcHours.addEventListener("input", calculateFee);
  const peakToggle = document.getElementById("calcPeakToggle");
  if (peakToggle) peakToggle.addEventListener("change", calculateFee);
  updateCalcOptions();
}

document.addEventListener("DOMContentLoaded", () => {
  // Expose planLabels for calculator
  import("./shared.js").then(m => { window._planLabels = m.planLabels; });
  setupProgramsListeners();
  initApp();
});
