"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Check, FlipHorizontal } from "lucide-react";
import { FurnitureItem } from "@/lib/furniture";
import { PanoramaViewerHandle } from "./PanoramaViewer";

export type Facing = "front" | "back" | "left" | "right";

export interface PlacedItem {
  uid: string;
  item: FurnitureItem;
  /** World-space anchor — set once when the item is first dropped */
  yaw: number;
  pitch: number;
  width: number;
  height: number;
  facing: Facing;
  flipX?: boolean;
  locked?: boolean;
  /** Cloudinary URL for canvas-composited image with client logo */
  brandedSrc?: string;
  /** 0–360° product spin; defaults to 0 */
  rotationAngle?: number;
  /** 0–360° CSS 3D rotation; defaults to 0 */
  rotationY?: number;
}

type InteractionMode = "drag" | "resize" | "rotate3d" | null;

/** Screen-space position computed each frame */
interface ScreenPos {
  x: number; // centre-x in px relative to container
  y: number; // centre-y in px relative to container
  visible: boolean;
  /** Compensatory rotation to follow sphere curvature */
  rotateY: number; // degrees
  rotateX: number; // degrees
  /** Subtle perspective scale based on angular distance from centre */
  scale: number;
}

interface SceneOverlayProps {
  placedItems: PlacedItem[];
  onChange?: (items: PlacedItem[]) => void;
  viewerRef: React.RefObject<PanoramaViewerHandle | null>;
  readOnly?: boolean;
}

function getSpinTransform(
  rotationAngle: number,
  views: FurnitureItem["views"]
): {
  src: string;
  rotateY: number;
  scaleX: number;
  face: Facing;
} {
  const angle = ((rotationAngle % 360) + 360) % 360;
  const zone = Math.floor(angle / 90);
  const remainder = angle % 90;
  const faces: Facing[] = ["front", "right", "back", "left"];
  const face = faces[zone];
  const src = views[face] ?? views.front;
  const rotateY = remainder;
  const scaleX = Math.cos((rotateY * Math.PI) / 180);
  return { src, rotateY, scaleX, face };
}

