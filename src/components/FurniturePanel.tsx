"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { FurnitureItem, FALLBACK_FURNITURE_ITEMS } from "@/lib/furniture";
import FurnitureUploadModal from "./FurnitureUploadModal";
import Furniture3DUploadModal from "./Furniture3DUploadModal";
import { Plus, User as UserIcon, Library, Box, ImageIcon } from "lucide-react";
import { GLBThumbnail } from "./GLBThumbnail";

export const FURNITURE_3D_MAP: Record<string, string> = {
  sofa: "/furniture/sofa.glb",
  chair: "/furniture/chair.glb",
  table: "/furniture/table.glb",
};

export type { FurnitureItem };

export interface Custom3DFurnitureItem {
  id: string;
  label: string;
  price: number;
  glbPath: string;
  createdAt: string;
}

type FurnitureTab = "3d" | "2d";

interface FurniturePanelProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: FurnitureItem) => void;
  /** Mongo-backed catalogue from editor; falls back to static list */
  catalogItems?: FurnitureItem[];
  projectId?: string;
}

export default function FurniturePanel({
  open,
  onClose,
  onAdd,
  catalogItems = FALLBACK_FURNITURE_ITEMS,
  projectId,
}: FurniturePanelProps) {
  const { user, token, updateUser, removeCustomFurniture, removeCustom3DFurniture } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<FurnitureTab>("3d");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [is3DUploadModalOpen, setIs3DUploadModalOpen] = useState(false);
  const [custom3DItems, setCustom3DItems] = useState<Custom3DFurnitureItem[]>([]);
  const [loading3DItems, setLoading3DItems] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const key = `furniture-tip-seen-${projectId || "default"}`;
    if (typeof window !== "undefined" && !localStorage.getItem(key)) {
      setShowTip(true);
    }
  }, [projectId]);

  const dismissTip = () => {
    const key = `furniture-tip-seen-${projectId || "default"}`;
    if (typeof window !== "undefined") {
      localStorage.setItem(key, "1");
    }
    setShowTip(false);
  };

  const customItems = (user?.customFurniture || []) as FurnitureItem[];

  useEffect(() => {
    if (!token) {
      setCustom3DItems([]);
      return;
    }

    let cancelled = false;
    setLoading3DItems(true);

    (async () => {
      try {
        const res = await fetch("/api/furniture/3d", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const items = (data.items || []) as Custom3DFurnitureItem[];
        setCustom3DItems(items);
        updateUser({ custom3DFurniture: items });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading3DItems(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const my3DItems = useMemo(() => {
    if (custom3DItems.length > 0) return custom3DItems;
    return (user?.custom3DFurniture || []) as Custom3DFurnitureItem[];
  }, [custom3DItems, user?.custom3DFurniture]);

  const items3d = useMemo(
    () => catalogItems.filter((item) => FURNITURE_3D_MAP[item.id]),
    [catalogItems]
  );
  const items2d = useMemo(
    () => catalogItems.filter((item) => !FURNITURE_3D_MAP[item.id]),
    [catalogItems]
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="furniture-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute top-0 right-0 h-full w-72 z-30 flex flex-col shadow-2xl"
            style={{
              background: "rgba(15,15,15,0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Library className="w-4 h-4 text-coral-400" />
                <span className="text-white font-bold text-sm tracking-tight uppercase">
                  {t("furnPanel.library")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="px-4 pt-4 pb-2">
              <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("3d")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === "3d"
                    ? "bg-coral-500 text-white shadow-lg shadow-coral-500/20"
                    : "text-white/50 hover:text-white/80"
                    }`}
                >
                  <Box className="w-3 h-3" />
                  {t("furnPanel.tab3d")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("2d")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === "2d"
                    ? "bg-coral-500 text-white shadow-lg shadow-coral-500/20"
                    : "text-white/50 hover:text-white/80"
                    }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  {t("furnPanel.tab2d")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
              {activeTab === "3d" && (
                <div className="px-5 py-4 space-y-6">
                  {token && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
                          {t("furnPanel.my3dItems")}
                        </h3>
                      </div>

                      {loading3DItems ? (
                        <div className="py-6 text-center text-[10px] text-white/30 uppercase tracking-wider">
                          {t("furnPanel.loading")}
                        </div>
                      ) : my3DItems.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {my3DItems.map((item) => (
                            <Custom3DFurnitureCard
                              key={item.id}
                              item={item}
                              onRemove={async (itemId) => {
                                const ok = await removeCustom3DFurniture(itemId);
                                if (ok) {
                                  setCustom3DItems((prev) => prev.filter((i) => i.id !== itemId));
                                }
                                return ok;
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div
                          onClick={() => setIs3DUploadModalOpen(true)}
                          className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl border border-dashed border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-all group"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <Plus className="w-5 h-5 text-white/20 group-hover:text-white/60" />
                          </div>
                          <p className="text-[10px] text-white/30 font-medium text-center leading-relaxed">
                            {t("furnPanel.noCustom3d")}
                            <br />
                            {t("furnPanel.clickToImport")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Box className="w-3.5 h-3.5 text-blue-400" />
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
                        {t("furnPanel.models3d")}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {items3d.map((item) => (
                        <FurnitureCard key={item.id} item={item} onAdd={onAdd} force3D />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIs3DUploadModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/15 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-bold uppercase tracking-wider transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {t("furnPanel.import3d")}
                  </button>
                </div>
              )}

              {activeTab === "2d" && (
                <>
                  <div className="px-5 py-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
                          {t("furnPanel.myItems")}
                        </h3>
                      </div>
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-coral-500 hover:bg-coral-600 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-coral-500/20"
                      >
                        <Plus className="w-3 h-3" />
                        {t("furnPanel.import2d")}
                      </button>
                    </div>

                    {customItems.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {customItems.map((item) => (
                          <FurnitureCard
                            key={item.id}
                            item={item}
                            onAdd={onAdd}
                            showRemove
                            onRemove={removeCustomFurniture}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl border border-dashed border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-all group"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <Plus className="w-5 h-5 text-white/20 group-hover:text-white/60" />
                        </div>
                        <p className="text-[10px] text-white/30 font-medium text-center leading-relaxed">
                          {t("furnPanel.noCustomItems")}
                          <br />
                          {t("furnPanel.clickToImport")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-2">
                    <div className="flex items-center gap-2 mb-4">
                      <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                      <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
                        {t("furnPanel.standardAssets")}
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {items2d.map((item) => (
                        <FurnitureCard key={item.id} item={item} onAdd={onAdd} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {showTip && open && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 50,
                  background: "rgba(0,0,0,0.75)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px",
                  borderRadius: "inherit",
                }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 20,
                    padding: "24px",
                    width: "100%",
                    maxWidth: 240,
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      marginBottom: 16,
                      textAlign: "center",
                    }}
                  >
                    🪑 {t("furnPanel.tipTitle")}
                  </div>

                  <div
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 12,
                      padding: "12px",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        color: "white",
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>🖼️</span> {t("furnPanel.tab2d")}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 11,
                        lineHeight: 1.6,
                      }}
                    >
                      {t("furnPanel.tip2dBody")}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(29,158,117,0.1)",
                      border: "1px solid rgba(29,158,117,0.3)",
                      borderRadius: 12,
                      padding: "12px",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        color: "white",
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>🧊</span> {t("furnPanel.tab3d")}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: 11,
                        lineHeight: 1.6,
                      }}
                    >
                      {t("furnPanel.tip3dBody")}
                    </div>
                  </div>

                  <button
                    onClick={dismissTip}
                    style={{
                      width: "100%",
                      background: "#1D9E75",
                      color: "white",
                      border: "none",
                      borderRadius: 12,
                      padding: "10px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t("furnPanel.tipGotIt")} 🎨
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <FurnitureUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          // Success handled by updateUser in modal
        }}
      />

      <Furniture3DUploadModal
        isOpen={is3DUploadModalOpen}
        onClose={() => setIs3DUploadModalOpen(false)}
        onSuccess={(item) => {
          setCustom3DItems((prev) => {
            if (prev.some((i) => i.id === item.id)) return prev;
            return [...prev, item];
          });
        }}
      />
    </>
  );
}

function Custom3DFurnitureCard({
  item,
  onRemove,
}: {
  item: Custom3DFurnitureItem;
  onRemove: (itemId: string) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        t("furnPanel.confirmRemove3d")
      )
    ) {
      return;
    }
    const ok = await onRemove(item.id);
    if (!ok) alert(t("furnPanel.remove3dFailed"));
  };

  return (
    <div
      className="relative group cursor-grab active:cursor-grabbing"
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "furniture3D",
          JSON.stringify({
            label: item.label,
            glbPath: item.glbPath,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
        window.dispatchEvent(new CustomEvent("furniture3DDragStart"));
      }}
      onDragEnd={() => {
        window.dispatchEvent(new CustomEvent("furniture3DDragEnd"));
      }}
    >
      <button
        type="button"
        onClick={handleRemove}
        className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
        title={t("furnPanel.remove3dTitle")}
      >
        ✕
      </button>
      <button
        type="button"
        className="w-full group flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 cursor-grab text-left relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-md bg-blue-500/90 text-white text-[9px] font-bold uppercase tracking-wide">
          3D
        </span>
        <div className="w-16 h-16 flex items-center justify-center relative z-10">
          <GLBThumbnail
            glbPath={item.glbPath}
            width={60}
            height={60}
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 relative z-10 w-full">
          <span className="text-white/70 text-[11px] font-semibold text-center leading-tight w-full truncate">
            {item.label}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
            {t("furnPanel.dragToScene")}
          </span>
          <span className="text-coral-400 text-[10px] font-bold">
            €{item.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-coral-500/0 via-coral-500/0 to-coral-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

function FurnitureCard({
  item,
  onAdd,
  showRemove = false,
  onRemove,
  force3D = false,
}: {
  item: FurnitureItem;
  onAdd: (item: FurnitureItem) => void;
  showRemove?: boolean;
  onRemove?: (itemId: string) => Promise<boolean>;
  force3D?: boolean;
}) {
  const { t } = useLanguage();
  const glbPath = FURNITURE_3D_MAP[item.id] ?? (item as unknown as { glbPath?: string }).glbPath;
  const is3D = Boolean(force3D || glbPath);

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !onRemove ||
      !confirm(
        t("furnPanel.confirmRemove")
      )
    ) {
      return;
    }
    const ok = await onRemove(item.id);
    if (!ok) alert(t("furnPanel.removeFailed"));
  };

  return (
    <div
      className={`relative group ${is3D ? "cursor-grab active:cursor-grabbing" : ""}`}
      draggable={is3D}
      onDragStart={
        is3D
          ? (e) => {
            e.dataTransfer.setData(
              "furniture3D",
              JSON.stringify({
                label: item.label,
                glbPath: FURNITURE_3D_MAP[item.id] ?? (item as unknown as { glbPath?: string }).glbPath,
              })
            );
            e.dataTransfer.effectAllowed = "copy";
            window.dispatchEvent(new CustomEvent("furniture3DDragStart"));
          }
          : undefined
      }
      onDragEnd={
        is3D
          ? () => {
            window.dispatchEvent(new CustomEvent("furniture3DDragEnd"));
          }
          : undefined
      }
    >
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          title={t("furnPanel.removeTitle")}
        >
          ✕
        </button>
      )}
      <button
        type="button"
        onClick={is3D ? undefined : () => onAdd(item)}
        className={`w-full group flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 ${is3D ? "cursor-grab" : "cursor-pointer"} text-left relative overflow-hidden`}
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {(force3D || glbPath) && (
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-md bg-blue-500/90 text-white text-[9px] font-bold uppercase tracking-wide">
            3D
          </span>
        )}
        <div className="w-16 h-16 flex items-center justify-center relative z-10">
          {glbPath ? (
            <GLBThumbnail
              glbPath={glbPath}
              width={60}
              height={60}
            />
          ) : (
            <Image
              src={item.views.front}
              alt={item.label}
              width={64}
              height={64}
              className="object-contain w-full h-full drop-shadow-xl group-hover:scale-110 transition-transform duration-300"
              unoptimized
            />
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5 relative z-10 w-full">
          <span className="text-white/70 text-[11px] font-semibold text-center leading-tight w-full truncate">
            {item.label}
          </span>
          {is3D && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              {t("furnPanel.dragToScene")}
            </span>
          )}
          <span className="text-coral-400 text-[10px] font-bold">
            ${item.price?.toLocaleString() || "0"}
          </span>
        </div>

        <div className="absolute inset-0 bg-gradient-to-br from-coral-500/0 via-coral-500/0 to-coral-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}
