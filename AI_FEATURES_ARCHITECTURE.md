## EventVista — AI Features & Architecture

This document explains **all AI-powered features** in EventVista and how they work technically: request flow, architecture, involved files, TypeScript interfaces, and external APIs.

- **AI Visual Auto‑Design** — vision model that auto‑places furniture in a 360° scene.
- **AI Asset Advisor (Chatbot)** — text model that recommends quantities, layouts, and budget allocations.
- **Orchids Visual Edits Integration** — developer‑side AI tooling that connects the running app to an AI code editor.

For background on the machine‑learning task type, see `AI_TASK_TYPE.md`.

---

## 1. AI Visual Auto‑Design (360° Scene)

**Goal:** One‑click furniture auto‑placement in the `/editor` 360° scene, using a **multimodal vision LLM** (Llama 4 Scout via Groq).

### 1.1 High‑Level Flow

1. **User clicks** the `AI Auto‑Design` button in the editor.
2. The editor **captures** the current 360° scene as a base64 JPEG.
3. The `AIAutoDesign` component **POSTs** this image plus context to `/api/ai-visual-design`.
4. The Edge API route calls **Groq** with the image and a detailed **system prompt**, forcing a **JSON response**.
5. The server **normalizes** yaw/pitch, quantities, and facings (`normalizeRecommendations`).
6. The client converts recommendations into `PlacedItem[]` and injects them into the live scene (`SceneOverlay`).

### 1.2 Main Files & Responsibilities

- `src/app/editor/page.tsx`
  - Owns the **360° editor** state (Marzipano viewer, `placedItems`).
  - Exposes `captureScene(): Promise<string | null>` to take a **full panorama** snapshot.
  - Passes `onCapture`, `onApply`, and contextual props into `AIAutoDesign`.

- `src/components/AIAutoDesign.tsx`
  - Client component that renders the **AI Auto‑Design UI**:
    - Steps: `idle → capturing → analysing → preview → placing → done / error`.
    - Status animations and previews using Framer Motion.
  - **Calls API**:
    - `runAnalysis()` → `fetch("/api/ai-visual-design", { imageBase64, eventType, sceneLabel, dimensions })`.
  - **Applies results**:
    - `convertSuggestionToPlacedItems(recommendations: PlacementSuggestion[]): PlacedItem[]`.
    - `handleApply()` decides **Replace vs Merge** with existing `currentItems`.

- `src/app/api/ai-visual-design/route.ts`
  - **Edge runtime** API route (`export const runtime = "edge"`).
  - Owns **Groq call** and **server‑side normalization**:
    - System prompt (`SYSTEM_PROMPT`) encodes the coordinate system and furniture catalogue.
    - Makes a `fetch` to `https://api.groq.com/openai/v1/chat/completions` with:
      - `model: "meta-llama/llama-4-scout-17b-16e-instruct"`
      - `response_format: { type: "json_object" }` (forces JSON, no markdown).
    - Parses `VisualDesignResponse` from `data.choices[0].message.content`.
    - Calls `normalizeRecommendations()` before returning the JSON.

- `src/components/SceneOverlay.tsx` (referenced architecture)
  - Reprojects each `PlacedItem` from `(yaw, pitch)` **world coordinates** into **screen coordinates** via Marzipano’s `coordinatesToScreen()`.
  - Renders draggable, resizable overlays with correct perspective (`rotateX`, `rotateY`, `scale`).

- `src/lib/furniture.ts`
  - Central **furniture catalogue** (`FURNITURE_ITEMS`):
    - `id`, `label`, `price`, `defaultWidth`, `defaultHeight`, and image paths per facing.
  - Used both in the **AI server prompt** (catalogue that the model can choose from) and on the **client** to map AI suggestions to actual image assets.

### 1.3 Data Contracts & Types

**Server‑side types (`/api/ai-visual-design/route.ts`):**

- `FURNITURE_CATALOGUE`: array of items with `id`, `label`, `width`, `height`, `price` — this is **embedded into the system prompt** so the model knows allowed IDs and unit prices.
- `PlacementSuggestion`:
  - `id: string` — catalogue id (e.g. `"chair"`).
  - `label: string`.
  - `quantity: number`.
  - `placements: { yaw: number; pitch: number; facing: "front" | "back" | "left" | "right"; reasoning: string }[]`.
- `VisualDesignResponse`:
  - `sceneAnalysis: string`.
  - `recommendations: PlacementSuggestion[]`.
  - `totalEstimatedCost: number`.
  - `designReasoning: string`.
  - `layoutStyle: string`.

