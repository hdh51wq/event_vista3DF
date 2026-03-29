# Logo Integration Flow (Editor)

This document explains how **client logo integration** works end-to-end in EventVista:

- UI workflow inside `src/components/LogoIntegration.tsx`
- How logo placement is computed (normalized drag coordinates)
- How the branded image is generated (canvas compositing via `applyLogoToFurniture`)
- How the branded asset is stored into the scene model (`PlacedItem.brandedSrc`)
- How it is rendered in the editor (`SceneOverlay`)

---

## 1) Key components and where they live

### `src/components/LogoIntegration.tsx`
Collapsible editor panel that guides the user through a 3-step flow:

1. **Upload logo** (PNG with transparency)
2. **Select furniture** to brand (catalog + user custom furniture)
3. **Adjust and preview** the logo placement on the selected furniture image
4. **Insert** branded furniture into the scene

It does all work client-side (no API).

### `src/lib/applyLogoToFurniture.ts`
Pure client-side image compositor that takes:

- a furniture image (e.g. `selectedFurniture.views.front`)
- the uploaded logo (data URL)
- placement options (`x`, `y`, `sizePercent`, `opacity`)

Then renders a new **branded PNG** as a canvas `toDataURL("image/png")`.

### `src/app/editor/page.tsx`
Hosts `LogoIntegration` and provides the callback:

- `onInsert(item: FurnitureItem, brandedSrc: string)`

This callback computes where the branded furniture should be dropped in the panorama (`yaw`, `pitch`) and creates a `PlacedItem` containing `brandedSrc`.

### `src/components/SceneOverlay.tsx`
Renders placed furniture on top of the panorama.

If an item has `placed.brandedSrc`, it uses it as the image source; otherwise it falls back to the furniture view image for the chosen facing.

---

## 2) Data structures used

### `FurnitureItem` (`src/lib/furniture.ts`)
Used as the catalogue record for each furniture type.

```ts
export interface FurnitureItem {
  id: string;
  label: string;
  views: {
    front: string;
    back?: string;
    left?: string;
    right?: string;
  };
  defaultWidth: number;
  defaultHeight: number;
  price?: number;
}
```

### `PlacedItem` (`src/components/SceneOverlay.tsx`)
Represents an item that is placed inside a 360° scene.

```ts
export interface PlacedItem {
  uid: string;
  item: FurnitureItem;

  yaw: number;
  pitch: number;
  width: number;
  height: number;
  facing: "front" | "back" | "left" | "right";
  flipX?: boolean;
  locked?: boolean;

  /**
   * Canvas-composited image with client logo burned in (data URL)
   */
  brandedSrc?: string;
}
```

#### How `brandedSrc` is used
`SceneOverlay` sets the image src as:

1. `placed.brandedSrc` (if present)
2. otherwise `placed.item.views[placed.facing]`
3. otherwise `placed.item.views.front`

So branding is an override of the visual asset only; positioning and behavior remain the same.

### Placement model in the editor
In `editor/page.tsx` the editor stores scene items inside:

- `placedItemsMap: Record<string, PlacedItem[]>`

Keys follow the format:

- ``${eventType}::${sceneIndex}``

Logo integration populates this map by creating a new `PlacedItem` containing `brandedSrc`.

---

## 3) Step-by-step LogoIntegration flow

### Step 1: Upload logo (client-side validation)
File: `LogoIntegration.tsx`

State:
- `logoDataUrl: string | null`
- `logoFileName: string`
- `uploadError: string`

Validation logic:
- Only accepts **PNG** (`fileToCheck.type === "image/png"`)
- Ensures the PNG contains transparency:
  - draws the PNG onto a canvas
  - scans the alpha channel (`data[i] < 255`) to detect any transparent pixels
  - if **no transparency** is found, it rejects with:
    “Image must have a transparent background (PNG-24)...”

On success:
- reads the file using `FileReader.readAsDataURL`
- stores:
  - `logoDataUrl` (the base64 data URL)
  - `logoFileName`
- advances to Step 2 (`setStep(2)`)

### Step 2: Select furniture
File: `LogoIntegration.tsx`

State:
- `selectedFurnitureId: string | null`

Catalogue:
- default furniture: `FURNITURE_ITEMS`
- user custom furniture: `user.customFurniture` (from `AuthContext`)
- merged into: `allItems = [...FURNITURE_ITEMS, ...customItems]`

When a furniture item is selected:
- Step 3 becomes available (`Next · Adjust placement`)

### Step 3: Adjust placement & preview (normalized drag coordinates)
File: `LogoIntegration.tsx`

State controlling the placement:
- `sizePercent` (default `0.22`) – relative size of the logo vs furniture width
- `opacity` (default `0.9`) – alpha for the logo
- `logoXNorm` (default `0.65`) – normalized X anchor (0..1) within the furniture preview image
- `logoYNorm` (default `0.65`) – normalized Y anchor (0..1)

Also:
- `imageDims: { w: number; h: number } | null`
  - computed by loading `selectedFurniture.views.front`

