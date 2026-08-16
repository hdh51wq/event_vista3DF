"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMarzipanoCameraSync } from "@/hooks/useMarzipanoCameraSync";
import { Furniture3D } from "./Furniture3D";

export interface Item3D {
  id: string;
  label: string;
  glbPath: string;
  yaw: number;
  pitch: number;
  scale: number;
  rotationY: number;
}

const btnStyle: React.CSSProperties = {
  color: "white",
  background: "rgba(255,255,255,0.15)",
  border: "none",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 12,
};

function ViewTracker({
  viewer,
  onUpdate,
}: {
  viewer: unknown;
  onUpdate: (yaw: number, pitch: number) => void;
}) {
  useFrame(() => {
    const v = viewer as { view?: () => { yaw: () => number; pitch: () => number } };
    if (!v?.view) return;
    const view = v.view();
    if (!view) return;
    onUpdate(view.yaw(), view.pitch());
  });
  return null;
}

function SyncedScene({
  viewer,
  items,
  onSelect,
  onViewUpdate,
}: {
  viewer?: unknown;
  items: Item3D[];
  onSelect: (id: string) => void;
  onViewUpdate: (yaw: number, pitch: number) => void;
}) {
  useMarzipanoCameraSync(viewer);

  return (
    <>
      <ViewTracker viewer={viewer} onUpdate={onViewUpdate} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 5, 5]} intensity={2.0} />
      <directionalLight position={[-5, 3, -5]} intensity={0.8} />
      <Suspense fallback={null}>
        {items.map((item) => (
          <group
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.id);
            }}
          >
            <Furniture3D
              glbPath={item.glbPath}
              yaw={item.yaw}
              pitch={item.pitch}
              scale={item.scale}
              rotationY={(item.rotationY * Math.PI) / 180}
              radius={5}
            />
          </group>
        ))}
      </Suspense>
    </>
  );
}

interface ThreeOverlayProps {
  viewer?: unknown;
  initialItems?: Item3D[];
  onItemsChange?: (items: Item3D[]) => void;
}

