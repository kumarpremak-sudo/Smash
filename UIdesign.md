# UI Design & Styling Replication Plan — FinResolver Design System

This document outlines the architectural implementation plan to replicate and integrate the exact UI design language, visual layout, and component styling from **FinResolver** (`https://finresolver.com/`) into the current application layout (`Smash Badminton POC`).

---

## 1. Design Language Breakdown

### Typography System
* **Primary / Body Font:** `'Inter'`, `'DM Sans'`, `sans-serif` (Weights: `400`, `500`, `600`)
* **Headings Font:** `'Syne'`, `sans-serif` (Weights: `500`, `600`, `700`, `800`)
* **Monospace / Data Font:** `'DM Mono'`, `monospace` (Weights: `400`, `500`)
* **Type Scale:**
  * `xs` (Secondary labels / subtext): `0.8125rem` (13px)
  * `sm` (Table text / badges): `0.875rem` (14px)
  * `base` (Primary body): `0.9375rem` (15px)
  * `h3` / `lg` (Subheadings / card titles): `1.25rem` (20px)
  * Display Headings: `1.5rem` to `2.6rem` using fluid responsive scale (`clamp()`)

### Color Palette Tokens (Dark & Light Theme States)

| Token Name | Dark Hex | Light Hex | Application / Description |
| :--- | :--- | :--- | :--- |
| `--bg` | `#0d1117` | `#eeecea` | App canvas background |
| `--surface` | `#151c28` | `#ffffff` | Card containers, header background, modal bodies |
| `--surface2` | `#1c2438` | `#f5f4f0` | Secondary inner panels, drawer items, input fills |
| `--border` | `#263040` | `#e4e2de` | Structural borders & table row dividers |
| `--text` | `#e8edf5` | `#1a2030` | Primary text content |
| `--muted` | `#8a96b2` | `#8a91a8` | Secondary labels, descriptions, muted indicators |
| `--accent` | `#00e5a0` | `#00b87d` | Primary Emerald green (active state, primary buttons) |
| `--accent2` | `#ff6b6b` | `#e84040` | Coral red (alerts, danger actions, pending fees) |
| `--accent3` | `#ffd166` | `#e09600` | Amber yellow (warnings, pending highlights) |
| `--accent4` | `#4dabf7` | `#2b80d4` | Sky blue (info tags, schedule highlights) |
| `--purple` | `#a78bfa` | `#6c42d8` | Soft purple (special module indicators) |

### Spacing & Rhythm Tokens
* **Border Radii:**
  * Small (`--radius-sm`): `6px` - `8px` (Buttons, form fields)
  * Medium (`--radius-md`): `10px` - `12px` (Cards, inner panels)
  * Large (`--radius-lg`): `16px` (Modals, full containers)
  * Full (`--radius-full`): `999px` (Badges, user avatar pills)
* **Layout Gaps:** `0.75rem`, `1rem`, `1.25rem`, `1.5rem`

---

## 2. Component Cloning Specifications

### Shell Components (Header & Mobile Drawer Navigation)
* **Header Bar:** 60px fixed height, sticky top positioning, glassmorphism blur background `rgba(21, 28, 40, 0.95)`, 1px solid bottom border (`--border`).
* **Drawer Navigation:** Slide-over drawer fixed on left/right with dark semi-transparent backdrop overlay (`backdrop-filter: blur(4px)`).

### Cards & Containers
* **Base Card:** `background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem;`
* **Interactive Hover Card:** Smooth translation `transform: translateY(-2px)`, subtle emerald border glow `border-color: rgba(0, 229, 160, 0.35)`, and elevated shadow `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25)`.

### Inputs & Action Buttons
* **Inputs & Selects:** `background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); padding: 0.6rem 0.85rem; outline: none;` Focus state transitions border to `var(--accent)`.
* **Primary Button:** `background: var(--accent); color: #000; font-family: var(--font-mono); font-weight: 700; border-radius: var(--radius-sm);` Hover state background `#00c98c`.
* **Secondary Button:** `background: var(--surface2); border: 1px solid var(--border); color: var(--text);` Hover state border `var(--accent4)`.

### Data Displays & Badges
* **Status Badges:** Rounded pills (`999px`), monospace font, uppercase tracking.
  * *Live/Active:* `background: rgba(0,229,160,0.12); color: var(--accent); border: 1px solid rgba(0,229,160,0.3);`
  * *Warning/Pending:* `background: rgba(255,209,102,0.12); color: var(--accent3); border: 1px solid rgba(255,209,102,0.3);`

---

## 3. Implementation & Refactoring Roadmap

### Phase 1: CSS Foundation Refactoring (`css/base.css`)
* Verify and lock down exact CSS custom properties matching FinResolver.
* Ensure light theme overrides (`:root.light-theme`) align with FinResolver light tokens.

### Phase 2: Modular Component Styling (`css/components.css`)
* Standardize interactive card components, buttons (`.btn-primary`, `.btn-secondary`), and inputs (`.form-input`, `.form-select`).
* Enhance table styles (`.data-table`) with monospace numeric data alignment and badge tags (`.badge-live`, `.badge-warning`).

### Phase 3: Layout & Page Harmonization (`css/layout.css` & Page CSS)
* Update shell layout headers across `dashboard.html`, `members.html`, `schedule.html`, `programs.html`, `settings.html`.
* Ensure drawer navigation overlay and mobile responsive breakpoints closely mimic the reference UX.

### Verification Plan
1. **Visual Alignment:** Compare components against reference styling for consistency across dark and light modes.
2. **Interactive States:** Verify hover, focus, and active micro-animations on cards, buttons, and input elements.
3. **Responsiveness:** Test shell drawer, header, and grid responsiveness on desktop and mobile viewports.
