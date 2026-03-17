## EventVista – Full Architecture Overview

This document gives a **single high-level view** of the EventVista architecture: what each part of the system does, how data flows end-to-end, and how the main features (editor, AI, exports, analytics) connect.

---

## 1. High-Level System Diagram

Conceptually, the platform is split into these layers:

- **Frontend Web App (Next.js 15 App Router)**
  - Routes in `src/app/*` (e.g. `page.tsx`, `editor`, `analytics`, `settings`, `share/[id]`).
  - Interactive components in `src/components/*` (Scene overlay, furniture panel, AI tools, etc.).
  - Styling & UX: Tailwind CSS 4, Framer Motion, Lucide icons, Plus Jakarta Sans.

- **Backend APIs (Next.js API Routes)**
  - `src/app/api/*` – CRUD for projects, auth, analytics, furniture uploads, AI endpoints.
  - Act as the **boundary** between the UI and:
    - MongoDB (projects, users, analytics).
    - External AI (Groq) and external assets (image proxy).

- **Database Layer (MongoDB via Mongoose)**
  - `models/Project.ts` and `models/User.ts`.
  - Persists project designs (placements), user accounts, and custom furniture.

- **Core Engines & Libraries**
  - `src/lib/furniture.ts` – central furniture catalogue (metadata & prices).
  - `src/lib/exportPdf.ts` – multi-section PDF generator.
  - `src/lib/applyLogoToFurniture.ts` – client-side logo compositing.
  - `src/lib/mongoose.ts`, `src/lib/utils.ts`, `src/lib/AuthContext.tsx`.

- **Visual Engines / Integrations**
  - `PanoramaViewer.tsx` + Marzipano for 360° scenes.
  - `SceneOverlay.tsx` for interactive overlay items.
  - `src/visual-edits/*` for Orchids dev tooling.

---

## 2. Main User Flows & Their Architecture

### 2.1 Editor Flow (`/editor`)

**Goal:** Let a planner design an event in a 360° room with draggable furniture, AI suggestions, and logo branding, and then save/export/share the result.

**Key files:**
- `src/app/editor/page.tsx` – main editor page.
- `src/components/PanoramaViewer.tsx` – 360° engine integration (Marzipano).
- `src/components/SceneOverlay.tsx` – pseudo-3D furniture overlay with drag/resize/rotate/flip.
- `src/components/FurniturePanel.tsx` – furniture catalogue & add-to-scene.
- `src/lib/furniture.ts` – furniture metadata, default prices, image paths.

**Data & state:**
- `placedItemsMap: Record<string, PlacedItem[]>` in `editor/page.tsx`:
  - Key: `${eventType}::${sceneIndex}`.
  - Value: array of `PlacedItem` objects for that scene.
- Per `PlacedItem`:
  - `uid`, `item` (FurnitureItem), `yaw`, `pitch`, `width`, `height`, `facing`, `flipX`, `locked`, optional `brandedSrc`.

**Flow:**
1. User opens `/editor?id=PROJECT_ID`.
2. Editor loads project + `data` from MongoDB and hydrates `placedItemsMap`.
3. `PanoramaViewer` renders the equirectangular 360° scene.
4. `SceneOverlay`:
   - Projects each `PlacedItem` from world coords (`yaw`, `pitch`) to screen coords using Marzipano’s `coordinatesToScreen`.
   - Renders each furniture item as a draggable, resizable overlay with correct curvature and rotations.
5. `FurniturePanel` lets the user add new items:
   - Computes world-space anchor at the current camera view.
   - Appends a new `PlacedItem` into `placedItemsMap`.
6. On “Save”, editor `PATCH`es `/api/projects/:id` with the new `data` blob.

---

### 2.2 AI Features

EventVista uses AI **only via dedicated API routes**, never directly from components. See `AI_FEATURES_ARCHITECTURE.md` for full detail; here is how they hook into the overall architecture.

**Files:**
- Visual auto-design:
  - `src/components/AIAutoDesign.tsx`
  - `src/app/api/ai-visual-design/route.ts`
- Asset advisor chatbot:
  - `src/components/AIChatbot.tsx`
  - `src/app/api/ai-recommend/route.ts`
- Shared AI docs:
  - `AI_TASK_TYPE.md`, `AI_AUTO_DESIGN_DOCS.md`, `AI_FEATURES_ARCHITECTURE.md`.