Drag interaction:
- A draggable logo handle listens to pointer events:
  - pointer down → start drag and compute offsets
  - pointer move → compute x,y within preview rect
  - clamps x,y and converts to normalized coordinates:
    - `logoXNorm = clampedX / rect.width`
    - `logoYNorm = clampedY / rect.height`

Live preview rendering:
- A `useEffect` watches:
  `selectedFurniture, logoDataUrl, imageDims, sizePercent, opacity, logoXNorm, logoYNorm`
- It computes actual pixel placement (x,y,w,h) on the natural furniture image:
  - clamp sizePercent: `clampedSize = clamp(sizePercent, 0.1..0.4)`
  - `logoW = w * clampedSize`
  - `logoH = h * clampedSize` (then util corrects aspect ratio via natural dimensions)
  - `maxX = w - logoW`, `maxY = h - logoH`
  - `x = maxX * logoXNorm`, `y = maxY * logoYNorm`

Then it calls:

```
applyLogoToFurniture(furnitureSrc, logoDataUrl, { x, y, sizePercent: clampedSize, opacity })
```

To avoid race conditions (multiple async renders while the user drags):
- it increments `renderVersionRef`
- only applies the result if the render version matches the latest.

### Insert branded furniture
File: `LogoIntegration.tsx` -> `onInsert` callback

On “Insert / Apply”:
- it recomputes the final pixel placement using the same math
- calls `applyLogoToFurniture(...)` one last time to generate the final `brandedSrc`
- invokes the editor callback:
  - `onInsert(selectedFurniture, finalBrandedDataUrl)`

---

## 4) Canvas compositing: applyLogoToFurniture
File: `src/lib/applyLogoToFurniture.ts`

Function signature:

```ts
export async function applyLogoToFurniture(
  furnitureImageSrc: string,
  logoSrc: string,
  options: {
    x: number; // pixel position X on canvas
    y: number; // pixel position Y on canvas
    sizePercent: number; // 0.10 to 0.40
    opacity: number; // 0.5 to 1.0
  }
): Promise<string>
```

Pipeline:
1. Create a canvas and context.
2. Load the furniture image.
   - canvas dimensions are set to `furniture.naturalWidth`/`naturalHeight`
   - draw furniture into the empty canvas
3. Load the logo image.
4. Compute logo size:
   - `logoW = canvas.width * options.sizePercent`
   - `logoH = (logo.naturalHeight / logo.naturalWidth) * logoW`
     (preserves logo aspect ratio)
5. Apply opacity:
   - `ctx.globalAlpha = options.opacity`
6. Draw the logo at (x,y) with computed (logoW, logoH)
7. Return:
   - `canvas.toDataURL("image/png")`

Output:
- A base64-encoded **PNG** branded asset.
- This is stored inside `PlacedItem.brandedSrc`.

---

## 5) How the editor inserts brandedSrc into the scene
File: `src/app/editor/page.tsx`

The callback `handleInsertBrandedFurniture(item, brandedSrc)`:
1. Reads current panorama viewer view + container.
2. Computes a drop position using screen coordinates:
   - by default it uses a point near center of the viewer
   - converts screen coordinates to world coordinates using:
     `view.screenToCoordinates({ x: sx, y: sy })`
3. Creates the `PlacedItem`:
   - sets `uid`
   - sets `yaw`, `pitch`
   - sets `width`, `height` from `item.defaultWidth/defaultHeight`
   - sets `facing: "front"`
   - sets `brandedSrc` to the branded canvas output.
4. Appends to the scene list:
   - `setPlacedItems([...placedItems, newItem])`

The resulting `PlacedItem[]` lives inside:
- `placedItemsMap[`${eventType}::${sceneIndex}`]`

---

## 6) Rendering brandedSrc in SceneOverlay
File: `src/components/SceneOverlay.tsx`

When rendering each placed item:

```tsx
src={
  placed.brandedSrc
  ?? placed.item.views[placed.facing]
  ?? placed.item.views.front
}
```

Meaning:
- If branding exists, it always wins (brandedSrc is the final visual).
- The overlay still uses `placed.width/height`, and the same sphere-curvature transform logic.

---

## 7) Persistence & size considerations (important)

### Where the branded image is stored
The editor persists scene content via:
- `handleSaveDraft` → PATCH `/api/projects/:id`
- body includes:
  - `data: placedItemsMap`

Because `brandedSrc` is a base64 PNG, it can be large (several MB).

### Practical implications
- Adding many branded items increases:
  - MongoDB document size quickly
  - bandwidth/storage of project data
  - refresh time and editor load time

If you add a “branding persistence” feature later, consider storing branded assets separately (or compressing) rather than embedding large base64 strings directly in `placedItemsMap`.

---

## 8) Quick mental model

You can think of logo integration as:

1. **User provides** a transparent logo image.
2. **User picks** a furniture template image.
3. **Client composites**: `furniture image + logo overlay → branded PNG data URL`.
4. **Scene model stores** `PlacedItem.brandedSrc`.
5. **Renderer chooses** `brandedSrc` when present.

No backend is involved in the compositing step; everything happens in the browser.

