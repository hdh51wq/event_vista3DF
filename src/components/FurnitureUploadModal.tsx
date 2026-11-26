"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Plus, Check, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface FurnitureUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FurnitureUploadModal({ isOpen, onClose, onSuccess }: FurnitureUploadModalProps) {
  const { token, updateUser } = useAuth();
  const { t } = useLanguage();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("0");
  const [files, setFiles] = useState<Record<string, File | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewLabel = (view: string): string =>
    view === "front"
      ? t("furnUpload.viewFront")
      : view === "back"
        ? t("furnUpload.viewBack")
        : view === "left"
          ? t("furnUpload.viewLeft")
          : t("furnUpload.viewRight");

  function validatePNG(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      if (file.type !== "image/png") {
        resolve(t("furnUpload.pngOnly"));
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
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
          resolve(
            t("furnUpload.transparentRequired")
          );
        } else {
          resolve(null); // valid
        }
      };
      img.src = url;
    });
  }

  const handleFileChange = async (view: string, file: File | null) => {
    if (!file) return;

    // Validate PNG-24 with transparency
    const validationError = await validatePNG(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(`${t("furnUpload.fileTooLargeFor")} ${viewLabel(view)}. ${t("furnUpload.max5mb")}`);
      return;
    }

    setError(null);
    setFiles((prev) => ({ ...prev, [view]: file }));
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviews((prev) => ({ ...prev, [view]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!label) {
      setError(t("furnUpload.nameRequired"));
      return;
    }
    if (!files.front) {
      setError(t("furnUpload.frontRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("label", label);
      formData.append("price", price);
      Object.entries(files).forEach(([key, file]) => {
        if (file) formData.append(key, file);
      });

      const response = await fetch("/api/furniture/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("furnUpload.uploadFailed"));
      }

      // Update local user data with the new custom furniture
      if (data.user) {
        updateUser(data.user);
      }
      
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLabel("");
    setFiles({ front: null, back: null, left: null, right: null });
    setPreviews({});
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-zinc-900/90 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
          style={{ backdropFilter: "blur(20px)" }}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{t("furnUpload.title")}</h2>
              <p className="text-sm text-white/50">{t("furnUpload.subtitle")}</p>
            </div>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* Name input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/70 ml-1">{t("furnUpload.nameLabel")}</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("furnUpload.namePlaceholder")}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-coral-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/70 ml-1">{t("furnUpload.priceLabel")}</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-bold">$</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-coral-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Upload sections */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-white/70 ml-1">{t("furnUpload.viewOrientations")}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {["front", "back", "left", "right"].map((view) => (
                  <div key={view} className="space-y-2">
                    <div
                      className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-2 text-center group ${
                        files[view]
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-white/10 hover:border-white/20 bg-white/5"
                      }`}
                    >
                      {previews[view] ? (
                        <div className="relative w-full h-full">
                          <img
                            src={previews[view]}
                            alt={viewLabel(view)}
                            className="w-full h-full object-contain"
                          />
                          <button
                            onClick={() => setFiles((prev) => ({ ...prev, [view]: null }))}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/png"
                            onChange={(e) => void handleFileChange(view, e.target.files?.[0] || null)}
                          />
                          <Upload className="w-6 h-6 text-white/20 mb-2 group-hover:text-white/40 transition-colors" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                            {viewLabel(view)}
                            {view === "front" && <span className="text-coral-400 font-bold ml-1">*</span>}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Validation Feedback */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <p className="text-[11px] font-medium text-white/40 flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" /> {t("furnUpload.transparentRecommended")}
              </p>
              <p className="text-[11px] font-medium text-white/40 flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" /> {t("furnUpload.maxFileSize")}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-white/5 border-t border-white/5 flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
            >
              {t("furnUpload.cancel")}
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !label || !files.front}
              className="btn-primary flex items-center gap-2 !rounded-xl !px-8 !py-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("furnUpload.uploading")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t("furnUpload.saveToLibrary")}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