**Flow (example – AI Auto-Design):**
1. `AIAutoDesign` asks `editor/page.tsx` for a snapshot via `onCapture()`.
2. `captureScene()`:
   - Uses `/api/proxy-image` to download the 360° JPG server-side (avoid CORS).
   - Downscales on the client and encodes as base64.
3. `AIAutoDesign` POSTs `{ imageBase64, eventType, sceneLabel, dimensions }` to `/api/ai-visual-design`.
4. API route:
   - Builds a detailed system prompt including the furniture catalogue.
   - Calls Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) with image + text, `response_format: json_object`.
   - Normalizes placements (yaw wrapping, pitch override, anti-clustering).
   - Returns `VisualDesignResponse`.
5. `AIAutoDesign` converts `PlacementSuggestion[]` → `PlacedItem[]` and inserts them into `SceneOverlay` via `setPlacedItems`.

**Flow (example – AI Asset Advisor):**
1. `AIChatbot` builds a `ProjectContext` from all scenes + `placedItemsMap`.
2. Sends context + user question + short history to `/api/ai-recommend`.
3. API route:
   - Builds a financial + capacity-aware system prompt.
   - Calls Groq (`llama-3.3-70b-versatile`) with JSON response formatting.
   - Returns `{ reply, suggestions }`.
4. `AIChatbot` renders the reply with markdown-like formatting and offers suggested follow-up questions.

---

### 2.3 Logo Integration Flow (Manual)

**Goal:** Upload a client logo, compose it onto a furniture PNG, then insert that branded item into the 360° scene.

**Files:**
- `src/components/LogoIntegration.tsx`
- `src/lib/applyLogoToFurniture.ts`
- `src/components/SceneOverlay.tsx` (uses `brandedSrc`).

**Flow:**
1. User clicks **“Logo Integration”** in the left AI panel.
2. Step 1 – Upload:
   - Uploads PNG only (`accept="image/png"`). Non-PNG → error message.
3. Step 2 – Select furniture:
   - Shows grid of `FURNITURE_ITEMS` from `src/lib/furniture.ts`.
   - User picks one item as the branding base.
4. Step 3 – Adjust & Preview:
   - Component maintains normalized logo position, size, and opacity.
   - Calls `applyLogoToFurniture(furnitureSrc, logoSrc, { x, y, sizePercent, opacity })` for live preview.
5. Step 4 – Apply & Insert:
   - Calls `applyLogoToFurniture` one last time for the final PNG.
   - Calls `editor` callback `handleInsertBrandedFurniture(furnitureItem, brandedSrc)`.
   - Editor creates a new `PlacedItem` with `brandedSrc` and inserts it near the camera centre.
6. `SceneOverlay` automatically prefers `brandedSrc` over default images when rendering.

---

### 2.4 Export & Sharing Flows

#### 2.4.1 PDF Export

**Files:**
- `src/lib/exportPdf.ts`
- `src/app/editor/page.tsx` (`handleExportPdf`)
- `PDF_ARCHITECTURE.md`

**Flow:**
1. Editor collects all scenes and their `placedItems`.
2. Enriches each item with a reliable price:
   - First: project’s own saved price (if any).
   - Fallback: `FURNITURE_ITEMS` price from `src/lib/furniture.ts`.
3. Calls `exportProjectToPdf({ projectId, projectName, clientName, agencyName, eventType, scenes })`.
4. `exportPdf.ts`:
   - Uses `jsPDF` + `jspdf-autotable`.
   - Builds an 8-section professional proposal (Cover, Overview, Scenes, Technical Specs, Furniture, Budget Summary, Budget Evolution, T&Cs).
5. Triggers a client-side download of the generated PDF.

#### 2.4.2 Standalone HTML Viewer

**Files:**
- `editor/page.tsx` – `handleExportStandalone`.

**Flow:**
1. Editor base64-encodes:
   - Current HDRI scene.
   - Each furniture image (`item.views[facing]`).
2. Injects them into an HTML template that:
   - Reconstructs a Marzipano viewer.
   - Recreates hotspots from saved yaw/pitch/size/flip data.
3. Downloads a self-contained `*.html` file that works offline.

#### 2.4.3 Shareable Proposal View (`/share/[id]`)

**Files:**
- `src/app/share/[id]/page.tsx`
- `src/app/api/share/[id]/route.ts`

**Flow:**
1. Public route fetches project data via `/api/share/[id]`.
2. Renders:
   - Interactive 360° scenes.
   - Proposal-style overlay (overview, specs, inventory, budget).
3. Functions as the **client-facing proposal** linked from PDFs and the editor.