export default function SceneOverlay({
  placedItems,
  onChange,
  viewerRef,
  readOnly = false,
}: SceneOverlayProps) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Screen positions recomputed every rAF
  const [screenPositions, setScreenPositions] = useState<Record<string, ScreenPos>>({});

  // ---- rAF loop: reproject all items every frame ----
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const handle = viewerRef.current;
      const container = handle?.getContainer();
      const view = handle?.getView();

        if (view && container) {
          const currentYaw = view.yaw();
          const currentPitch = view.pitch();
          const next: Record<string, ScreenPos> = {};
          for (const item of placedItems) {
            const screen = view.coordinatesToScreen({ yaw: item.yaw, pitch: item.pitch });
            if (screen) {
              // Angular delta between camera centre and item anchor
              const deltaYaw = item.yaw - currentYaw;
              const deltaPitch = item.pitch - currentPitch;

              // Convert radians to degrees for CSS rotateY/rotateX
              // rotateY compensates horizontal offset, rotateX vertical offset
              // We negate so the face "turns into" the sphere surface
              const rotateYDeg = -deltaYaw * (180 / Math.PI);
              const rotateXDeg = deltaPitch * (180 / Math.PI);

              // Angular distance from centre — used for a subtle perspective scale
              const angDist = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);
              // Max scale reduction at 90° offset; keep it mild (max 15% reduction)
              const scale = Math.max(0.85, 1 - angDist * 0.08);

              next[item.uid] = { x: screen.x, y: screen.y, visible: true, rotateY: rotateYDeg, rotateX: rotateXDeg, scale };
            } else {
              // Behind the viewer — hide it
              const prev = screenPositions[item.uid];
              next[item.uid] = prev ? { ...prev, visible: false } : { x: 0, y: 0, visible: false, rotateY: 0, rotateX: 0, scale: 1 };
            }
          }
          setScreenPositions(prev => {
            // Only update if something actually changed
            const hasChanged = Object.keys(next).some(uid => {
              const p = prev[uid]
              const n = next[uid]
              if (!p || !n) return true
              return p.x !== n.x || 
                     p.y !== n.y || 
                     p.visible !== n.visible ||
                     p.rotateY !== n.rotateY ||
                     p.rotateX !== n.rotateX ||
                     p.scale !== n.scale
            })
            return hasChanged ? next : prev
          });
        }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
    // We deliberately leave screenPositions out of deps to avoid re-subscribing every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedItems, viewerRef]);

  // ---- Drag state (screen delta → world delta) ----
  const dragRef = useRef<{
    uid: string;
    startMouseX: number;
    startMouseY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);

  const resizeRef = useRef<{
    uid: string;
    startMouseX: number;
    startMouseY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const spinRef = useRef<{
    uid: string;
    startMouseX: number;
    startAngle: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotatingUid, setRotatingUid] = useState<string | null>(null);
  const [rotateStartX, setRotateStartX] = useState(0);
  const [rotateStartAngle, setRotateStartAngle] = useState(0);

  const updateItem = useCallback(
    (uid: string, patch: Partial<PlacedItem>) => {
      onChange?.(placedItems.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
    },
    [placedItems, onChange]
  );

  const deleteItem = useCallback(
    (uid: string) => {
      onChange?.(placedItems.filter((p) => p.uid !== uid));
      setSelectedUid(null);
    },
    [placedItems, onChange]
  );

  // Convert a screen delta (dx, dy) to a world-space (yaw, pitch) delta
  const screenDeltaToWorld = useCallback(
    (dx: number, dy: number): { dyaw: number; dpitch: number } => {
      const view = viewerRef.current?.getView();
      const container = viewerRef.current?.getContainer();
      if (!view || !container) return { dyaw: 0, dpitch: 0 };
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const c0 = view.screenToCoordinates({ x: cx, y: cy });
      const c1 = view.screenToCoordinates({ x: cx + dx, y: cy + dy });
      if (!c0 || !c1) return { dyaw: 0, dpitch: 0 };
      return { dyaw: c1.yaw - c0.yaw, dpitch: c1.pitch - c0.pitch };
    },
    [viewerRef]
  );

  const applySpinMove = useCallback(
    (clientX: number) => {
      if (!spinRef.current) return;
      const dx = clientX - spinRef.current.startMouseX;
      let newAngle = (spinRef.current.startAngle + dx) % 360;
      if (newAngle < 0) newAngle += 360;
      updateItem(spinRef.current.uid, { rotationAngle: newAngle });
    },
    [updateItem]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (spinRef.current) {
        applySpinMove(e.clientX);
        return;
      }
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startMouseX;
        const dy = e.clientY - dragRef.current.startMouseY;
        const { dyaw, dpitch } = screenDeltaToWorld(dx, dy);
        updateItem(dragRef.current.uid, {
          yaw: dragRef.current.startYaw + dyaw,
          pitch: dragRef.current.startPitch + dpitch,
        });
      }
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startMouseX;
        const ratio = resizeRef.current.startWidth / resizeRef.current.startHeight;
        const newW = Math.max(40, resizeRef.current.startWidth + dx);
    updateItem(resizeRef.current.uid, {
          width: newW,
          height: Math.max(40, newW / ratio),
        });
      }
    },
    [updateItem, screenDeltaToWorld, applySpinMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!spinRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      applySpinMove(touch.clientX);
    },
    [applySpinMove]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
    spinRef.current = null;
    setIsDragging(false);
    setIsSpinning(false);
  }, []);

  const startDrag = (e: React.MouseEvent, placed: PlacedItem) => {
    if (readOnly || placed.locked) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedUid(placed.uid);
    setIsDragging(true);
    dragRef.current = {
      uid: placed.uid,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startYaw: placed.yaw,
      startPitch: placed.pitch,
    };
  };

  const startResize = (e: React.MouseEvent, placed: PlacedItem) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    resizeRef.current = {
      uid: placed.uid,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: placed.width,
      startHeight: placed.height,
    };
  };

  const startSpin = (clientX: number, placed: PlacedItem) => {
    if (readOnly || placed.locked) return;
    setIsDragging(true);
    setIsSpinning(true);
    spinRef.current = {
      uid: placed.uid,
      startMouseX: clientX,
      startAngle: placed.rotationAngle ?? 0,
    };
  };

  useEffect(() => {
    if (!rotatingUid) return;

    const handleMove = (e: PointerEvent) => {
      const deltaX = e.clientX - rotateStartX;
      const newAngle = (rotateStartAngle + deltaX * 0.5) % 360;
      const normalized = newAngle < 0 ? newAngle + 360 : newAngle;
      updateItem(rotatingUid, { rotationY: normalized });
    };

    const handleUp = () => setRotatingUid(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [rotatingUid, rotateStartX, rotateStartAngle, updateItem]);

  useEffect(() => {
    if (!rotatingUid) return;
    document.body.style.cursor = "ew-resize";
    return () => {
      document.body.style.cursor = "";
    };
  }, [rotatingUid]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20"
      style={{
        pointerEvents: isDragging || rotatingUid ? "all" : "none",
        cursor: isDragging
          ? spinRef.current || rotatingUid
            ? "ew-resize"
            : "grabbing"
          : "default",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseUp}
    >
      {placedItems.map((placed) => {
        const pos = screenPositions[placed.uid];
        if (!pos || !pos.visible) return null;
          const isSelected = selectedUid === placed.uid;
          const isLocked = placed.locked;
          const rotY = pos.rotateY ?? 0;
          const rotX = pos.rotateX ?? 0;
          const scaleVal = pos.scale ?? 1;
          const rotationAngle = placed.rotationAngle ?? 0;
          const useSpin =
            placed.rotationAngle !== undefined && placed.rotationAngle !== 0;
          const spin = getSpinTransform(rotationAngle, placed.item.views);
          const imageSrc = useSpin
            ? spin.src
            : placed.brandedSrc ??
              placed.item.views[placed.facing] ??
              placed.item.views.front;
          const displayFace = spin.face;
          // Build the CSS transform: sphere-curvature rotation + optional flipX
          const curvatureTransform = `perspective(600px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scaleVal})`;
          const combinedTransform = placed.flipX
            ? `perspective(600px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${scaleVal}) scaleX(-1)`
            : curvatureTransform;
          const innerSpinTransform = useSpin
            ? `scaleX(${spin.scaleX}) rotateY(${spin.rotateY}deg)`
            : undefined;
          const itemRotY = placed.rotationY ?? 0;
          const isRotating = rotatingUid === placed.uid;

        return (
          <div
            key={placed.uid}
            style={{
              position: "absolute",
              // Place item centred on its world-space anchor
              left: pos.x - placed.width / 2,
              top: pos.y - placed.height / 2,
              width: placed.width,
              height: placed.height,
              cursor: isLocked ? "default" : "grab",
              userSelect: "none",
              pointerEvents: "all",
              outline: isSelected
                ? isLocked
                  ? "2px solid rgba(52,199,89,0.9)"
                  : "2px solid rgba(255,107,74,0.85)"
                : "2px solid transparent",
              borderRadius: 6,
            filter: isSelected
              ? isLocked
                ? "drop-shadow(0 0 8px rgba(52,199,89,0.5))"
                : "drop-shadow(0 0 8px rgba(255,107,74,0.5))"
              : "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
              transition: "outline 0.15s, filter 0.15s",
              transform: combinedTransform,
              transformOrigin: "center center",
              willChange: "transform",
            }}
            onMouseDown={(e) => startDrag(e, placed)}
            onClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              setSelectedUid(placed.uid);
            }}
          >
            {/* Lock badge */}
            {isLocked && !readOnly && (
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: -10,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#34C759",
                  border: "2px solid white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                  pointerEvents: "none",
                }}
              >
                <Check size={11} strokeWidth={3} color="white" />
              </div>
            )}

            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                transform: innerSpinTransform,
                transition: useSpin ? "transform 0.05s linear" : undefined,
                transformOrigin: "center center",
              }}
            >
              <Image
                src={imageSrc}
                alt={placed.item.label}
                width={placed.width}
                height={placed.height}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                  transform: `perspective(600px) rotateY(${itemRotY}deg)`,
                  transition: isRotating ? "none" : "transform 0.1s ease",
                }}
                unoptimized
                draggable={false}
              />
            </div>

            {isRotating && (
              <div
                style={{
                  position: "absolute",
                  top: -28,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.75)",
                  color: "white",
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 15,
                }}
              >
                {Math.round(itemRotY)}°
              </div>
            )}

            {(isSelected || readOnly) && (
              <>
                {/* Delete */}
                {!readOnly && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteItem(placed.uid); }}
                    style={{
                      position: "absolute", top: -14, right: -14,
                      width: 26, height: 26, borderRadius: "50%",
                      background: "#FF3B30", border: "2px solid white",
                      color: "white", fontSize: 14, lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", zIndex: 10,
                    }}
                    title="Delete"
                  >✕</button>
                )}

                {/* Confirm / lock */}
                {!isLocked && !readOnly && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateItem(placed.uid, { locked: true });
                      setSelectedUid(null);
                    }}
                    style={{
                      position: "absolute", top: -14, left: -14,
                      width: 26, height: 26, borderRadius: "50%",
                      background: "#34C759", border: "2px solid white",
                      color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", zIndex: 10,
                    }}
                    title="Confirm position"
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                )}

                {/* Unlock */}
                {isLocked && !readOnly && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateItem(placed.uid, { locked: false });
                    }}
                    style={{
                      position: "absolute", top: -14, left: -14,
                      width: 26, height: 26, borderRadius: "50%",
                      background: "#FF9500", border: "2px solid white",
                      color: "white", fontSize: 13,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", zIndex: 10,
                    }}
                    title="Unlock to reposition"
                  >✎</button>
                )}

                      {/* Resize handle */}
                      {!isLocked && !readOnly && (
                        <>
                          <div
                            onMouseDown={(e) => startResize(e, placed)}
                            style={{
                              position: "absolute", bottom: -8, right: -8,
                              width: 18, height: 18, borderRadius: 4,
                              background: "rgba(255,255,255,0.9)",
                              border: "2px solid rgba(255,107,74,0.85)",
                              cursor: "se-resize", zIndex: 10,
                            }}
                            title="Resize"
                          />
                        </>
                      )}

                      {/* 3D rotate handle */}
                      {isSelected && !isLocked && !readOnly && (
                        <button
                          title="Rotate 3D"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setRotatingUid(placed.uid);
                            setRotateStartX(e.clientX);
                            setRotateStartAngle(placed.rotationY ?? 0);
                          }}
                          className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs flex items-center justify-center transition-colors cursor-ew-resize"
                          style={{
                            position: "absolute",
                            bottom: -14,
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 20,
                            touchAction: "none",
                            border: "none",
                          }}
                        >
                          ↻
                        </button>
                      )}

                      {/* Toolbar: flip + face label */}
                      {!isLocked && !readOnly && (
                        <div
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            bottom: -48,
                            left: "50%",
                            transform: "translateX(-50%)",
                            display: "flex",
                            gap: 4,
                            background: "rgba(255,255,255,0.95)",
                            backdropFilter: "blur(8px)",
                            padding: "4px",
                            borderRadius: 12,
                            border: "1px solid rgba(0,0,0,0.1)",
                            boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                            zIndex: 30,
                          }}
                        >
                          <div className="flex items-center gap-1 px-2 border-r border-zinc-200 mr-1">
                            <span className="text-[10px] font-bold text-coral-500 uppercase tracking-tight">
                              {displayFace}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateItem(placed.uid, { flipX: !placed.flipX });
                            }}
                            style={{
                              width: 28, height: 28, borderRadius: 8,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", border: "none",
                              background: placed.flipX ? "rgba(255,107,74,0.1)" : "transparent",
                              color: placed.flipX ? "#FF6B4A" : "#52525b",
                            }}
                            className="hover:bg-zinc-100 transition-colors"
                            title="Horizontal Flip"
                          >
                            <FlipHorizontal size={14} />
                          </button>
                        </div>
                      )}

                    {/* Label */}

                <div
                  style={{
                    position: "absolute", top: -28, left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.65)", color: "white",
                    fontSize: 11, padding: "2px 8px", borderRadius: 8,
                    whiteSpace: "nowrap", pointerEvents: "none",
                  }}
                  >
                    {placed.item.label}{isLocked && !readOnly ? " 🔒" : ""}
                  </div>
                </>
              )}
            </div>
          );

      })}
    </div>
  );
}