export default function ThreeOverlay({
  viewer,
  initialItems,
  onItemsChange,
}: ThreeOverlayProps) {
  const currentViewRef = useRef({ yaw: 0, pitch: -0.15 });
  const [items, setItems] = useState<Item3D[]>(initialItems ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingFromPanel, setIsDraggingFromPanel] = useState(false);

  useEffect(() => {
    setItems(initialItems ?? []);
  }, [JSON.stringify(initialItems)]);

  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;

  useEffect(() => {
    onItemsChangeRef.current?.(items);
  }, [items]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const onDragStart = () => setIsDragOver(false);
    const onDragEnd = () => setIsDragOver(false);

    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  useEffect(() => {
    const onStart = () => setIsDraggingFromPanel(true);
    const onEnd = () => setIsDraggingFromPanel(false);
    window.addEventListener("furniture3DDragStart", onStart);
    window.addEventListener("furniture3DDragEnd", onEnd);
    return () => {
      window.removeEventListener("furniture3DDragStart", onStart);
      window.removeEventListener("furniture3DDragEnd", onEnd);
    };
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<Pick<Item3D, "yaw" | "pitch" | "scale" | "rotationY">>) => {
      if (!selectedId) return;
      setItems((prev) =>
        prev.map((item) => (item.id === selectedId ? { ...item, ...patch } : item))
      );
    },
    [selectedId]
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== selectedId);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }, [selectedId]);

  const normalizedRotation = selected
    ? ((selected.rotationY % 360) + 360) % 360
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: "transparent",
        zIndex: 10,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 0], fov: 90, near: 0.1, far: 1000 }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        }}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "transparent",
        }}
      >
        <SyncedScene
          viewer={viewer}
          items={items}
          onSelect={setSelectedId}
          onViewUpdate={(yaw, pitch) => {
            currentViewRef.current = { yaw, pitch };
          }}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          pointerEvents: isDraggingFromPanel ? 'all' : 'none',
          background: isDragOver
            ? 'rgba(29,158,117,0.15)'
            : 'transparent',
          border: isDragOver
            ? '2px dashed rgba(29,158,117,0.6)'
            : 'none',
          borderRadius: 8,
          transition: 'all 0.15s',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setIsDragOver(true);
        }}
        onDragEnter={() => setIsDragOver(true)}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          setIsDraggingFromPanel(false);

          const data = e.dataTransfer.getData('furniture3D');
          if (!data) return;

          const { label, glbPath } = JSON.parse(data);

          const yaw = -currentViewRef.current.yaw;

          const id = `3d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          setItems(prev => [...prev, {
            id,
            label,
            glbPath,
            yaw,
            pitch: -0.15,
            scale: 0.5,
            rotationY: 0,
          }]);
          setSelectedId(id);
        }}
      />

      {isDragOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(29,158,117,0.9)',
          color: 'white',
          fontSize: 14,
          fontWeight: 500,
          padding: '10px 20px',
          borderRadius: 20,
          pointerEvents: 'none',
          zIndex: 50,
        }}>
          Drop here to place in scene
        </div>
      )}

      {items.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 30,
            pointerEvents: "all",
          }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              style={{
                background:
                  selectedId === item.id ? "rgba(24,95,165,0.9)" : "rgba(0,0,0,0.6)",
                border:
                  selectedId === item.id
                    ? "1.5px solid #60A5FA"
                    : "1px solid rgba(255,255,255,0.2)",
                borderRadius: 12,
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 14 }}>
                {item.label === "Sofa"
                  ? "🛋️"
                  : item.label === "Chair"
                    ? "🪑"
                    : item.label === "Table"
                      ? "🪑"
                      : "📦"}
              </span>
              <span style={{ color: "white", fontSize: 11, fontWeight: 500 }}>{item.label}</span>
              {selectedId === item.id && (
                <span style={{ fontSize: 8, color: "#93C5FD", marginLeft: 2 }}>●</span>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          style={{
            position: "absolute",
            bottom: showControls ? 130 : 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 20,
            padding: "4px 14px",
            color: "white",
            fontSize: 11,
            cursor: "pointer",
            zIndex: 31,
            pointerEvents: "all",
            transition: "bottom 0.2s",
          }}
        >
          {showControls ? "▼ Hide controls" : "▲ Show controls"}
        </button>
      )}

      {selected && showControls && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.65)",
            borderRadius: 24,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 30,
            pointerEvents: "all",
          }}
        >
          <span style={{ color: "white", fontSize: 11 }}>Size</span>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.1}
            value={selected.scale}
            onChange={(e) => updateSelected({ scale: parseFloat(e.target.value) })}
            style={{ width: 90 }}
          />
          <span style={{ color: "white", fontSize: 11 }}>{selected.scale.toFixed(1)}</span>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.3)" }} />

          <button type="button" onClick={() => updateSelected({ rotationY: selected.rotationY - 15 })} style={btnStyle}>
            ←
          </button>
          <span style={{ color: "white", fontSize: 11, minWidth: 35, textAlign: "center" }}>
            {normalizedRotation}°
          </span>
          <button type="button" onClick={() => updateSelected({ rotationY: selected.rotationY + 15 })} style={btnStyle}>
            →
          </button>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.3)" }} />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <button type="button" onClick={() => updateSelected({ pitch: selected.pitch + 0.02 })} style={btnStyle}>
              ▲
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => updateSelected({ yaw: selected.yaw - 0.05 })} style={btnStyle}>
                ◄
              </button>
              <button type="button" onClick={() => updateSelected({ yaw: selected.yaw + 0.05 })} style={btnStyle}>
                ►
              </button>
            </div>
            <button type="button" onClick={() => updateSelected({ pitch: selected.pitch - 0.02 })} style={btnStyle}>
              ▼
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.3)" }} />

          <button
            type="button"
            onClick={removeSelected}
            style={{
              ...btnStyle,
              background: "rgba(220,38,38,0.75)",
              padding: "4px 10px",
            }}
            title="Remove selected item"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