---

## 3. Data & Persistence Architecture

**Models (MongoDB via Mongoose):**
- `Project`:
  - Core fields: `name`, `client`, `eventType`, `budget`, etc.
  - `data`: JSON blob keyed by `eventType::sceneIndex` containing `PlacedItem[]` snapshots.
- `User`:
  - Auth (email, password hash).
  - `customFurniture`: user-specific assets and custom prices.

**Where data lives:**
- **In the database** (dynamic, per user/project):
  - Projects and all saved placements.
  - Users and custom furniture.
  - Analytics aggregates are recomputed from raw project data.

- **In code** (static, global):
  - Standard furniture catalogue (`src/lib/furniture.ts`).
  - Scene definitions (HDRI URLs, venue dimensions, rent prices).
  - Financial rules (fees, logistics %, PDF structure).

For a detailed discussion of “code vs DB”, see `DATA_STRATEGY.md`.

---

## 4. Settings, Auth, and Analytics

### 4.1 Settings & Auth

**Files:**
- `src/app/settings/page.tsx`
- `src/lib/AuthContext.tsx`
- Auth APIs: `src/app/api/auth/login/route.ts`, `signup`, `me`, etc.

**Architecture:**
- `AuthContext` wraps the app (`src/app/layout.tsx`) and:
  - Holds `user`, `token`, `projects`.
  - Exposes `login`, `logout`, `saveProfile`, `deleteAccount`.
- Settings page:
  - `"use client"` page bound to `AuthContext`.
  - Uses `PATCH /api/auth/me` for profile and password updates.
  - Uses `DELETE /api/auth/me` for account deletion.

### 4.2 Analytics

**Files:**
- `src/app/analytics/page.tsx`
- `src/app/api/analytics/route.ts`
- `src/components/analytics/*.tsx`

**Architecture:**
- API aggregates metrics directly from `Project` documents:
  - Revenue, budget, client performance, seasonal trends.
- Analytics UI components:
  - `ProjectsOverview`, `RevenueChart`, `TopClients`, `ProjectsTrend`, `RevenueByEventType`, `BudgetAnalysis`, `ClientInsights`.
- Design:
  - Computation happens server-side to keep the client light.
  - Deleting or editing a project immediately affects analytics, since charts query live data.

---

## 5. Directory Structure (Simplified)

```text
src/
  app/
    page.tsx               # Landing / marketing
    editor/page.tsx        # Main 360° editor (core app)
    analytics/page.tsx     # Analytics dashboard
    settings/page.tsx      # Profile, security, account lifecycle
    share/[id]/page.tsx    # Public interactive proposal
    api/
      projects/*.ts        # Project CRUD & data persistence
      auth/*.ts            # Auth endpoints
      analytics/route.ts   # Analytics aggregation
      furniture/upload/*   # Custom furniture uploads
      ai-visual-design/*   # Vision AI furniture layout
      ai-recommend/*       # Text LLM advisor
      proxy-image/*        # Server-side image proxy

  components/
    SceneOverlay.tsx       # Pseudo-3D furniture overlay
    PanoramaViewer.tsx     # Marzipano 360° viewer wrapper
    FurniturePanel.tsx     # Library browser & add-to-scene
    FurnitureUploadModal.tsx
    AIAutoDesign.tsx       # Vision AI integration
    AIChatbot.tsx          # Budget & quantity advisor
    LogoIntegration.tsx    # Manual logo branding flow
    analytics/*.tsx        # Reusable analytics charts/cards

  lib/
    furniture.ts           # Furniture metadata & pricing
    exportPdf.ts           # PDF proposal engine
    applyLogoToFurniture.ts# Canvas logo compositing helper
    mongoose.ts            # MongoDB connection
    AuthContext.tsx        # Global auth & project state
    utils.ts               # Shared helpers

  models/
    User.ts                # User schema (auth + customFurniture)
    Project.ts             # Project schema (includes `data` blob)

  visual-edits/
    VisualEditsMessenger.tsx   # Orchids visual editor bridge
    component-tagger-loader.js # JSX instrumentation for Orchids
```

This file is meant as the **entry point for understanding the whole system**. For deeper dives into specific areas, follow:

- `architecture.md` – interactive editor & exports.
- `DATA_STRATEGY.md` – what lives in DB vs code.
- `PDF_ARCHITECTURE.md` – full PDF pipeline.
- `AI_FEATURES_ARCHITECTURE.md` – AI endpoints and flows.

