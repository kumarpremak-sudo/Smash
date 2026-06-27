# Multi-Tenancy & RBAC Implementation Plan

This plan details the architectural transition from a single-tenant "Allowed Emails Array" auth system to a robust, strict Multi-Tenant setup utilizing Firestore Security Rules, `academyId` isolation, and a `users` collection.

## User Review Required

> [!WARNING]
> This represents a major architectural shift. All existing data in `bookings`, `members`, and `configs` will become inaccessible unless migrated to include an `academyId` field. If you are starting fresh, this is not an issue. If you have production data, a migration script will be needed.

## Open Questions

> [!IMPORTANT]
> 1. **Existing Data Migration:** Do you need a script to backfill an `academyId` onto all your existing bookings and members, or is it okay to start with a fresh database for testing?
> 2. **Tenant Creation:** How will an `academyId` be assigned to new Tenant Admins? I plan to add a UI in `settings.html` for the Super Admin to create Academies and assign Tenant Admins. Is this acceptable?

## Proposed Changes

### Firestore Security Rules

#### [NEW] [firestore.rules](file:///c:/Users/Admin/Documents/POC/Badminton/firestore.rules)
Create the master security rules file enforcing isolation:
- `isSuperAdmin()` checks `users/{uid}` for `SUPER_ADMIN` role.
- `hasAcademyAccess(academyId)` ensures users can only read/write documents where `resource.data.academyId == user.academyId`.
- Block Staff users from modifying permissions or reading across tenants.

### Auth & Global Configuration Layer

#### [MODIFY] [js/shared.js](file:///c:/Users/Admin/Documents/POC/Badminton/js/shared.js)
- **`checkUserAccess(user)`:** Rewrite to query the `users` collection instead of `configs/auth`.
  - Fetch `users/{uid}`.
  - Store `currentUser.academyId` and `currentUser.role`.
- **Query Hardening:** Append `where("academyId", "==", currentUser.academyId)` to all global data fetches:
  - `loadCourts()`
  - `loadMembers()`
  - `loadPricingRates()`
  - `checkBookingConflicts()`

### Core Operations & Dashboards

#### [MODIFY] [js/dashboard.js](file:///c:/Users/Admin/Documents/POC/Badminton/js/dashboard.js)
- **Data Creation:** Inject `academyId: currentUser.academyId` into every `addDoc` and `batch.set` operation for:
  - New Bookings
  - New Members (Trainees)
- **Data Queries:** Add the `academyId` filter to `loadDashboardStats()` and booking range queries.

#### [MODIFY] [js/schedule.js](file:///c:/Users/Admin/Documents/POC/Badminton/js/schedule.js)
- Similar to the dashboard, ensure `academyId` is injected into new bookings and members created from the timeline view.
- Filter timeline fetches securely.

### Access Management UI

#### [MODIFY] [settings.html](file:///c:/Users/Admin/Documents/POC/Badminton/settings.html) & [js/settings.js](file:///c:/Users/Admin/Documents/POC/Badminton/js/settings.js)
- **Super Admin View:** Add a panel to create new `academies` and assign initial `TENANT_ADMIN` users to them.
- **Tenant Admin View:** Replace the generic "Allowed Emails" whitelist with a "Staff Users" management panel.
  - Allow Tenant Admins to add `STAFF` users specifically bound to their `academyId`.
  - Disable Staff user creation for actual Staff members.

## Verification Plan

### Automated Tests
- N/A (Client-side validation).

### Manual Verification
1. **Super Admin Tests:** Log in as `kumarprem.ak@gmail.com`. Verify ability to create a new Academy ("Smash Downtown") and assign a Tenant Admin email.
2. **Tenant Isolation Test:** Log in as the new Tenant Admin. Create a booking. Log in as a *second* Tenant Admin (different Academy). Verify the first booking is strictly invisible and inaccessible.
3. **Staff Restriction Test:** Log in as a Staff User for Tenant 1. Attempt to access `settings.html` or manually run `addDoc` on the `users` collection via console. Verify Firestore strictly rejects the operation (`Permission Denied`).
