Code Modification & Refactoring

"Modify the open file to add [FEATURE_DESCRIPTION].Do NOT rewrite the entire file or output any introductory or concluding text.Output ONLY the specific lines or functions that changed. Use clear code comments to indicate where the modified code should be inserted."

Error Troubleshooting

"Review this error: [PASTE_ERROR_STRING].Fix it based on the code in @FILENAME.Output zero conceptual explanations, zero theory, and zero filler text.Provide ONLY the corrected code block and 1 short sentence stating the root cause."

Logic & Algorithm Writing

Write a compact [LANGUAGE] function that [FUNCTION_GOAL].Maximize token efficiency. Strip out verbose docstrings, long variable names, and excessive inline comments.Output the raw code block only."

 Boilerplate Setup

"Generate a minimal boilerplate configuration for [FRAMEWORK/TOOL] targeting [USE_CASE].Strip out all optional parameters, comments, and placeholders.Provide only the mandatory keys required to run." 



Context: Frontend-only app hosted on GitHub Pages. Firebase config is currently hardcoded in a `config.json` file on the window object.
Goal: Migrate these sensitive keys to GitHub Actions Secrets and Variables, and dynamically inject them into the build/deployment workflow so they aren't exposed in the source code repository.

Requirements:
1. GitHub Actions Workflow Code (`.github/workflows/deploy.yml`): Provide a YAML workflow for GitHub Pages deployment that reads GitHub Secrets and replaces placeholders in the codebase before deploying.
2. Codebase Adjustment: Show how to modify the JavaScript/HTML file to read these environment variables or placeholders during the GitHub Actions build step (e.g., using a script, `sed` commands in the runner, or standard build tools env replacement).
3. Step-by-Step Instructions: Provide a short, bulleted guide on exactly what keys to add inside the GitHub Repository settings (Settings > Secrets and variables > Actions).

Provide only the updated workflow YAML, the updated config initialization snippet, and the brief setup steps. No fluff.



Current setup: Admin can block a single slot or an entire month's slots for a member. Currently, cancellation only works manually, one slot at a time.
Goal: Add a bulk-cancellation feature for an entire month's worth of slots for a specific member or coaching group.

Requirements:
1. Input: if the cour admin cancel/update the booking for a month 
2. DB/Storage (e.g., firebase ): Suggest the most efficient query/scan strategy  to find all matching active reservations for that month without hitting throughput limits.
3. update the backend logic to handle the deletion/update. maximize performance.
4. Handle partial failures during  deletes, and ensure any associated payment/refund triggers or notification events are emitted.

Provide only the updated architecture overview and the clean, production-ready backend code. No fluff.


Role: Expert Frontend Engineer & UI/UX Designer

Context: I want to replicate the exact UI design, visual layout, and styling from a reference site ("https://finresolver.com/") and apply it cleanly to my current application's layout.

Objective: Provide the structural layout strategy and precise CSS/Tailwind variables to clone the design language of the reference site.

Requirements:
1. Design Language Breakdown:
   - Typography: Specify the primary/secondary font families, weights, and scale (headings vs body text).
   - Color Palette: Extract exact Hex codes for Primary, Secondary, Backgrounds (light/dark states), Surfaces, Borders, and Accent colors.
   - Spacing & Rhythm: Map out the padding, margins, border-radius, and grid/flex gap systems used.

2. Component Cloning (Provide the structural HTML/JSX framework and exact CSS/Tailwind classes):
   - Shell: Navigation bar, sidebar layout, and footer structure.
   - Cards/Containers: Box shadows, border styling, states (:hover, :focus, :active).
   - Inputs/Forms: Input fields, dropdown selectors, toggle sliders, and primary action buttons.
   - Data Displays: Layout styling for lists, tables, grids, and status badges.

3. Refactoring Strategy:
   - Show how to integrate these style tokens cleanly into a global stylesheet (CSS Variables) or a config file (Tailwind/unocss), ensuring it applies modularly to my existing features without breaking layout alignments.

Output: Provide only the design token specifications, clean modular component code, and exact CSS rules. No long explanations.

2. 

Goal: Implement Client-Side Role-Based Access Control (RBAC) and Multi-Tenancy secured strictly by Firestore Security Rules (no custom backend).

Roles & Rules Required:
1. Super Admin (Application Owner): Can create/whitelist Tenant Admins (Court Academies).
2. Tenant Admin (Academy Owner): Can manage their academy's bookings, coaching, and whitelist their own Staff Users.

Database Schema Strategy:
- Suggest a Firestore collection structure (e.g., `academies`, `users`, `bookings`) that supports multi-tenancy via an `academyId` field.

Security Requirements (Firestore Security Rules):
- Provide the exact Firestore Security Rules to enforce that users can only read/write data if their authenticated UID/Email matches their assigned role and `academyId` in a `users` collection.
- Ensure Tenant Admins can only read/write data belonging to their specific `academyId`.
- Ensure Staff Users cannot modify user permissions or add other users.

Frontend Implementation (JavaScript/TypeScript):
- Provide a clean client-side React/JS context or routing guard helper that checks the current logged-in user's role from Firestore and conditionally hides/shows UI elements (like the "Add User" button).

Provide only the Firestore database schema, the complete Firestore Security Rules file, and the frontend route guard code. No fluff.

3.

Strict Requirement: Complete data isolation between different Tenant Admins. Tenant 1 must never be able to read or write Tenant 2's data (bookings, members, coaching), and vice versa.

Database Design:
- Assume every document in collections like `bookings`, `members`, and `coaching` has a field called `tenantId`.
- collection mapping `uid` to `tenantId` and `role`.

Provide the Firestore Security Rules that:
1. Lookup the logged-in user's `tenantId` from the `/users/$(request.auth.uid)` document.
2. Allow read/write access to any resource document ONLY if the resource's `tenantId` matches the requesting user's `tenantId`.
3. Block any cross-tenant read/write queries entirely at the database level.

Provide only the Firestore Security Rules file and a quick breakdown of how it secures the data. No fluff.



Feature: A single-click "Cancel Everything / Hard Reset" button for Tenant . 

Requirements:
1. Scope: When clicked, it must securely delete ALL records (slots, member profiles, coaching data, bookings) belonging strictly to that specific Admin's `tenantId`, reverting their dashboard to a clean, fresh state.
2. Frontend Logic (JS/React): Provide a clean, optimized function to batch-delete or sequentially delete documents across multiple collections (`bookings`, `members`, `coaching`, etc.) matching the current user's `tenantId`. Include a confirmation modal block to prevent accidental clicks.
3. Firestore Security Rules: Update the security rules to ensure that:
   - Only a user with the role `tenantAdmin` can perform these deletions.
   - The admin can ONLY delete documents where the `tenantId` matches their own assigned `tenantId`. They must be completely blocked from wiping any other tenant's data.

Provide only the frontend batch-deletion code and the updated Firestore Security Rules. No fluff.

Major modification need in the application..

Newly registered court admin and should update their program, membership, schedule, and fee details. they can also update pricing schedule when ever they need. remove pricing setting from the dashoard and place it in the each program edit..

All the reservation (Booking Type,Category,Court) should be based on the court admin program page.. please do uderstand the whole picture of the requirement and implement without fucntions bugs..

Test the entire UI flow
Create walkthrough documentation.. with this email id - "kumarprem029@gmail"
no need to hardcode in the code, just use this id for all the functional case realated to mange program and reserve a cout..
if you fond any issue/bug.. pls fix the issue