**Client‑side types (editor / SceneOverlay):**

- `PlacedItem` (from `SceneOverlay`):
  - `uid: string` — unique ID for React keys and drag operations.
  - `item: FurnitureItem` — full metadata and image paths from `FURNITURE_ITEMS`.
  - `yaw: number`, `pitch: number` — **normalized** by the server.
  - `width`, `height` — pixel size of the overlay.
  - `facing: "front" | "back" | "left" | "right"`.
  - Optional flags: `flipX`, `locked`, `brandedSrc`.

**Conversion bridge:**

- `convertSuggestionToPlacedItems(suggestions: PlacementSuggestion[])` in `AIAutoDesign.tsx`:
  - For each `PlacementSuggestion`:
    - Finds the corresponding `FurnitureItem` with `FURNITURE_ITEMS.find(f => f.id === suggestion.id)`.
    - For each `placement`, creates a `PlacedItem` with server‑normalized `yaw`, `pitch`, and `facing`.
  - This is the **only place** where the AI JSON gets transformed into the editor’s runtime `placedItems` state.

### 1.4 Coordinate System & Normalization

The project uses a **spherical coordinate system** aligned with Marzipano:

- `yaw` in \([-π, +π]\): horizontal angle, 0 = forward, positive = left, negative = right.
- `pitch` in radians: vertical angle; convention is **project‑specific** (see `AI_AUTO_DESIGN_DOCS.md` and comments in `route.ts`).

**Server normalization (`normalizeRecommendations` in `route.ts`):**

1. **Yaw wrapping** into \([-π, +π]\) and fallback yaw when the model outputs `NaN` or no value.
2. **Anti‑clustering**:
   - Maintains `usedYaws` and nudges items apart by a minimum separation (`0.12` for chairs, `0.18` for others).
3. **Pitch override**:
   - Ignores AI pitch and computes `floorPitchForItem(id)` so floor items don’t appear at the ceiling.
4. **Facing inference**:
   - Uses `inferFacingFromYaw` if the model’s `facing` field is invalid.
5. **Quantity sanitization**:
   - Floors to a positive integer and prevents `0` / negative / `NaN` quantities.

This ensures **robustness** even when the LLM makes numerical mistakes.

### 1.5 End‑to‑End Sequence (Per Request)

1. `editor/page.tsx`:
   - User clicks **Analyse & Auto‑Design Scene**.
   - `captureScene()` builds a panorama data URL (via `/api/proxy-image` or Marzipano canvas).
2. `AIAutoDesign.runAnalysis()`:
   - `setStep("capturing")` → calls `onCapture()` → stores `imageBase64`.
   - `setStep("analysing")` → POSTs to `/api/ai-visual-design`.
3. `/api/ai-visual-design`:
   - Validates body and API key (`GROQ_API_KEY`).
   - Builds `userPrompt` with `eventType`, `sceneLabel`, `dimensions`.
   - Calls **Groq** with:
     - Image as `image_url` content.
     - System + user messages.
     - `temperature: 0.4`, `max_tokens: 2000`.
   - Parses `VisualDesignResponse`, runs `normalizeRecommendations`, returns JSON.
4. `AIAutoDesign` (preview phase):
   - Stores `result` (server response).
   - Shows **Scene Analysis**, **Design Strategy**, **Furniture Plan**, **Total Estimated Cost**, and a **Replace / Merge** toggle.
5. `AIAutoDesign.handleApply()`:
   - Converts `result.recommendations` to `PlacedItem[]`.
   - Calls `onApply(newItems)` or `onApply([...currentItems, ...newItems])`.
6. `editor/page.tsx`:
   - Stores updated `placedItems` in state.
   - `SceneOverlay` reprojects and renders the new furniture overlays in the 360° viewer.

For a very detailed deep‑dive (with diagrams and reasoning), see `AI_AUTO_DESIGN_DOCS.md`.

---

## 2. AI Asset Advisor (Budget & Quantity Chatbot)

**Goal:** Help planners decide **how many assets** they need per scene, how to **allocate budget**, and what **trade‑offs** to make, using a text‑only LLM.

This feature appears as an **“AI Asset Advisor”** chat widget, typically on project or analytics views.

### 2.1 High‑Level Flow

1. The user opens the **AI Asset Advisor** panel (`AIChatbot` component).
2. The component builds a **project context**:
   - Project name, event type, budget.
   - Scenes, their dimensions, rent prices, and current furniture placements.
