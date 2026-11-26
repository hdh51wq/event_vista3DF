"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  Move,
  SlidersHorizontal,
  CheckCircle2,
  X,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { FurnitureItem, FALLBACK_FURNITURE_ITEMS } from "@/lib/furniture";
import { applyLogoToFurniture } from "@/lib/applyLogoToFurniture";
import { uploadImage } from "@/lib/uploadImageClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface LogoIntegrationProps {
  /** Called when the user finalises branding and wants to insert into the scene */
  onInsert: (item: FurnitureItem, brandedSrc: string) => void;
  catalogItems?: FurnitureItem[];
}

type Step = 1 | 2 | 3 | 4;

export default function LogoIntegration({
  onInsert,
  catalogItems = FALLBACK_FURNITURE_ITEMS,
}: LogoIntegrationProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const { user, token } = useAuth();

  const customItems = (user?.customFurniture || []) as FurnitureItem[];
  const allItems: FurnitureItem[] = [...catalogItems, ...customItems];

  // Step 1 – Logo upload
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 – Furniture selection
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);

  // Step 3 – Adjust & preview
  const [sizePercent, setSizePercent] = useState<number>(0.22); // 22% of width
  const [opacity, setOpacity] = useState<number>(0.9); // 0.5 – 1.0
  const [logoXNorm, setLogoXNorm] = useState<number>(0.65); // 0–1, relative to furniture width
  const [logoYNorm, setLogoYNorm] = useState<number>(0.65); // 0–1, relative to furniture height
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string>("");
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const interactiveRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    dragging: boolean;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrorOnInsert, setUploadErrorOnInsert] = useState("");
  const renderVersionRef = useRef(0);

  const selectedFurniture = selectedFurnitureId
    ? allItems.find((f) => f.id === selectedFurnitureId) ?? null
    : null;

  const reset = useCallback(() => {
    setStep(1);
    setLogoDataUrl(null);
    setLogoFileName("");
    setUploadError("");
    setSelectedFurnitureId(null);
    setSizePercent(0.22);
    setOpacity(0.9);
    setLogoXNorm(0.65);
    setLogoYNorm(0.65);
    setPreviewSrc(null);
    setRenderError("");
    setImageDims(null);
    setUploadErrorOnInsert("");
    setIsUploading(false);
  }, []);

  // ── Step 1: Handle logo upload ───────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reuse the same validation logic as furniture uploads
    const validatePNG = (fileToCheck: File): Promise<string | null> => {
      return new Promise((resolve) => {
        if (fileToCheck.type !== "image/png") {
          resolve(t("logo.pngOnly"));
          return;
        }
        const img = new Image();
        const url = URL.createObjectURL(fileToCheck);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let hasTransparency = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
              hasTransparency = true;
              break;
            }
          }
          URL.revokeObjectURL(url);
          if (!hasTransparency) {
            resolve(t("logo.transparentRequired"));
          } else {
            resolve(null);
          }
        };
        img.src = url;
      });
    };

    validatePNG(file).then((err) => {
      if (err) {
        setUploadError(err);
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setLogoDataUrl(reader.result as string);
        setLogoFileName(file.name);
        setUploadError("");
        setStep(2);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });
  }, [t]);

  // Load selected furniture image to know natural dimensions
  useEffect(() => {
    if (!selectedFurniture) {
      setImageDims(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageDims({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    };
    img.onerror = () => {
      setImageDims(null);
    };
    img.src = selectedFurniture.views.front;
  }, [selectedFurniture]);

  // ── Step 3: Live preview rendering with applyLogoToFurniture ────────────────
  useEffect(() => {
    if (!selectedFurniture || !logoDataUrl || !imageDims) {
      setPreviewSrc(null);
      return;
    }

    const furnitureSrc = selectedFurniture.views.front;
    const { w, h } = imageDims;
    const clampedSize = Math.min(Math.max(sizePercent, 0.1), 0.4);

    // Map normalized drag position into pixel coordinates on the natural image
    const logoW = w * clampedSize;
    const logoH = h * clampedSize; // approximate while preserving aspect in util
    const maxX = Math.max(w - logoW, 0);
    const maxY = Math.max(h - logoH, 0);
    const x = maxX * logoXNorm;
    const y = maxY * logoYNorm;

    const version = ++renderVersionRef.current;
    setIsRendering(true);
    setRenderError("");

    applyLogoToFurniture(furnitureSrc, logoDataUrl, {
      x,
      y,
      sizePercent: clampedSize,
      opacity: Math.min(Math.max(opacity, 0.5), 1),
    })
      .then((dataUrl) => {
        if (renderVersionRef.current === version) {
          setPreviewSrc(dataUrl);
        }
      })
      .catch(() => {
        if (renderVersionRef.current === version) {
          setRenderError(t("logo.renderFailed"));
        }
      })
      .finally(() => {
        if (renderVersionRef.current === version) {
          setIsRendering(false);
        }
      });
  }, [selectedFurniture, logoDataUrl, imageDims, sizePercent, opacity, logoXNorm, logoYNorm, t]);

  // Drag handlers over interactive furniture preview
  const handleLogoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactiveRef.current) return;
    const rect = interactiveRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    dragStateRef.current = {
      dragging: true,
      offsetX: startX,
      offsetY: startY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLogoPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactiveRef.current || !dragStateRef.current?.dragging) return;
    const rect = interactiveRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clampedX = Math.min(Math.max(x, 0), rect.width);
    const clampedY = Math.min(Math.max(y, 0), rect.height);

    setLogoXNorm(clampedX / rect.width);
    setLogoYNorm(clampedY / rect.height);
  };

  const handleLogoPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleApplyAndInsert = useCallback(async () => {
    if (!selectedFurniture || !logoDataUrl || !imageDims || !token) return;
    const furnitureSrc = selectedFurniture.views.front;
    const { w, h } = imageDims;
    const clampedSize = Math.min(Math.max(sizePercent, 0.1), 0.4);

    const logoW = w * clampedSize;
    const logoH = h * clampedSize;
    const maxX = Math.max(w - logoW, 0);
    const maxY = Math.max(h - logoH, 0);
    const x = maxX * logoXNorm;
    const y = maxY * logoYNorm;

    setIsUploading(true);
    setUploadErrorOnInsert("");
    try {
      const final = await applyLogoToFurniture(furnitureSrc, logoDataUrl, {
        x,
        y,
        sizePercent: clampedSize,
        opacity: Math.min(Math.max(opacity, 0.5), 1),
      });
      const cloudinaryUrl = await uploadImage(final, "branded", token);
      onInsert(selectedFurniture, cloudinaryUrl);
      setOpen(false);
      reset();
    } catch {
      setUploadErrorOnInsert(t("logo.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  }, [
    selectedFurniture,
    logoDataUrl,
    imageDims,
    sizePercent,
    opacity,
    logoXNorm,
    logoYNorm,
    onInsert,
    reset,
    token,
    t,
  ]);

  const currentStepLabel =
    step === 1 ? t("logo.stepUpload") : step === 2 ? t("logo.stepSelect") : step === 3 ? t("logo.stepAdjust") : t("logo.stepDone");

  return (
    <div className="relative">
      {/* Toggle button */}
      <motion.button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            setStep(1);
          }
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(15,118,110,0.88) 0%, rgba(52,211,153,0.80) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(52,211,153,0.35)",
          boxShadow: "0 4px 24px rgba(15,118,110,0.25)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="font-bold text-[13px] leading-none mb-0.5">{t("logo.title")}</div>
            <div className="text-[10px] font-medium text-white/70 leading-none">
              {open ? t("logo.collapse") : t("logo.subtitle")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            {t("logo.step")} {step <= 3 ? step : 3} {t("logo.of3")}
          </span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-white/80" />
          </motion.div>
        </div>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden mt-2 rounded-2xl flex flex-col"
            style={{
              background: "rgba(10, 18, 16, 0.96)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(52,211,153,0.15)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-2 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest">
                  {t("logo.title")} · {currentStepLabel}
                </p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col gap-4">
              {/* Step 1 – Upload logo */}
              {step === 1 && (
                <>
                  <p className="text-[11px] text-white/60">
                    {t("logo.uploadIntro")}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400/40 bg-white/5 hover:bg-white/10 transition-all py-6"
                  >
                    <Upload className="w-6 h-6 text-emerald-300" />
                    <span className="text-[12px] font-semibold text-white/90">{t("logo.uploadPng")}</span>
                    <span className="text-[10px] text-white/40">{t("logo.pngNote")}</span>
                  </button>
                  {uploadError && <p className="text-[10px] text-red-400">{uploadError}</p>}
                </>
              )}

              {/* Step 2 – Select furniture */}
              {step === 2 && logoDataUrl && (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoDataUrl} alt={t("logo.logoPreviewAlt")} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-white truncate">
                        {logoFileName || t("logo.logoUploaded")}
                      </div>
                      <div className="text-[10px] text-white/45">{t("logo.step2Choose")}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 max-h-56 overflow-y-auto scrollbar-hide">
                    {/* Default furniture section */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                          {t("logo.defaultFurniture")}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {catalogItems.map((item) => {
                          const selected = selectedFurnitureId === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setSelectedFurnitureId(item.id)}
                              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                                selected
                                  ? "border-emerald-400 bg-emerald-500/15"
                                  : "border-white/10 bg-white/5 hover:border-white/25"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.views.front}
                                alt={item.label}
                                className="w-12 h-12 object-contain mb-0.5"
                              />
                              <span className="text-[10px] text-white/80 text-center leading-tight line-clamp-2">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom furniture section */}
                    {customItems.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-emerald-300" />
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                              {t("logo.myCustomFurniture")}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {customItems.map((item) => {
                            const selected = selectedFurnitureId === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => setSelectedFurnitureId(item.id)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                                  selected
                                    ? "border-emerald-400 bg-emerald-500/15"
                                    : "border-white/10 bg-white/5 hover:border-white/25"
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.views.front}
                                  alt={item.label}
                                  className="w-12 h-12 object-contain mb-0.5"
                                />
                                <span className="text-[10px] text-white/80 text-center leading-tight line-clamp-2">
                                  {item.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-white/35 leading-relaxed">
                        {t("logo.customHint")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setStep(1);
                      }}
                      className="flex-none px-3 py-2 rounded-xl text-[11px] font-semibold text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t("logo.back")}
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setStep(3)}
                      disabled={!selectedFurnitureId}
                      className="flex-1 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(135deg, #0f766e, #34d399)",
                        boxShadow: "0 4px 14px rgba(15,118,110,0.35)",
                      }}
                    >
                      {t("logo.nextAdjust")}
                    </motion.button>
                  </div>
                </>
              )}

              {/* Step 3 – Adjust & preview */}
              {step === 3 && logoDataUrl && selectedFurniture && (
                <>
                  <div className="flex flex-col gap-3">
                    <div
                      ref={interactiveRef}
                      className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center"
                      style={{
                        backgroundImage: `url(${selectedFurniture.views.front})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    >
                      {/* Draggable logo handle */}
                      <div
                        onPointerDown={handleLogoPointerDown}
                        onPointerMove={handleLogoPointerMove}
                        onPointerUp={handleLogoPointerUp}
                        onPointerCancel={handleLogoPointerUp}
                        className="absolute w-14 h-14 rounded-xl bg-emerald-500/70 border border-white/70 flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${logoXNorm * 100}%`,
                          top: `${logoYNorm * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <Move className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/50 font-semibold uppercase tracking-wider block mb-1.5">
                          {t("logo.size")} · {Math.round(sizePercent * 100)}%
                        </label>
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300" />
                          <input
                            type="range"
                            min={10}
                            max={40}
                            step={2}
                            value={Math.round(sizePercent * 100)}
                            onChange={(e) => setSizePercent(Number(e.target.value) / 100)}
                            className="w-full accent-emerald-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 font-semibold uppercase tracking-wider block mb-1.5">
                          {t("logo.opacity")} · {Math.round(opacity * 100)}%
                        </label>
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-300" />
                          <input
                            type="range"
                            min={50}
                            max={100}
                            step={5}
                            value={Math.round(opacity * 100)}
                            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                            className="w-full accent-emerald-400"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                        {t("logo.livePreview")}
                      </span>
                      {isRendering && (
                        <span className="text-[10px] text-emerald-300">{t("logo.rendering")}</span>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                        {previewSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewSrc}
                            alt={t("logo.brandedPreviewAlt")}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-white/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-white truncate">
                          {selectedFurniture.label}
                        </p>
                        <p className="text-[10px] text-white/45">
                          {t("logo.positionHint")}
                        </p>
                      </div>
                    </div>
                    {renderError && <p className="text-[10px] text-red-400">{renderError}</p>}
                    {uploadErrorOnInsert && (
                      <p className="text-[10px] text-red-400">{uploadErrorOnInsert}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setStep(2)}
                        className="flex-none px-3 py-2 rounded-xl text-[11px] font-semibold text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t("logo.back")}
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleApplyAndInsert}
                        disabled={isRendering || isUploading}
                        className="flex-1 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: "linear-gradient(135deg, #0f766e, #34d399)",
                          boxShadow: "0 4px 14px rgba(15,118,110,0.35)",
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isUploading ? t("logo.uploading") : t("logo.applyInsert")}
                      </motion.button>
                    </div>
                  </div>
                </>
              )}

              {/* Step 4 – Done (brief confirmation if we ever keep panel open) */}
              {step === 4 && (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-[12px] text-white/80 text-center">
                    {t("logo.doneMessage")}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

