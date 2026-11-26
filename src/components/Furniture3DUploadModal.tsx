"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Plus, Check, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const MAX_GLB_BYTES = 5 * 1024 * 1024;

interface Furniture3DUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: {
    id: string;
    label: string;
    glbPath: string;
    price: number;
    createdAt: string;
  }) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Furniture3DUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: Furniture3DUploadModalProps) {
  const { token, updateUser } = useAuth();
  const { t } = useLanguage();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileIsValid = useMemo(() => {
    if (!file) return false;
    if (!file.name.toLowerCase().endsWith(".glb")) return false;
    if (file.size > MAX_GLB_BYTES) return false;
    return true;
  }, [file]);

  const priceIsValid = useMemo(() => {
    if (price.trim() === "") return false;
    const n = Number(price);
    return Number.isFinite(n) && n >= 0;
  }, [price]);

  const canImport = Boolean(label.trim() && priceIsValid && fileIsValid && !loading);

  const validateFile = (selected: File | null): string | null => {
    if (!selected) return null;
    if (!selected.name.toLowerCase().endsWith(".glb")) {
      return t("furn3dUpload.glbOnly");
    }
    if (selected.size > MAX_GLB_BYTES) {
      return `${t("furn3dUpload.fileTooLarge")} (${formatFileSize(selected.size)}). ${t("furn3dUpload.maxSize5mb")}`;
    }
    return null;
  };

  const handleFileChange = (selected: File | null) => {
    setSuccess(null);
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }

    const validationError = validateFile(selected);
    if (validationError) {
      setFile(selected);
      setFileError(validationError);
      setError(null);
      return;
    }

    setFile(selected);
    setFileError(null);
    setError(null);
  };

  const handleImport = async () => {
    if (!label.trim()) {
      setError(t("furn3dUpload.nameRequired"));
      return;
    }
    if (!priceIsValid) {
      setError(t("furn3dUpload.validPriceRequired"));
      return;
    }
    if (!file) {
      setError(t("furn3dUpload.selectGlb"));
      return;
    }
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError(t("furn3dUpload.glbOnly"));
      return;
    }
    if (file.size > MAX_GLB_BYTES) {
      setError(`${t("furn3dUpload.fileTooLarge")} (${formatFileSize(file.size)}). ${t("furn3dUpload.maxSize5mb")}`);
      return;
    }
    if (!token) {
      setError(t("furn3dUpload.loginRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "furniture-3d");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || t("furn3dUpload.uploadFailed"));

      const saveRes = await fetch("/api/furniture/3d", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: label.trim(),
          price: Number(price),
          glbPath: uploadData.url as string,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || t("furn3dUpload.saveFailed"));

      if (saveData.user) {
        updateUser(saveData.user);
      }

      const imported = saveData.item as {
        id: string;
        label: string;
        glbPath: string;
        price: number;
        createdAt: string;
      };

      window.dispatchEvent(
        new CustomEvent("add3DFurniture", {
          detail: { label: imported.label, glbPath: imported.glbPath },
        })
      );

      setSuccess(`${imported.label} ${t("furn3dUpload.importedSuccessfully")}`);
      onSuccess({
        id: imported.id,
        label: imported.label,
        glbPath: imported.glbPath,
        price: imported.price,
        createdAt: imported.createdAt,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("furn3dUpload.importFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLabel("");
    setPrice("");
    setFile(null);
    setFileError(null);
    setError(null);
    setSuccess(null);
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
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{t("furn3dUpload.title")}</h2>
              <p className="text-sm text-white/50">{t("furn3dUpload.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/70 ml-1">
                  {t("furn3dUpload.nameLabel")} <span className="text-coral-400">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("furn3dUpload.namePlaceholder")}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-coral-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white/70 ml-1">
                  {t("furn3dUpload.priceLabel")} <span className="text-coral-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-bold">
                    €
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-coral-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-white/70 ml-1">
                {t("furn3dUpload.glbLabel")} <span className="text-coral-400">*</span>
              </label>
              <div
                className={`relative rounded-2xl border-2 border-dashed transition-all p-6 ${
                  file && fileIsValid
                    ? "border-green-500/50 bg-green-500/5"
                    : file && fileError
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-white/10 hover:border-white/20 bg-white/5"
                }`}
              >
                {!file ? (
                  <label className="flex flex-col items-center justify-center cursor-pointer text-center gap-3 py-4">
                    <input
                      type="file"
                      className="hidden"
                      accept=".glb,model/gltf-binary"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                    <Upload className="w-8 h-8 text-white/20" />
                    <div>
                      <p className="text-sm font-semibold text-white/70">{t("furn3dUpload.uploadGlb")}</p>
                      <p className="text-xs text-white/40 mt-1">
                        {t("furn3dUpload.uploadHint")}
                      </p>
                    </div>
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {fileIsValid ? (
                          <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                          <p className="text-xs text-white/50">{formatFileSize(file.size)}</p>
                          {fileIsValid && (
                            <p className="text-xs text-green-400 mt-1">{t("furn3dUpload.readyToImport")}</p>
                          )}
                          {fileError && <p className="text-xs text-red-400 mt-1">{fileError}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileChange(null)}
                        className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

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

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
              >
                <Check className="w-5 h-5 shrink-0" />
                <p>{success}</p>
              </motion.div>
            )}

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <p className="text-[11px] font-medium text-white/40 flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" /> {t("furn3dUpload.acceptsGlbOnly")}
              </p>
              <p className="text-[11px] font-medium text-white/40 flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" /> {t("furn3dUpload.maxFileSize")}
              </p>
              <p className="text-[11px] font-medium text-white/40">
                {t("furn3dUpload.uploadHint")}
              </p>
            </div>
          </div>

          <div className="px-8 py-6 bg-white/5 border-t border-white/5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
            >
              {t("furn3dUpload.cancel")}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="btn-primary flex items-center gap-2 !rounded-xl !px-8 !py-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("furn3dUpload.importing")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t("furn3dUpload.importButton")}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