3. On each user message:
   - `AIChatbot` POSTs to `/api/ai-recommend` with:
     - The project context.
     - A **scene inventory summary** aggregated from `PlacedItem[]`.
     - Conversation history (last 10 turns).
4. The API route constructs a **system prompt** that explains the project, budget, scenes, and required output format.
5. Groq’s **`llama-3.3-70b-versatile`** returns JSON with:
   - A long, human‑readable `reply` string.
   - Exactly **three short follow‑up questions** in `suggestions[]`.
6. `AIChatbot` renders the answer as a chat bubble and shows suggested follow‑up questions as quick‑reply chips.

### 2.2 Main Files & Responsibilities

- `src/components/AIChatbot.tsx`
  - Client component for the **chat UI**.
  - Props:
    - `context: { projectName; eventType; budget; scenes: { label; dimensions?; rentPrice?; items: PlacedItem[] }[] }`.
  - Internal responsibilities:
    - Renders the **toggle button** (“AI Asset Advisor”).
    - Computes and shows a **budget bar** (`BudgetBar`) from current placements.
    - Maintains `messages: ChatMessage[]` and `input` state.
    - Calls `sendMessage(text)` on Enter or button click.
    - Renders assistant suggestions as clickable chips (which send new questions).

- `src/app/api/ai-recommend/route.ts`
  - Edge API route (`export const runtime = "edge"`).
  - Request body (`RecommendRequest`):
    - `projectName`, `eventType`, `budget`.
    - `scenes: SceneInfo[]` (summarised on the client).
    - `userMessage: string`.
    - `history: { role; content }[]` — past messages.
  - Core logic:
    - Builds a **rich system prompt** via `buildSystemPrompt(projectName, eventType, budget, scenes)`.
    - Sends chat `messages` (system + history + current user) to Groq:
      - `model: "llama-3.3-70b-versatile"`.
      - `temperature: 0.6`, `max_tokens: 1200`.
      - `response_format: { type: "json_object" }`.
    - Parses JSON into `{ reply, suggestions }`.
    - Returns `{ reply, suggestions }` to the client.

### 2.3 Data Preparation on the Client

Inside `AIChatbot.tsx`, the project context is transformed before calling the API:

- `buildScenesSummary(scenes: Scene[])`:
  - For each scene, it aggregates **placed furniture** by `item.id`:
    - Counts quantities and attaches prices (from `PlacedItem.item.price` or `FURNITURE_ITEMS` as fallback).
  - Produces an array of:
    - `{ label, dimensions, rentPrice, items: { label, price, qty }[] }`.
  - This is what gets sent to `/api/ai-recommend` as `scenes`.

- `BudgetBar`:
  - Recomputes **current spend**:
    - Sum of `(price × quantity)` for all placed items + scene rent prices.
  - Compares it against `context.budget` to show:
    - Progress bar (green if under budget, red if over).
    - “Over Budget by €X” label when exceeded.

### 2.4 System Prompt & JSON Contract

`buildSystemPrompt` (in the API route) encodes:

- **Project context**:
  - Project name, event type, client budget.
  - Summarised scenes with dimensions, area, rent price, and current items.
- **Responsibilities**:
  - Estimate capacity based on venue size and event type (cocktail vs seated vs conference, etc.).
  - Recommend **specific quantities** of furniture/assets per scene.
  - Always produce a **budget comparison**:
    - Initial budget, current spend, cost of suggested additions, final projection, and over/under amount.
  - Give concise, structured explanations (bullets and short paragraphs).
  - Provide trade‑offs when budget is tight.
- **Response format (strict)**:
  - Must be a JSON object:
    - `"reply": "<plain text with \\n line breaks>"`.
    - `"suggestions": ["...", "...", "..."]` (exactly 3 follow‑ups).

The route then:

1. Sends the prompt and messages to Groq.
2. Parses the JSON string from `data.choices[0].message.content`.
3. Returns `{ reply, suggestions }` to the frontend.

### 2.5 UI Rendering & Conversation Loop

1. **First open**:
   - `AIChatbot` auto‑sends a **greeting message** built from `ProjectContext` (project name, scenes count, budget).
2. **User question**:
   - `sendMessage(text)` appends a `ChatMessage` with `role: "user"`.
   - Sends project context + question + condensed history to `/api/ai-recommend`.
3. **API response**:
   - On success: appends an `assistant` message:
     - `content: data.reply`.
     - `suggestions: data.suggestions`.
   - On error: appends an `assistant` message with `isError: true`.
