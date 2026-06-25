# Badminton Application Test Scenarios

This document outlines detailed test scenarios for all core functionalities of the Badminton Court Booking application. These scenarios cover Authentication, Booking Management, Membership Tracking, Admin Configurations, and **Boundary/Edge Cases**.

---

## 1. Authentication & Access Control

### 1.1 Google Authentication (Whitelisted User) [Positive]
- **Pre-conditions:** The user has a valid Google account, and their email is present in the `allowedEmails` whitelist.
- **Steps:** Navigate to login -> Click Sign in with Google -> Select account.
- **Expected Result:** Login succeeds, user accesses Dashboard.

### 1.2 Google Authentication (Non-Whitelisted User) [Negative]
- **Pre-conditions:** User has a valid Google account NOT in the whitelist.
- **Steps:** Navigate to login -> Click Sign in with Google -> Select account.
- **Expected Result:** Login rejected, user signed out, red error: "Access Denied: Your email is not whitelisted."

### 1.3 Guest Administrator Login [Positive]
- **Pre-conditions:** Guest Administrator Access is enabled.
- **Steps:** Navigate to login -> Click Continue as Guest.
- **Expected Result:** Login succeeds as "Guest Player", Admin Settings hidden.

### 1.4 Guest Login when Disabled [Negative]
- **Pre-conditions:** Guest Access is toggled OFF.
- **Steps:** Navigate to login -> Click Continue as Guest.
- **Expected Result:** Login blocked, error: "Access Denied: Guest Administrator login is currently disabled."

---

## 2. Booking & Court Management

### 2.1 Single Day Slot Booking (No Conflict) [Positive]
- **Steps:** Dashboard -> Allocate Slot -> Single Day -> Select Time, Court, Name -> Submit.
- **Expected Result:** Booking created and visible on timeline.

### 2.2 Booking Conflict Handling [Negative]
- **Steps:** Attempt to book an already reserved time block for the same court.
- **Expected Result:** Rejected with "This court is already reserved for the selected time range."

### 2.3 Invalid Time Range Booking [Negative]
- **Steps:** Enter End Time before Start Time (e.g., Start: 10:00, End: 09:00).
- **Expected Result:** Blocked with error: "End time must occur after start time."

### 2.4 Missing Required Booking Fields [Negative]
- **Steps:** Leave Organizer Name or Email blank and submit.
- **Expected Result:** Browser prevents submission, highlighting missing fields.

### 2.5 Bulk Monthly Booking [Positive]
- **Steps:** Allocate Slot -> Weekday Recurring Month Block -> Select Time, Court -> Submit.
- **Expected Result:** Automatically books all non-conflicting weekdays in the current month.

### 2.6 Attempting to Edit/Cancel Another User's Booking [Negative]
- **Steps:** Click on a booking created by someone else.
- **Expected Result:** Edit/Cancel buttons are completely hidden; email is masked (e.g., `Jo***@gmail.com`).

---

## 3. Membership & Fee Management

### 3.1 Enrolling a Member/Trainee [Positive]
- **Steps:** Open Booking Details -> Enter Trainee Name -> Pick Plan & Date -> Add Member.
- **Expected Result:** Member added, timeline updates badge (e.g., "1 Enrolled").

### 3.2 Enrolling a Member with Empty Name [Negative]
- **Steps:** Leave Trainee Name blank and click Add Member.
- **Expected Result:** Ignored; no blank record created.

### 3.3 Overdue Fee Alert Generation [Positive]
- **Steps:** Member exists with `lastPaidDate` older than 30 days. View Dashboard.
- **Expected Result:** Appears in "Pending Fee Alerts" in red.

---

## 4. Admin Settings & Configuration

### 4.1 Submitting Pricing Board with Blank Values [Negative]
- **Steps:** Clear out a pricing value so it is empty -> Save Advanced Rates.
- **Expected Result:** HTML5 validation blocks submission to prevent `NaN` pricing calculation errors.

### 4.2 Adding an Invalid Email to Whitelist [Negative]
- **Steps:** Settings -> Type "not_an_email" in whitelist -> Add.
- **Expected Result:** Blocked by HTML5 email validation.

