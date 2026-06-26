# Badminton Court Operations - Comprehensive Test Cases & Scenarios

This document contains a comprehensive set of test cases and scenarios designed to verify all features, user pathways, security restrictions, and edge-case behaviors of the Badminton Court Operations and Management system.

---

## Document Map
1. **[Module 1: Authentication & Access Control (TC-001 to TC-015)](#1-authentication--access-control)**
2. **[Module 2: Role-Based Access Control (RBAC) (TC-016 to TC-030)](#2-role-based-access-control-rbac)**
3. **[Module 3: Court Booking Management - Single Day (TC-031 to TC-045)](#3-court-booking-management---single-day)**
4. **[Module 4: Court Booking Management - Recurring & Details (TC-046 to TC-055)](#4-court-booking-management---recurring--details)**
5. **[Module 5: Member Management & Statuses (TC-056 to TC-070)](#5-member-management--statuses)**
6. **[Module 6: Fee Alert Management (TC-071 to TC-080)](#6-fee-alert-management)**
7. **[Module 7: Trainee Enrollment & Coaching Management (TC-081 to TC-095)](#7-trainee-enrollment--coaching-management)**
8. **[Module 8: Settings & Configurations (TC-096 to TC-110)](#8-settings--configurations)**
9. **[Module 9: Programs & Fee Calculator (TC-111 to TC-120)](#9-programs--fee-calculator)**
10. **[Module 10: Scheduling Timeline & Calendar (TC-121 to TC-130)](#10-scheduling-timeline--calendar)**
11. **[Module 11: Security, Edge Cases & UI Responsiveness (TC-131 to TC-150)](#11-security-edge-cases--ui-responsiveness)**

---

## 1. Authentication & Access Control

### TC-001: Google Auth - Whitelisted User Login (Happy)
- **Pre-conditions:** Google account is valid, and the email exists in the Firestore `auth/allowedEmails` array.
- **Steps:**
  1. Load `index.html`.
  2. Click the **Sign in with Google** button.
  3. Select the whitelisted Google account in the popup window.
- **Expected Result:** Sign-in succeeds, page redirects to `dashboard.html`, and header welcome shows the user's Google display name.

### TC-002: Google Auth - Non-Whitelisted User Login (Negative)
- **Pre-conditions:** Google account is valid, but the email is NOT in the Firestore `auth/allowedEmails` array.
- **Steps:**
  1. Load `index.html`.
  2. Click the **Sign in with Google** button.
  3. Select the non-whitelisted Google account.
- **Expected Result:** Sign-in is rejected, user is signed out automatically, and the UI displays: *"Access Denied: Your email is not whitelisted to access this application."*

### TC-003: Guest Login - Guest Access Enabled (Happy)
- **Pre-conditions:** `allowGuestLogin` is set to `true` in Firestore configs.
- **Steps:**
  1. Load `index.html`.
  2. Click the **Continue as Guest** button.
- **Expected Result:** Sign-in succeeds as an anonymous user, page redirects to `dashboard.html`, and user is labeled as "Guest Player".

### TC-004: Guest Login - Guest Access Disabled (Negative)
- **Pre-conditions:** `allowGuestLogin` is set to `false` in Firestore configs.
- **Steps:**
  1. Load `index.html`.
  2. Click the **Continue as Guest** button.
- **Expected Result:** Sign-in is blocked, user is signed out, and the UI displays: *"Access Denied: Guest Administrator login is currently disabled by the owner."*

### TC-005: Auth State - First User Auto-Seeding (Happy)
- **Pre-conditions:** Firestore `auth/allowedEmails` whitelist array is completely empty.
- **Steps:**
  1. Load `index.html`.
  2. Click **Sign in with Google** and complete authentication.
- **Expected Result:** Since the whitelist was empty, the first user's email is automatically added/seeded to the whitelist database, and login succeeds.

### TC-006: Auth State - Session Persistence (Happy)
- **Pre-conditions:** User is logged in as a Whitelisted User.
- **Steps:**
  1. Navigate to `dashboard.html`.
  2. Press F5 (Reload page).
- **Expected Result:** Page reloads, Firebase Auth listener resolves the session, and user remains logged in without seeing the login page.

### TC-007: Auth Redirection - Unauthenticated Access (Negative)
- **Pre-conditions:** User is not logged in.
- **Steps:**
  1. Attempt to load `dashboard.html` directly via address bar.
- **Expected Result:** Navigation is intercepted by `shared.js` auth check, and user is redirected back to `index.html`.

### TC-008: Auth Redirection - Authenticated Login Page Visit (Happy)
- **Pre-conditions:** User is logged in.
- **Steps:**
  1. Attempt to load `index.html` directly via address bar.
- **Expected Result:** Authentication state is detected, and user is automatically redirected to `dashboard.html`.

### TC-009: Sign Out Action (Happy)
- **Pre-conditions:** User is logged in.
- **Steps:**
  1. Click on the User Pill on the top right.
  2. Click the **Sign Out** button.
- **Expected Result:** Session is destroyed, page redirects to `index.html`, and accessing dashboard directly is blocked.

### TC-010: UI Elements - Guest User Avatar (Happy)
- **Pre-conditions:** Logged in via "Continue as Guest".
- **Steps:**
  1. Inspect the user pill on the top right header.
- **Expected Result:** Avatar displays a default silhouette icon 👤 and the name reads "Guest Player".

### TC-011: UI Elements - Whitelisted User Avatar (Happy)
- **Pre-conditions:** Logged in via Google Auth.
- **Steps:**
  1. Inspect the user pill on the top right header.
- **Expected Result:** Avatar displays the Google account profile picture (or the email's first letter capitalized if no image is set).

### TC-012: UI Elements - Super Admin Avatar (Happy)
- **Pre-conditions:** Logged in as `kumarprem.ak@gmail.com`.
- **Steps:**
  1. Inspect the user pill on the top right.
- **Expected Result:** Name displays Google name, and Settings menu item is visible.

### TC-013: UI Elements - Navigation Settings Visibility (Happy)
- **Pre-conditions:** User is logged in as `kumarprem.ak@gmail.com` (Super Admin).
- **Steps:**
  1. Look at the header navigation links.
- **Expected Result:** The **Settings** link is visible in both the desktop top header and the mobile bottom navigation bar.

### TC-014: UI Elements - Navigation Settings Hidden for Guest (Happy)
- **Pre-conditions:** User is logged in as a Guest.
- **Steps:**
  1. Look at the header navigation links.
- **Expected Result:** The **Settings** navigation link is hidden (has `.hidden` class applied).

### TC-015: UI Elements - Navigation Settings Hidden for Whitelisted User (Happy)
- **Pre-conditions:** User is logged in as a whitelisted user (not Super Admin).
- **Steps:**
  1. Look at the header navigation links.
- **Expected Result:** The **Settings** navigation link is hidden (has `.hidden` class applied).

---

## 2. Role-Based Access Control (RBAC)

### TC-016: Settings Page - Direct URL Access by Super Admin (Happy)
- **Pre-conditions:** Logged in as `kumarprem.ak@gmail.com`.
- **Steps:**
  1. Enter URL: `http://localhost:8000/settings.html` in browser address bar.
- **Expected Result:** Page load is authorized; user can view the configurations dashboard.

### TC-017: Settings Page - Direct URL Access by Whitelisted User (Negative)
- **Pre-conditions:** Logged in as a standard whitelisted user.
- **Steps:**
  1. Enter URL: `http://localhost:8000/settings.html` in address bar.
- **Expected Result:** Page resolves auth, detects user is not Super Admin, and immediately redirects back to `dashboard.html`.

### TC-018: Settings Page - Direct URL Access by Guest (Negative)
- **Pre-conditions:** Logged in as a Guest.
- **Steps:**
  1. Enter URL: `http://localhost:8000/settings.html` in address bar.
- **Expected Result:** Redirects immediately back to `dashboard.html`.

### TC-019: Whitelist Operations - Super Admin Adds Email (Happy)
- **Pre-conditions:** Logged in as `kumarprem.ak@gmail.com`.
- **Steps:**
  1. Open `settings.html`.
  2. Input a valid email into the text field.
  3. Click **Add**.
- **Expected Result:** Email is added to the whitelist list, Firestore is updated, and toast message says: *"Added [email] to whitelist"*.

### TC-020: Whitelist Operations - Super Admin Removes Email (Happy)
- **Pre-conditions:** Logged in as `kumarprem.ak@gmail.com`. Whitelisted emails exist.
- **Steps:**
  1. Open `settings.html`.
  2. Click the `&times;` (Remove) button next to an email.
  3. Click **✓ Yes** on the inline confirmation prompt.
- **Expected Result:** Email is removed from the whitelist list, Firestore is updated, and toast message says: *"Removed [email] from whitelist"*.

### TC-021: Whitelist Operations - Console Block (Negative)
- **Pre-conditions:** Logged in as a standard whitelisted user (non-admin).
- **Steps:**
  1. Open browser developer console.
  2. Try to invoke the Firestore addition directly or send a fake setDoc command to the `configs/auth` collection.
- **Expected Result:** Denied by Firestore security rules (or local checks inside settings functions reject because `isSuperAdmin(currentUser)` returns false).

### TC-022: Whitelist Operations - Guest Block (Negative)
- **Pre-conditions:** Logged in as a Guest.
- **Steps:**
  1. Execute programmatic whitelisting function calls from console.
- **Expected Result:** Blocked by Firestore rules and client-side validations.

### TC-023: Guest Settings - Super Admin Toggles Guest Login (Happy)
- **Pre-conditions:** Logged in as `kumarprem.ak@gmail.com`.
- **Steps:**
  1. Open `settings.html`.
  2. Toggle the Guest Access checkbox.
- **Expected Result:** Firestore updates `allowGuestLogin`, and toast notification confirms state change.

### TC-024: Guest Settings - Non-Admin Toggle Block (Negative)
- **Pre-conditions:** Logged in as standard whitelisted user.
- **Steps:**
  1. Trigger `handleGuestToggle` programmatically.
- **Expected Result:** UI shows permission denied toast, and state reverts.

### TC-025: Guest Settings - Guest User Toggle Block (Negative)
- **Pre-conditions:** Logged in as Guest.
- **Steps:**
  1. Execute `handleGuestToggle` programmatically.
- **Expected Result:** Permission Denied alert displays, no database change.

### TC-026: Member Payments - Whitelisted User Action (Happy)
- **Pre-conditions:** Logged in as whitelisted user. Overdue member alerts exist.
- **Steps:**
  1. Open `members.html`.
  2. Locate an overdue member, click **Mark Paid**.
  3. Click **✓ Yes** on inline confirmation.
- **Expected Result:** Member lastPaidDate updates to today's date in database, UI re-renders, and toast confirms payment.

### TC-027: Member Payments - Guest UI Stripping (Negative)
- **Pre-conditions:** Logged in as Guest.
- **Steps:**
  1. Open `members.html` and inspect directory table and fee alerts.
- **Expected Result:** The "Actions" column in the directory is hidden, and no "Mark Paid" buttons appear anywhere.

### TC-028: Member Payments - Guest Programmatic Block (Negative)
- **Pre-conditions:** Logged in as Guest.
- **Steps:**
  1. Open console and run `handleMarkPaid(memberData, buttonEl)`.
- **Expected Result:** Programmatic call checks guest status and throws: *"Permission Denied: Guests cannot modify payments."*

### TC-029: Enrollment Controls - Whitelisted User Action (Happy)
- **Pre-conditions:** Logged in as Whitelisted User.
- **Steps:**
  1. Click on a booked court cell in `schedule.html`.
  2. Enter a name, select a plan, click **+ Add**.
- **Expected Result:** Trainee added to enrollees list.

### TC-030: Enrollment Controls - Guest UI Stripping (Negative)
- **Pre-conditions:** Logged in as Guest.
- **Steps:**
  1. Click on a booked court cell in `schedule.html` to open details.
- **Expected Result:** The enrollee addition form (`.enroll-block`) is completely hidden, and remove buttons `&times;` are omitted from the list items.

---

## 3. Court Booking Management - Single Day

### TC-031: Create Booking - Valid Inputs (Happy)
- **Pre-conditions:** Whitelisted User is logged in. Court 1 is open.
- **Steps:**
  1. Navigate to `dashboard.html`.
  2. Click **Allocate Slot**.
  3. Fill form: Date = Today, Start = `08:00`, End = `09:00`, Court = Court 1, Name = "Alice", Email = "alice@example.com", Category = Court Rental.
  4. Submit form.
- **Expected Result:** Booking successfully created, modal closes, calendar grid updates with a dot, and selected day timeline displays the booking.

### TC-032: Create Booking - Exact Time Conflict (Negative)
- **Pre-conditions:** Court 1 is booked from `10:00` to `11:00` on Selected Date.
- **Steps:**
  1. Click **Allocate Slot**.
  2. Select Date = Selected Date, Start = `10:00`, End = `11:00`, Court = Court 1, Name = "Bob".
  3. Submit.
- **Expected Result:** Submit is blocked, modal displays error: *"This court is already reserved for the selected time range."*

### TC-033: Create Booking - Overlapping Start Time (Negative)
- **Pre-conditions:** Booking exists on Court 1 from `10:00` to `11:00`.
- **Steps:**
  1. Open booking form.
  2. Request Court 1, Start = `09:30`, End = `10:30`. Submit.
- **Expected Result:** Blocked with conflict error message.

### TC-034: Create Booking - Overlapping End Time (Negative)
- **Pre-conditions:** Booking exists on Court 1 from `10:00` to `11:00`.
- **Steps:**
  1. Open booking form.
  2. Request Court 1, Start = `10:30`, End = `11:30`. Submit.
- **Expected Result:** Blocked with conflict error.

### TC-035: Create Booking - Nested Inside Existing (Negative)
- **Pre-conditions:** Booking exists on Court 1 from `10:00` to `12:00`.
- **Steps:**
  1. Request Court 1, Start = `10:30`, End = `11:30`. Submit.
- **Expected Result:** Conflict check fails, booking rejected.

### TC-036: Create Booking - Spanning Over Existing (Negative)
- **Pre-conditions:** Booking exists on Court 1 from `10:30` to `11:30`.
- **Steps:**
  1. Request Court 1, Start = `10:00`, End = `12:00`. Submit.
- **Expected Result:** Conflict detected, booking rejected.

### TC-037: Create Booking - Same Time, Different Court (Happy)
- **Pre-conditions:** Court 1 is booked from `14:00` to `15:00`. Court 2 is free.
- **Steps:**
  1. Request Court 2, Start = `14:00`, End = `15:00`. Submit.
- **Expected Result:** Booking successfully saved on Court 2.

### TC-038: Create Booking - Start Time After End Time (Negative)
- **Pre-conditions:** User opens reservation form.
- **Steps:**
  1. Select Start = `15:00`, End = `14:00`. Submit.
- **Expected Result:** UI blocks submission displaying: *"End time must occur after start time."*

### TC-039: Create Booking - Start Time Equals End Time (Negative)
- **Pre-conditions:** User opens reservation form.
- **Steps:**
  1. Select Start = `12:00`, End = `12:00`. Submit.
- **Expected Result:** Blocked by client-side verification as invalid duration.

### TC-040: Create Booking - Time Limits Lower Bound (Negative)
- **Pre-conditions:** User allocates slot.
- **Steps:**
  1. Enter Start = `05:00`.
- **Expected Result:** Form inputs or logic restrict selection to business hours (06:00 to 22:00).

### TC-041: Create Booking - Time Limits Upper Bound (Negative)
- **Pre-conditions:** User allocates slot.
- **Steps:**
  1. Enter End = `23:00`.
- **Expected Result:** Form rejects slot as operations close at 22:00.

### TC-042: Edit Booking - Successful Fields Save (Happy)
- **Pre-conditions:** Logged in. Booking details modal open for a booking owned by current user.
- **Steps:**
  1. Click **✏️ Edit**.
  2. Change Name to "David Edited", Email to "david.edit@example.com".
  3. Click **💾 Save**.
- **Expected Result:** Saved status toast shows, page values update, and modal returns to details view with new values.

### TC-043: Edit Booking - Modify Other User's Booking (Negative)
- **Pre-conditions:** Current user UID is different from the booking's `userId`.
- **Steps:**
  1. Access booking details card from timeline.
- **Expected Result:** Edit button is hidden; any programmatic update request receives a permission error.

### TC-044: Cancel Booking - Delete Confirmation Yes (Happy)
- **Pre-conditions:** Open details for own booking.
- **Steps:**
  1. Click **🗑 Cancel**.
  2. Click **OK** on browser confirmation.
- **Expected Result:** Booking is deleted from database, toast notification displays success, modal closes, and timeline removes the block.

### TC-045: Cancel Booking - Delete Confirmation No (Happy)
- **Pre-conditions:** Open details for own booking.
- **Steps:**
  1. Click **🗑 Cancel**.
  2. Click **Cancel** on browser confirmation.
- **Expected Result:** Deletion aborted, booking remains intact.

---

## 4. Court Booking Management - Recurring & Details

### TC-046: Bulk Booking - Weekday Recurring (Happy)
- **Pre-conditions:** Logged in. No bookings on Court 1 during selected hour in current month.
- **Steps:**
  1. Open Allocate Slot form.
  2. Choose **Weekday Recurring Month Block**.
  3. Select Court 1, Date = Any day in current month, Start = `09:00`, End = `10:00`.
  4. Fill name, submit.
- **Expected Result:** System runs a loop through all weekdays in the current month, performs conflict checks, and books all available weekdays.

### TC-047: Bulk Booking - Daily Recurring (Happy)
- **Pre-conditions:** Logged in.
- **Steps:**
  1. Choose **Daily Recurring Month Block** under recurring type.
  2. Select Court 1, Start = `18:00`, End = `19:00`, Name = "Club Practice". Submit.
- **Expected Result:** Books every day of the selected month on Court 1.

### TC-048: Bulk Booking - Partial Conflicts (Happy)
- **Pre-conditions:** Daily recurring block requested. Court is already booked on the 15th of the month.
- **Steps:**
  1. Select **Daily Recurring Month Block**.
  2. Fill details and submit.
- **Expected Result:** All days except the 15th are booked. Conflict on the 15th is safely skipped without aborting the entire sequence.

### TC-049: Detail Modal - Owner Email Visibility (Happy)
- **Pre-conditions:** User is viewing their own booking.
- **Steps:**
  1. Click on own booking in the daily schedule matrix.
- **Expected Result:** Details modal opens, and owner email shows as clear text (e.g. `owner@domain.com`).

### TC-050: Detail Modal - Non-Owner Email Masking (Happy)
- **Pre-conditions:** User is viewing a booking created by another account.
- **Steps:**
  1. Click on another user's booking cell in matrix.
- **Expected Result:** Email field is masked for security and privacy (e.g. `da***@example.com`).

### TC-051: Detail Modal - Non-Owner Actions Stripping (Happy)
- **Pre-conditions:** Booking is owned by User A. User B is logged in.
- **Steps:**
  1. User B opens details for User A's booking.
- **Expected Result:** The **Edit** and **Cancel** buttons are hidden (`ownerActions` div is hidden).

### TC-052: Detail Modal - Guest Views Booking (Happy)
- **Pre-conditions:** Guest User logged in.
- **Steps:**
  1. Click any booked cell in daily timeline.
- **Expected Result:** Details display safely; email is masked, edit/cancel controls are omitted.

### TC-053: Form Validation - Missing Name Field (Negative)
- **Pre-conditions:** Booking form open.
- **Steps:**
  1. Leave Name field empty.
  2. Attempt to submit.
- **Expected Result:** Browser prevents submit, focusing on the empty required input field.

### TC-054: Form Validation - Missing Email Field (Negative)
- **Pre-conditions:** Booking form open.
- **Steps:**
  1. Leave Email field empty.
  2. Click submit.
- **Expected Result:** Submission blocked by HTML5 form validation.

### TC-055: Form Validation - Invalid Email Format (Negative)
- **Pre-conditions:** Booking form open.
- **Steps:**
  1. Type "not-an-email" in email field.
  2. Submit.
- **Expected Result:** HTML5 email format checker blocks submission and requests a valid email format.

---

## 5. Member Management & Statuses

### TC-056: Directory - Active Members Fetch (Happy)
- **Pre-conditions:** Firestore contains members collection with active member documents.
- **Steps:**
  1. Navigate to `members.html`.
- **Expected Result:** Members table loads and renders all active member records from database.

### TC-057: Directory Search - Matching Query (Happy)
- **Pre-conditions:** Active member "Suthithra" exists in directory.
- **Steps:**
  1. Type "Suthi" in the search input box.
- **Expected Result:** Table filters instantly, displaying only "Suthithra" in the rows.

### TC-058: Directory Search - No Match Query (Happy)
- **Pre-conditions:** Open members page.
- **Steps:**
  1. Type "NonExistentNameXYZ" in search input.
- **Expected Result:** Table body empties and displays empty state message: *"No members found matching your filters."*

### TC-059: Directory Filter - Plan Selection (Happy)
- **Pre-conditions:** Members exist with plans: `Kids_5d` and `Individual_7d`.
- **Steps:**
  1. Select **Kids 5-Day/wk** in the plan dropdown filter.
- **Expected Result:** Table refreshes to show only trainees enrolled under the selected Kids plan.

### TC-060: Directory Filter - Plan with No Enrollments (Happy)
- **Pre-conditions:** No members are signed up under `Women_3d`.
- **Steps:**
  1. Select **Women 3-Day/wk** in the plan filter.
- **Expected Result:** Empty state display shows in the table.

### TC-061: Status Badges - Paid Member (Happy)
- **Pre-conditions:** Member's lastPaidDate is 10 days ago (within 30 days window).
- **Steps:**
  1. Locate the member in the directory list.
- **Expected Result:** Status badge reads **✅ Paid** in green.

### TC-062: Status Badges - Overdue Member (Happy)
- **Pre-conditions:** Member lastPaidDate is 35 days ago (older than 30 days).
- **Steps:**
  1. Locate the member in the list.
- **Expected Result:** Status badge reads **🔴 Overdue** in red.

### TC-063: Status Badges - Due Soon Member (Happy)
- **Pre-conditions:** Member lastPaidDate is 25 days ago (due in 5 days, within 7-day warning window).
- **Steps:**
  1. Locate the member in the list.
- **Expected Result:** Status badge reads **🟡 Due Soon** in yellow.

### TC-064: Member Stats - Total Count Display (Happy)
- **Pre-conditions:** 10 active members exist.
- **Steps:**
  1. Look at the top stats dashboard card "Total Active Members".
- **Expected Result:** Card displays count **10**.

### TC-065: Member Stats - Overdue Count Display (Happy)
- **Pre-conditions:** Exactly 3 members are overdue.
- **Steps:**
  1. Look at the stats card "Overdue Fees".
- **Expected Result:** Card displays count **3** and badge color is highlighted.

### TC-066: Member Stats - Due Soon Count Display (Happy)
- **Pre-conditions:** Exactly 2 members are due soon.
- **Steps:**
  1. Look at the stats card "Due Soon".
- **Expected Result:** Card displays count **2**.

### TC-067: Table Action - Mark Paid Click (Happy)
- **Pre-conditions:** Whitelisted User is viewing an overdue member row.
- **Steps:**
  1. Click the **💳 Mark Paid** button in the actions cell.
- **Expected Result:** Actions cell swaps into an inline confirmation widget showing: *"Confirm payment?"* with **✓ Yes** and **✕ No** buttons.

### TC-068: Table Action - Confirm Payment Cancel (Happy)
- **Pre-conditions:** Clicked Mark Paid. Inline confirmation is active.
- **Steps:**
  1. Click the **✕ No** button.
- **Expected Result:** Row cancels confirmation, and restores the original **💳 Mark Paid** button.

### TC-069: Table Action - Confirm Payment Yes (Happy)
- **Pre-conditions:** Clicked Mark Paid. Confirmation active.
- **Steps:**
  1. Click the **✓ Yes** button.
- **Expected Result:** Database is updated (lastPaidDate set to today), table re-renders, stats card updates, and a success toast notifications shows.

### TC-070: Guest Member Payments Action (Negative)
- **Pre-conditions:** Guest User is logged in.
- **Steps:**
  1. Inspect the members directory grid.
- **Expected Result:** The action column and buttons are absent; guest cannot mark members as paid.

---

## 6. Fee Alert Management

### TC-071: Alerts List - Alerts Loading (Happy)
- **Pre-conditions:** At least one member is overdue and one is due soon.
- **Steps:**
  1. Navigate to `members.html`.
  2. Inspect the **Pending Fee Alerts** panel.
- **Expected Result:** Alert rows load showing names of both members.

### TC-072: Filter Tabs - All Alerts (Happy)
- **Pre-conditions:** Both overdue and upcoming alerts exist.
- **Steps:**
  1. Click **All Alerts** tab.
- **Expected Result:** Displays all alerts sorted with Overdue at the top and Due Soon below.

### TC-073: Filter Tabs - Overdue Filter (Happy)
- **Pre-conditions:** Overdue and upcoming alerts exist.
- **Steps:**
  1. Click the **Overdue** tab.
- **Expected Result:** Alert list updates, displaying only members with overdue fees.

### TC-074: Filter Tabs - Upcoming Filter (Happy)
- **Pre-conditions:** Overdue and upcoming alerts exist.
- **Steps:**
  1. Click the **Due Soon** tab.
- **Expected Result:** Alert list updates, displaying only members whose fees are due within 7 days.

### TC-075: Alert Actions - Inline Payment Confirm (Happy)
- **Pre-conditions:** Admin opens the alerts panel.
- **Steps:**
  1. Click **💳 Mark Paid** on an alert row.
- **Expected Result:** Row action area shifts to confirmation buttons: *"Confirm payment? ✓ Yes ✕ No"*.

### TC-076: Alert Actions - Confirm Cancel (Happy)
- **Pre-conditions:** Inline confirmation active on alert row.
- **Steps:**
  1. Click **✕ No**.
- **Expected Result:** Reverts to showing the alert row details and the standard payment button.

### TC-077: Alert Actions - Confirm Success (Happy)
- **Pre-conditions:** Inline confirmation active on alert row.
- **Steps:**
  1. Click **✓ Yes**.
- **Expected Result:** Saves payment date to database, removes the member from the alerts list, updates summary counters, and shows a success toast.

### TC-078: Badge Count Synchronization - Overdue (Happy)
- **Pre-conditions:** Overdue counter displays "3".
- **Steps:**
  1. Complete payment processing for 1 overdue member.
- **Expected Result:** Overdue counter immediately decreases to "2".

### TC-080: Badge Count Synchronization - Upcoming (Happy)
- **Pre-conditions:** Upcoming counter displays "2".
- **Steps:**
  1. Complete payment processing for 1 upcoming member.
- **Expected Result:** Upcoming counter immediately decreases to "1".

### TC-080: Empty State Alerts Display (Happy)
- **Pre-conditions:** All members have paid fees (no overdue or due soon dates).
- **Steps:**
  1. View the Pending Fee Alerts panel.
- **Expected Result:** Displays the success card: *"🎉 All member fees are fully up to date!"*

---

## 7. Trainee Enrollment & Coaching Management

### TC-081: Add Trainee - Valid Input (Happy)
- **Pre-conditions:** Logged in. Booking details modal is open.
- **Steps:**
  1. Enter "Ethan Hunt" in the trainee name field.
  2. Select plan: "Kids 5-Day/wk".
  3. Select Join Date: Today.
  4. Click **+ Add**.
- **Expected Result:** Trainee is saved, enrollees list refreshes showing Ethan Hunt with the correct plan badge.

### TC-082: Add Trainee - Empty Name (Negative)
- **Pre-conditions:** Booking details open.
- **Steps:**
  1. Leave trainee name input empty.
  2. Click **+ Add**.
- **Expected Result:** Input is ignored; no database call is made.

### TC-083: Add Trainee - Custom Join Date (Happy)
- **Pre-conditions:** Booking details open.
- **Steps:**
  1. Type Name = "Bruce Wayne".
  2. Choose Join Date = `2026-06-01`.
  3. Click **+ Add**.
- **Expected Result:** Trainee is added with joinDate and lastPaidDate set to `2026-06-01`.

### TC-084: Plan Dropdown Codes Coverage (Happy)
- **Pre-conditions:** Open booking modal details, examine plan select list.
- **Steps:**
  1. Click plan selection dropdown.
- **Expected Result:** List includes all 16 valid operational codes (Kids, Individual, Group, Women, Adults, PT, Advance).

### TC-085: Enrollees List - Display Badges (Happy)
- **Pre-conditions:** Booking details modal open. Trainees are enrolled.
- **Steps:**
  1. Look at the enrollees list.
- **Expected Result:** Renders each enrollee name, plan code badge (using plan styling map: name, color, background), and join/paid dates.

### TC-086: Enrollees List - Empty State Display (Happy)
- **Pre-conditions:** Booking has no trainees enrolled.
- **Steps:**
  1. Open booking details.
- **Expected Result:** List shows a centered grey label: *"No enrollees yet"*.

### TC-087: Enrollment limit - Up to 30 Enrollees (Happy)
- **Pre-conditions:** Booking has 29 enrollees.
- **Steps:**
  1. Input 30th enrollee name.
  2. Click **+ Add**.
- **Expected Result:** Enrollee is successfully added; count equals 30.

### TC-088: Enrollment limit - Exceeding 30 Enrollees (Negative)
- **Pre-conditions:** Booking has exactly 30 enrollees.
- **Steps:**
  1. Try to input a 31st enrollee name.
  2. Click **+ Add**.
- **Expected Result:** Addition is rejected, UI shows alert: *"This coaching batch has reached its maximum limit of 30 trainees."*

### TC-089: Remove Enrollee - Action Click (Happy)
- **Pre-conditions:** Trainees enrolled. Whitelisted user open details.
- **Steps:**
  1. Click the `&times;` (Remove) button next to a trainee's name.
  2. Click **OK** on browser confirmation.
- **Expected Result:** Trainee is deleted from the `members` collection, list refreshes to reflect removal.

### TC-090: Remove Enrollee - Abort confirmation (Happy)
- **Pre-conditions:** Trainees enrolled.
- **Steps:**
  1. Click the `&times;` (Remove) button next to a trainee.
  2. Click **Cancel** on browser confirmation.
- **Expected Result:** Removal is aborted, trainee remains in list.

### TC-091: Guest Enrollment - Controls Hidden (Happy)
- **Pre-conditions:** Guest User logged in. Booking details open.
- **Steps:**
  1. Inspect the modal layout.
- **Expected Result:** The enrollment input bar and date selector are completely hidden (`.enroll-block` has `.hidden` class).

### TC-092: Guest Enrollment - Remove Button Hidden (Happy)
- **Pre-conditions:** Guest User logged in. Trainees exist in list.
- **Steps:**
  1. Inspect list items.
- **Expected Result:** The delete `&times;` buttons are omitted from the HTML string.

### TC-093: Guest Enrollment - Add Programmatic Block (Negative)
- **Pre-conditions:** Guest User logged in.
- **Steps:**
  1. Run `handleEnrollmentSubmit()` from console.
- **Expected Result:** Function returns early showing guest permission warning.

### TC-094: Guest Enrollment - Remove Programmatic Block (Negative)
- **Pre-conditions:** Guest User logged in.
- **Steps:**
  1. Attempt to execute deletion sequence on member document from console.
- **Expected Result:** Denied by client check and Firestore security rules.

### TC-095: Matrix Grid - Enrollment Badge Sync (Happy)
- **Pre-conditions:** Court booking has 3 enrollees. Daily Matrix view open.
- **Steps:**
  1. Examine the corresponding booking cell on the timeline.
- **Expected Result:** Cell displays a badge read: **3 Enrolled** under the organizer name.

---

## 8. Settings & Configurations

### TC-096: Whitelist - Add Valid Email (Happy)
- **Pre-conditions:** Logged in as Super Admin.
- **Steps:**
  1. Open `settings.html`.
  2. Enter "coach@yesmash.in" in input.
  3. Click **Add**.
- **Expected Result:** Added successfully, shows in Whitelisted list.

### TC-097: Whitelist - Add Empty Field (Negative)
- **Pre-conditions:** Open settings.
- **Steps:**
  1. Leave whitelist input empty.
  2. Click **Add**.
- **Expected Result:** HTML5 form validation blocks submit.

### TC-098: Whitelist - Add Invalid Email Format (Negative)
- **Pre-conditions:** Open settings.
- **Steps:**
  1. Input "not-an-email" in whitelist box.
  2. Click **Add**.
- **Expected Result:** HTML5 validation blocks submit.

### TC-099: Whitelist - Email Too Long (Negative)
- **Pre-conditions:** Whitelist form open.
- **Steps:**
  1. Paste an email containing 81 characters (e.g. `a...a@test.com`).
  2. Click **Add**.
- **Expected Result:** Native HTML5 `maxlength="80"` prevents typing further characters, or JS validation triggers error: *"Email cannot exceed 80 characters."*

### TC-100: Whitelist - Duplicate Email (Negative)
- **Pre-conditions:** "admin@yesmash.in" is already whitelisted.
- **Steps:**
  1. Type "admin@yesmash.in" into input.
  2. Click **Add**.
- **Expected Result:** Blocked with error: *"This email is already whitelisted."*

### TC-101: Whitelist - Remove Confirmation prompt (Happy)
- **Pre-conditions:** Logged in as Super Admin. Whitelisted emails exist.
- **Steps:**
  1. Click `&times;` next to email.
- **Expected Result:** The button hides, replaced with the custom confirmation block *"Remove email? ✓ Yes ✕ No"*.

### TC-102: Whitelist - Remove Confirm No (Happy)
- **Pre-conditions:** Custom confirmation active.
- **Steps:**
  1. Click **✕ No**.
- **Expected Result:** Confirmation widget hides, restoring the email item layout.

### TC-103: Whitelist - Remove Confirm Yes (Happy)
- **Pre-conditions:** Custom confirmation active.
- **Steps:**
  1. Click **✓ Yes**.
- **Expected Result:** Whitelisted email is removed from Firestore config, item disappears from list, success toast is displayed.

### TC-104: Whitelist - Empty State Display (Happy)
- **Pre-conditions:** No whitelisted email exist.
- **Steps:**
  1. View Whitelist list panel.
- **Expected Result:** Renders warning: *"No whitelisted emails configured yet."*

### TC-105: Guest Setting - Enable Login Checkbox (Happy)
- **Pre-conditions:** Logged in as Super Admin. Guest login is disabled.
- **Steps:**
  1. Check the Guest Access checkbox.
- **Expected Result:** Firestore updates config to `allowGuestLogin: true`, toast shows success.

### TC-106: Guest Setting - Disable Login Checkbox (Happy)
- **Pre-conditions:** Logged in as Super Admin. Guest login is enabled.
- **Steps:**
  1. Uncheck the Guest Access checkbox.
- **Expected Result:** Firestore updates config to `allowGuestLogin: false`, toast shows success.

### TC-107: Pricing Board - Save Updated Rates (Happy)
- **Pre-conditions:** Logged in. Open pricing board modal from dashboard.
- **Steps:**
  1. Change Hourly Slot rate from 300 to 350.
  2. Change Kids coaching rate from 2000 to 2200.
  3. Click **Save Pricing**.
- **Expected Result:** Rates are updated in `configs/pricing` in Firestore, pricing values update dynamically on dashboard stats and program pricing cards.

### TC-108: Pricing Board - Negative Values Block (Negative)
- **Pre-conditions:** Pricing board modal open.
- **Steps:**
  1. Set Hourly Slot rate to `-100`.
  2. Attempt to save.
- **Expected Result:** Blocked by HTML5 `min="1"` validation.

### TC-109: Pricing Board - Zero Value Block (Negative)
- **Pre-conditions:** Pricing board modal open.
- **Steps:**
  1. Set Hourly Slot rate to `0`.
  2. Click Save.
- **Expected Result:** Blocked by HTML5 `min="1"` validation.

### TC-110: Pricing Board - Guest Programmatic Update (Negative)
- **Pre-conditions:** Guest User logged in.
- **Steps:**
  1. Run `handlePricingSubmit()` programmatically via console.
- **Expected Result:** Rejects update, showing programmatic permission denied toast.

---

## 9. Programs & Fee Calculator

### TC-111: Programs Tabs - View Switching (Happy)
- **Pre-conditions:** Navigate to `programs.html`.
- **Steps:**
  1. Click **Coaching Programs** tab.
  2. Click **Coaching Schedule** tab.
  3. Click **Membership Fee Calculator** tab.
- **Expected Result:** Tabs toggling correctly, showing the corresponding sub-panels, updating active tab styling.

### TC-112: Calculator - Guest Category Non-Peak (Happy)
- **Pre-conditions:** Calculator tab selected.
- **Steps:**
  1. Select Category = **Guest Player**.
  2. Leave Peak Hour toggle = OFF.
  3. Set Hours = `2`.
- **Expected Result:** Renders breakdown with non-peak hourly rate (e.g. ₹150) and displays Total Fee = **₹300**.

### TC-113: Calculator - Guest Category Peak Hour (Happy)
- **Pre-conditions:** Calculator tab selected.
- **Steps:**
  1. Select Category = **Guest Player**.
  2. Toggle Peak Hour = ON.
  3. Set Hours = `2`.
- **Expected Result:** Renders breakdown with peak hourly rate (e.g. ₹200) and displays Total Fee = **₹400**.

### TC-114: Calculator - Guest Category Hours Input (Happy)
- **Pre-conditions:** Calculator tab selected.
- **Steps:**
  1. Select Category = **Guest Player**.
  2. Set Hours = `5`.
- **Expected Result:** Renders breakdown correctly; total equals `rate * 5`.

### TC-115: Calculator - Member Coaching Selection (Happy)
- **Pre-conditions:** Calculator tab selected.
- **Steps:**
  1. Select Category = **Member / Kid Coaching**.
  2. Select Plan = **Kids 3-Day/wk**.
  3. Set Duration = `1` Month.
- **Expected Result:** Renders breakdown with Kids 3-Day rate (e.g. ₹2000), total equals **₹2,000**.

### TC-116: Calculator - Coaching Duration Multiple Months (Happy)
- **Pre-conditions:** Calculator tab selected.
- **Steps:**
  1. Select Category = **Member / Kid Coaching**.
  2. Select Plan = **Kids 3-Day/wk**.
  3. Set Duration = `3` Months.
- **Expected Result:** Renders breakdown with monthly rate * 3, total equals **₹6,000**.

### TC-117: UI Pricing Cards Sync (Happy)
- **Pre-conditions:** Hourly slot rate was updated in settings to 350.
- **Steps:**
  1. Open `programs.html` and look at Pricing Cards.
- **Expected Result:** Guest play card displays the updated price ₹350 dynamically.

### TC-118: Calculator - Guest Hours Empty Fallback (Happy)
- **Pre-conditions:** Calculator tab selected. Category = Guest.
- **Steps:**
  1. Clear the Hours input box (leave empty).
- **Expected Result:** Calculator logic falls back to `1` hour as a default, displaying correct rate total.

### TC-119: Calculator - Coaching Months Empty Fallback (Happy)
- **Pre-conditions:** Calculator tab selected. Category = Coaching.
- **Steps:**
  1. Clear the Months input box (leave empty).
- **Expected Result:** Calculator logic falls back to `1` month default.

### TC-120: UI Calculator Dynamic Dropdown Options Sync (Happy)
- **Pre-conditions:** Standard coaching rates modified in Firestore pricing document.
- **Steps:**
  1. Navigate to Calculator.
  2. Select plan from dropdown.
- **Expected Result:** Selected plan fee calculation uses the updated pricing rates.

---

## 10. Scheduling Timeline & Calendar

### TC-121: Calendar Navigation - Previous Month (Happy)
- **Pre-conditions:** Current month is June 2026.
- **Steps:**
  1. Navigate to `dashboard.html`.
  2. Click the left arrow `<` on the calendar header.
- **Expected Result:** Calendar updates to display May 2026, rendering correct days grid.

### TC-122: Calendar Navigation - Next Month (Happy)
- **Pre-conditions:** Current month is June 2026.
- **Steps:**
  1. Click the right arrow `>` on the calendar.
- **Expected Result:** Calendar updates to July 2026.

### TC-123: Calendar - Click Selected Date (Happy)
- **Pre-conditions:** Calendar is open.
- **Steps:**
  1. Click on day "15" on the calendar.
- **Expected Result:** Selected date displays `2026-06-15`, and the timeline displays bookings specifically for June 15th.

### TC-124: Daily Matrix Time Slots Coverage (Happy)
- **Pre-conditions:** Navigate to `schedule.html`.
- **Steps:**
  1. Check the time column of the matrix grid.
- **Expected Result:** Row times span hourly from **06:00 - 07:00** down to **22:00 - 23:00**.

### TC-125: Daily Matrix Columns Build (Happy)
- **Pre-conditions:** Active courts seeded in database (Court 1, Court 2, Court 3).
- **Steps:**
  1. Load `schedule.html` and check the table headers.
- **Expected Result:** Table headers render exactly matching columns: **Time | Court 1 | Court 2 | Court 3**.

### TC-126: Daily Matrix Click Open Slot (Happy)
- **Pre-conditions:** Slot on Court 1 from 08:00 - 09:00 is free on selected date.
- **Steps:**
  1. Click the "Click to Book" text inside Court 1, 08:00 column cell.
- **Expected Result:** Opens the **Quick Reservation** modal form pre-filled with Court 1, start 08:00, end 09:00, and selected date.

### TC-127: Daily Matrix Click Booked Slot (Happy)
- **Pre-conditions:** Slot on Court 2 is already booked.
- **Steps:**
  1. Click on the booked cell displaying the organizer name.
- **Expected Result:** Opens the **Booking Details** modal window, showing details, enrollees, and owner action buttons (if owned).

### TC-130: Daily Matrix Cell Class Categories (Happy)
- **Pre-conditions:** Bookings exist with categories: coaching (coaching), rental (court_rental), personal training (personal_training).
- **Steps:**
  1. Look at cells styling.
- **Expected Result:** Grid cells display styling corresponding to categories (green for rental, blue for coaching, yellow for training, red for advanced).

### TC-129: Matrix Day Controls - Next Day Button (Happy)
- **Pre-conditions:** Selected date is `2026-06-26`.
- **Steps:**
  1. On `schedule.html`, click the `>` (Next Day) button.
- **Expected Result:** Date input value updates to `2026-06-27`, and the matrix refreshes showing Court bookings for June 27th.

### TC-130: Matrix Day Controls - Previous Day Button (Happy)
- **Pre-conditions:** Selected date is `2026-06-26`.
- **Steps:**
  1. Click the `<` (Previous Day) button.
- **Expected Result:** Date updates to `2026-06-25`, and timeline updates.

---

## 11. Security, Edge Cases & UI Responsiveness

### TC-131: XSS Injection - Organizer Name in Matrix (Happy/Sanitized)
- **Pre-conditions:** Booking is created with name `<script>alert('XSS')</script>Tester`.
- **Steps:**
  1. Navigate to daily matrix in `schedule.html`.
- **Expected Result:** HTML code is rendered as plain text in the table cell without executing.

### TC-132: XSS Injection - Booking Details Modal (Happy/Sanitized)
- **Pre-conditions:** Booking organizer name contains XSS script.
- **Steps:**
  1. Click on the booked cell to open details.
- **Expected Result:** Organizer name displays as plain text in the details modal; no popup or code executes.

### TC-133: XSS Injection - Trainee List (Happy/Sanitized)
- **Pre-conditions:** Trainee added with name `<img src=x onerror=alert(1)>`.
- **Steps:**
  1. View enrollees list in booking details.
- **Expected Result:** Trainee name displays safely, image tag does not execute scripting code.

### TC-134: XSS Injection - Whitelist Email Tooltip (Happy/Sanitized)
- **Pre-conditions:** Email containing double quotes and scripts is added to whitelist.
- **Steps:**
  1. Hover or inspect delete button tooltip in whitelist panel.
- **Expected Result:** Email string is properly escaped inside the button's `title="..."` attribute, preventing DOM injection bypass.

### TC-135: Data Limits - Name Length Truncation (Happy/Constraint)
- **Pre-conditions:** User opens reservation form.
- **Steps:**
  1. Attempt to type a name containing 50 characters in the Organizer Name box.
- **Expected Result:** Typing stops at 40 characters due to input `maxlength="40"` constraint.

### TC-136: Data Limits - Email Length Truncation (Happy/Constraint)
- **Pre-conditions:** Whitelist or booking form open.
- **Steps:**
  1. Paste an email string containing 100 characters.
- **Expected Result:** Input is truncated at 80 characters due to `maxlength="80"` limit.

### TC-137: Business Rules - Zero Duration Booking (Negative)
- **Pre-conditions:** User opens booking dialog.
- **Steps:**
  1. Set Start Time = `10:00`, End Time = `10:00`.
  2. Click confirm.
- **Expected Result:** Submission blocked with validation message: *"End time must occur after start time."*

### TC-138: Business Rules - Crossing Midnight Slots (Negative)
- **Pre-conditions:** Booking form open.
- **Steps:**
  1. Request Start = `23:00`, End = `01:00`.
- **Expected Result:** Form inputs prevent selecting times outside operational boundaries (06:00 to 22:00).

### TC-139: Date Bounds - Leap Year Recurring Blocks (Happy)
- **Pre-conditions:** Month selected is February 2028 (Leap Year).
- **Steps:**
  1. Select **Daily Recurring Month Block** for February.
  2. Confirm booking.
- **Expected Result:** Sequence books slots on all 29 days of February correctly, without skip or overflow into March.

### TC-140: UI Responsive - Mobile Nav Layout (Happy)
- **Pre-conditions:** Load page on device width < 768px (Mobile viewport).
- **Steps:**
  1. Examine bottom of screen.
- **Expected Result:** Bottom navigation bar (Home, Schedule, Members, Programs) is fixed to the bottom of the screen with touch-friendly spacing.

### TC-141: UI Responsive - Hamburger Menu Toggle (Happy)
- **Pre-conditions:** Mobile layout width < 768px.
- **Steps:**
  1. Tap the hamburger icon ☰ on the top header.
- **Expected Result:** Navigation menu panel slides down or activates overlay, displaying links. Tap again collapses.

### TC-142: UI Theme - Light Mode Toggle (Happy)
- **Pre-conditions:** Theme is currently dark mode.
- **Steps:**
  1. Click the ☀️ toggle button in the header.
- **Expected Result:** Theme switches to Light Mode instantly; button text icon swaps to 🌙.

### TC-143: UI Theme - Dark Mode Toggle (Happy)
- **Pre-conditions:** Theme is light mode.
- **Steps:**
  1. Click the 🌙 toggle button.
- **Expected Result:** CSS switches back to default Dark Mode stylesheet variables; button icon returns to ☀️.

### TC-144: UI Theme - Preference Persistence (Happy)
- **Pre-conditions:** Theme is set to Light Mode.
- **Steps:**
  1. Reload page or open `schedule.html`.
- **Expected Result:** System reads theme preference from `localStorage`, applying Light Mode instantly on loading screen.

### TC-145: FOUC Protection - Initial Auth Flashing (Happy)
- **Pre-conditions:** Slow connection test environment.
- **Steps:**
  1. Refresh `dashboard.html`.
- **Expected Result:** Layout content is hidden during initial firebase auth state check, preventing flashing of unauthenticated menu panels.

### TC-146: Calculator - Coaching Duration Limit (Negative)
- **Pre-conditions:** Open programs calculator.
- **Steps:**
  1. Input duration = `-5` months.
- **Expected Result:** Fallback defaults values to 1, calculation remains positive.

### TC-147: Matrix Grid - Scroll Overflow (Happy)
- **Pre-conditions:** Screen resolution is set to a low resolution (e.g. 1024x768).
- **Steps:**
  1. Open `schedule.html`.
- **Expected Result:** The matrix container wraps with horizontal scrollbar (`overflow-x: auto`), maintaining timeline alignment without cutting off layout.

### TC-148: Detail Modal - Trainee Scroll Overflow (Happy)
- **Pre-conditions:** 25 trainees are added to a coaching block.
- **Steps:**
  1. Open booking details.
- **Expected Result:** Enrollees list container scrolls vertically (`overflow-y: auto`), keeping modal buttons visible within the viewport.

### TC-149: Whitelist Input - Script Stripping (Happy)
- **Pre-conditions:** Super admin whitelists a user.
- **Steps:**
  1. Enter `  Admin.User@domain.com  ` (with extra spaces and capital letters).
  2. Click Add.
- **Expected Result:** Email is sanitized to lowercase and trimmed to `admin.user@domain.com` before database insertion.

### TC-150: Double-Booking Conflict - Transaction Check (Happy)
- **Pre-conditions:** Open two browser tabs on the same date/court slot.
- **Steps:**
  1. On Tab 1, prepare to book Court 1 at 18:00.
  2. On Tab 2, prepare the same slot.
  3. Click confirm on Tab 1, then immediately click confirm on Tab 2.
- **Expected Result:** Tab 1 booking is saved. Tab 2 booking is rejected with conflict error toast because the conflict checking function checks active bookings state right before writing.
