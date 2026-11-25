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

/**
 * Furniture sprites are mostly transparent padding — the plant drawing is
 * only ~28% of its image width, the lamp ~22% — so the old defaults
 * (60–160 px) rendered as 20 px specks on a 1900 px panorama, invisible
 * against the decor. Defaults below are scaled x3 so placed furniture
 * actually reads as furniture. Stored items placed at the old size are
 * scaled up on load in the editor (see restoreData) when untouched.
 */
export const FURNITURE_SIZE_SCALE = 3;

/** Static fallback catalogue (used when API / MongoDB is unavailable). */
export const FALLBACK_FURNITURE_ITEMS: FurnitureItem[] = [
  {
    id: "chair",
    label: "Chair",
    views: {
      front: "/furniture/chairfront.png",
      back: "/furniture/chairback.png",
      left: "/furniture/chairleft.png",
      right: "/furniture/chairright.png",
    },
    defaultWidth: 270,
    defaultHeight: 330,
    price: 75,
  },
  {
    id: "sofa",
    label: "Sofa",
    views: {
      front: "/furniture/sofa.png",
      back: "/furniture/sofaback.png",
      left: "/furniture/sofaleft.png",
      right: "/furniture/sofaright.png",
    },
    defaultWidth: 480,
    defaultHeight: 300,
    price: 450,
  },
  {
    id: "table",
    label: "Table",
    views: {
      front: "/furniture/table.png",
      back: "/furniture/table_back.svg",
      left: "/furniture/table_left.svg",
      right: "/furniture/table_right.svg",
    },
    defaultWidth: 420,
    defaultHeight: 300,
    price: 220,
  },
  {
    id: "lamp",
    label: "Floor Lamp",
    views: {
      front: "/furniture/lamp.png",
      back: "/furniture/lamp.png",
      left: "/furniture/lamp.png",
      right: "/furniture/lamp.png",
    },
    defaultWidth: 180,
    defaultHeight: 480,
    price: 120,
  },
  {
    id: "plant",
    label: "Plant",
    views: {
      front: "/furniture/plant.png",
      back: "/furniture/plant.png",
      left: "/furniture/plant.png",
      right: "/furniture/plant.png",
    },
    defaultWidth: 240,
    defaultHeight: 390,
    price: 45,
  },
  {
    id: "coffee-table",
    label: "Coffee Table",
    views: {
      front: "/furniture/coffee-table.png",
      back: "/furniture/coffee-table.png",
      left: "/furniture/coffee-table_left.png",
      right: "/furniture/coffee-table_left.png",
    },
    defaultWidth: 390,
    defaultHeight: 240,
    price: 180,
  },
  {
    id: "bookshelf",
    label: "Bookshelf",
    views: {
      front: "/furniture/bookshelf.png",
      back: "/furniture/bookshelf_back.png",
      left: "/furniture/bookshelf_left.png",
      right: "/furniture/bookshelf_right.png",
    },
    defaultWidth: 330,
    defaultHeight: 480,
    price: 250,
  },
  {
    id: "flower-vase",
    label: "Flower Vase",
    views: {
      front: "/furniture/flower-vase.png",
      back: "/furniture/flower-vase.png",
      left: "/furniture/flower-vase.png",
      right: "/furniture/flower-vase.png",
    },
    defaultWidth: 210,
    defaultHeight: 390,
    price: 35,
  },
  {
    id: "dining-table",
    label: "Dining Table",
    views: {
      front: "/furniture/dining-table.png",
      back: "/furniture/dining-table_left.png",
      left: "/furniture/dining-table.png",
      right: "/furniture/dining-table_left.png",
    },
    defaultWidth: 480,
    defaultHeight: 330,
    price: 550,
  },
];

/** @deprecated Prefer `fetchFurnitureCatalog` + state in components; kept for compatibility. */
export const FURNITURE_ITEMS = FALLBACK_FURNITURE_ITEMS;

/** Load furniture from MongoDB via API; falls back to `FALLBACK_FURNITURE_ITEMS`. */
export async function fetchFurnitureCatalog(token: string | null): Promise<FurnitureItem[]> {
  if (!token) return [...FALLBACK_FURNITURE_ITEMS];
  try {
    const res = await fetch("/api/furniture", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("furniture fetch failed");
    const data = await res.json();
    if (Array.isArray(data.items) && data.items.length > 0) return data.items as FurnitureItem[];
  } catch {
    // ignore
  }
  return [...FALLBACK_FURNITURE_ITEMS];
}
