"use client";

import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Save,
  Share2,
  Sofa,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import dynamic from "next/dynamic";
import FurniturePanel from "@/components/FurniturePanel";
import { FurnitureItem, FALLBACK_FURNITURE_ITEMS, FURNITURE_SIZE_SCALE, fetchFurnitureCatalog } from "@/lib/furniture";
import SceneOverlay, { PlacedItem } from "@/components/SceneOverlay";
import type { Item3D } from "@/components/ThreeOverlay";
import { PanoramaViewerHandle } from "@/components/PanoramaViewer";
import { exportProjectToPdf } from "@/lib/exportPdf";
import AIChatbot from "@/components/AIChatbot";
import AIAutoDesign from "@/components/AIAutoDesign";
import LogoIntegration from "@/components/LogoIntegration";
import SceneImportModal from "@/components/SceneImportModal";
import { VENUES } from "@/lib/venues";
import { copyTextToClipboard } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BASE = "https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG";

type Scene = { 
  label: string; 
  src: string; 
  dimensions?: string;
  setupTimeline?: string;
  rentPrice?: number;
  isCustom?: boolean;
};

interface CustomScene {
  name: string;
  src: string;
  width: number;
  height: number;
  isCustom: true;
}

const EVENT_SCENES: Record<string, Scene[]> = {
  Wedding: [
    { label: "Dancing Hall",  src: `${BASE}/dancing_hall.jpg`, dimensions: "25m x 40m", setupTimeline: "24 Hours", rentPrice: 1500 },
    { label: "Music Hall",    src: `${BASE}/music_hall_02.jpg`, dimensions: "30m x 50m", setupTimeline: "36 Hours", rentPrice: 2200 },
    { label: "Pillared Hall", src: `${BASE}/solitude_interior.jpg`, dimensions: "20m x 30m", setupTimeline: "18 Hours", rentPrice: 1200 },
  ],
  Conference: [
    { label: "Main Theater",   src: `${BASE}/theater_02.jpg`, dimensions: "40m x 60m", setupTimeline: "48 Hours", rentPrice: 3500 },
    { label: "Stage Hall",     src: `${BASE}/theater_01.jpg`, dimensions: "35m x 45m", setupTimeline: "36 Hours", rentPrice: 2800 },
    { label: "Lecture Hall",   src: `${BASE}/school_hall.jpg`, dimensions: "20m x 25m", setupTimeline: "12 Hours", rentPrice: 800 },
    { label: "Screening Room", src: `${BASE}/cinema_hall.jpg`, dimensions: "15m x 20m", setupTimeline: "12 Hours", rentPrice: 600 },
  ],
  "Gala Dinner": [
    { label: "Grand Hall",    src: `${BASE}/old_hall.jpg`, dimensions: "45m x 70m", setupTimeline: "60 Hours", rentPrice: 4500 },
    { label: "Entrance Hall", src: `${BASE}/entrance_hall.jpg`, dimensions: "15m x 30m", setupTimeline: "24 Hours", rentPrice: 1000 },
    { label: "Long Gallery",  src: `${BASE}/large_corridor.jpg`, dimensions: "10m x 80m", setupTimeline: "36 Hours", rentPrice: 1800 },
  ],
};

function PanoramaLoading() {
  const { t } = useLanguage();
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="text-white/60 text-sm font-medium animate-pulse">{t("editor.loadingScene")}</div>
    </div>
  );
}

const PanoramaViewer = dynamic(() => import("@/components/PanoramaViewer"), {
  ssr: false,
  loading: PanoramaLoading,
});

const ThreeOverlay = dynamic(() => import("@/components/ThreeOverlay"), {
  ssr: false,
});

let uidCounter = 0;
function nextUid() { return `item-${++uidCounter}`; }