---

## 5. UI & Theme Interactions

### 5.1 Theme Toggling [Positive]
- **Steps:** Click "☀️" -> Reload page.
- **Expected Result:** Light theme applies and persists across reloads via `localStorage`.

### 5.2 Responsive Mobile Navigation [Positive]
- **Steps:** Resize browser to mobile -> Click ☰ -> Click link.
- **Expected Result:** Sidebar opens, navigates, and auto-closes.

---

## 6. Boundary & Edge Case Testing (Stress/Limits)

This section aims to "break" the application by testing extreme boundaries, unconventional inputs, and threshold limits.

### 6.1 Zero-Duration Booking (Time Boundary)
- **Pre-conditions:** User is logged in.
- **Steps:** Open reservation modal. Enter exactly the same Start Time and End Time (e.g., Start: `09:00`, End: `09:00`). Submit.
- **Expected Result:** The system should ideally reject this as a 0-minute duration. (If it allows it, the UI matrix block height/rendering might collapse or behave unexpectedly).

### 6.2 Booking Spanning Midnight (Time Boundary)
- **Pre-conditions:** User is logged in.
- **Steps:** Enter a Start Time of `23:30` and an End Time of `01:00`.
- **Expected Result:** The system should throw a boundary error, as daily bookings cannot span across two different `date` entries natively without splitting the logic.

### 6.3 Leap Year / Month End Bulk Booking (Date Boundary)
- **Pre-conditions:** System date is set to February in a Leap Year (e.g., 2024 or 2028).
- **Steps:** Select "Daily Recurring Month Block" for February.
- **Expected Result:** The script logic `new Date(currentYear, currentMonth + 1, 0).getDate()` must correctly identify 29 days, creating exactly 29 bookings without skipping the 29th or bleeding into March.

### 6.4 Extreme Character Limits in Input Fields (Data Boundary)
- **Pre-conditions:** User opens reservation or enrollment modal.
- **Steps:** In the "Organizer Name" or "Trainee Name" field, paste a string of 10,000 characters. Submit.
- **Expected Result:** The database might accept it, but the Daily Matrix UI and Modal lists should truncate the text via CSS (`text-overflow: ellipsis`) rather than overflowing and breaking the screen layout.

### 6.5 HTML/Script Injection (Security Boundary)
- **Pre-conditions:** User opens the Quick Booking modal.
- **Steps:** Enter `<script>alert("Hacked")</script>` or `<img src=x onerror=alert(1)>` as the Organizer Name. Submit.
- **Expected Result:** The name should be stored as plain text and safely rendered via `textContent` in JS, preventing the script from executing on the Dashboard (XSS protection).

### 6.6 Negative and Zero Pricing Board Values (Data Boundary)
- **Pre-conditions:** User opens "Manage Pricing Board".
- **Steps:** Enter `-500` or `0` for the "Guest Hourly Slot" rate. Save. Navigate to Fee Calculator and calculate Guest play.
- **Expected Result:** System might save it, but calculator will project a negative/zero estimate. Form validation should ideally enforce `min="1"`.

### 6.7 Massive Volume of Enrollees (UI Stress Test)
- **Pre-conditions:** A booking is selected.
- **Steps:** Rapidly add 50+ members/trainees to a single court booking block.
- **Expected Result:** The "Registered Members" modal list should scroll internally (`overflow-y: auto`) instead of pushing the modal buttons off the screen. The daily matrix cell badge should cleanly read "50 Enrolled" without breaking table layout.

### 6.8 Concurrent Booking Race Condition (Concurrency Boundary)
- **Pre-conditions:** Open the application in two separate browser tabs/profiles side-by-side.
- **Steps:** In Tab 1, prepare to book Court 1 at 18:00. In Tab 2, prepare the identical booking. Click "Confirm" on both tabs at the exact same millisecond.
- **Expected Result:** One transaction should succeed. The second should fail upon fetching conflicts, though without Firestore Transactions (`runTransaction`), a highly precise millisecond race condition *might* allow double booking. (An edge-case architectural limitation to observe).