4. **Rendering (`MessageBubble`)**:
   - Splits `content` by `\n` and applies simple **markdown‑like formatting** (headings, bullets, inline `**bold**` and ``code``).
   - Renders suggestion chips underneath the message, which call `sendMessage` again when clicked.

This closed loop enables an **LLM‑driven planning assistant** that is always grounded in the **real project data and budget** coming from the editor and database.

---

## 3. Orchids Visual Edits & Error Reporting (Developer AI Tooling)

While not visible to end‑users, EventVista integrates with **Orchids Visual Edits**, an AI‑assisted developer workflow that connects the running Next.js app to an AI editor for live code changes and debugging.

### 3.1 Component Tagging & DOM Instrumentation

- `src/visual-edits/component-tagger-loader.js`
  - A custom **webpack/Turbopack loader** that parses every React file (JSX/TSX) with `@babel/parser`.
  - Walks the AST and injects `data-orchids-id` and `data-orchids-name` attributes into JSX opening elements, except for:
    - Blacklisted Three.js / react‑three‑fiber / drei components.
  - `data-orchids-id` encodes:
    - Source file path (relative to project root).
    - Line and column of the JSX element.
    - Optional extra context (e.g. array names in `.map()` calls or referenced variables).
  - This makes it possible for the Orchids side to **map DOM elements back to their exact source code location**, which is essential for AI‑generated code edits.

### 3.2 VisualEditsMessenger — In‑App Overlay & Editing Bridge

- `src/visual-edits/VisualEditsMessenger.tsx` (exports `HoverReceiver`)
  - Client‑side component that runs inside the app and:
    - Draws **hover/focus boxes** around elements tagged with `data-orchids-id`.
    - Sends hit‑testing results and click events to the parent frame via `window.postMessage`.
    - Enables **content‑editable** text changes on safe text elements and sends diffs as `TEXT_CHANGED` messages.
    - Applies **style previews and image updates** sent from Orchids (e.g. changing font, background, or swapping an `<img>` source).
    - Supports **element resizing** via resize handles, translating drag operations into style updates (width/height).
  - Message types (child → parent, type `ORCHIDS_HOVER_v1`):
    - `"HIT"` — hover info (id, tag, rect).
    - `"ELEMENT_CLICKED"` — focus info + current styles + click position + optional `src`.
    - `"TEXT_CHANGED"` — old vs new text with file path + line + column.
    - `"STYLE_CHANGED"` / `"STYLE_BLUR"` — inline style diffs to be converted into Tailwind/JSX changes.
    - `"IMAGE_BLUR"` — image `src` changes for code updates.
  - Message types (parent → child):
    - `"VISUAL_EDIT_MODE"` — toggles edit mode on/off.
    - `"PREVIEW_FONT"`, `"RESIZE_ELEMENT"`, `"CLEAR_INLINE_STYLES"`, `"SHOW_ELEMENT_HOVER"`, `"SCROLL"`, etc.

**Net effect:** Orchids can let a developer **hover, click, and edit** the live UI, and then use AI to rewrite the underlying React/Next.js source code in a controlled, file‑aware manner.

### 3.3 Error Reporter Channel

- `src/components/ErrorReporter.tsx`
  - Mounted globally (typically via the app’s error boundary).
  - In an Orchids iframe environment:
    - Listens to `window.onerror` and `unhandledrejection`.
    - Polls Next.js’ dev overlay for error messages.
    - Sends structured `ERROR_CAPTURED` events via `postMessage` to the parent.
  - On the `global-error` route:
    - Sends an additional `global-error-reset` message with full error details.

This allows the AI tooling to **see runtime errors in real time**, correlate them with source files (thanks to `data-orchids-id`), and propose or apply fixes directly in code.

---

## 4. External AI Provider (Groq) & Environment

All AI features rely on the **Groq** OpenAI‑compatible API:

- Vision model for auto‑design:
  - `model: "meta-llama/llama-4-scout-17b-16e-instruct"`.
- Text model for the asset advisor:
  - `model: "llama-3.3-70b-versatile"`.

Common patterns:

- Both API routes are **Edge functions** for low latency.
- Both enforce **JSON output** with `response_format: { type: "json_object" }`.
- Both require `process.env.GROQ_API_KEY` to be set.
- Frontend components never call Groq directly; they always go through **Next.js API routes**, which handle:
  - Prompt construction.
  - Data validation and normalization.
  - Type‑safe interfaces (`VisualDesignResponse`, `SceneInfo`, etc.).

This separation keeps the React code **clean and UI‑focused**, while all AI integration details (models, prompts, error handling) live in **small, well‑defined API modules**.