function Editor() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const { projects, token, user } = useAuth();

  const panoramaRef = useRef<PanoramaViewerHandle | null>(null);
  const [marzipanoViewer, setMarzipanoViewer] = useState<unknown>(null);

  const [projectName, setProjectName] = useState(t("editor.untitledProject"));
  const [eventType, setEventType] = useState("Wedding");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [venueId, setVenueId] = useState<string | null>(null);
  /** Set when venue is resolved from GET /api/venues/:id (Mongo-only venues). */
  const [resolvedVenueName, setResolvedVenueName] = useState<string | null>(null);
  const [furniturePanelOpen, setFurniturePanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showSceneImport, setShowSceneImport] = useState(false);
  const [placedItemsMap, setPlacedItemsMap] = useState<Record<string, PlacedItem[]>>({});
  const [items3DMap, setItems3DMap] = useState<Record<string, Item3D[]>>({});
  const [budget, setBudget] = useState(0);
  const [customScenes, setCustomScenes] = useState<CustomScene[]>([]);
  /** Template projects show only their own scene(s), no event-type defaults. */
  const [customScenesOnly, setCustomScenesOnly] = useState(false);
  const [furnitureCatalog, setFurnitureCatalog] = useState<FurnitureItem[]>(FALLBACK_FURNITURE_ITEMS);
  const eventLabel =
    eventType === "Wedding"
      ? t("editor.eventWeddingVenue")
      : eventType === "Conference"
      ? t("editor.eventConferenceHall")
      : eventType === "Gala Dinner"
      ? t("editor.eventGalaDinnerHall")
      : eventType;


  const sceneKey = `${eventType}::${sceneIndex}`;
  const placedItems: PlacedItem[] = placedItemsMap[sceneKey] ?? [];
  const currentItems3D = items3DMap[sceneKey] ?? [];

  useEffect(() => {
    if (!token) {
      setFurnitureCatalog(FALLBACK_FURNITURE_ITEMS);
      return;
    }
    let cancelled = false;
    fetchFurnitureCatalog(token).then((items) => {
      if (!cancelled) setFurnitureCatalog(items);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Capture the full 360° equirectangular panorama for Vision AI.
  // PRIMARY: server-side proxy avoids CORS restriction on dl.polyhaven.org CDN.
  // FALLBACK: Marzipano canvas (current 90° viewport only — less accurate for AI).
  const captureScene = useCallback(async (): Promise<string | null> => {
    const sceneSrc = (EVENT_SCENES[eventType] ?? EVENT_SCENES["Wedding"])[sceneIndex]?.src;
    if (!sceneSrc) return null;

    // 1. Try server-side proxy — returns full equirectangular as data URL
    try {
      console.log("[captureScene] Trying proxy for:", sceneSrc);
      const proxyRes = await fetch(
        `/api/proxy-image?url=${encodeURIComponent(sceneSrc)}`
      );
      console.log("[captureScene] Proxy response status:", proxyRes.status);
      if (proxyRes.ok) {
        const { dataUrl } = await proxyRes.json();
        if (dataUrl) {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = dataUrl;
          });
          const maxW = 1920;
          const w = Math.min(img.naturalWidth, maxW);
          const h = Math.round((w / img.naturalWidth) * img.naturalHeight);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          const result = canvas.toDataURL("image/jpeg", 0.82);
          console.log(
            `%c[captureScene] ✅ PROXY SUCCESS — full 360° equirectangular captured`,
            "color: #22c55e; font-weight: bold"
          );
          console.log(`[captureScene] Image dimensions: ${w}×${h}px, data URL length: ${result.length} chars`);
          return result;
        }
      } else {
        const errText = await proxyRes.text().catch(() => "");
        console.warn("[captureScene] Proxy returned non-OK:", proxyRes.status, errText);
      }
    } catch (err) {
      console.warn("[captureScene] Proxy fetch threw:", err);
    }

    // 2. Fallback: grab whatever Marzipano is currently rendering (90° viewport)
    console.warn(
      "%c[captureScene] ⚠️ FALLBACK — using 90° viewport canvas (proxy failed). AI placement will be less accurate.",
      "color: #f59e0b; font-weight: bold"
    );
    try {
      const container = panoramaRef.current?.getContainer();
      if (!container) return null;
      const canvas = container.querySelector("canvas");
      if (canvas) {
        console.log(`[captureScene] Viewport canvas size: ${canvas.width}×${canvas.height}px`);
      }
      return canvas ? canvas.toDataURL("image/jpeg", 0.85) : null;
    } catch {
      return null;
    }
  }, [panoramaRef, eventType, sceneIndex]);

  const setPlacedItems = useCallback(
    (items: PlacedItem[]) => {
      setPlacedItemsMap((prev) => ({ ...prev, [sceneKey]: items }));
    },
    [sceneKey]
  );

    const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const scenesData = (EVENT_SCENES[eventType] || []).map((scene, idx) => ({
        ...scene,
        items: (placedItemsMap[`${eventType}::${idx}`] || []).map(p => ({
          ...p,
          item: {
            ...p.item,
            // Ensure price is present even for older saved items or custom items
            price:
              p.item.price ||
              furnitureCatalog.find((fi) => fi.id === p.item.id)?.price ||
              0,
          }
        }))
      }));
      
      const project = projects.find(p => p._id === projectId);
      
      await exportProjectToPdf({
        projectId: projectId || "unknown",
        projectName,
        clientName: project?.client || t("editor.valuedClient"),
        agencyName: user?.agencyName || "EventVista Agency",
        eventType,
        furnitureCatalog,
        scenes: scenesData,
      });
    } catch (e) {
      console.error("PDF Export failed", e);
    } finally {
      setIsExportingPdf(false);
    }
  }, [eventType, placedItemsMap, projectName, projectId, projects, user, furnitureCatalog, t]);


  const handleAddFurniture = useCallback(
    (item: FurnitureItem) => {
      const view = panoramaRef.current?.getView();
      const container = panoramaRef.current?.getContainer();

      // Default: drop on the floor, slightly right of centre so it's
      // visible and not hidden by panel. 55% down the screen lands at
      // pitch ~0.10, inside the floor band (0.04–0.18); dropping at the
      // vertical centre (pitch 0) left furniture floating on the wall
      // at eye level, half-hidden in the decor.
      let yaw = view ? view.yaw() : 0;
      let pitch = view ? view.pitch() : 0.1;

      if (view && container) {
        const rect = container.getBoundingClientRect();
        // Drop slightly right of centre so it's visible and not hidden by panel
        const sx = rect.width * 0.45;
        const sy = rect.height * 0.55;
        const world = view.screenToCoordinates({ x: sx, y: sy });
        if (world) { yaw = world.yaw; pitch = world.pitch; }
      }

      const newItem: PlacedItem = {
        uid: nextUid(),
        item,
        yaw,
        pitch,
        width: item.defaultWidth,
        height: item.defaultHeight,
        facing: "front",
        brandedSrc: undefined,
        rotationY: 0,
      };
      setPlacedItems([...placedItems, newItem]);
    },
    [placedItems, setPlacedItems]
  );

  const handleInsertBrandedFurniture = useCallback(
    (item: FurnitureItem, brandedSrc: string) => {
      const view = panoramaRef.current?.getView();
      const container = panoramaRef.current?.getContainer();

      let yaw = view ? view.yaw() : 0;
      let pitch = view ? view.pitch() : 0.1;

      if (view && container) {
        const rect = container.getBoundingClientRect();
        const sx = rect.width * 0.45;
        const sy = rect.height * 0.55;
        const world = view.screenToCoordinates({ x: sx, y: sy });
        if (world) {
          yaw = world.yaw;
          pitch = world.pitch;
        }
      }

      const newItem: PlacedItem = {
        uid: nextUid(),
        item,
        yaw,
        pitch,
        width: item.defaultWidth,
        height: item.defaultHeight,
        facing: "front",
        brandedSrc,
        rotationY: 0,
      };

      setPlacedItems([...placedItems, newItem]);
    },
    [placedItems, setPlacedItems]
  );

  const handleSaveDraft = useCallback(async () => {
    if (!projectId || !token) return;
    setIsSaving(true);
    setSaveStatus("saving");
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: placedItemsMap,
          items3D: items3DMap,
        }),
      });

      if (!response.ok) {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
        return;
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error: any) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, token, placedItemsMap, items3DMap]);

    const handleExportStandalone = useCallback(async () => {
    setIsExporting(true);
    try {
      const currentScene = EVENT_SCENES[eventType][sceneIndex];
      const items = placedItemsMap[`${eventType}::${sceneIndex}`] || [];

      // Utility to convert URL to base64
      const toBase64 = async (url: string) => {
        try {
          // If it's already a base64 or blob, return it
          if (url.startsWith("data:") || url.startsWith("blob:")) return url;
          
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const blob = await res.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("Could not base64 image", url, e);
          return url; // Fallback to URL
        }
      };

      // Base64-ing assets for offline use
      const sceneBase64 = await toBase64(currentScene.src);
      const itemsWithBase64 = await Promise.all(
        items.map(async (p) => ({
          yaw: p.yaw,
          pitch: p.pitch,
          width: p.width,
          height: p.height,
          flipX: p.flipX,
          imgSrc: await toBase64(p.item.views[p.facing as keyof typeof p.item.views] || p.item.views.front),
          label: p.item.label,
        }))
      );

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EventVista - ${projectName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; font-family: 'Plus Jakarta Sans', sans-serif; }
    #container { width: 100%; height: 100%; }
    .hotspot { pointer-events: none; transform: translate(-50%, -50%); }
    .furniture-img { pointer-events: none; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45)); transition: opacity 0.3s; }
    #ui { position: absolute; bottom: 30px; left: 30px; z-index: 100; color: white; background: rgba(0,0,0,0.55); padding: 18px 26px; border-radius: 24px; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.12); pointer-events: none; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .badge { background: linear-gradient(135deg, #FF6B4A, #FF8E72); color: white; padding: 4px 12px; border-radius: 99px; font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; display: inline-block; letter-spacing: 0.08em; box-shadow: 0 2px 8px rgba(255,107,74,0.3); }
    .brand { position: absolute; top: 30px; left: 30px; color: white; font-weight: 800; letter-spacing: -0.02em; opacity: 0.95; font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    #loading { position: absolute; inset: 0; background: #0a0a0a; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; color: white; transition: opacity 0.5s; text-align: center; padding: 20px; }
    .loader { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #FF6B4A; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  <script src="https://unpkg.com/marzipano@0.10.2/dist/marzipano.js"></script>
</head>
<body>
  <div id="loading">
    <div id="loader-box">
      <div class="loader"></div>
      <div style="font-size: 14px; font-weight: 500; opacity: 0.7;">${t("editor.exportDecoding")}</div>
    </div>
    <div id="error-box" style="display: none; color: #ff4a4a; max-width: 400px;">
      <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">${t("editor.exportError")}</div>
      <div id="error-msg" style="font-size: 13px; opacity: 0.8; line-height: 1.5;"></div>
    </div>
  </div>

  <div id="container"></div>
  <div class="brand">EventVista</div>
  
  <div id="ui">
    <div class="badge">${t("editor.interactiveScene")}</div>
    <div style="font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 2px;">${projectName}</div>
    <div style="font-size: 13px; opacity: 0.7; font-weight: 500;">${eventLabel} • ${currentScene.label}</div>
  </div>

  <script>
    const container = document.getElementById('container');
    const loading = document.getElementById('loading');
    const errorBox = document.getElementById('error-box');
    const errorMsg = document.getElementById('error-msg');
    const loaderBox = document.getElementById('loader-box');

    function showError(msg) {
      loaderBox.style.display = 'none';
      errorBox.style.display = 'block';
      errorMsg.textContent = msg;
    }

    try {
      // Create viewer
      const viewer = new Marzipano.Viewer(container, { 
        controls: { mouseViewMode: 'drag' },
        stage: { progressive: true }
      });
      
      const img = new Image();
      img.onload = function() {
        try {
          // Use ImageUrlSource for both base64 and URLs as it's more stable in Marzipano
          // Specifying the geometry width based on image size for accuracy
          const source = Marzipano.ImageUrlSource.fromString(img.src);
          const geometry = new Marzipano.EquirectGeometry([{ width: img.width }]);
          
          const limiter = Marzipano.RectilinearView.limit.vfov(30 * Math.PI / 180, 120 * Math.PI / 180);
          const view = new Marzipano.RectilinearView({ yaw: 0, pitch: 0, fov: 90 * Math.PI / 180 }, limiter);
          
          const scene = viewer.createScene({ source, geometry, view });
          scene.switchTo({ transitionDuration: 0 });
          
          // Render furniture
          const items = ${JSON.stringify(itemsWithBase64)};
          items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'hotspot';
            element.style.width = item.width + 'px';
            element.style.height = item.height + 'px';
            
            const hotspotImg = document.createElement('img');
            hotspotImg.src = item.imgSrc;
            hotspotImg.className = 'furniture-img';
            hotspotImg.style.width = '100%';
            hotspotImg.style.height = '100%';
            if (item.flipX) hotspotImg.style.transform = 'scaleX(-1)';
            
            element.appendChild(hotspotImg);
            scene.hotspotContainer().createHotspot(element, { yaw: item.yaw, pitch: item.pitch });
          });

          // Hide loading screen
          loading.style.opacity = '0';
          setTimeout(() => loading.style.display = 'none', 500);
        } catch (e) {
          showError(${JSON.stringify(t("editor.exportSceneError"))} + e.message);
        }
      };
      img.onerror = function() {
        showError(${JSON.stringify(t("editor.exportDecodeFailed"))});
      };
      
      // Assign the source - this triggers decoding
      img.src = "${sceneBase64}";
    } catch (e) {
      showError(${JSON.stringify(t("editor.exportViewerError"))} + e.message);
    }
  </script>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/ /g, "_")}_360.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  }, [eventType, sceneIndex, placedItemsMap, projectName, eventLabel, t]);

  const handleShare = useCallback(async () => {
    if (!projectId) return;
    const shareUrl = `${window.location.origin}/share/${projectId}`;
    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      setIsSharing(true);
      setTimeout(() => setIsSharing(false), 2000);
    } else {
      window.prompt(t("editor.copyShareLink"), shareUrl);
    }
  }, [projectId, t]);

  const defaultScenes: Scene[] = (EVENT_SCENES[eventType] ?? EVENT_SCENES["Wedding"]).map(
    (s) => ({ ...s, isCustom: false })
  );
  // Template projects open with only their own scene(s) — no defaults.
  const baseScenes: Scene[] = customScenesOnly ? [] : defaultScenes;
  const allScenes: Scene[] = [
    ...baseScenes,
    ...customScenes.map((cs) => ({
      label: cs.name,
      src: cs.src,
      dimensions: `${cs.width}×${cs.height}px`,
      isCustom: true as const,
    })),
  ];
  const currentScene = allScenes[sceneIndex] ?? allScenes[0];
  const legacyVenue = venueId ? VENUES.find((v) => v.id === venueId) : null;
  const displayVenueName = resolvedVenueName ?? legacyVenue?.name ?? null;

  useEffect(() => {
    setMarzipanoViewer(null);
    const interval = window.setInterval(() => {
      const viewer = panoramaRef.current?.getViewer();
      if (viewer) {
        setMarzipanoViewer(viewer);
        window.clearInterval(interval);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [currentScene.src]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const restoreData = (data: any) => {
      if (data && typeof data === "object") {
        // 2D furniture sits on the floor — the editor's own debug panel
        // calls pitch 0.04–0.18 the good floor band. Items dropped while
        // the scene was black landed at pitch 0 (horizon) and floated on
        // the wall at eye level, half-hidden in the decor. Nudge those
        // down to the floor band on load (yaw untouched).
        // Also: old placed items are tiny (60–80 px divs whose drawings
        // cover only ~25% of the image), rendering as 20 px specks.
        // Scale up items never resized by the user (still at their
        // embedded catalog default size) to the new catalog scale.
        const normalized: Record<string, any[]> = {};
        Object.entries(data).forEach(([key, items]) => {
          normalized[key] = Array.isArray(items)
            ? items.map((item: any) => {
                let next = item;
                if (typeof item?.pitch === "number" && item.pitch < 0.04) {
                  next = { ...next, pitch: 0.1 };
                }
                const dw = item?.item?.defaultWidth;
                const dh = item?.item?.defaultHeight;
                if (
                  typeof item?.width === "number" &&
                  typeof item?.height === "number" &&
                  typeof dw === "number" &&
                  typeof dh === "number" &&
                  item.width === dw &&
                  item.height === dh
                ) {
                  next = {
                    ...next,
                    width: item.width * FURNITURE_SIZE_SCALE,
                    height: item.height * FURNITURE_SIZE_SCALE,
                  };
                }
                return next;
              })
            : (items as any[]);
        });
        setPlacedItemsMap(normalized);
        let maxId = 0;
        Object.values(normalized).forEach((items: any) => {
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              const num = parseInt(item.uid?.split("-")[1] || "0");
              if (num > maxId) maxId = num;
            });
          }
        });
        uidCounter = maxId;
      }
    };

    const applyProject = (data: {
      name?: string;
      eventType?: string;
      venueId?: string;
      budget?: number;
      data?: any;
      items3D?: any;
      customScenes?: Array<{ name: string; src: string; width?: number; height?: number }>;
      customScenesOnly?: boolean;
    }) => {
      setProjectName(data.name ?? t("editor.untitledProject"));
      const et = data.eventType ?? "Wedding";
      setEventType(et);
      setVenueId(data.venueId ?? null);
      setResolvedVenueName(null);
      setSceneIndex(0);
      setBudget(data.budget ?? 0);
      setCustomScenesOnly(data.customScenesOnly ?? false);
      restoreData(data.data);
      if (data.items3D) {
        if (Array.isArray(data.items3D)) {
          setItems3DMap({ [`${et}::0`]: data.items3D });
        } else {
          setItems3DMap(data.items3D);
        }
      }
      if (data.customScenes?.length) {
        setCustomScenes(
          data.customScenes.map((cs) => ({
            name: cs.name,
            src: cs.src,
            width: cs.width ?? 0,
            height: cs.height ?? 0,
            isCustom: true as const,
          }))
        );
      } else {
        setCustomScenes([]);
      }
    };

    const loadVenueScene = async (
      venueIdStr: string,
      et: string,
      projectCustomScenes: Array<{ name: string; src: string; width?: number; height?: number }> | undefined,
      customOnly = false
    ) => {
      if (!token) return;
      try {
        const res = await fetch(`/api/venues/${encodeURIComponent(venueIdStr)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const venue = await res.json();
        if (cancelled) return;

        setResolvedVenueName(typeof venue.name === "string" ? venue.name : null);

        const defaultScenesList = EVENT_SCENES[et] ?? EVENT_SCENES["Wedding"];
        // Template projects have no event-type defaults, so the venue
        // scene (if one is ever added) sits at index 0, not baseLen.
        const baseLen = customOnly ? 0 : defaultScenesList.length;

        // The venue's sceneImageUrl is only a real panorama when it is an
        // absolute URL (e.g. an admin-uploaded Cloudinary panorama). Seeded
        // venues store a relative thumbnail path instead
        // ('/scenes/grand-hall-thumb.jpg'), and public/scenes/ does not
        // exist, so that URL 404s and Marzipano shows a black view — and
        // the editor auto-selects this scene on entry, so the user always
        // lands on black. Fall back to the real panorama with the same
        // name as the venue (searched across all event types); if there
        // is none, land on the venue's configured scene instead.
        const sceneImageUrl =
          typeof venue.sceneImageUrl === "string" ? venue.sceneImageUrl : "";
        const isPanoramaUrl = /^https?:\/\//i.test(sceneImageUrl);

        if (isPanoramaUrl) {
          const venueScene: CustomScene = {
            name: venue.name,
            src: sceneImageUrl,
            width: 4096,
            height: 2048,
            isCustom: true,
          };
          const saved = (projectCustomScenes ?? []).map((cs) => ({
            name: cs.name,
            src: cs.src,
            width: cs.width ?? 0,
            height: cs.height ?? 0,
            isCustom: true as const,
          }));
          const rest = saved.filter((c) => c.src !== sceneImageUrl);
          setCustomScenes([venueScene, ...rest]);
          setSceneIndex(baseLen);
        } else {
          // "Grand Hall" lives under Gala Dinner, not Wedding, so search
          // every event type's list for a panorama with the venue's name.
          // If one exists, re-add the venue scene at the same index the
          // broken venue scene had (baseLen), pointing at the real
          // panorama — furniture placed on the old black scene then
          // reappears on it, since it is stored under that same key.
          const match = Object.values(EVENT_SCENES)
            .flat()
            .find(
              (s) =>
                s.label.toLowerCase() === String(venue.name ?? "").toLowerCase()
            );
          if (match) {
            const venueScene: CustomScene = {
              name: venue.name,
              src: match.src,
              width: 4096,
              height: 2048,
              isCustom: true,
            };
            const saved = (projectCustomScenes ?? []).map((cs) => ({
              name: cs.name,
              src: cs.src,
              width: cs.width ?? 0,
              height: cs.height ?? 0,
              isCustom: true as const,
            }));
            const rest = saved.filter(
              (c) => c.src !== sceneImageUrl && c.src !== match.src
            );
            setCustomScenes([venueScene, ...rest]);
            setSceneIndex(baseLen);
          } else if (venue.sceneIndex !== undefined && venue.sceneIndex !== null) {
            // No panorama matches the venue name: land on the venue's
            // configured scene, moving any furniture stored under the old
            // venue-scene key there so it does not vanish with the scene.
            const targetIdx = Number(venue.sceneIndex);
            const fromKey = `${et}::${baseLen}`;
            const toKey = `${et}::${targetIdx}`;
            setPlacedItemsMap((prev) => {
              if (!prev[fromKey]?.length) return prev;
              const next = { ...prev };
              next[toKey] = [...(next[toKey] ?? []), ...next[fromKey]];
              delete next[fromKey];
              return next;
            });
            setItems3DMap((prev) => {
              if (!prev[fromKey]?.length) return prev;
              const next = { ...prev };
              next[toKey] = [...(next[toKey] ?? []), ...next[fromKey]];
              delete next[fromKey];
              return next;
            });
            setSceneIndex(targetIdx);
          }
        }
      } catch (err) {
        console.warn("Could not load venue scene:", err);
      }
    };

    const local = projects.find((p) => p._id === projectId);
    if (local) {
      applyProject({
        name: local.name,
        eventType: local.eventType,
        venueId: (local as any).venueId,
        budget: local.budget,
        data: (local as any).data,
        items3D: (local as any).items3D,
        customScenes: (local as any).customScenes,
        customScenesOnly: (local as any).customScenesOnly,
      });
      const vid = (local as any).venueId as string | undefined;
      if (vid && token) {
        void loadVenueScene(vid, local.eventType ?? "Wedding", (local as any).customScenes, (local as any).customScenesOnly ?? false);
      }
      return () => {
        cancelled = true;
      };
    }

    if (!token) return;

    fetch(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data._id || cancelled) return;
        applyProject(data);
        if (data.venueId && token) {
          void loadVenueScene(
            data.venueId,
            data.eventType ?? "Wedding",
            data.customScenes,
            data.customScenesOnly ?? false
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [projectId, projects, token]);

  // Build chatbot context from all scenes
  const aiScenes = allScenes.map((scene, idx) => ({
    label: scene.label,
    dimensions: scene.dimensions,
    rentPrice: scene.rentPrice,
    items: placedItemsMap[`${eventType}::${idx}`] ?? [],
  }));

  function handleSceneImport(scene: Omit<CustomScene, "isCustom">) {
    if (customScenes.length >= 3) {
      setShowSceneImport(false);
      return;
    }
    const newScene: CustomScene = { ...scene, isCustom: true };
    const updated = [...customScenes, newScene];
    setCustomScenes(updated);
    setSceneIndex(defaultScenes.length + customScenes.length);
    setShowSceneImport(false);

    if (projectId && token) {
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customScenes: updated }),
      }).catch(() => {});
    }
  }

  function removeCustomScene(index: number) {
    // A template project's single scene cannot be removed — the project
    // would be left with no scene at all.
    if (customScenesOnly && customScenes.length <= 1) return;
    if (
      !confirm(t("editor.removeSceneConfirm"))
    )
      return;

    const baseLength = baseScenes.length;
    const removedGlobalIndex = baseLength + index;

    // Remove placed items for the removed scene AND shift any later custom-scene keys down by 1.
    setPlacedItemsMap((prev) => {
      const next: Record<string, PlacedItem[]> = {};
      for (const [key, value] of Object.entries(prev)) {
        const prefix = `${eventType}::`;
        if (!key.startsWith(prefix)) {
          next[key] = value;
          continue;
        }

        const idxStr = key.slice(prefix.length);
        const idx = Number.parseInt(idxStr, 10);
        if (!Number.isFinite(idx)) {
          next[key] = value;
          continue;
        }

        if (idx === removedGlobalIndex) {
          // drop this scene's items
          continue;
        }

        if (idx > removedGlobalIndex) {
          // shift down to keep indices aligned with allScenes
          next[`${prefix}${idx - 1}`] = value;
          continue;
        }

        next[key] = value;
      }
      return next;
    });

    const updatedCustomScenes = customScenes.filter((_, i) => i !== index);
    setCustomScenes(updatedCustomScenes);

    // If currently viewing the removed scene (or any custom scene at/after it), go back to last default scene
    if (sceneIndex >= baseLength + index) {
      setSceneIndex(Math.max(0, baseLength - 1));
    }

    if (projectId && token) {
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ customScenes: updatedCustomScenes }),
      }).catch(() => {});
    }
  }

  return (
    <div
      className="h-[calc(100vh-112px)] flex flex-col overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
    >

      {/* ── Clean Header ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "rgba(0,0,0,0.07)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)" }}
      >
        {/* Left: back + project name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-zinc-100 text-zinc-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-zinc-900 text-sm leading-tight">{projectName}</h1>
            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider leading-none mt-0.5">
              {eventLabel}
              {displayVenueName ? ` · ${displayVenueName}` : ""} · {currentScene.label}
            </p>
          </div>
        </div>

        {/* Right: action buttons only */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 ${
              saveStatus === "success"
                ? "bg-green-500 text-white border border-green-400"
                : saveStatus === "error"
                ? "bg-red-500 text-white border border-red-400"
                : "text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? "animate-spin" : ""}`} />
            {isSaving
              ? t("editor.saving")
              : saveStatus === "success"
              ? `✓ ${t("editor.saved")}`
              : saveStatus === "error"
              ? `✗ ${t("editor.saveError")}`
              : t("editor.save")}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 transition-all shadow-sm"
          >
            <FileText className={`w-3.5 h-3.5 ${isExportingPdf ? "animate-spin" : ""}`} />
            {isExportingPdf ? t("editor.generating") : "PDF"}
          </button>
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              isSharing
                ? "bg-green-500 text-white border border-green-400"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Share2 className={`w-3.5 h-3.5 ${isSharing ? "scale-110" : ""}`} />
            {isSharing ? t("editor.copied") : t("editor.share")}
          </button>
          <button
            onClick={handleExportStandalone}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-all shadow-sm"
            style={{ background: "linear-gradient(135deg,#FF6B4A,#FF8E72)" }}
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-spin" : ""}`} />
            {isExporting ? t("editor.exporting") : t("editor.export")}
          </button>
        </div>
      </div>

      {/* ── Body: Left AI Panel + Right 360° Viewer ──────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: AI Panel ────────────────────────────────────────────── */}
        <div
          className="w-80 shrink-0 flex flex-col overflow-hidden border-r"
          style={{
            borderColor: "rgba(0,0,0,0.07)",
            background: "linear-gradient(180deg, #f8f8fb 0%, #f2f2f8 100%)",
          }}
        >
          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b shrink-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#7C3AED,#A78BFA)" }}
              >
                <Sofa className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-zinc-900 leading-none">{t("editor.aiSuggestions")}</p>
                <p className="text-[10px] text-zinc-400 leading-none mt-0.5">{t("editor.aiSubtitle")}</p>
              </div>
            </div>
          </div>

          {/* Scrollable AI tools */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-hide">

            {/* AI Auto-Design */}
            <AIAutoDesign
              onCapture={captureScene}
              eventType={eventType}
              sceneLabel={currentScene.label}
              dimensions={currentScene.dimensions}
              onApply={setPlacedItems}
              currentItems={placedItems}
              catalog={furnitureCatalog}
            />

            {/* Logo Integration */}
            <LogoIntegration
              onInsert={handleInsertBrandedFurniture}
              catalogItems={furnitureCatalog}
            />

            {/* AI Asset Advisor / Chatbot */}
            <AIChatbot
              context={{
                projectName,
                eventType,
                budget,
                scenes: aiScenes,
              }}
              furnitureCatalog={furnitureCatalog}
            />
          </div>
        </div>

        {/* ── RIGHT: 360° Viewer ────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden bg-zinc-900">
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <PanoramaViewer ref={panoramaRef} src={currentScene.src} />
            <ThreeOverlay
              viewer={marzipanoViewer ?? panoramaRef.current?.getViewer()}
              initialItems={currentItems3D}
              onItemsChange={(items) => {
                setItems3DMap((prev) => ({
                  ...prev,
                  [sceneKey]: items,
                }));
              }}
            />
            <SceneOverlay
              placedItems={placedItems}
              onChange={setPlacedItems}
              viewerRef={panoramaRef}
            />
          </div>

          {/* 360° badge */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="bg-black/45 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {t("editor.virtualTour")}
            </div>
          </div>

          {/* Furniture Panel toggle — top-right of viewer */}
          <div className="absolute top-4 right-4 z-30">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setFurniturePanelOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold shadow-lg transition-all"
              style={{
                background: furniturePanelOpen ? "rgba(255,107,74,0.92)" : "rgba(255,255,255,0.18)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: furniturePanelOpen ? "1px solid rgba(255,107,74,0.5)" : "1px solid rgba(255,255,255,0.3)",
                color: "white",
              }}
            >
              <Sofa className="w-4 h-4" />
              {t("editor.furniture")}
            </motion.button>
          </div>

          {/* Scene info card — bottom of viewer, compact + 80% opacity */}
          <div className="absolute bottom-5 left-5 z-20 pointer-events-auto" style={{ opacity: 0.82 }}>
            <div
              className="rounded-2xl px-3.5 py-2.5 flex items-center gap-3"
              style={{
                background: "rgba(10,10,20,0.72)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {/* Scene label + meta */}
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-[11px] font-bold text-white leading-none truncate">
                    {currentScene.label}
                  </p>
                  {currentScene?.isCustom && (
                    <>
                      <span className="px-1.5 py-0.5 rounded-full border border-white/30 text-[8px] uppercase tracking-wider text-white/80">
                        {t("editor.custom")}
                      </span>
                      {allScenes.length > 1 && (
                        <button
                          onClick={() => {
                            removeCustomScene(sceneIndex - baseScenes.length);
                          }}
                          className="text-[10px] px-2 py-1 rounded-md border border-dashed border-red-400/60 text-red-400 hover:bg-red-500/10 transition-colors ml-2"
                        >
                          {t("editor.removeScene")}
                        </button>
                      )}
                    </>
                  )}
                </div>
                <p className="text-[9px] text-white/55 mt-0.5 leading-none">
                  {currentScene.dimensions ?? "—"} · {eventType}
                  {currentScene.rentPrice ? ` · €${currentScene.rentPrice.toLocaleString()}${t("editor.perDay")}` : ""}
                </p>
              </div>
              {/* Divider */}
              <div className="w-px h-7 bg-white/15 shrink-0" />
              {/* Mini scene switcher + import */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSceneIndex(Math.max(0, sceneIndex - 1))}
                    disabled={sceneIndex === 0}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-white/60 hover:text-white disabled:opacity-25 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {allScenes.map((scene, i) => {
                    const baseLength = baseScenes.length;
                    const isCustom = i >= baseLength;
                    const customIndex = i - baseLength;

                    return (
                      <div key={i} className="relative inline-block">
                        <button
                          onClick={() => setSceneIndex(i)}
                          className={`w-5 h-5 rounded-md text-[9px] font-bold transition-all ${
                            i === sceneIndex
                              ? "bg-white/25 text-white"
                              : "text-white/40 hover:text-white/70"
                          } ${isCustom ? "border border-blue-400/60" : ""}`}
                        >
                          {i + 1}
                        </button>

                        {isCustom && allScenes.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomScene(customIndex);
                            }}
                            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-[9px] font-bold z-10 transition-colors"
                            title={t("editor.removeSceneTitle")}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setSceneIndex(Math.min(allScenes.length - 1, sceneIndex + 1))}
                    disabled={sceneIndex === allScenes.length - 1}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-white/60 hover:text-white disabled:opacity-25 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => setShowSceneImport(true)}
                  disabled={customScenes.length >= 3}
                  className="text-[10px] px-3 py-1 rounded-md border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70 transition-colors"
                >
                  + {t("editor.importScene")}
                </button>
                {customScenes.length >= 3 ? (
                  <span className="text-[9px] text-red-400/80 ml-1">
                    {t("editor.maxCustomScenes")}
                  </span>
                ) : (
                  <span className="text-[9px] text-white/50 ml-1">
                    {t("editor.customScenes")}: {customScenes.length}/3 — {t("editor.maxPerProject")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Debug overlay — shows coordinates of all placed items ── */}
          {placedItems.length > 0 && (
            <div className="absolute top-14 left-4 z-40 pointer-events-none max-w-[260px]">
              <div
                className="rounded-xl px-3 py-2 text-[9px] font-mono leading-relaxed"
                style={{ background: "rgba(0,0,0,0.72)", color: "#a3e635", border: "1px solid rgba(163,230,53,0.25)" }}
              >
                <div className="text-[8px] font-bold uppercase tracking-widest text-lime-400/70 mb-1">
                  {t("editor.placementDebug")} · {placedItems.length} {t("editor.items")}
                </div>
                {placedItems.slice(0, 8).map((p) => (
                  <div
                    key={p.uid}
                    className={
                      p.pitch > 0.04 && p.pitch < 0.18
                        ? "text-lime-300" // good floor band (~0.05–0.15)
                        : p.pitch < 0
                        ? "text-red-400" // ceiling / invalid
                        : "text-yellow-300" // near horizon / edge cases
                    }
                  >
                    {p.item.label.slice(0, 10).padEnd(10)} y={p.yaw.toFixed(2)} p={p.pitch.toFixed(2)}
                    {p.pitch > 0.04 && p.pitch < 0.18
                      ? ` ✓ ${t("editor.floor")}`
                      : p.pitch < 0
                      ? ` ✗ ${t("editor.ceil")}`
                      : ` ⚠ ${t("editor.horizon")}`}
                  </div>
                ))}
                {placedItems.length > 8 && (
                  <div className="text-lime-400/50">+{placedItems.length - 8} {t("editor.more")}</div>
                )}
              </div>
            </div>
          )}

          {/* Furniture Panel (slides in from right of viewer) */}
          <FurniturePanel
            open={furniturePanelOpen}
            onClose={() => setFurniturePanelOpen(false)}
            onAdd={handleAddFurniture}
            catalogItems={furnitureCatalog}
            projectId={projectId || undefined}
          />

          <HintOverlay />

          <SceneImportModal
            isOpen={showSceneImport}
            onClose={() => setShowSceneImport(false)}
            onImport={handleSceneImport}
          />
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-112px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-coral-500/20 border-t-coral-500 rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium">{t("editor.loadingEditor")}</p>
        </div>
      </div>
    }>
      <Editor />
    </Suspense>
  );
}


function HintOverlay() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="bg-black/40 backdrop-blur-sm text-white text-sm font-medium px-5 py-3 rounded-2xl flex items-center gap-3">
        <span className="text-xl">👆</span>
        {t("editor.dragToExplore")}
      </div>
    </motion.div>
  );
}
