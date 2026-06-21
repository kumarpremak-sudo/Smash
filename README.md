# Smash. | Premium Badminton Court Booking

A high-performance, serverless, single-page web application (SPA) for reserving badminton courts and managing schedules. 

Designed with a premium dark-theme aesthetic inspired by `finresolver.com`, the application is built entirely with **Vanilla HTML/CSS/JavaScript (ES6)** and uses **Firebase** for real-time database syncing and authentication.

---

## ⚡ Key Features

- **Single Page Application (SPA):** Seamlessly transition between Dashboard views and Hourly Matrix timelines without page reloads.
- **Real-time Synchronization:** Powered by Firebase Cloud Firestore for instant schedule updates.
- **Secure Permissions:** Integrates Firebase Auth (Google Sign-In & Anonymous Guest mode). Only the organizer who created a booking can edit its details or cancel the reservation.
- **Privacy Enforcement:** Contact emails of other organizers are automatically masked (e.g. `jo***@domain.com`) to prevent scraping and protect member privacy.
- **Daily Matrix Grid:** A responsive timeline showing court availability (06:00 to 22:00) with quick booking cells.
- **Player Enrollment:** Allows users to join existing games or add play partners directly into an organized slot.
- **Auto-Configuring:** Self-seeds the default badminton courts (`Court 1`, `Court 2`, `Court 3`) on first startup.

---

## 🛠️ Architecture & Technology Stack

- **Hosting:** Static HTML/CSS/JS hosted directly on **GitHub Pages**.
- **Database:** Firebase Cloud Firestore (NoSQL, real-time database).
- **Authentication:** Firebase Auth (Google Provider & Anonymous Sign-In).
- **Styling:** Custom CSS with typography system (fonts `'Syne'`, `'Inter'`, and `'DM Mono'`), micro-interactions, responsive side-drawer navigation, and smooth modal animations.

---

## 📂 Project Directory Structure

```
├── frontend/
│   ├── app.js               # Main application and Firebase operations module
│   ├── config.js            # Active Firebase API credentials (gitignored in production)
│   ├── config.example.js    # Template file for Firebase credentials
│   ├── index.html           # Unified SPA layout (views: login, dashboard, daily timeline)
│   ├── logo.png             # Smash. brand logo
│   └── style.css            # Custom premium CSS design tokens and responsive classes
├── start_server.bat         # Script to run local web server for testing
└── README.md                # Project documentation and guide
```

---

## ⚙️ Secure Firebase Firestore Rules

To secure the database, copy and paste the following rules into your **Firebase Console** -> **Cloud Firestore** -> **Rules** tab. This secures your backend completely:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Courts are readable by anyone, but writable only by authenticated sessions
    match /courts/{courtId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Pricing configuration parameters are readable by anyone, writable by admin
    match /configs/{configId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Bookings security configuration
    match /bookings/{bookingId} {
      // 1. Anyone logged in (Google or Guest) can view bookings
      allow read: if request.auth != null;
      
      // 2. Creation is allowed only if the owner UID matches the creator's UID
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      
      // 3. Deletion is allowed only by the owner
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // 4. Updates are allowed in two cases:
      allow update: if request.auth != null && (
        // Case A: The user is the owner (can change details like customer_name/email)
        (resource.data.userId == request.auth.uid && request.resource.data.userId == resource.data.userId) ||
        
        // Case B: Public enrollment. Non-owners can ONLY modify the 'enrollees' field.
        // All other core fields must remain unchanged to prevent tampering.
        (
          request.resource.data.court_id == resource.data.court_id &&
          request.resource.data.customer_name == resource.data.customer_name &&
          request.resource.data.customer_email == resource.data.customer_email &&
          request.resource.data.date == resource.data.date &&
          request.resource.data.start_time == resource.data.start_time &&
          request.resource.data.end_time == resource.data.end_time &&
          request.resource.data.userId == resource.data.userId &&
          request.resource.data.enrollees != resource.data.enrollees
        )
      );
    }
  }
}
```

---

## 💻 Local Quickstart

### 1. Configure Firebase Credentials
1. Copy `frontend/config.example.js` to `frontend/config.js`.
2. Replace the placeholder credentials with your Firebase project configurations.

### 2. Run Local Web Server
Ensure Python is installed on your machine.
- Double-click **`start_server.bat`** in the project root.
- Open your browser to `http://localhost:8000`.

---

## 🚀 GitHub Pages & DNS Routing (`yesmash.in`)

1. **Deploy Frontend:** Push the contents of the `frontend` folder to a public GitHub repository. Enable **GitHub Pages** in the repository settings, selecting the branch and folder (e.g. root) to build from.
2. **Cloudflare custom DNS:**
   - In your Cloudflare DNS panel for `yesmash.in`, create a **CNAME record** pointing your root domain or subdomain to your GitHub Pages username domain:
     - **Type:** `CNAME`
     - **Name:** `@` (or `www`)
     - **Target:** `<username>.github.io`
     - **Proxy status:** Proxied (orange cloud) or DNS only (depending on preference).
3. **Configure Custom Domain in Github Pages:** In your GitHub repository's **Settings** -> **Pages**, enter your custom domain `yesmash.in` under **Custom Domain** and save. Check **Enforce HTTPS**.
