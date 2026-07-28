// Rewritten file: previous version contained escaped quotes (\\\") that broke parsing.

import { useState, useCallback, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { uploadImage } from "@/lib/uploadImageClient";

export interface SceneImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (scene: {
    name: string;
    src: string;
    width: number;
    height: number;
  }) => void;
}

export async function validate360Scene(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve("Please upload a JPG or PNG image file.");
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      resolve("File too large. Maximum size is 150MB.");
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < 1024) {
        resolve(`Image too small (${img.width}×${img.height}px). Minimum width is 1024px.`);
        return;
      }
      const ratio = img.width / img.height;
      if (ratio < 1.9 || ratio > 2.1) {
        resolve(
          `Not a valid 360° panorama. Your image is ${img.width}×${img.height}px ` +
            `(ratio ${ratio.toFixed(2)}:1). Required ratio is 2:1 — e.g. 4096×2048.`
        );
        return;
      }
      resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Could not read file.");
    };
    img.src = url;
  });
}

async function compressScene(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      // Target max width 4096px (keeps 2:1 ratio)
      const MAX_WIDTH = 4096;
      const w = Math.min(img.width, MAX_WIDTH);
      const h = Math.round((w / img.width) * img.height);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

      // Compress as JPEG at 0.82 quality
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = url;
  });
}

function estimateBytesFromDataUrl(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  // base64 length to bytes approximation
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function SceneImportModal({ isOpen, onClose, onImport }: SceneImportModalProps) {
  const inputId = useId();
  const { token } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [sceneName, setSceneName] = useState("");
  const [importing, setImporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedBytes, setCompressedBytes] = useState<number | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setFile(null);
    setError(null);
    setDims(null);
    setSceneName("");
    setImporting(false);
    setCompressedBytes(null);
    setIsEstimating(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    setError(null);
    setFile(null);
    setDims(null);

    const validationError = await validate360Scene(f);
    if (validationError) {
      setError(validationError);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      setDims({ width: img.width, height: img.height });
      setFile(f);
      setSceneName(f.name.replace(/\.[^.]+$/, "") || "Imported Scene");
      const p = URL.createObjectURL(f);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return p;
      });
      setStep(2);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read file.");
    };
    img.src = url;
  }, []);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    void handleFile(f);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    void handleFile(f);
  };

  const handleImport = () => {
    if (!file || !dims) return;
    if (!token) {
      setError("You must be signed in to import a scene.");
      return;
    }
    setImporting(true);
    setError(null);
    compressScene(file)
      .then((dataUrl) => uploadImage(dataUrl, "custom-scenes", token))
      .then((src) => {
        onImport({ name: sceneName || "Imported Scene", src, width: dims.width, height: dims.height });
        reset();
      })
      .catch(() => {
        setError("Failed to upload scene image. Please try again.");
        setImporting(false);
      });
  };

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Estimate compressed size in preview step (for user feedback).
  useEffect(() => {
    let cancelled = false;
    if (step !== 2 || !file) {
      setCompressedBytes(null);
      setIsEstimating(false);
      return;
    }
    setIsEstimating(true);
    compressScene(file)
      .then((dataUrl) => {
        if (cancelled) return;
        setCompressedBytes(estimateBytesFromDataUrl(dataUrl));
      })
      .catch(() => {
        if (cancelled) return;
        setCompressedBytes(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsEstimating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, file]);

  const ratio = dims ? dims.width / dims.height : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-full max-w-xl rounded-2xl bg-black/80 text-white border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <p className="text-xs font-medium text-white/60 uppercase tracking-[0.18em]">Import 360° Scene</p>
                <p className="text-sm text-white/80">
                  {step === 1 ? "Upload equirectangular panorama" : "Preview & confirm import"}
                </p>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <span className={step === 1 ? "font-semibold text-white" : ""}>1. Upload</span>
                <span className="w-6 h-px bg-white/15" />
                <span className={step === 2 ? "font-semibold text-white" : ""}>2. Preview & Import</span>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div
                    onDrop={onDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border border-dashed border-white/25 rounded-2xl px-6 py-8 text-center cursor-pointer hover:border-white/60 transition-colors bg-white/5"
                    onClick={() => document.getElementById(inputId)?.click()}
                  >
                    <input
                      id={inputId}
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={onFileInput}
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <UploadCloud className="w-5 h-5 text-white/80" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Drop your 360° JPG or PNG here</p>
                        <p className="text-[11px] text-white/55 mt-1">Equirectangular 2:1 panoramas only · Max 150MB</p>
                      </div>
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center px-3 py-1.5 rounded-full border border-white/25 text-[11px] font-medium text-white/80 hover:bg-white/10"
                      >
                        Browse Files
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 border border-red-500/40 px-3 py-2.5 text-[11px] text-red-100">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-0.5">There&apos;s a problem with this file</p>
                        <p>{error}</p>
                        <p className="mt-1 text-red-200/80">
                          Tip: Export an equirectangular panorama at 2:1 ratio, e.g. 4096×2048 or 8192×4096.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 text-[10px] text-white/60">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-full h-10 rounded-md bg-gradient-to-r from-emerald-500/50 to-emerald-400/40 border border-emerald-400/60 flex items-center justify-center text-[9px] font-semibold text-emerald-50">
                        2:1
                      </div>
                      <span>360° panorama ✓</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-full h-10 rounded-md bg-white/10 border border-white/20 flex items-center justify-center text-[9px] font-semibold text-white/70">
                        3:4
                      </div>
                      <span>Normal photo ✗</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-full h-10 rounded-md bg-white/10 border border-white/20 flex items-center justify-center text-[9px] font-semibold text-white/70">
                        1:1
                      </div>
                      <span>Square photo ✗</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && file && dims && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-white/15 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl ?? ""} alt="Preview" className="w-full max-h-[150px] object-cover" />
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/60 text-emerald-200 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Valid 360° panorama
                    </span>
                    <span className="text-white/60">
                      {dims.width}×{dims.height}px · {formatBytes(file.size)} · ratio {ratio ? ratio.toFixed(2) : "—"}:1
                    </span>
                  </div>

                  <div className="text-[10px] text-white/45">
                    Original: {formatBytes(file.size)} → Compressed:{" "}
                    {isEstimating ? "estimating…" : compressedBytes ? `~${formatBytes(compressedBytes)}` : "—"}
                  </div>

                  {dims.width < 2048 && (
                    <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 border border-amber-400/50 px-3 py-2.5 text-[11px] text-amber-100">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-0.5">Low resolution — may appear blurry</p>
                        <p>Recommended: 2048×1024 minimum.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[11px] font-medium text-white/70">Scene name</label>
                    <input
                      type="text"
                      value={sceneName}
                      onChange={(e) => setSceneName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
                      placeholder="e.g. Imported Lobby 360"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[11px] px-3 py-1.5 rounded-xl border border-white/20 text-white/80 hover:bg-white/10"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={importing}
                      onClick={handleImport}
                      className="text-[11px] px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-zinc-100 disabled:opacity-60"
                    >
                      {importing ? "Importing…" : "Import Scene"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
